import { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Dumbbell, Play, Trash2, Zap, Layout, ChevronDown, ChevronUp, RotateCcw, Copy } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { gradients } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import useRefresh from '../lib/useRefresh';
import { formatRelativeDate } from '../lib/date';
import { exercisesInGroup } from '../constants/exercises';
import { useAuth } from '../context/AuthContext';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import Avatar from '../components/Avatar';


export default function TrainingScreen({ navigation }) {
  const { user } = useAuth();
  const { refreshControl } = useRefresh(() => fetchMyWorkouts());
  const [myWorkouts, setMyWorkouts] = useState([]);
  const [suggestedWorkouts, setSuggestedWorkouts] = useState([]);
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  /** Most recent finished session, offered as a one-tap repeat. */
  const [lastSession, setLastSession] = useState(null);
  /** 'mine' = your saved workouts, 'browse' = public ones plus what we suggest. */
  const [view, setView] = useState('mine');
  const [publicWorkouts, setPublicWorkouts] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [isBuiltInExpanded, setIsBuiltInExpanded] = useState(false);
  const [isNamingModalVisible, setIsNamingModalVisible] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  useFocusEffect(
    useCallback(() => {
    // user?.id is in the deps because useCallback pins the closure: without it
    // the memoised function keeps the `user` from first render (null, before the
    // session loads) and every later focus re-runs that stale copy — which is
    // why signing in left the screen empty until something forced a remount.
      fetchMyWorkouts();
      generateSmartWorkouts();
    }, [user?.id])
  );

  const fetchMyWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMyWorkouts(data);

    // The most recent finished session, so the list can offer it back.
    // Most people repeat the same handful of workouts, and hunting for
    // yesterday's in an unsorted list is the friction that makes them stop.
    const { data: last } = await supabase
      .from('workout_completions')
      .select('workout_id, workout_name, completed_at, duration_minutes')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only offer it if the workout still exists — it may have been deleted.
    const stillExists = last && (data || []).some((w) => String(w.id) === String(last.workout_id));
    setLastSession(stillExists ? last : null);
  };

  const fetchPublicWorkouts = useCallback(async () => {
    setBrowseLoading(true);
    const { data } = await supabase.rpc('browse_workouts', { p_limit: 30, p_search: null });
    setPublicWorkouts(data || []);
    setBrowseLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'browse' && publicWorkouts.length === 0) fetchPublicWorkouts();
  }, [view, publicWorkouts.length, fetchPublicWorkouts]);

  const handleCopy = async (workoutId, name) => {
    const { data, error } = await supabase.rpc('copy_workout', { p_workout_id: workoutId });
    if (error || !data?.ok) {
      return Alert.alert('Nothing copied', 'That workout is no longer available.');
    }
    Alert.alert('Added', `"${name}" is in your workouts, with the sets cleared.`);
    fetchMyWorkouts();
    setView('mine');
  };

  const generateSmartWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('weight, age, sex, goal, workouts_per_week').eq('id', user.id).single();
    
    const weight = parseFloat(profile?.weight) || 70;
    const age = parseInt(profile?.age) || 25;
    const sex = (profile?.sex || 'M').toUpperCase();
    const goal = profile?.goal || 'build_muscle';
    const days = parseInt(profile?.workouts_per_week) || 3;

    let targetReps = "10";
    let intensityStr = "Medium";
    let weightModifier = 1.0; 

    if (goal === 'gain_strength') { targetReps = "5"; intensityStr = "Insane"; weightModifier = 1.1; }
    else if (goal === 'build_muscle') { targetReps = "10"; intensityStr = "Hard"; weightModifier = 0.9; }
    else if (goal === 'maintain') { targetReps = "12"; intensityStr = "Medium"; weightModifier = 0.7; }
    else if (goal === 'lose_weight') { targetReps = "20"; intensityStr = "High"; weightModifier = 0.4; } 

    const ageMod = (age < 18 || age > 45) ? 0.85 : 1.0;
    const sexUpperMod = sex === 'F' ? 0.6 : 1.0; 
    const sexLowerMod = sex === 'F' ? 0.8 : 1.0;

    const calcWeight = (baseRatio, isUpper, isDb) => {
        if (baseRatio === 0) return "0";
        let w = weight * baseRatio * weightModifier * ageMod * (isUpper ? sexUpperMod : sexLowerMod);
        if (isDb) w = w / 2; 
        return Math.max(2.5, Math.round(w / 2.5) * 2.5).toString(); 
    };

    const genSets = (w, r) => Array.from({ length: 4 }).map(() => ({ 
      id: Math.random().toString(), weight: w, reps: r, prev: '-', completed: false 
    }));

    const buildWorkout = (name, categories, duration, specificReps = targetReps) => {
        let exercises = [];
        let itemsPerGroup = Math.ceil(5 / categories.length);
        
        categories.forEach(cat => {
            exercisesInGroup(cat).slice(0, itemsPerGroup).forEach(ex => {
                if (exercises.length < 5) {
                    let w = calcWeight(ex.ratio, ex.upper, ex.isDb);
                    let r = specificReps;
                    
                    if (ex.name === 'Plank') r = '60'; 
                    if (ex.ratio === 0 && ex.name !== 'Plank') r = (parseInt(specificReps) + 5).toString(); 
                    
                    exercises.push({
                        id: Math.random().toString(),
                        name: ex.name,
                        // Carried through so StatsScreen can group by muscle.
                        muscle: ex.muscle,
                        sets: genSets(w, r)
                    });
                }
            });
        });
        return { name, duration, intensity: intensityStr, exercises };
    };

    let workouts = [];

    if (goal === 'lose_weight') {
        workouts.push(buildWorkout('HIIT Cardio Blast', ['cardio', 'core'], '35 min', '30'));
        workouts.push(buildWorkout('Core & Fat Burn', ['core', 'cardio'], '30 min', '25'));
        workouts.push(buildWorkout('Full Body Sweat', ['light_fullbody', 'cardio'], '40 min', '20'));
        workouts.push(buildWorkout('Metabolic Conditioning', ['cardio', 'light_fullbody'], '45 min', '25'));
        workouts.push(buildWorkout('Active Recovery & Abs', ['core', 'light_fullbody'], '30 min', '20'));
    } 
    else if (goal === 'gain_strength') {
        workouts.push(buildWorkout('Heavy Push (Chest/Shoulders)', ['heavy_push', 'hyper_push'], '60 min'));
        workouts.push(buildWorkout('Heavy Pull (Back)', ['heavy_pull', 'hyper_pull'], '60 min'));
        workouts.push(buildWorkout('Heavy Legs', ['heavy_legs', 'hyper_legs'], '65 min'));
        workouts.push(buildWorkout('Upper Body Power', ['heavy_push', 'heavy_pull'], '60 min'));
        workouts.push(buildWorkout('Lower Body Power', ['heavy_legs', 'core'], '60 min'));
    }
    else if (goal === 'build_muscle') {
        if (days <= 3) {
            workouts.push(buildWorkout('Full Body A', ['heavy_push', 'hyper_legs', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Full Body B', ['heavy_pull', 'hyper_push', 'heavy_legs'], '55 min'));
            workouts.push(buildWorkout('Full Body C', ['heavy_legs', 'hyper_push', 'hyper_pull'], '55 min'));
        } else if (days === 4) {
            workouts.push(buildWorkout('Upper Body', ['heavy_push', 'hyper_pull', 'hyper_push'], '55 min'));
            workouts.push(buildWorkout('Lower Body', ['heavy_legs', 'hyper_legs', 'core'], '60 min'));
            workouts.push(buildWorkout('Upper Body Hypertrophy', ['heavy_pull', 'hyper_push', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Lower Body Hypertrophy', ['heavy_legs', 'hyper_legs'], '60 min'));
        } else {
            workouts.push(buildWorkout('Chest & Triceps', ['heavy_push', 'hyper_push'], '55 min'));
            workouts.push(buildWorkout('Back & Biceps', ['heavy_pull', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Leg Day', ['heavy_legs', 'hyper_legs'], '65 min'));
            workouts.push(buildWorkout('Shoulders & Core', ['hyper_push', 'core'], '50 min'));
            workouts.push(buildWorkout('Arm Day', ['hyper_pull', 'hyper_push'], '45 min'));
        }
    }
    else if (goal === 'maintain') {
        workouts.push(buildWorkout('Balanced Full Body', ['heavy_push', 'heavy_legs', 'hyper_pull'], '45 min'));
        workouts.push(buildWorkout('Core & Cardio', ['core', 'cardio'], '30 min'));
        workouts.push(buildWorkout('Upper Body Flow', ['heavy_pull', 'hyper_push'], '45 min'));
        workouts.push(buildWorkout('Lower Body Flow', ['heavy_legs', 'core'], '45 min'));
        workouts.push(buildWorkout('Functional Fitness', ['light_fullbody', 'cardio'], '40 min'));
    }

    setSuggestedWorkouts(workouts.slice(0, Math.max(1, Math.min(days, 5))));
  };

  const confirmDeleteWorkout = (id) => {
    Alert.alert("Delete workout", "Delete this workout? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          setMyWorkouts(myWorkouts.filter(w => w.id !== id));
          await supabase.from('user_workouts').delete().eq('id', id);
        } 
      }
    ]);
  };

  const triggerCustomWorkoutCreation = () => {
    closeMainMenu();
    setNewWorkoutName('');
    setIsNamingModalVisible(true);
  };

  const handleCreateNamedWorkout = async () => {
    const finalName = newWorkoutName.trim() || 'Custom Session';
    setIsNamingModalVisible(false);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: finalName, exercises: []
    }).select().single();

    if (data) {
      setMyWorkouts([data, ...myWorkouts]);
      openWorkoutDetail(data); 
    }
  };

  const addPreset = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: item.name, duration: item.duration,
      intensity: item.intensity, exercises: item.exercises || []
    }).select().single();

    if (data) setMyWorkouts([data, ...myWorkouts]);
    closeMainMenu();
  };

  const closeMainMenu = () => {
    setMainMenuVisible(false);
    setIsBuiltInExpanded(false); 
  };

  const handleSaveWorkout = (updatedWorkout) => {
    setMyWorkouts(prevWorkouts => prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
  };

  const openWorkoutDetail = (workout) => {
    navigation.navigate('WorkoutDetailScreen', { workout: workout, onSave: handleSaveWorkout });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={300} intensity={0.38} />
        <ScreenHeader title="Workouts" />

        <View style={styles.segments}>
          {[
            { id: 'mine', label: 'My workouts' },
            { id: 'browse', label: 'Browse' },
          ].map((tab) => {
            const active = view === tab.id;
            return (
              <Press
                key={tab.id}
                scale={0.98}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setView(tab.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab.label}</Text>
              </Press>
            );
          })}
        </View>

        <FlatList
        refreshControl={refreshControl}
        data={view === 'mine' ? myWorkouts : publicWorkouts}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          view === 'mine' && lastSession ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.repeatCard}
              onPress={() => {
                const workout = myWorkouts.find((w) => String(w.id) === String(lastSession.workout_id));
                if (workout) openWorkoutDetail(workout);
              }}
              accessibilityLabel={`Repeat ${lastSession.workout_name}`}
            >
              <View style={styles.repeatIcon}>
                <RotateCcw color={colors.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.repeatLabel}>Pick up where you left off</Text>
                <Text style={styles.repeatName} numberOfLines={1}>{lastSession.workout_name}</Text>
                <Text style={styles.repeatMeta}>
                  {formatRelativeDate(lastSession.completed_at)} · {lastSession.duration_minutes} min
                </Text>
              </View>
              <Play color={colors.onAccent} size={16} fill={colors.onAccent} style={styles.repeatPlay} />
            </TouchableOpacity>
          ) : null
        }
        ListFooterComponent={
          view === 'mine' && myWorkouts.length > 0 ? (
            <Press
              scale={0.98}
              style={styles.createRow}
              onPress={() => setMainMenuVisible(true)}
              accessibilityLabel="Create or add a workout"
            >
              <View style={styles.createGlyph}><Plus color={colors.accent} size={18} /></View>
              <Text style={styles.createText}>Create or add a workout</Text>
            </Press>
          ) : null
        }
        ListEmptyComponent={
          view === 'browse' ? (
            browseLoading ? null : (
              <EmptyState
                icon={<Layout color={colors.textFaint} size={44} />}
                title="No public workouts yet"
                message="Nobody has shared one so far. Publish yours from the workout screen and it will show up here."
                actionLabel="Build a workout"
                onAction={() => setMainMenuVisible(true)}
              />
            )
          ) : (
          <EmptyState
            icon={<Dumbbell color={colors.textFaint} size={44} />}
            title="No workouts yet"
            message="Build your own, or pick one we have matched to your goal."
            actionLabel="Add a workout"
            onAction={() => setMainMenuVisible(true)}
          />
          )
        }
        renderItem={({ item, index }) =>
          view === 'browse' ? (
            <FadeIn index={index}>
              <View style={styles.browseCard}>
                <View style={styles.browseTop}>
                  <Avatar profile={{ equipped_avatar: item.author_avatar, xp: item.author_xp }} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workoutName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.browseAuthor}>
                      {item.is_mine ? 'Yours' : `by ${item.author_name}`}
                      {item.copy_count > 0 ? `  ·  ${item.copy_count} copied` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.browseTags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.exercise_count} exercises</Text>
                  </View>
                  {(item.muscles || []).slice(0, 3).map((m) => (
                    <View key={m} style={styles.tag}><Text style={styles.tagText}>{m}</Text></View>
                  ))}
                </View>

                {!item.is_mine && (
                  <Press
                    scale={0.97}
                    style={styles.copyBtn}
                    onPress={() => handleCopy(item.id, item.name)}
                    accessibilityLabel={`Copy ${item.name}`}
                  >
                    <Copy color={colors.accent} size={15} />
                    <Text style={styles.copyBtnText}>Add to my workouts</Text>
                  </Press>
                )}
              </View>
            </FadeIn>
          ) : (
          <View style={styles.glassCard}>
            <TouchableOpacity activeOpacity={0.7} style={styles.workoutMain} onPress={() => openWorkoutDetail(item)}>
              <View style={styles.iconCircle}><Dumbbell color={colors.accent} size={20} /></View>
              <View>
                <Text style={styles.workoutName}>{item.name}</Text>
                {item.duration && <Text style={{color: colors.textMuted, fontSize: 13}}>{item.duration} • {item.intensity}</Text>}
              </View>
            </TouchableOpacity>
            <View style={styles.actionButtons}>
              <TouchableOpacity accessibilityLabel="Delete" activeOpacity={0.7} onPress={() => confirmDeleteWorkout(item.id)} style={styles.deleteBtn}>
                <Trash2 color={colors.danger} size={18} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} accessibilityLabel="Start workout" style={styles.playBtn} onPress={() => openWorkoutDetail(item)}>
                <Play color={colors.onAccent} size={16} fill="#000" />
              </TouchableOpacity>
            </View>
          </View>
          )
        }
      />

      <Modal visible={mainMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeMainMenu}>
          <TouchableOpacity activeOpacity={1} style={styles.glassMenu}>
            <Text style={styles.menuTitle}>Choose a workout</Text>
            
            <TouchableOpacity activeOpacity={0.7} style={styles.menuOption} onPress={triggerCustomWorkoutCreation}>
              <Zap color={colors.accent} size={22} /><Text style={styles.menuOptionText}>Create a custom workout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity activeOpacity={0.7} 
              style={[styles.menuOption, isBuiltInExpanded && styles.menuOptionExpanded]} 
              onPress={() => setIsBuiltInExpanded(!isBuiltInExpanded)}
            >
              <Layout color={colors.accent} size={22} />
              <Text style={styles.menuOptionText}>Suggested Workouts</Text>
              {isBuiltInExpanded ? <ChevronUp color={colors.textMuted} size={20} style={styles.chevron} /> : <ChevronDown color={colors.textMuted} size={20} style={styles.chevron} />}
            </TouchableOpacity>
            
            {isBuiltInExpanded && (
              <View style={styles.expandedContainer}>
                {suggestedWorkouts.map((item, index) => (
                  <TouchableOpacity accessibilityLabel="Add" activeOpacity={0.7} key={index} style={styles.expandedItem} onPress={() => addPreset(item)}>
                    <View>
                      <Text style={styles.expandedItemName}>{item.name}</Text>
                      <Text style={styles.expandedItemSub}>{item.duration} • {item.intensity}</Text>
                    </View>
                    <Plus color={colors.accent} size={20} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <TouchableOpacity activeOpacity={0.7} onPress={closeMainMenu} style={{ marginTop: 20 }}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isNamingModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.glassMenu}>
            <Text style={styles.menuTitle}>Pick a workout name:</Text>
            <TextInput 
              style={styles.nameInput} placeholder="Ex: Leg Day" placeholderTextColor={colors.textMuted}
              value={newWorkoutName} onChangeText={setNewWorkoutName} autoFocus
            />
            <TouchableOpacity activeOpacity={0.7} style={styles.saveNameBtn} onPress={handleCreateNamedWorkout}>
              <Text style={styles.saveNameBtnText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsNamingModalVisible(false)} style={{ marginTop: 20 }}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  header: { padding: 20, paddingTop: 40 },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 10 },
  dateText: { color: colors.textMuted, marginTop: 16, fontSize: 15 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 6 },
  repeatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    gap: 16,
    // The one card in the list that is a suggestion rather than an item, so it
    // gets the accent edge to separate it from the workouts below.
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  repeatIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  repeatLabel: { color: colors.accent, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
  repeatName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  repeatMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  repeatPlay: {
    backgroundColor: colors.accent,
    width: 34, height: 34, borderRadius: 17,
    textAlign: 'center', lineHeight: 34,
    overflow: 'hidden',
  },
  // --- Segmented control ---------------------------------------------------
  // The two things you can do here, side by side, instead of a floating plus
  // that hid one of them behind a menu.
  segments: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: colors.onAccent, fontWeight: '700' },

  // --- Browse cards --------------------------------------------------------
  browseCard: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 12, gap: 14 },
  browseTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  browseAuthor: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  browseTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accentSoft, paddingVertical: 11, borderRadius: 16,
  },
  copyBtnText: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 20, padding: 16, marginTop: 4,
  },
  createGlyph: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  createText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  listContent: { padding: 20, paddingBottom: 100 },
  glassCard: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 10, borderRadius: 14, marginRight: 16 },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { backgroundColor: colors.accent, width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  deleteBtn: { padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  glassMenu: { backgroundColor: colors.sheet, width: '100%', borderRadius: 35, padding: 26 },
  menuTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  menuOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, padding: 20, borderRadius: 18, marginBottom: 10 },
  menuOptionExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  menuOptionText: { color: colors.text, fontSize: 15, fontWeight: '600', marginLeft: 16 },
  chevron: { marginLeft: 'auto' },
  expandedContainer: { backgroundColor: colors.surfaceRaised, padding: 16, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginBottom: 10, borderTopWidth: 0 },
  expandedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  expandedItemName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  expandedItemSub: { color: colors.accent, fontSize: 13, marginTop: 6 },
  closeText: { color: colors.textMuted, textAlign: 'center', fontSize: 15 },
  emptyText: { color: colors.textDisabled, textAlign: 'center', marginTop: 50 },
  nameInput: { backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 18, padding: 20, fontSize: 15, marginBottom: 20 },
  saveNameBtn: { backgroundColor: colors.accent, padding: 20, borderRadius: 18, alignItems: 'center' },
  saveNameBtnText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 }
});