import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform, FlatList, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronLeft, Edit3, Plus, X, Play, CheckCircle2, Circle, Clock, 
  Save, Trash2, Zap, Star, Flame, ChevronUp, ChevronDown 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

const EXERCISE_DB = [
  { id: 'ex1', name: 'Barbell Bench Press', muscle: 'Chest' },
  { id: 'ex2', name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { id: 'ex3', name: 'Machine Chest Fly', muscle: 'Chest' },
  { id: 'ex4', name: 'Push-ups', muscle: 'Chest' },
  { id: 'ex5', name: 'Lat Pulldown', muscle: 'Back' },
  { id: 'ex6', name: 'Barbell Row', muscle: 'Back' },
  { id: 'ex7', name: 'Pull-ups', muscle: 'Back' },
  { id: 'ex8', name: 'Barbell Squat', muscle: 'Legs' },
  { id: 'ex13', name: 'Overhead Press', muscle: 'Shoulders' },
  { id: 'ex15', name: 'Barbell Bicep Curl', muscle: 'Arms' },
  { id: 'ex17', name: 'Cable Tricep Pushdown', muscle: 'Arms' },
  { id: 'ex19', name: 'Crunches', muscle: 'Core' },
];

const MOTIVATIONAL_MESSAGES = [
  "You showed up today. That already puts you ahead.",
  "Consistency beats intensity. This session is one more brick.",
  "Strong habits are built one finished workout at a time.",
  "You're not chasing perfection, you're chasing progress.",
  "Future you is grateful you didn't skip this.",
  "The hard part is starting. You did that.",
  "Tiny improvements stacked over time become strength.",
  "You don't have to feel motivated, you just have to show up.",
  "Discipline is doing what you said you'd do. You did it.",
  "Every rep was a vote for the person you want to become."
];

export default function WorkoutDetailScreen({ route, navigation }) {
  const workout = route?.params?.workout;
  const onSave = route?.params?.onSave;

  const [currentWorkout, setCurrentWorkout] = useState(workout || { name: '', exercises: [] });
  const [mode, setMode] = useState('idle');
  const [timer, setTimer] = useState(0);
  const [isExerciseSelectorVisible, setIsExerciseSelectorVisible] = useState(false);

  const [showSummary, setShowSummary] = useState(false);
  const [showTooFastModal, setShowTooFastModal] = useState(false);
  const [workoutStats, setWorkoutStats] = useState({ volume: 0, time: 0, message: '', xpGained: 50, energyGained: 0, isFirstWorkoutToday: false, newStreak: 0 });

  useEffect(() => {
    if (!workout) {
      navigation.replace('MainTabs');
    }
  }, [workout, navigation]);

  useEffect(() => {
    let interval;
    if (mode === 'started') interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [mode]);

  if (!workout) {
    return <View style={styles.container} />;
  }

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

  const addNewExercise = (exerciseName) => {
    const newExercise = { id: Math.random().toString(), name: exerciseName, sets: [{ id: Math.random().toString(), weight: '', reps: '', prev: '-', completed: false }] };
    setCurrentWorkout({ ...currentWorkout, exercises: [...(currentWorkout.exercises || []), newExercise] });
    setIsExerciseSelectorVisible(false);
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
    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, completed: !s.completed } : s) };
      return ex;
    });
    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
  };

  const handleFinishWorkout = async () => {
    const allSetsCompleted = currentWorkout.exercises.every(ex => ex.sets.every(set => set.completed));

    if (!allSetsCompleted) {
      Alert.alert(
        'Incomplete Workout',
        'This workout cannot be validated. All sets must be marked as DONE before you can finish and save your progress.',
        [{ text: 'Got it', style: 'cancel' }]
      );
      return;
    }

    if (timer < 60) {
      setShowTooFastModal(true);
      return;
    }

    let totalSets = 0;
    currentWorkout.exercises.forEach(ex => { totalSets += ex.sets.length; });
    const MIN_SECONDS_PER_SET = 60;
    const minRequiredSeconds = totalSets * MIN_SECONDS_PER_SET;

    if (totalSets > 0 && timer < minRequiredSeconds) {
      const minutesSpent = Math.floor(timer / 60);
      const minimumMinutes = Math.floor(minRequiredSeconds / 60);
      Alert.alert(
        'Workout Too Fast',
        `You tried to complete ${totalSets} sets in just ${minutesSpent} minutes.\n\nThe minimum estimated time for this volume is ~${minimumMinutes} minutes.\n\nYou can’t cheat the system—come back when you’re really done.`,
        [{ text: 'Back to work', style: 'default' }]
      );
      return;
    }

    processWorkoutCompletion();
  };

  const processWorkoutCompletion = async () => {
    setMode('idle');
    let totalKg = 0;
    currentWorkout.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed && set.weight && set.reps) totalKg += (parseFloat(set.weight) * parseInt(set.reps));
      });
    });

    const randomMsg = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
    const elapsedMinutes = Math.max(1, Math.ceil(timer / 60));

    const { data: { user } } = await supabase.auth.getUser();
    let isFirstWorkoutToday = false;
    let finalStreakValue = 0;
    let finalXP = 50 + (totalKg > 1000 ? 20 : 0);
    let finalEnergy = 0;

    if (user) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const { data: currentStat } = await supabase.from('daily_stats').select('activity_minutes').eq('user_id', user.id).eq('date', todayStr).maybeSingle();
      const currentMinutes = currentStat?.activity_minutes || 0;

      await supabase.from('daily_stats').upsert({
        user_id: user.id,
        date: todayStr,
        activity_minutes: currentMinutes + elapsedMinutes
      });

      await supabase.from('workout_completions').insert([{
        user_id: user.id,
        workout_id: currentWorkout.id,
        workout_name: currentWorkout.name || 'Workout',
        completed_at: new Date().toISOString(),
        duration_minutes: elapsedMinutes
      }]);

      const { data: profile } = await supabase.from('profiles').select('xp, energy_points, current_streak, previous_streak, last_workout_date, xp_boost_expires_at, coin_boost_active').eq('id', user.id).single();

      // 🔴 CALCUL PENTRU COIN BOOST (+50% Coins)
      let boostMultiplier = 1.0;
      let resetCoinBoost = false;
      if (profile?.coin_boost_active) {
         boostMultiplier = 1.5;
         resetCoinBoost = true;
      }
      
      finalEnergy = Math.min(Math.floor((elapsedMinutes * 5) * boostMultiplier), 500);

      let newStreak = profile?.current_streak || 0;
      let streakIncreased = false;

      if (profile?.last_workout_date === todayStr) {
        streakIncreased = false;
      } else if (profile?.last_workout_date) {
        const todayDate = new Date(todayStr);
        const lastDate = new Date(profile.last_workout_date);
        const diffTime = todayDate.getTime() - lastDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak += 1;
          streakIncreased = true;
        } else if (diffDays > 1) {
          await supabase.from('profiles').update({ previous_streak: profile.current_streak }).eq('id', user.id);
          newStreak = 1;
          streakIncreased = true;
        }
      } else {
        newStreak = 1;
        streakIncreased = true;
      }

      isFirstWorkoutToday = streakIncreased;
      finalStreakValue = newStreak;

      const isBoosted = profile?.xp_boost_expires_at && new Date(profile.xp_boost_expires_at) > new Date();
      if (isBoosted) finalXP *= 2;

      let updatesProfile = {
        xp: (profile?.xp || 0) + finalXP,
        energy_points: (profile?.energy_points || 0) + finalEnergy,
        current_streak: newStreak,
        last_workout_date: todayStr
      };

      if (resetCoinBoost) {
        updatesProfile.coin_boost_active = false;
      }

      await supabase.from('profiles').update(updatesProfile).eq('id', user.id);
    }

    setWorkoutStats({
      volume: totalKg,
      time: timer,
      message: randomMsg,
      xpGained: finalXP,
      energyGained: finalEnergy,
      isFirstWorkoutToday,
      newStreak: finalStreakValue
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
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={handleBackPress}><ChevronLeft color="#fff" size={30} /></TouchableOpacity>
          {mode === 'started' ? (
            <View style={styles.timerHeader}><Clock color={NEON_GREEN} size={20} /><Text style={styles.timerText}>{formatTime(timer)}</Text></View>
          ) : (
            <Text style={styles.detailTitle}>{currentWorkout?.name}</Text>
          )}
          {mode === 'idle' && <TouchableOpacity onPress={toggleEditMode}><Edit3 color={NEON_GREEN} size={24} /></TouchableOpacity>}
          {mode === 'editing' && <TouchableOpacity onPress={toggleEditMode}><Save color={NEON_GREEN} size={24} /></TouchableOpacity>}
          {mode === 'started' && <View style={{width: 24}} />}
        </View>

        {mode === 'idle' && (
          <TouchableOpacity style={styles.startBigBtn} onPress={() => setMode('started')}>
            <Play color="#000" size={24} fill="#000" />
            <Text style={styles.startBigBtnText}>Start Workout</Text>
          </TouchableOpacity>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 100 }}>
          {currentWorkout?.exercises?.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>

              <View style={styles.exerciseHeaderRow}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>

                {mode === 'editing' && (
                  <View style={styles.exerciseActionRow}>
                    <TouchableOpacity onPress={() => moveExerciseUp(index)} disabled={index === 0} style={{ opacity: index === 0 ? 0.2 : 1, paddingHorizontal: 5 }}>
                      <ChevronUp color={NEON_GREEN} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveExerciseDown(index)} disabled={index === currentWorkout.exercises.length - 1} style={{ opacity: index === currentWorkout.exercises.length - 1 ? 0.2 : 1, paddingHorizontal: 5, marginRight: 15 }}>
                      <ChevronDown color={NEON_GREEN} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDeleteExercise(exercise.id)}>
                      <Trash2 color="#ff4444" size={22} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>SET</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>PREV</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>KG</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>REPS</Text>
                {mode === 'started' && <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>DONE</Text>}
                {mode === 'editing' && <Text style={[styles.tableHeaderText, { flex: 0.5 }]}></Text>}
              </View>

              {exercise.sets.map((set, setIndex) => (
                <View key={set.id} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                  <Text style={[styles.setText, { flex: 0.5 }]}>{setIndex + 1}</Text>
                  <Text style={[styles.setText, { flex: 1, color: '#555' }]}>{set.prev}</Text>

                  <TextInput style={[styles.setInput, set.completed && {opacity: 0.5}]} keyboardType="numeric" value={set.weight} onChangeText={(v) => updateSetData(exercise.id, set.id, 'weight', v)} placeholder="0" placeholderTextColor="#444" editable={!set.completed} />
                  <TextInput style={[styles.setInput, set.completed && {opacity: 0.5}]} keyboardType="numeric" value={set.reps} onChangeText={(v) => updateSetData(exercise.id, set.id, 'reps', v)} placeholder="0" placeholderTextColor="#444" editable={!set.completed} />

                  {mode === 'started' && (
                    <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleSetCompletion(exercise.id, set.id)}>
                      {set.completed ? <CheckCircle2 color={NEON_GREEN} size={26} /> : <Circle color="#444" size={26} />}
                    </TouchableOpacity>
                  )}
                  {mode === 'editing' && (
                    <TouchableOpacity style={{ flex: 0.5, alignItems: 'center' }} onPress={() => confirmDeleteSet(exercise.id, set.id)}>
                      <X color="#ff4444" size={20} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {mode === 'editing' && (
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetToExercise(exercise.id)}>
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {mode === 'editing' && (
            <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setIsExerciseSelectorVisible(true)}>
              <Plus color={NEON_GREEN} size={24} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

        {mode === 'started' && (
          <View style={styles.finishContainer}>
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinishWorkout}>
              <Text style={styles.finishBtnText}>Finish Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={showSummary} animationType="slide">
          <SafeAreaView style={styles.summaryContainer}>
            <LinearGradient colors={['#000000', '#05180B']} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.summaryScroll}>
              <View style={styles.summaryHeader}>
                <CheckCircle2 color={NEON_GREEN} size={80} style={{ marginBottom: 20 }} />
                <Text style={styles.summaryTitle}>WORKOUT{'\n'}COMPLETED!</Text>
                <Text style={styles.summaryMessage}>{workoutStats.message}</Text>
            </View>

            <View style={styles.duoCard}>
              <View style={styles.duoStatRow}>
                <View style={styles.duoStatBox}>
                  <Text style={styles.duoStatLabel}>TOTAL TIME</Text>
                  <Text style={styles.duoStatValue}>{formatTime(workoutStats.time)}</Text>
                </View>
                <View style={styles.duoDivider} />
                <View style={styles.duoStatBox}>
                  <Text style={styles.duoStatLabel}>TOTAL VOLUME</Text>
                  <Text style={styles.duoStatValue}>{workoutStats.volume} kg</Text>
                </View>
              </View>
            </View>

            <View style={styles.duoCard}>
              <Text style={styles.duoRewardTitle}>Rewards Earned</Text>
              <View style={styles.duoStatRow}>
                <View style={styles.duoRewardBox}>
                  <Star color="#3b82f6" size={32} fill="#3b82f6" />
                  <Text style={[styles.duoStatValue, { color: '#3b82f6', marginTop: 10 }]}>+{workoutStats.xpGained} XP</Text>
                </View>
                <View style={styles.duoRewardBox}>
                  <Zap color="#FFD700" size={32} fill="#FFD700" />
                  <Text style={[styles.duoStatValue, { color: '#FFD700', marginTop: 10 }]}>+{workoutStats.energyGained} ⚡</Text>
                </View>
              </View>
            </View>

            {workoutStats.isFirstWorkoutToday && (
              <View style={[styles.duoCard, { borderColor: '#FF8800', backgroundColor: '#1f1000' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.streakCircle}>
                    <Flame color="#FF8800" size={36} fill="#FF8800" />
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
              <TouchableOpacity style={styles.duoButton} onPress={closeSummaryAndExit}>
                <Text style={styles.duoButtonText}>CONTINUE</Text>
              </TouchableOpacity>
            </View>
            </LinearGradient>
          </SafeAreaView>
        </Modal>

        <Modal transparent visible={showTooFastModal} animationType="fade">
          <View style={styles.modalOverlayFull}>
            <View style={styles.modalContentTooFast}>
              <Clock color="#ff4444" size={56} style={{ marginBottom: 20 }} />
              <Text style={styles.modalTitle}>Wait a minute!</Text>
              <Text style={styles.modalText}>
                You haven't trained enough. Try training more until you complete the workout!
              </Text>
              <TouchableOpacity
                style={styles.modalBtnAction}
                onPress={() => setShowTooFastModal(false)}
              >
                <Text style={styles.modalBtnActionText}>Keep Training</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={isExerciseSelectorVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.glassMenu, { height: '80%', padding: 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.menuTitle}>Choose an exercise</Text>
                <TouchableOpacity onPress={() => setIsExerciseSelectorVisible(false)}><X color="#fff" size={24} /></TouchableOpacity>
              </View>
              <FlatList
                data={EXERCISE_DB} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.exerciseDbItem} onPress={() => addNewExercise(item.name)}>
                    <View><Text style={styles.exerciseDbName}>{item.name}</Text><Text style={styles.exerciseDbMuscle}>{item.muscle}</Text></View>
                    <Plus color={NEON_GREEN} size={20} />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: Platform.OS === 'android' ? 40 : 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  timerHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 215, 96, 0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  timerText: { color: NEON_GREEN, fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  startBigBtn: { flexDirection: 'row', backgroundColor: NEON_GREEN, margin: 20, padding: 18, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: NEON_GREEN, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  startBigBtnText: { color: '#000', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },

  exerciseCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  exerciseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  exerciseName: { color: NEON_GREEN, fontSize: 16, fontWeight: '700', flex: 1 },
  exerciseActionRow: { flexDirection: 'row', alignItems: 'center' },

  tableHeader: { flexDirection: 'row', marginBottom: 10 },
  tableHeaderText: { color: '#666', fontSize: 12, textAlign: 'center', fontWeight: 'bold' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  setRowCompleted: { backgroundColor: 'rgba(30, 215, 96, 0.05)', borderRadius: 10 },
  setText: { color: '#fff', textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 8, marginHorizontal: 5, textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  checkboxContainer: { flex: 0.6, alignItems: 'center', justifyContent: 'center' },
  addSetBtn: { marginTop: 15, alignItems: 'center', paddingVertical: 5 },
  addSetText: { color: '#888', fontSize: 14, fontWeight: '600' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 15, borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: NEON_GREEN + 'AA' },
  addExerciseText: { color: NEON_GREEN, fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  finishContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 10 : 0, width: '100%', backgroundColor: CARD_BG, padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
  finishBtn: { backgroundColor: NEON_GREEN, padding: 18, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end', padding: 15 },
  glassMenu: { backgroundColor: '#161616', width: '100%', borderRadius: 35, padding: 25, borderWidth: 1, borderColor: '#222', paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  exerciseDbItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  exerciseDbName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  exerciseDbMuscle: { color: '#888', fontSize: 12, marginTop: 4 },

  summaryContainer: { flex: 1, backgroundColor: '#000' },
  summaryScroll: { padding: 20, alignItems: 'center', paddingBottom: 100 },
  summaryHeader: { alignItems: 'center', marginVertical: 40 },
  summaryTitle: { color: NEON_GREEN, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  summaryMessage: { color: '#FFF', fontSize: 16, textAlign: 'center', marginTop: 15, fontStyle: 'italic', paddingHorizontal: 20 },

  duoCard: { backgroundColor: CARD_BG, width: '100%', borderRadius: 22, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  duoStatRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  duoStatBox: { alignItems: 'center', flex: 1 },
  duoDivider: { width: 2, height: 40, backgroundColor: '#333' },
  duoStatLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  duoStatValue: { color: '#FFF', fontSize: 24, fontWeight: '900' },

  duoRewardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  duoRewardBox: { alignItems: 'center', flex: 1 },

  streakCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 136, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  duoStreakTitle: { color: '#FF8800', fontSize: 20, fontWeight: '900' },
  duoStreakSub: { color: '#FFAA44', fontSize: 13, marginTop: 4, fontWeight: '600' },

  duoFooter: { position: 'absolute', bottom: Platform.OS === 'ios' ? 10 : 0, width: '100%', padding: 20, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  duoButton: { backgroundColor: NEON_GREEN, paddingVertical: 18, borderRadius: 16, alignItems: 'center', width: '100%' },
  duoButtonText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContentTooFast: { backgroundColor: CARD_BG, borderRadius: 32, padding: 30, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#ff4444' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 25 },
  modalBtnAction: { backgroundColor: '#ff4444', padding: 15, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 10 },
  modalBtnActionText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});