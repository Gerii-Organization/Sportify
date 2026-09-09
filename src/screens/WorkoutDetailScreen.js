import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform, FlatList, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronLeft, Edit3, Plus, X, Play, CheckCircle2, Circle, Clock, 
  Save, Trash2, Zap, Star, Flame, ChevronUp, ChevronDown, Globe, Lock, Info, Weight, Image as ImageIcon 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { EXERCISES, MUSCLES } from '../constants/exercises';
import { randomMotivationalMessage } from '../constants/content';
import { formatStopwatch } from '../lib/date';
import { gradients } from '../theme';
import RestTimer, { restSecondsFor } from '../components/RestTimer';
import { useAuth } from '../context/AuthContext';
import PersonalRecordCard from '../components/PersonalRecordCard';
import { AchievementIcon } from '../lib/achievements';
import { scheduleRestAlert, cancelRestAlert } from '../lib/restNotification';
import Button from '../components/Button';
import PlateSheet from '../components/PlateSheet';
import { pickAndUploadImage } from '../lib/upload';
import { deviceTimeZone } from '../lib/date';


export default function WorkoutDetailScreen({ route, navigation }) {
  const { user, profile, refreshProfile } = useAuth();
  const workout = route?.params?.workout;
  const onSave = route?.params?.onSave;
  /** Chosen from the workouts screen's edit mode, so it opens ready to change
   *  rather than making you press the pencil a second time. */
  const startInEdit = route?.params?.startInEdit;

  const [currentWorkout, setCurrentWorkout] = useState(workout || { name: '', exercises: [] });
  const [mode, setMode] = useState(startInEdit ? 'editing' : 'idle');
  const [timer, setTimer] = useState(0);
  const [isExerciseSelectorVisible, setIsExerciseSelectorVisible] = useState(false);
  /** Which exercise has its form cue open in the picker. */
  const [cueFor, setCueFor] = useState(null);
  const [plateSheetVisible, setPlateSheetVisible] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState(null);

  // Recomputed only when the search or filter changes, not on every keystroke
  // elsewhere in the screen.
  const visibleExercises = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase();
    return EXERCISES.filter(
      (ex) =>
        (!muscleFilter || ex.muscle === muscleFilter) &&
        (!query || ex.name.toLowerCase().includes(query))
    );
  }, [exerciseQuery, muscleFilter]);

  /** Heaviest weight entered anywhere in this workout, as the sheet's default. */
  const heaviestWeight = useMemo(() => {
    let max = 0;
    (currentWorkout.exercises || []).forEach((ex) =>
      (ex.sets || []).forEach((set) => {
        const w = parseFloat(set.weight);
        if (Number.isFinite(w) && w > max) max = w;
      })
    );
    return max || '';
  }, [currentWorkout]);

  const [showSummary, setShowSummary] = useState(false);
  /** Row id of the session just written, so a note can be attached to it. */
  const [completionId, setCompletionId] = useState(null);
  const [note, setNote] = useState('');
  /** Timestamp the current rest period ends, or null when not resting. */
  const [restEndsAt, setRestEndsAt] = useState(null);
  /** Id of the pending local notification, so it can be cancelled. */
  const restAlertId = useRef(null);
  const [workoutStats, setWorkoutStats] = useState({ volume: 0, time: 0, message: '', xpGained: 50, energyGained: 0, isFirstWorkoutToday: false, newStreak: 0, records: [], achievements: [] });

  useEffect(() => {
    if (!workout) {
      navigation.replace('MainTabs');
    }
  }, [workout, navigation]);

  useEffect(() => () => cancelRestAlert(restAlertId.current), []);

  useEffect(() => {
    let interval;
    if (mode === 'started') interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [mode]);

  if (!workout) {
    return <View style={styles.container} />;
  }



  /** Attaches the note to the session. Blank clears it, server-side. */
  const saveNote = async () => {
    if (!completionId) return;
    const { error } = await supabase.rpc('set_workout_note', {
      p_completion_id: completionId,
      p_note: note,
    });
    if (error) console.warn(`[Sportify] Could not save note: ${error.message}`);
  };

  /**
   * Sets the workout's cover photo.
   *
   * Stored at <user-id>/<workout-id>.jpg and overwritten in place, so changing
   * it five times leaves one file rather than five orphans. WorkoutCard already
   * falls back to a generated cover when there is none, so this only ever
   * replaces the fallback.
   */
  const pickCover = async () => {
    if (uploadingCover) return;
    setUploadingCover(true);

    try {
      const result = await pickAndUploadImage({
        bucket: 'workout_covers',
        pathPrefix: `${user.id}/${currentWorkout.id}`,
      });

      if (result) {
        const { error } = await supabase
          .from('user_workouts')
          .update({ cover_url: result.url })
          .eq('id', currentWorkout.id);

        if (error) throw error;
        setCurrentWorkout((w) => ({ ...w, cover_url: result.url }));
        if (onSave) onSave({ ...currentWorkout, cover_url: result.url });
      }
    } catch (e) {
      Alert.alert('Could not set the cover', e.message);
    }

    setUploadingCover(false);
  };

  /**
   * Publish or unpublish. A public workout appears in Browse for everyone, so
   * the confirmation names what actually becomes visible — the plan, not your
   * logged weights, which copy_workout strips.
   */
  const togglePublic = async () => {
    const next = !currentWorkout.is_public;

    const apply = async () => {
      const { error } = await supabase
        .from('user_workouts')
        .update({ is_public: next })
        .eq('id', currentWorkout.id);

      if (error) return Alert.alert('Could not change this', error.message);
      setCurrentWorkout((w) => ({ ...w, is_public: next }));
    };

    if (!next) return apply();

    Alert.alert(
      'Share this workout?',
      'Anyone can find it in Browse and add it to their own list. They get the exercises and set count — not your weights or reps.',
      [
        { text: 'Keep private', style: 'cancel' },
        { text: 'Share', onPress: apply },
      ]
    );
  };

  const toggleEditMode = async () => {
    if (mode === 'editing') {
      const { error } = await supabase
        .from('user_workouts')
        .update({ exercises: currentWorkout.exercises })
        .eq('id', currentWorkout.id);

      if (error) {
        Alert.alert("Save Error", error.message);
      } else {
        setMode('idle');
        if (onSave) onSave(currentWorkout);
      }
    } else {
      setMode('editing');
    }
  };

  const moveExerciseUp = (index) => {
    if (index === 0) return;
    const newExercises = [...currentWorkout.exercises];
    const temp = newExercises[index - 1];
    newExercises[index - 1] = newExercises[index];
    newExercises[index] = temp;
    setCurrentWorkout({ ...currentWorkout, exercises: newExercises });
  };

  const moveExerciseDown = (index) => {
    if (index === currentWorkout.exercises.length - 1) return;
    const newExercises = [...currentWorkout.exercises];
    const temp = newExercises[index + 1];
    newExercises[index + 1] = newExercises[index];
    newExercises[index] = temp;
    setCurrentWorkout({ ...currentWorkout, exercises: newExercises });
  };

  const updateSetData = (exerciseId, setId, field, value) => {
    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) };
      return ex;
    });
    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
  };

  const addSetToExercise = (exerciseId) => {
    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        const lastSet = ex.sets.length > 0 ? ex.sets[ex.sets.length - 1] : null;
        const newSet = { id: Math.random().toString(), weight: lastSet ? lastSet.weight : '', reps: lastSet ? lastSet.reps : '', prev: '-', completed: false };
        return { ...ex, sets: [...ex.sets, newSet] };
      }
      return ex;
    });
    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
  };

  const addNewExercise = (exercise) => {
    const newExercise = {
      id: Math.random().toString(),
      name: exercise.name,
      // StatsScreen groups training by `muscle`. It was never written, which is
      // why "Primary Muscle Group" always read "More data needed".
      muscle: exercise.muscle,
      sets: [{ id: Math.random().toString(), weight: '', reps: '', prev: '-', completed: false }],
    };
    setCurrentWorkout({ ...currentWorkout, exercises: [...(currentWorkout.exercises || []), newExercise] });
    setIsExerciseSelectorVisible(false);
    setExerciseQuery('');
    setMuscleFilter(null);
  };

  const confirmDeleteExercise = (exId) => {
    Alert.alert("Remove Exercise", "Remove this exercise from the workout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setCurrentWorkout({ ...currentWorkout, exercises: currentWorkout.exercises.filter(ex => ex.id !== exId) }) }
    ]);
  };

  const confirmDeleteSet = (exId, setId) => {
    Alert.alert("Remove Set", "Delete this set?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const updated = currentWorkout.exercises.map(ex => {
          if (ex.id === exId) return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
          return ex;
        });
        setCurrentWorkout({ ...currentWorkout, exercises: updated });
      }}
    ]);
  };

  const toggleSetCompletion = (exerciseId, setId) => {
    if (mode !== 'started') return;

    let startedResting = false;
    const updatedExercises = currentWorkout.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set) => {
          if (set.id !== setId) return set;
          // Only when ticking ON — un-ticking a set is a correction, not a
          // finished set, so it should not start a rest period.
          if (!set.completed) startedResting = true;
          return { ...set, completed: !set.completed };
        }),
      };
    });

    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });

    if (startedResting) {
      const seconds = restSecondsFor(profile?.goal);
      setRestEndsAt(Date.now() + seconds * 1000);

      // Replace any alert still pending from the previous set.
      cancelRestAlert(restAlertId.current);
      scheduleRestAlert(seconds).then((id) => { restAlertId.current = id; });
    }
  };

  const handleFinishWorkout = async () => {
    const allSets = currentWorkout.exercises.flatMap((ex) => ex.sets);
    const doneSets = allSets.filter((s) => s.completed);

    if (doneSets.length === 0) {
      Alert.alert('Nothing logged yet', 'Mark at least one set as done before finishing.', [{ text: 'OK' }]);
      return;
    }

    // A session can legitimately be cut short — a busy gym, a phone call, an
    // injury. Log what was actually done and scale the reward to match, rather
    // than refusing to save anything at all.
    if (doneSets.length < allSets.length) {
      const remaining = allSets.length - doneSets.length;
      Alert.alert(
        'Finish early?',
        `You have ${remaining} set${remaining === 1 ? '' : 's'} left. You can save what you have done and come back to the rest another time.`,
        [
          { text: 'Keep training', style: 'cancel' },
          { text: 'Save and finish', onPress: () => processWorkoutCompletion(doneSets.length, allSets.length) },
        ]
      );
      return;
    }

    // Guard against a full workout being 'finished' in seconds. This is a
    // nudge, not a lockout — the user decides.
    const minRealisticSeconds = doneSets.length * 20;
    if (timer < minRealisticSeconds) {
      Alert.alert(
        'That was quick',
        `${doneSets.length} sets in ${formatStopwatch(timer)}. If that is right, go ahead — otherwise keep the timer running.`,
        [
          { text: 'Keep training', style: 'cancel' },
          { text: 'Save anyway', onPress: () => processWorkoutCompletion(doneSets.length, allSets.length) },
        ]
      );
      return;
    }

    processWorkoutCompletion(doneSets.length, allSets.length);
  };

  const processWorkoutCompletion = async (setsDone, setsTotal) => {
    setMode('idle');

    // A snapshot of what was actually lifted, sent with the completion.
    //
    // Only the finished session used to be recorded — name, minutes, time — so
    // "total weight lifted" had to be recomputed from the workout template.
    // Templates get edited, which rewrote history: drop the bar 10kg today and
    // last month's numbers moved with it. The sets are now stored alongside the
    // session, and nothing after the fact can change them.
    const performed = currentWorkout.exercises
      .map((ex) => ({
        name: ex.name,
        muscle: ex.muscle || null,
        sets: ex.sets
          .filter((set) => set.completed && set.weight && set.reps)
          .map((set) => ({ weight: Number(set.weight), reps: Number(set.reps) })),
      }))
      .filter((ex) => ex.sets.length > 0);

    const totalKg = performed.reduce(
      (total, ex) => total + ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
      0
    );

    const randomMsg = randomMotivationalMessage();
    const elapsedMinutes = Math.max(1, Math.ceil(timer / 60));

    // Everything below used to happen here: read the profile, compute the new
    // streak and rewards in JavaScript, write them back. That is the same
    // read-modify-write shape that let the daily spin wipe people's XP, and it
    // put the streak rules inside a client anyone can edit.
    //
    // One call now does the history write, the streak (including spending a
    // Streak Freeze on a missed day) and the rewards, in a single transaction.
    const completionRatio = setsTotal > 0 ? setsDone / setsTotal : 1;
    let finalXP = 0;
    let finalEnergy = 0;
    let isFirstWorkoutToday = false;
    let finalStreakValue = 0;
    let freezeUsed = false;

    if (user) {
      const { data: result, error } = await supabase.rpc('complete_workout', {
        p_workout_id: String(currentWorkout.id),
        p_workout_name: currentWorkout.name || 'Workout',
        p_minutes: elapsedMinutes,
        p_volume_kg: totalKg,
        p_completion: completionRatio,
        // Without the zone, a session logged after midnight local time records
        // against yesterday on the server and breaks the streak.
        p_tz: deviceTimeZone(),
        // The server re-adds the volume from these rather than trusting the
        // figure above — that number earns an XP bonus past 1000kg.
        p_exercises: performed,
      });

      if (error || !result?.ok) {
        Alert.alert(
          'Could not save this workout',
          error?.message || 'Your session was not recorded. Check your connection and try again.'
        );
        setMode('started');
        return;
      }

      setCompletionId(result.completion_id ?? null);
      finalXP = result.xp;
      finalEnergy = result.energy;
      finalStreakValue = result.streak;
      isFirstWorkoutToday = result.streak_grew;
      freezeUsed = result.freeze_used;
    }

    // The server keeps only the sets that beat a previous best and tells us
    // which those were. Doing the comparison there means a modified client
    // cannot claim a record it did not earn.
    let newRecords = [];
    let newAchievements = [];

    if (user) {
      const completedSets = performed.flatMap((ex) =>
        ex.sets.map((set) => ({ name: ex.name, weight: set.weight, reps: set.reps }))
      );

      if (completedSets.length > 0) {
        const { data } = await supabase.rpc('submit_sets', { p_sets: completedSets });
        newRecords = data || [];
      }

      // Achievements are evaluated after the workout is written, so this session
      // counts towards the thresholds.
      const { data: unlocked } = await supabase.rpc('check_achievements');
      newAchievements = unlocked || [];
    }

    setWorkoutStats({
      volume: totalKg,
      time: timer,
      message: randomMsg,
      xpGained: finalXP,
      energyGained: finalEnergy,
      isFirstWorkoutToday,
      newStreak: finalStreakValue,
      freezeUsed,
      records: newRecords,
      achievements: newAchievements,
    });

    const resetExercises = currentWorkout.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(set => ({
        ...set,
        prev: set.weight && set.reps ? `${set.weight}kg x ${set.reps}` : set.prev,
        completed: false
      }))
    }));

    const finalWorkoutToSave = { ...currentWorkout, exercises: resetExercises };

    if (user) {
      await supabase.from('user_workouts').update({ exercises: resetExercises }).eq('id', currentWorkout.id);
    }

    setCurrentWorkout(finalWorkoutToSave);
    setShowSummary(true);
  };

  const closeSummaryAndExit = () => {
    if (onSave) onSave(currentWorkout);
    setShowSummary(false);
    const elapsedMinutes = Math.ceil(workoutStats.time / 60);
    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: {
              screen: 'Dashboard',
              params: { newActivityMinutes: elapsedMinutes },
            },
          },
        ],
      });
    }, 300);
  };

  const handleBackPress = () => {
    if (mode === 'started') {
      Alert.alert('Workout in Progress', 'If you leave now, this workout will be discarded.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() }
      ]);
    } else if (mode === 'editing') {
      Alert.alert('Unsaved Changes', 'You have unsaved edits. Do you still want to leave?', [
        { text: 'Back to editing', style: 'cancel' },
        { text: 'Leave without saving', style: 'destructive', onPress: () => navigation.goBack() }
      ]);
    } else {
      if (onSave) onSave(currentWorkout);
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <View style={styles.detailHeader}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleBackPress} accessibilityLabel="Go back"><ChevronLeft color={colors.text} size={30} /></TouchableOpacity>
          {mode === 'started' ? (
            <View style={styles.timerHeader}><Clock color={colors.accent} size={20} /><Text style={styles.timerText}>{formatStopwatch(timer)}</Text></View>
          ) : (
            <Text style={styles.detailTitle}>{currentWorkout?.name}</Text>
          )}
          {mode === 'idle' && <TouchableOpacity activeOpacity={0.7} onPress={toggleEditMode} accessibilityLabel="Edit"><Edit3 color={colors.accent} size={24} /></TouchableOpacity>}
          {mode === 'editing' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity
                onPress={pickCover}
                accessibilityLabel="Set cover photo"
                activeOpacity={0.7}
                disabled={uploadingCover}
              >
                <ImageIcon color={uploadingCover ? colors.textFaint : colors.accent} size={22} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={togglePublic}
                accessibilityLabel={currentWorkout.is_public ? 'Make private' : 'Share publicly'}
                activeOpacity={0.7}
              >
                {currentWorkout.is_public
                  ? <Globe color={colors.accent} size={22} />
                  : <Lock color={colors.textSecondary} size={22} />}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={toggleEditMode} accessibilityLabel="Save">
                <Save color={colors.accent} size={24} />
              </TouchableOpacity>
            </View>
          )}
          {mode === 'started' && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPlateSheetVisible(true)}
              accessibilityLabel="Plate calculator"
            >
              <Weight color={colors.accent} size={24} />
            </TouchableOpacity>
          )}
        </View>

        {mode === 'idle' && (
          <Button
            label="Start workout"
            icon={<Play color={colors.onAccent} size={20} fill={colors.onAccent} />}
            onPress={() => setMode('started')}
            style={styles.startBigBtn}
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {currentWorkout?.exercises?.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>

              <View style={styles.exerciseHeaderRow}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>

                {mode === 'editing' && (
                  <View style={styles.exerciseActionRow}>
                    <TouchableOpacity accessibilityLabel="Collapse" activeOpacity={0.7} onPress={() => moveExerciseUp(index)} disabled={index === 0} style={{ opacity: index === 0 ? 0.2 : 1, paddingHorizontal: 6 }}>
                      <ChevronUp color={colors.accent} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Expand" activeOpacity={0.7} onPress={() => moveExerciseDown(index)} disabled={index === currentWorkout.exercises.length - 1} style={{ opacity: index === currentWorkout.exercises.length - 1 ? 0.2 : 1, paddingHorizontal: 6, marginRight: 16 }}>
                      <ChevronDown color={colors.accent} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Delete" activeOpacity={0.7} onPress={() => confirmDeleteExercise(exercise.id)}>
                      <Trash2 color={colors.danger} size={22} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>Set</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Prev</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Kg</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Reps</Text>
                {mode === 'started' && <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Done</Text>}
                {mode === 'editing' && <Text style={[styles.tableHeaderText, { flex: 0.5 }]}></Text>}
              </View>

              {exercise.sets.map((set, setIndex) => (
                <View key={set.id} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                  <Text style={[styles.setText, { flex: 0.5 }]}>{setIndex + 1}</Text>
                  <Text style={[styles.setText, { flex: 1, color: colors.textDisabled }]}>{set.prev}</Text>

                  <TextInput style={[styles.setInput, set.completed && {opacity: 0.5}]} keyboardType="numeric" value={set.weight} onChangeText={(v) => updateSetData(exercise.id, set.id, 'weight', v)} placeholder="0" placeholderTextColor={colors.textFaint} editable={!set.completed} />
                  <TextInput style={[styles.setInput, set.completed && {opacity: 0.5}]} keyboardType="numeric" value={set.reps} onChangeText={(v) => updateSetData(exercise.id, set.id, 'reps', v)} placeholder="0" placeholderTextColor={colors.textFaint} editable={!set.completed} />

                  {mode === 'started' && (
                    <TouchableOpacity activeOpacity={0.7} style={styles.checkboxContainer} onPress={() => toggleSetCompletion(exercise.id, set.id)}>
                      {set.completed ? <CheckCircle2 color={colors.accent} size={26} /> : <Circle color={colors.textFaint} size={26} />}
                    </TouchableOpacity>
                  )}
                  {mode === 'editing' && (
                    <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} style={{ flex: 0.5, alignItems: 'center' }} onPress={() => confirmDeleteSet(exercise.id, set.id)}>
                      <X color={colors.danger} size={20} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {mode === 'editing' && (
                <TouchableOpacity activeOpacity={0.7} style={styles.addSetBtn} onPress={() => addSetToExercise(exercise.id)}>
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {mode === 'editing' && (
            <TouchableOpacity activeOpacity={0.7} style={styles.addExerciseBtn} onPress={() => setIsExerciseSelectorVisible(true)}>
              <Plus color={colors.accent} size={24} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

        {mode === 'started' && restEndsAt && (
          <View style={styles.restWrapper}>
            <RestTimer
              endsAt={restEndsAt}
              onExtend={(delta) =>
                setRestEndsAt((end) => {
                  const next = Math.max(Date.now(), end + delta * 1000);
                  cancelRestAlert(restAlertId.current);
                  scheduleRestAlert(Math.round((next - Date.now()) / 1000)).then((id) => {
                    restAlertId.current = id;
                  });
                  return next;
                })
              }
              onDismiss={() => {
                cancelRestAlert(restAlertId.current);
                restAlertId.current = null;
                setRestEndsAt(null);
              }}
            />
          </View>
        )}

        {mode === 'started' && (
          <View style={styles.finishContainer}>
            <Button label="Finish workout" onPress={handleFinishWorkout} />
          </View>
        )}

        <Modal visible={showSummary} animationType="slide">
          <SafeAreaView style={styles.summaryContainer}>
            <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.summaryScroll}>
              <View style={styles.summaryHeader}>
                <CheckCircle2 color={colors.accent} size={80} style={{ marginBottom: 20 }} />
                <Text style={styles.summaryTitle}>WORKOUT{'\n'}COMPLETED!</Text>
                <Text style={styles.summaryMessage}>{workoutStats.message}</Text>
            </View>

            <View style={styles.duoCard}>
              <View style={styles.duoStatRow}>
                <View style={styles.duoStatBox}>
                  <Text style={styles.duoStatLabel}>Total time</Text>
                  <Text style={styles.duoStatValue}>{formatStopwatch(workoutStats.time)}</Text>
                </View>
                <View style={styles.duoDivider} />
                <View style={styles.duoStatBox}>
                  <Text style={styles.duoStatLabel}>Total volume</Text>
                  <Text style={styles.duoStatValue}>{workoutStats.volume} kg</Text>
                </View>
              </View>
            </View>

            {completionId && (
              <View style={styles.duoCard}>
                <Text style={styles.duoRewardTitle}>How did it go?</Text>
                {/* Saved on blur rather than behind a button: a note nobody
                    remembered to save is the same as no note. */}
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  onBlur={saveNote}
                  placeholder="Bar felt heavy, shoulder fine — optional"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  maxLength={280}
                />
              </View>
            )}

            <View style={styles.duoCard}>
              <Text style={styles.duoRewardTitle}>Rewards Earned</Text>
              <View style={styles.duoStatRow}>
                <View style={styles.duoRewardBox}>
                  <Star color={colors.water} size={32} fill={colors.water} />
                  <Text style={[styles.duoStatValue, { color: colors.water, marginTop: 10 }]}>+{workoutStats.xpGained} XP</Text>
                </View>
                <View style={styles.duoRewardBox}>
                  <Zap color={colors.energy} size={32} fill={colors.energy} />
                  <Text style={[styles.duoStatValue, { color: colors.energy, marginTop: 10 }]}>+{workoutStats.energyGained} ⚡</Text>
                </View>
              </View>
            </View>

            <PersonalRecordCard records={workoutStats.records} />

            {workoutStats.achievements?.length > 0 && (
              <View style={[styles.duoCard, { borderColor: colors.accent }]}>
                <Text style={styles.duoRewardTitle}>
                  {workoutStats.achievements.length === 1 ? 'Achievement unlocked' : 'Achievements unlocked'}
                </Text>
                {workoutStats.achievements.map((a) => (
                  <View key={a.code} style={styles.unlockRow}>
                    <AchievementIcon name={a.icon} color={colors.accent} size={22} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.unlockName}>{a.name}</Text>
                      <Text style={styles.unlockDesc}>{a.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {workoutStats.freezeUsed && (
              <View style={[styles.duoCard, { borderColor: colors.water }]}>
                <Text style={[styles.duoRewardTitle, { color: colors.water, marginBottom: 6 }]}>
                  Streak Freeze used
                </Text>
                <Text style={styles.duoStreakSub}>
                  You missed a day, so one freeze was spent to keep your streak alive.
                </Text>
              </View>
            )}

            {workoutStats.isFirstWorkoutToday && (
              <View style={[styles.duoCard, { borderColor: colors.streak, backgroundColor: 'rgba(255, 138, 43, 0.12)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.streakCircle}>
                    <Flame color={colors.streak} size={36} fill={colors.streak} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.duoStreakTitle}>{workoutStats.newStreak}-Day Streak! 🔥</Text>
                    <Text style={styles.duoStreakSub}>Great work. You’ve extended your training streak.</Text>
                  </View>
                </View>
              </View>
            )}

            </ScrollView>

            <View style={styles.duoFooter}>
              <Button label="Continue" onPress={closeSummaryAndExit} />
            </View>
            </LinearGradient>
          </SafeAreaView>
        </Modal>


        <Modal visible={isExerciseSelectorVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.glassMenu, { height: '80%', padding: 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.menuTitle}>Choose an exercise</Text>
                <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setIsExerciseSelectorVisible(false)}><X color={colors.text} size={24} /></TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textFaint}
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                autoCorrect={false}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {MUSCLES.map((muscle) => {
                  const active = muscleFilter === muscle;
                  return (
                    <TouchableOpacity activeOpacity={0.7}
                      key={muscle}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setMuscleFilter(active ? null : muscle)}
                    >
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>{muscle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <FlatList
                data={visibleExercises}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.noResults}>No exercises match that search.</Text>}
                renderItem={({ item }) => {
                  const showing = cueFor === item.id;

                  return (
                    <View style={styles.exerciseDbItem}>
                      <View style={styles.exerciseDbRow}>
                        <TouchableOpacity
                          accessibilityLabel={`Add ${item.name}`}
                          activeOpacity={0.7}
                          style={{ flex: 1 }}
                          onPress={() => addNewExercise(item)}
                        >
                          <Text style={styles.exerciseDbName}>{item.name}</Text>
                          <Text style={styles.exerciseDbMuscle}>{item.muscle}</Text>
                        </TouchableOpacity>

                        {/* Separate target from Add. Wanting to know how an
                            exercise is performed is the opposite of being ready
                            to commit to it, and one tap should not do both. */}
                        <TouchableOpacity
                          accessibilityLabel={`How to do ${item.name}`}
                          activeOpacity={0.7}
                          hitSlop={8}
                          onPress={() => setCueFor(showing ? null : item.id)}
                          style={styles.exerciseInfoBtn}
                        >
                          <Info color={showing ? colors.accent : colors.textFaint} size={18} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          accessibilityLabel={`Add ${item.name}`}
                          activeOpacity={0.7}
                          hitSlop={8}
                          onPress={() => addNewExercise(item)}
                        >
                          <Plus color={colors.accent} size={20} />
                        </TouchableOpacity>
                      </View>

                      {showing && item.cue ? (
                        <View style={styles.cueBox}>
                          <Text style={styles.cueText}>{item.cue}</Text>
                          {item.watch ? (
                            <Text style={styles.cueWatch}>Common mistake: {item.watch}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
        <PlateSheet
          visible={plateSheetVisible}
          onClose={() => setPlateSheetVisible(false)}
          initialWeight={heaviestWeight}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'android' ? 40 : 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  timerHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 211, 198, 0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  timerText: { color: colors.accent, fontSize: 17, fontWeight: '700', marginLeft: 10 },
  startBigBtn: { flexDirection: 'row', backgroundColor: colors.accent, margin: 20, padding: 20, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  startBigBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 17, marginLeft: 10 },

  exerciseCard: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 20 },
  exerciseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  exerciseName: { color: colors.accent, fontSize: 15, fontWeight: '600', flex: 1 },
  exerciseActionRow: { flexDirection: 'row', alignItems: 'center' },

  tableHeader: { flexDirection: 'row', marginBottom: 10 },
  tableHeaderText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  setRowCompleted: { backgroundColor: 'rgba(46, 211, 198, 0.05)', borderRadius: 12 },
  setText: { color: colors.text, textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 10, padding: 10, marginHorizontal: 6, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  checkboxContainer: { flex: 0.6, alignItems: 'center', justifyContent: 'center' },
  addSetBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 6 },
  addSetText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 16, borderRadius: 18, marginBottom: 26, borderWidth: 1, borderColor: colors.accent + 'AA' },
  addExerciseText: { color: colors.accent, fontWeight: '600', fontSize: 15, marginLeft: 10 },
  restWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 96 : 86,
    left: 0,
    right: 0,
  },
  finishContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 10 : 0, width: '100%', backgroundColor: colors.card, padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  finishBtn: { backgroundColor: colors.accent, padding: 20, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end', padding: 16 },
  glassMenu: { backgroundColor: colors.sheet, width: '100%', borderRadius: 35, padding: 26, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  menuTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  exerciseDbItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseDbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  exerciseInfoBtn: { padding: 2 },
  cueBox: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12, gap: 8 },
  cueText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  cueWatch: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  searchInput: {
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  filterRow: { flexGrow: 0, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    marginRight: 10,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.onAccent },
  noResults: { color: colors.textMuted, textAlign: 'center', marginTop: 26, fontSize: 15 },
  exerciseDbName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  exerciseDbMuscle: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },

  summaryContainer: { flex: 1, backgroundColor: colors.background },
  summaryScroll: { padding: 20, alignItems: 'center', paddingBottom: 100 },
  summaryHeader: { alignItems: 'center', marginVertical: 40 },
  summaryTitle: { color: colors.accent, fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  summaryMessage: { color: colors.text, fontSize: 15, textAlign: 'center', marginTop: 16, fontStyle: 'italic', paddingHorizontal: 20 },

  duoCard: { backgroundColor: colors.card, width: '100%', borderRadius: 26, padding: 20, marginBottom: 20 },
  duoStatRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  duoStatBox: { alignItems: 'center', flex: 1 },
  noteInput: {
    backgroundColor: colors.surface, color: colors.text,
    borderRadius: 14, padding: 14, fontSize: 15, minHeight: 76,
    textAlignVertical: 'top', marginTop: 4,
  },
  duoDivider: { width: 2, height: 40, backgroundColor: colors.border },
  duoStatLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.7 },
  duoStatValue: { color: colors.text, fontSize: 26, fontWeight: '900' },

  duoRewardTitle: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  duoRewardBox: { alignItems: 'center', flex: 1 },
  unlockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  unlockName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  unlockDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

  streakCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 138, 43, 0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  duoStreakTitle: { color: colors.streak, fontSize: 20, fontWeight: '900' },
  duoStreakSub: { color: colors.streak, fontSize: 13, marginTop: 6, fontWeight: '600' },

  duoFooter: { position: 'absolute', bottom: Platform.OS === 'ios' ? 10 : 0, width: '100%', padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  duoButton: { backgroundColor: colors.accent, paddingVertical: 20, borderRadius: 20, alignItems: 'center', width: '100%' },
  duoButtonText: { color: colors.onAccent, fontSize: 17, fontWeight: '900', letterSpacing: 1 },

  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContentTooFast: { backgroundColor: colors.card, borderRadius: 32, padding: 26, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  modalText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 26 },
  modalBtnAction: { backgroundColor: colors.danger, padding: 16, borderRadius: 18, width: '100%', alignItems: 'center', marginTop: 10 },
  modalBtnActionText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 }
});