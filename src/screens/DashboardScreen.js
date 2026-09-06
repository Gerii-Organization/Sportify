import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Flame, Trophy, Zap, User, LogIn, X, Bell, HelpCircle, Scale, Ruler, ChevronRight, Edit3, Footprints, Droplets, Clock, Moon, TrendingUp, Activity, Crown, CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp, Edit2, Check, Star, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Polygon, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { Pedometer } from 'expo-sensors';
import { colors } from '../theme';
import { getAvatar, getRing } from '../constants/cosmetics';
import { levelInfo } from '../lib/level';
import { todayKey, formatDuration, formatRelativeDate } from '../lib/date';
import { gradients } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import EditProfileSheet from '../components/EditProfileSheet';
import MacroRings, { macroTargets } from '../components/MacroRings';
import { WATER_AMOUNTS } from '../constants/content';
import AchievementGrid from '../components/AchievementGrid';
import { mergeAchievements } from '../lib/achievements';
import WeightSheet from '../components/WeightSheet';
import { getSetting, setSetting } from '../lib/settings';
import AmbientGlow from '../components/AmbientGlow';
import useRefresh from '../lib/useRefresh';
import StreakCalendar from '../components/StreakCalendar';
import Press from '../components/Press';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation, route }) {
  const { refreshControl } = useRefresh(() => fetchProfileAndStats());
  const { user, refreshProfile } = useAuth();
  const scrollViewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isEditProfileVisible, setEditProfileVisible] = useState(false);
  const [isWeightSheetVisible, setWeightSheetVisible] = useState(false);
  const [isStreakVisible, setStreakVisible] = useState(false);
  /** Device preference, read by the rest timer before it schedules an alert. */
  const [restAlerts, setRestAlerts] = useState(true);

  useEffect(() => {
    getSetting('restAlerts').then(setRestAlerts);
  }, []);

  const toggleRestAlerts = async () => {
    const next = !restAlerts;
    setRestAlerts(next);
    await setSetting('restAlerts', next);
  };
  const [isWaterModalVisible, setWaterModalVisible] = useState(false);
  const [isAddTaskModalVisible, setAddTaskModalVisible] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [stepsGoal, setStepsGoal] = useState(10000);
  const [dailyStats, setDailyStats] = useState({
    steps: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    activity: 0,
    sleep: '7h 30m',
    water: 0
  });

  const [tasks, setTasks] = useState([]);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [taskType, setTaskType] = useState('manual');
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(null);
  const [deviceSteps, setDeviceSteps] = useState(0);
  const [completedWorkouts, setCompletedWorkouts] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const [xpToast, setXpToast] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const { total: totalXp, level: currentLevel, intoLevel: currentLevelXp, percent: xpPercentage } = levelInfo(userProfile?.xp);


  const showXpToast = (amount, title) => {
    setXpToast({ amount, title });
    Animated.parallel([
      // friction: 6 was underdamped — the toast overshot and wobbled back, which
      // is the 'toy' feel. These are the same near-critical numbers as the rest
      // of the app's motion; see src/lib/motion.js.
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, {
        toValue: Platform.OS === 'ios' ? 50 : 20,
        stiffness: 240, damping: 26, mass: 1,
        useNativeDriver: true,
      })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -100, duration: 180, useNativeDriver: true })
      ]).start(() => setXpToast(null));
    }, 3000);
  };



  const saveSleepToSupabase = async (totalSleepMinutes) => {
    try {
      if (!user) return;

      const now = new Date();
      const todayStr = todayKey();

      await supabase.from('daily_stats').upsert(
        { user_id: user.id, date: todayStr, sleep_minutes: totalSleepMinutes },
        { onConflict: 'user_id,date' }
      );
    } catch (e) { }
  };

  useEffect(() => {
    if (route.params?.newActivityMinutes) {
      setDailyStats(prev => ({ ...prev, activity: prev.activity + route.params.newActivityMinutes }));
      navigation.setParams({ newActivityMinutes: undefined });
    }
  }, [route.params?.newActivityMinutes, navigation]);

  const saveStepsToSupabase = async (steps) => {
    try {
      if (!user) return;
      const todayStr = todayKey();
      const { data: existing } = await supabase.from('daily_steps').select('id').eq('user_id', user.id).eq('record_date', todayStr).maybeSingle();

      if (existing) await supabase.from('daily_steps').update({ step_count: steps }).eq('id', existing.id);
      else await supabase.from('daily_steps').insert([{ user_id: user.id, record_date: todayStr, step_count: steps }]);
    } catch (e) { }
  };

  useEffect(() => {
    let subscription;
    const subscribePedometer = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);
        if (!available) return;

        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const result = await Pedometer.getStepCountAsync(start, end);
        const initialSteps = result?.steps || 0;
        setDeviceSteps(initialSteps);
        setDailyStats(prev => ({ ...prev, steps: initialSteps }));
        saveStepsToSupabase(initialSteps);

        subscription = Pedometer.watchStepCount(stepResult => {
          setDeviceSteps(prev => {
            const updated = Math.max(prev, stepResult.steps);
            setDailyStats(p => ({ ...p, steps: updated }));
            saveStepsToSupabase(updated);
            return updated;
          });
        });
      } catch (e) { setIsPedometerAvailable(false); }
    };
    subscribePedometer();
    return () => { if (subscription) subscription.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let isCancelled = false;
    const syncSleepFromHealth = async () => {
      try {
        const AppleHealthKitModule = await import('react-native-health');
        const AppleHealthKit = AppleHealthKitModule.default;
        const permissions = { permissions: { read: [AppleHealthKit.Constants.Permissions.SleepAnalysis] } };

        AppleHealthKit.initHealthKit(permissions, (err) => {
          if (err || isCancelled) return;
          const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
          const options = { startDate: startOfDay.toISOString(), endDate: new Date().toISOString() };

          AppleHealthKit.getSleepSamples(options, async (error, samples) => {
            if (error || isCancelled) return;
            let totalSleepMinutes = 0;
            (samples || []).forEach(sample => {
              const start = new Date(sample.startDate);
              const end = new Date(sample.endDate);
              const minutes = (end - start) / (1000 * 60);
              if (!Number.isNaN(minutes) && minutes > 0) totalSleepMinutes += minutes;
            });
            totalSleepMinutes = Math.round(totalSleepMinutes);
            if (!isCancelled && totalSleepMinutes > 0) {
              await saveSleepToSupabase(totalSleepMinutes);
              setDailyStats(prev => ({ ...prev, sleep: formatDuration(totalSleepMinutes) }));
            }
          });
        });
      } catch (e) { }
    };
    syncSleepFromHealth();
    return () => { isCancelled = true; };
  }, []);

  useFocusEffect(useCallback(() => {
    // user?.id is in the deps because useCallback pins the closure: without it
    // the memoised function keeps the `user` from first render (null, before the
    // session loads) and every later focus re-runs that stale copy — which is
    // why signing in left the screen empty until something forced a remount.
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    fetchProfileAndStats();
  }, [user?.id]));

  const getRecommendedCalories = () => {
    if (!userProfile) return 2000;
    const weight = parseFloat(userProfile.weight) || 70;
    const height = parseFloat(userProfile.height) || 170;
    const age = parseInt(userProfile.age) || 25;
    const sex = userProfile.sex === 'F' ? 'F' : 'M';
    const goal = userProfile.goal || 'maintain';
    const workouts = parseInt(userProfile.workouts_per_week) || 3;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = sex === 'M' ? bmr + 5 : bmr - 161;

    let multiplier = 1.2;
    if (workouts >= 6) multiplier = 1.725;
    else if (workouts >= 3) multiplier = 1.55;
    else if (workouts >= 1) multiplier = 1.375;

    let tdee = bmr * multiplier;

    if (goal === 'lose_weight') tdee -= 500;
    else if (goal === 'build_muscle' || goal === 'gain_strength') tdee += 300;

    return Math.max(1200, Math.round(tdee));
  };

  const fetchCompletedWorkouts = useCallback(async () => {
    if (!user) { setCompletedWorkouts([]); return; }
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const { data } = await supabase.from('workout_completions').select('id, workout_name, completed_at, duration_minutes').eq('user_id', user.id).gte('completed_at', weekAgo.toISOString()).order('completed_at', { ascending: false });
    setCompletedWorkouts(data || []);
  }, []);

  const fetchAchievements = useCallback(async () => {
    if (!user) { setAchievements([]); return; }

    // The catalogue is every badge that exists; the second query is what this
    // user has unlocked. Merging them lets locked badges stay visible as goals.
    const [{ data: catalogue }, { data: unlocked }] = await Promise.all([
      supabase.from('achievements').select('*').order('sort_order'),
      supabase.from('user_achievements').select('code, unlocked_at').eq('user_id', user.id),
    ]);

    setAchievements(mergeAchievements(catalogue, unlocked));
  }, [user]);

  useEffect(() => {
    if (!isProfileModalVisible) return;
    fetchCompletedWorkouts();
    fetchAchievements();
  }, [isProfileModalVisible, fetchCompletedWorkouts, fetchAchievements]);

  const toggleHistoryExpand = () => setIsHistoryExpanded(prev => !prev);



  const fetchProfileAndStats = async () => {
    if (user) {
      setIsLoggedIn(true);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profile) {
        setUserProfile(profile);
        setStepsGoal(profile.step_goal || 10000);
      }

      const now = new Date();
      const todayStr = todayKey();
      const isoMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: foodLogs } = await supabase
        .from('scanned_foods')
        .select('calories, protein, carbs, fats')
        .eq('user_id', user.id)
        .gte('scanned_at', isoMidnight);

      const macroTotals = (foodLogs || []).reduce(
        (sum, log) => ({
          calories: sum.calories + (Number(log.calories) || 0),
          protein: sum.protein + (Number(log.protein) || 0),
          carbs: sum.carbs + (Number(log.carbs) || 0),
          fats: sum.fats + (Number(log.fats) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const { data: workoutsToday } = await supabase.from('workout_completions').select('duration_minutes').eq('user_id', user.id).gte('completed_at', isoMidnight);
      const totalActivityMinutes = workoutsToday ? workoutsToday.reduce((sum, w) => sum + (Number(w.duration_minutes) || 0), 0) : 0;

      const { data: statLog } = await supabase.from('daily_stats').select('activity_minutes, water_ml, sleep_minutes').eq('user_id', user.id).eq('date', todayStr).maybeSingle();
      const totalWaterMl = statLog?.water_ml ?? 0;
      const totalSleepMinutes = statLog?.sleep_minutes ?? 0;

      await supabase.from('daily_stats').upsert(
        { user_id: user.id, date: todayStr, activity_minutes: totalActivityMinutes, water_ml: totalWaterMl, sleep_minutes: totalSleepMinutes },
        { onConflict: 'user_id,date' }
      );

      setDailyStats(prev => ({
        ...prev,
        ...macroTotals,
        activity: totalActivityMinutes,
        water: totalWaterMl,
        sleep: formatDuration(totalSleepMinutes),
      }));

      const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (tasksData) setTasks(tasksData);
    } else {
      setIsLoggedIn(false); setUserProfile(null);
      setDailyStats(prev => ({ ...prev, calories: 0, activity: 0, sleep: "0 m", water: 0 })); setTasks([]);
    }
  };

  const addWater = async (amount) => {
    // Amount may be negative — the modal offers an undo for a mis-tapped entry.
    const newWaterValue = Math.max(0, dailyStats.water + amount);
    setDailyStats(prev => ({ ...prev, water: newWaterValue }));
    setWaterModalVisible(false);

    try {
      if (!user) return;
      const todayStr = todayKey();

      const { data: currentStat } = await supabase.from('daily_stats').select('id, water_ml').eq('user_id', user.id).eq('date', todayStr).maybeSingle();

      if (currentStat) await supabase.from('daily_stats').update({ water_ml: (currentStat.water_ml ?? 0) + amount }).eq('id', currentStat.id);
      else await supabase.from('daily_stats').insert([{ user_id: user.id, date: todayStr, activity_minutes: 0, water_ml: amount }]);

      const waterTask = tasks.find(t => t.type === 'water');
      if (waterTask) {
        // Award only on the transition across the goal, not on every sip after
        // it. Comparing the value before and after is what makes that possible.
        const wasCompleted = (dailyStats.water / 1000) >= waterTask.goal;
        const isCompletedNow = (newWaterValue / 1000) >= waterTask.goal;

        if (!wasCompleted && isCompletedNow) {
          // award_xp increments in the database. Reading xp, adding 30 and
          // writing it back is the pattern that let the daily spin reset
          // everyone's total to zero.
          const { data: updated } = await supabase.rpc('award_xp', {
            xp_delta: 30,
            energy_delta: 0,
          });

          if (updated) {
            setUserProfile((prev) => ({ ...prev, xp: updated.xp }));
            showXpToast(30, 'Water goal reached 💧');
            checkAchievements();
          }
        }
      }
    } catch (e) {
      // A failed water write is not worth interrupting the user for; the value
      // reverts on the next refresh.
    }
  };

  /**
   * Asks the server which achievements this action unlocked, and announces any
   * that came back. Safe to call often — it only ever returns what is new.
   */
  const checkAchievements = async () => {
    const { data: unlocked } = await supabase.rpc('check_achievements');
    if (unlocked?.length) {
      showXpToast(0, `${unlocked[0].name} unlocked 🏆`);
      fetchAchievements();
    }
  };

  const handleAddTask = async (type = taskType) => {
    let finalTitle = "";
    let finalGoal = parseFloat(newTaskGoal) || 0;

    if (type === 'manual') { if (!newTaskTitle.trim()) return; finalTitle = newTaskTitle; }
    else if (type === 'water') { if (!finalGoal) return; finalTitle = `Drink ${finalGoal}L Water`; }
    else if (type === 'gym') { if (!finalGoal) return; finalTitle = `GYM for ${finalGoal.toLocaleString()} min`; }

    resetAndCloseModal();
    if (!user) return;

    const existing = tasks.find(t => t.type === type);
    if ((type === 'gym' || type === 'water') && existing) {
      setTasks(prev => prev.map(t => t.id === existing.id ? { ...t, title: finalTitle, goal: finalGoal } : t));
      await supabase.from('tasks').update({ title: finalTitle, goal: finalGoal }).eq('id', existing.id);
      return;
    }

    const tempId = Date.now().toString();
    const newTask = { id: tempId, title: finalTitle, goal: finalGoal, type: type, completed: false };
    setTasks(prev => [...prev, newTask]);

    try {
      const { data } = await supabase.from('tasks').insert([{ user_id: user.id, title: newTask.title, goal: newTask.goal, type: newTask.type, completed: false }]).select();
      if (data && data.length > 0) setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
    } catch (err) {}
  };

  const resetAndCloseModal = () => {
    setAddTaskModalVisible(false); setIsCustomExpanded(false); setNewTaskTitle(''); setNewTaskGoal(''); setTaskType('manual');
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (user) await supabase.from('tasks').delete().eq('id', id);
  };

  /**
   * Manual tasks record WHICH DAY they were ticked, not just that they were.
   * Without the date, `completed` stayed true forever and "Daily Quests"
   * never reset — the checklist was permanently green after the first day.
   */
  const toggleTask = async (id, currentStatus) => {
    if (isEditMode) return;
    const today = todayKey();
    const nowCompleted = !currentStatus;
    const completedOn = nowCompleted ? today : null;

    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: nowCompleted, completed_on: completedOn } : t))
    );

    if (!user) return;
    const { error } = await supabase
      .from('tasks')
      .update({ completed: nowCompleted, completed_on: completedOn })
      .eq('id', id);

    if (error) {
      // Put the row back the way it was so the tick matches what is stored.
      setTasks(prev =>
        prev.map(t => (t.id === id ? { ...t, completed: currentStatus } : t))
      );
      Alert.alert('Could not save', error.message);
    }
  };

  const isTaskAutoCompleted = (task) => {
    if (task.type === 'water') return (dailyStats.water / 1000) >= task.goal;
    if (task.type === 'steps') return dailyStats.steps >= task.goal;
    if (task.type === 'gym') return dailyStats.activity >= task.goal;
    // A manual task counts as done only if it was ticked TODAY.
    return task.completed_on === todayKey();
  };

  const renderAvatar = (size, iconSize) => {
    const theme = getAvatar(userProfile?.equipped_avatar);
    let strokeColor = isLoggedIn ? theme.color : colors.textFaint;
    let borderWidth = 1;
    let extraStyles = {};

    if (isLoggedIn) {
      if (theme.type === 'holo') {
        borderWidth = 2;
        extraStyles = { shadowColor: theme.color, shadowOpacity: 1, shadowRadius: 15 };
      } else if (theme.type === 'inferno_avatar') {
        borderWidth = 2;
        extraStyles = { shadowColor: theme.color, shadowOpacity: 0.8, shadowRadius: 8 };
      } else if (theme.type === 'void') {
        borderWidth = 3;
        extraStyles = { shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: 5 };
      } else {
        if (currentLevel >= 40) { strokeColor = '#FF00FF'; borderWidth = 4; extraStyles = { shadowColor: '#FF00FF', shadowOpacity: 0.8, shadowRadius: 10 }; }
        else if (currentLevel >= 30) { strokeColor = '#00FFFF'; borderWidth = 3; extraStyles = { shadowColor: '#00FFFF', shadowOpacity: 0.5 }; }
        else if (currentLevel >= 20) { strokeColor = colors.energy; borderWidth = 3; }
        else if (currentLevel >= 10) { strokeColor = '#C0C0C0'; borderWidth = 2; }
        else if (currentLevel >= 5) { strokeColor = '#CD7F32'; borderWidth = 2; }
      }
    }

    return (
      <View style={[
        styles.avatarBase,
        { width: size, height: size, borderRadius: size / 2, borderColor: strokeColor, borderWidth },
        extraStyles,
        isLoggedIn && theme.type === 'demon' && { borderStyle: 'dashed' },
        isLoggedIn && theme.type === 'glitch' && { borderRadius: size / 4 }
      ]}>
        <User size={iconSize} color={isLoggedIn ? (theme.type === 'glitch' ? '#00EAFF' : theme.color) : '#888'} />
        {isLoggedIn && theme.type === 'royal' && <Crown color={theme.color} size={iconSize * 0.8} style={styles.avatarCrown} fill="rgba(255, 215, 0, 0.3)" />}
        {isLoggedIn && (theme.type === 'demon' || theme.type === 'inferno_avatar') && <Flame color={theme.color} size={size * 0.8} style={styles.avatarFlameBack} />}
        {isLoggedIn && theme.type === 'glitch' && <User size={iconSize} color="#FF00FF" style={styles.avatarGlitchOverlay} />}
      </View>
    );
  };

const renderProgressShape = () => {
    const theme = getRing(userProfile?.equipped_ring);
    // Guard against divide-by-zero when the user has no step goal set.
    const safeStepsGoal = stepsGoal > 0 ? stepsGoal : 10000;
    const progress = Math.min(dailyStats.steps / safeStepsGoal, 1);
    const offset = theme.perimeter - (theme.perimeter * progress);

    // Each ring is drawn three times: a blurred copy for the glow, a dark
    const renderShape = (points, isCircle = false) => {
      if (isCircle) {
        return (
          <G transform="rotate(-90 50 50)">
            {/* Glow: same shape, thicker stroke, Gaussian blur. */}
            <Circle cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="8" fill="transparent" opacity="0.7" filter="url(#glow)" />
            {/* Track and progress arc, drawn sharp on top of the glow. */}
            <Circle cx="50" cy="50" r="45" stroke="#121212" strokeWidth="3" fill="transparent" />
            <Circle cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="3" fill="transparent" strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round" />
          </G>
        );
      }
      return (
        <G>
          {/* Glow, following the exact polygon outline. */}
          <Polygon points={points} stroke={theme.color} strokeWidth="8" fill="transparent" strokeLinejoin="round" opacity="0.7" filter="url(#glow)" />
          {/* Track and progress outline. */}
          <Polygon points={points} stroke="#121212" strokeWidth="3" fill="transparent" strokeLinejoin="round" />
          <Polygon points={points} stroke={theme.color} strokeWidth="3" fill="transparent" strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    };

    // Rings with a `points` polygon are drawn as that shape; the rest are circles.
    const shapeContent = theme.points ? renderShape(theme.points) : renderShape(null, true);

    return (
      <View style={styles.progressContainer}>
        <View style={styles.ringWrapper}>
          
          <Svg height={300} width={300} viewBox="-20 -20 140 140" style={{ position: 'absolute' }}>
            
            {/* stdDeviation controls how far the glow spreads. */}
            <Defs>
              <Filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <FeGaussianBlur stdDeviation="6" result="blur" />
              </Filter>
            </Defs>
            
            {shapeContent}
            
            {theme.type === 'pulse' && (
              <Circle cx="50" cy="50" r="32" stroke={theme.color} strokeWidth="1.5" fill="transparent" opacity={0.4} strokeDasharray={190} strokeDashoffset={offset * 0.7} filter="url(#glow)" />
            )}
          </Svg>
          
          {theme.type === 'inferno' && (
            <>
              <Flame color={colors.streak} size={35} style={[styles.absoluteIcon, { top: -15 }]} fill={colors.streak} />
              <Flame color={colors.streak} size={35} style={[styles.absoluteIcon, { bottom: -15, transform: [{rotate: '180deg'}] }]} fill={colors.streak} />
            </>
          )}
        </View>
        
        <View style={styles.stepsInfoContainer}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Footprints size={24} color={theme.color} />
             <TouchableOpacity accessibilityLabel="More information" activeOpacity={0.7}
               onPress={() => Alert.alert('Step syncing', 'Your steps are read automatically and in real time from the motion sensor on your phone.')}
               style={{marginLeft: 6, padding: 6}}
             >
               <Info size={16} color={colors.textMuted} />
             </TouchableOpacity>
          </View>
          <Text style={styles.stepCount}>{dailyStats.steps}</Text>
          <Text style={styles.stepGoal}>of {stepsGoal} steps</Text>
        </View>
      </View>
    );
  };

  const renderTaskItem = (item) => {
    const completed = isTaskAutoCompleted(item);
    return (
      <View key={item.id} style={[styles.taskCard, completed && styles.neonBorder]}>
        <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => toggleTask(item.id, item.completed)}>
          {completed ? <CheckCircle2 size={24} color={colors.accent} /> : <View style={styles.circleOutline} />}
          <View style={{ marginLeft: 16 }}>
            <Text style={styles.taskTitleText}>{item.title}</Text>
            {item.type === 'water' && <Text style={styles.taskSub}>{(dailyStats.water / 1000).toFixed(2)}L / {item.goal}L</Text>}
            {item.type === 'gym' && <Text style={styles.taskSub}>{dailyStats.activity} min / {item.goal} min</Text>}
          </View>
        </TouchableOpacity>
        {isEditMode && <TouchableOpacity accessibilityLabel="Delete" activeOpacity={0.7} onPress={() => deleteTask(item.id)}><Trash2 color={colors.danger} size={20} /></TouchableOpacity>}
      </View>
    );
  };

  const renderSetupItem = (type, title) => {
    return (
      <View key={type} style={[styles.taskCard, { borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[styles.circleOutline, { borderStyle: 'dashed', borderColor: '#444' }]} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={[styles.taskTitleText, { color: colors.textSecondary }]}>{title}</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.7} style={styles.setupBtn} onPress={() => { setTaskType(type); setAddTaskModalVisible(true); }}>
          <Text style={styles.setupBtnText}>Set up</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const taskElements = [];
  const gymTask = tasks.find(t => t.type === 'gym');
  const waterTask = tasks.find(t => t.type === 'water');
  const customTasks = tasks.filter(t => t.type === 'manual');

  if (gymTask) taskElements.push(renderTaskItem(gymTask));
  else taskElements.push(renderSetupItem('gym', 'Gym for -- minutes'));

  if (waterTask) taskElements.push(renderTaskItem(waterTask));
  else taskElements.push(renderSetupItem('water', 'Drink -- L Water'));

  customTasks.forEach(t => taskElements.push(renderTaskItem(t)));

  const visibleTasks = isTasksCollapsed ? taskElements.slice(0, 2) : taskElements;

  return (
    <SafeAreaView style={styles.container}>

      {xpToast && (
        <Animated.View style={[styles.xpToastContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.xpToastContent}>
            <View style={styles.xpToastIconBg}>
              {xpToast.amount > 0 ? (
                <Star color={colors.water} size={24} fill={colors.water} />
              ) : (
                <Trophy color={colors.energy} size={24} fill={colors.energy} />
              )}
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.xpToastTitle}>{xpToast.title}</Text>
              {/* Achievements pass 0 — showing "+0 XP" would read as a bug. */}
              {xpToast.amount > 0 && <Text style={styles.xpToastAmount}>+{xpToast.amount} XP</Text>}
            </View>
          </View>
        </Animated.View>
      )}

      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={400} intensity={0.5} />
        <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}>

          <ScreenHeader
            title={`Hello, ${isLoggedIn ? userProfile?.first_name || 'User' : 'Guest'}`}
            right={
              <View style={styles.headerActions}>
                {isLoggedIn && (
                  <>
                    {/* Streak: flame and a number, nothing else. It is a status
                        light, not a card — the detail lives in the calendar. */}
                    <Press
                      scale={0.94}
                      style={styles.headerPill}
                      onPress={() => setStreakVisible(true)}
                      accessibilityLabel={`Streak: ${userProfile?.current_streak || 0} days. Open calendar.`}
                    >
                      <Flame
                        color={colors.streak}
                        size={15}
                        fill={(userProfile?.current_streak || 0) > 0 ? colors.streak : 'transparent'}
                      />
                      <Text style={[styles.pillValue, { color: colors.streak }]}>
                        {userProfile?.current_streak || 0}
                      </Text>
                    </Press>

                    {/* Energy reads as currency: the chevron is what tells you
                        it goes somewhere rather than just reporting a number. */}
                    <Press
                      scale={0.94}
                      style={styles.headerPill}
                      onPress={() => navigation.navigate('ShopScreen')}
                      accessibilityLabel={`${userProfile?.energy_points || 0} energy. Open shop.`}
                    >
                      <Zap color={colors.energy} size={15} fill={colors.energy} />
                      <Text style={[styles.pillValue, { color: colors.energy }]}>
                        {userProfile?.energy_points ?? 0}
                      </Text>
                      <ChevronRight color={colors.textFaint} size={13} />
                    </Press>
                  </>
                )}

                <Press scale={0.94} onPress={() => setMenuVisible(true)} accessibilityLabel="Open menu">
                  <Avatar profile={userProfile} size={40} muted={!isLoggedIn} />
                </Press>
              </View>
            }
          />

          {renderProgressShape()}

          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Daily Quests</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setIsTasksCollapsed(!isTasksCollapsed)} style={{ marginLeft: 10 }}>
                {isTasksCollapsed ? <ChevronDown color={colors.accent} size={22} /> : <ChevronUp color={colors.accent} size={22} />}
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isEditMode && (
                <TouchableOpacity accessibilityLabel="Add" activeOpacity={0.7} onPress={() => { setTaskType('manual'); setAddTaskModalVisible(true); }} style={[styles.editButtonBorder, { marginRight: 10 }]}>
                  <Plus color={colors.accent} size={24} />
                </TouchableOpacity>
              )}
              <TouchableOpacity activeOpacity={0.7} onPress={() => setIsEditMode(!isEditMode)} style={styles.editButtonBorder}>
                {isEditMode ? <Check color={colors.accent} size={24} /> : <Edit2 color={colors.accent} size={22} />}
              </TouchableOpacity>
            </View>
          </View>

          <View>
            {visibleTasks}
          </View>

          <Text style={styles.eyebrow}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <StatCardWrapper
              icon={<Flame size={15} color={colors.accent} />}
              label="Calories"
              value={Math.round(dailyStats.calories)}
              unit={`of ${getRecommendedCalories()}`}
              color={colors.accent}
              progress={dailyStats.calories / getRecommendedCalories()}
            />
            <StatCardWrapper
              icon={<Clock size={15} color={colors.activity} />}
              label="Activity"
              value={dailyStats.activity}
              unit="min"
              color={colors.activity}
              progress={dailyStats.activity / 60}
            />
            <StatCardWrapper
              icon={<Moon size={15} color={colors.sleep} />}
              label="Sleep"
              value={dailyStats.sleep}
              unit=""
              color={colors.sleep}
              hint={Platform.OS === 'ios' ? 'From Apple Health' : 'iOS only for now'}
            />
            <StatCardWrapper
              icon={<Droplets size={15} color={colors.water} />}
              label="Water"
              value={(dailyStats.water / 1000).toFixed(1)}
              unit="L"
              color={colors.water}
              progress={dailyStats.water / 2500}
              onPress={() => setWaterModalVisible(true)}
            />
          </View>

          <Text style={styles.eyebrow}>Macros</Text>
          <MacroRings
            totals={dailyStats}
            targets={macroTargets(userProfile, getRecommendedCalories())}
          />
        </ScrollView>
      </LinearGradient>

      <Modal visible={isAddTaskModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={resetAndCloseModal}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContentTasks}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{taskType === 'gym' ? 'Set Gym Goal' : taskType === 'water' ? 'Set Water Goal' : 'New Custom Task'}</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={resetAndCloseModal} style={styles.closeBtnContainer} accessibilityLabel="Close">
                  <X color={colors.textMuted} size={24} />
                </TouchableOpacity>
              </View>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

                {taskType === 'manual' && (
                  <View style={styles.expandedContent}>
                    <TextInput style={styles.modalInput} placeholder="E.g. Morning Yoga" placeholderTextColor={colors.textFaint} value={newTaskTitle} onChangeText={setNewTaskTitle} />
                    <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={() => handleAddTask('manual')}><Text style={styles.saveBtnText}>Add Task</Text></TouchableOpacity>
                  </View>
                )}

                {(taskType === 'gym' || taskType === 'water') && (
                  <View style={{ width: '100%', marginTop: 10 }}>
                    <TextInput style={styles.modalInput} placeholder={taskType === 'gym' ? "Goal: 45 min" : "Goal: 2.5 liters"} placeholderTextColor={colors.textFaint} keyboardType="numeric" value={newTaskGoal} onChangeText={(t) => setNewTaskGoal(t.replace(/[^0-9.]/g, ''))} />
                    <TouchableOpacity activeOpacity={0.7} style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={() => handleAddTask(taskType)}><Text style={styles.saveBtnText}>Save Goal</Text></TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={styles.menuOverlaySide}>
          <TouchableOpacity activeOpacity={0.7} style={styles.menuCloseArea} onPress={() => setMenuVisible(false)} />
          <View style={styles.sideMenuContent}>

            {/* The whole profile block is tappable, not just the avatar. */}
            <TouchableOpacity activeOpacity={0.7}
              style={styles.sidebarProfileSection}
              onPress={() => {
                if (isLoggedIn) {
                  setMenuVisible(false);
                  setProfileModalVisible(true);
                }
              }}
            >
              {renderAvatar(56, 30)}
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={styles.sidebarName}>{isLoggedIn ? (userProfile?.first_name || 'User') : 'Guest'}</Text>

                {isLoggedIn && userProfile?.equipped_title && (
                   <Text style={{color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 6}}>{userProfile.equipped_title}</Text>
                )}

                {isLoggedIn ? (
                  <View>
                    <View style={styles.sidebarXpBarBg}>
                      <View style={[styles.sidebarXpBarFill, { width: xpPercentage }]} />
                    </View>
                    <Text style={styles.sidebarXpText}>Lvl {currentLevel} • {currentLevelXp}/100 XP</Text>
                  </View>
                ) : (
                  <Text style={[styles.viewProfileSidebar, { color: colors.textSecondary }]}>Not logged in</Text>
                )}
              </View>
              {isLoggedIn && <ChevronRight color={colors.textFaint} size={24} />}
            </TouchableOpacity>

            <View style={styles.menuDivider} />
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.menuGroupTitle}>Your data</Text>
              <MenuOption
                icon={<Activity color={colors.textMuted} size={20}/>}
                label="Analytics"
                onPress={() => { setMenuVisible(false); navigation.navigate('StatsScreen'); }}
              />
              <MenuOption
                icon={<Scale color={colors.textMuted} size={20}/>}
                label="Body weight"
                onPress={() => { setMenuVisible(false); setWeightSheetVisible(true); }}
                disabled={!isLoggedIn}
              />

              <Text style={styles.menuGroupTitle}>Settings</Text>
              <MenuOption
                icon={<Bell color={colors.textMuted} size={20}/>}
                label="Rest timer alerts"
                value={restAlerts ? 'On' : 'Off'}
                onPress={toggleRestAlerts}
              />
              <MenuOption
                icon={<Ruler color={colors.textMuted} size={20}/>}
                label="Units"
                value="Metric (kg, cm)"
                onPress={() => Alert.alert('Units', 'Imperial units are not supported yet. Everything is shown in kg and cm.')}
              />
              <MenuOption
                icon={<HelpCircle color={colors.textMuted} size={20}/>}
                label="How scoring works"
                onPress={() =>
                  Alert.alert(
                    'How scoring works',
                    'XP: 50 per workout, +20 when you lift over 1000 kg, 30 for hitting your water goal.\n\n' +
                    'Energy: 5 per minute trained, up to 500 a session. Spend it in the Shop.\n\n' +
                    'Streak: one workout on consecutive calendar days. Miss a day and it resets, but the old streak can be bought back.'
                  )
                }
              />
            </ScrollView>
            <View style={styles.menuFooter}>
              {isLoggedIn ? (
                <TouchableOpacity activeOpacity={0.7} style={styles.logoutButton} onPress={async () => { await supabase.auth.signOut(); setMenuVisible(false); fetchProfileAndStats(); }}>
                  <LogIn color={colors.danger} size={20} /><Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity activeOpacity={0.7} style={styles.loginButtonWrapper} onPress={() => { setMenuVisible(false); navigation.navigate('AuthScreen'); }}>
                  <Text style={styles.loginButtonText}>Log In / Create Account</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isWaterModalVisible} animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContentWater}>
            <Droplets size={48} color={colors.water} style={{ marginBottom: 26 }} />
            <Text style={styles.modalTitle}>Add Water</Text>
            <View style={styles.selectionGrid}>
              {WATER_AMOUNTS.map((amount) => (
                <TouchableOpacity activeOpacity={0.7} key={amount} style={styles.amountButton} onPress={() => addWater(amount)}>
                  <Text style={styles.amountButtonText}>+{amount}ml</Text>
                </TouchableOpacity>
              ))}
            </View>

            {dailyStats.water > 0 && (
              <TouchableOpacity activeOpacity={0.7}
                style={styles.undoWaterBtn}
                onPress={() => addWater(-250)}
                accessibilityLabel="Remove 250 millilitres"
              >
                <Text style={styles.undoWaterText}>−250ml (undo)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.7} onPress={() => setWaterModalVisible(false)}><Text style={styles.closeBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isProfileModalVisible} animationType="slide">
        <View style={styles.profileContainer}>
          <LinearGradient colors={gradients.flat} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>

              <View style={styles.profileHeaderContent}>
                <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setProfileModalVisible(false)} style={styles.backBtn}>
                  <X color={colors.text} size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <TouchableOpacity activeOpacity={0.7}
                  style={styles.editBtn}
                  onPress={() => setEditProfileVisible(true)}
                  accessibilityLabel="Edit profile"
                >
                  <Edit3 color={colors.onAccent} size={18} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                <View style={styles.mainInfoSection}>
                  <View style={styles.bigAvatarContainer}>
                    {renderAvatar(110, 60)}
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>LVL {currentLevel}</Text>
                    </View>
                  </View>
                  <Text style={styles.userNameBig}>{userProfile?.first_name || 'Athlete'}</Text>

                  {userProfile?.equipped_title && (
                    <Text style={{color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 6}}>{userProfile.equipped_title}</Text>
                  )}

                  <View style={styles.xpBarContainer}>
                    <View style={styles.xpBarHeader}>
                      <Text style={styles.xpBarText}>{totalXp} Total XP</Text>
                      <Text style={styles.xpBarText}>{currentLevelXp} / 100 XP</Text>
                    </View>
                    <View style={styles.xpBarBackground}>
                      <View style={[styles.xpBarFill, { width: xpPercentage }]} />
                    </View>
                  </View>

                  <Text style={[styles.userBio, { marginTop: 16 }]}>"Dedication has no off-season."</Text>
                </View>

                <View style={styles.streakCard}>
                  <LinearGradient
                    colors={['rgba(46, 211, 198, 0.15)', 'rgba(0,0,0,0)']}
                    start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                    style={styles.streakGradient}
                  >
                    <View style={styles.streakIconContainer}>
                      <Flame size={40} color={colors.accent} fill={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.streakValue}>{userProfile?.current_streak || 0} days</Text>
                      <Text style={styles.streakLabel}>Current Streak</Text>
                    </View>
                    <View style={styles.streakChartPlaceholder}>
                      <Activity size={24} color={colors.accent} opacity={0.5} />
                    </View>
                  </LinearGradient>
                </View>

                <View style={styles.statsRow}>
                  <ProfileStatItem label="Weight" value={`${userProfile?.weight || 0}kg`} onPress={() => setWeightSheetVisible(true)} />
                  <ProfileStatItem label="Height" value={`${userProfile?.height || 0}cm`} />
                  <ProfileStatItem label="Workouts" value={`${userProfile?.workouts_per_week || 0}/wk`} />
                </View>

                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.profileSectionTitle}>Recent Activity</Text>
                    <TouchableOpacity activeOpacity={0.7} style={styles.viewHistoryBtn} onPress={toggleHistoryExpand}>
                      <Text style={styles.seeMore}>View History</Text>
                      {isHistoryExpanded ? <ChevronUp color={colors.accent} size={20} style={{ marginLeft: 6 }} /> : <ChevronDown color={colors.accent} size={20} style={{ marginLeft: 6 }} />}
                    </TouchableOpacity>
                  </View>

                  {isHistoryExpanded && completedWorkouts.length === 0 && (
                    <Text style={styles.historyEmptyText}>No workouts in the last 7 days.</Text>
                  )}
                  {isHistoryExpanded && completedWorkouts.length > 0 && completedWorkouts.map((w) => (
                    <RecentWorkoutItem key={w.id} title={w.workout_name} date={formatRelativeDate(w.completed_at)} duration={`${w.duration_minutes} min`} />
                  ))}
                  {!isHistoryExpanded && completedWorkouts.length > 0 && (
                    <RecentWorkoutItem title={completedWorkouts[0].workout_name} date={formatRelativeDate(completedWorkouts[0].completed_at)} duration={`${completedWorkouts[0].duration_minutes} min`} />
                  )}
                </View>

                <View style={styles.sectionWrapper}>
                  <Text style={styles.profileSectionTitle}>Achievements</Text>
                  <AchievementGrid achievements={achievements} />
                </View>

              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        </View>
      </Modal>

      <StreakCalendar visible={isStreakVisible} onClose={() => setStreakVisible(false)} />

      <WeightSheet
        visible={isWeightSheetVisible}
        onClose={() => setWeightSheetVisible(false)}
        profile={userProfile}
        onSaved={(weight) => {
          setUserProfile((prev) => ({ ...prev, weight }));
          refreshProfile();
        }}
      />

      <EditProfileSheet
        visible={isEditProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        profile={userProfile}
        onSaved={(updates) => {
          // Update the copy this screen renders, and the shared one, so the
          // new calorie target shows immediately rather than after a refetch.
          setUserProfile((prev) => ({ ...prev, ...updates }));
          setStepsGoal(updates.step_goal);
          refreshProfile();
        }}
      />

    </SafeAreaView>
  );
}

function MenuOption({ icon, label, value, onPress, disabled }) {
  return (
    <TouchableOpacity activeOpacity={0.7}
      style={[styles.menuOption, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
    >
      <View style={styles.menuOptionLeft}>{icon}<Text style={styles.menuOptionText}>{label}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value ? <Text style={styles.menuOptionValue}>{value}</Text> : null}
        <ChevronRight color={colors.borderLight} size={18} />
      </View>
    </TouchableOpacity>
  );
}

/**
 * A tile in Daily Summary.
 *
 * Same anatomy as the macro rings, which is what makes the two sections read as
 * one screen: a tinted glyph, the figure at full size, and a track underneath
 * that fills toward the goal.
 *
 * `progress` is optional. Sleep has no target worth drawing, so its tile omits
 * the bar rather than showing an empty one — an empty track reads as zero, not
 * as not-applicable.
 */
function StatCardWrapper({ icon, label, value, unit, color, onPress, progress, hint }) {
  const pct = typeof progress === 'number' ? Math.min(Math.max(progress, 0), 1) : null;

  return (
    <Press
      scale={onPress ? 0.965 : 1}
      style={styles.statCardWrapper}
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={onPress ? `${label}: ${value} ${unit}. Tap to change.` : `${label}: ${value} ${unit}`}
    >
      <View style={styles.statCardInner}>
        <View style={styles.statTop}>
          <View style={[styles.statGlyph, { backgroundColor: `${color}1F` }]}>{icon}</View>
          <Text style={styles.statLabel}>{label}</Text>
        </View>

        <View style={styles.statValueContainer}>
          <Text style={styles.statValue}>{value}</Text>
          {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
        </View>

        {pct !== null ? (
          <View style={styles.statTrack}>
            <View style={[styles.statFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
          </View>
        ) : (
          <Text style={styles.statHint} numberOfLines={1}>{hint || ' '}</Text>
        )}
      </View>
    </Press>
  );
}

function ProfileStatItem({ label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.statBox} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function RecentWorkoutItem({ title, date, duration, intensity }) {
  return (
    <View style={styles.recentItem}>
      <View style={styles.recentLeft}>
        <View style={styles.recentIconBox}><TrendingUp color={colors.accent} size={18}/></View>
        <View>
          <Text style={styles.recentTitle}>{title}</Text>
          <Text style={styles.recentSub}>{date}</Text>
        </View>
      </View>
      {intensity != null ? (
        <View style={[styles.intensityTag, { borderColor: intensity === 'Hard' || intensity === 'Insane' ? colors.danger : colors.accent }]}>
          <Text style={styles.intensityText}>{intensity}</Text>
        </View>
      ) : (
        <View style={[styles.intensityTag, { borderColor: colors.accent }]}>
          <Text style={styles.intensityText}>{duration}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { padding: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Pills, not cards: small, self-contained, and clearly separate from the
  // avatar beside them. The value carries the colour so the number is the
  // thing you read, not the container.
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    paddingLeft: 11,
    paddingRight: 9,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillValue: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 10 },
  dateText: { color: colors.textMuted, marginTop: 16, fontSize: 15 },
  welcomeText: { color: colors.text, fontSize: 34, fontWeight: '800' },

  xpToastContainer: { position: 'absolute', top: 0, left: 20, right: 20, zIndex: 9999, alignItems: 'center' },
  xpToastContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.water, shadowColor: colors.water, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, width: '100%' },
  xpToastIconBg: { backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: 10, borderRadius: 18 },
  xpToastTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  xpToastAmount: { color: colors.water, fontSize: 15, fontWeight: '900', marginTop: 2 },

  progressContainer: { alignItems: 'center', marginVertical: 40, justifyContent: 'center' },
  ringWrapper: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
  absoluteIcon: { position: 'absolute' },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: colors.text, fontSize: 40, fontWeight: '800' },
  stepGoal: { color: colors.textMuted, fontSize: 15 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16, alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  editButtonBorder: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 21, backgroundColor: colors.card },
  emptyTaskPlaceholder: { height: 120, marginHorizontal: 20, borderRadius: 28, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  emptyTaskText: { color: '#333', marginTop: 10, fontWeight: '600' },

  taskCard: { backgroundColor: colors.card, marginHorizontal: 20, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  neonBorder: { borderColor: colors.accent + 'AA' },
  circleOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderLight },
  taskTitleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  taskSub: { color: colors.textMuted, fontSize: 13 },

  setupBtn: { backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  setupBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },


  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: 20,
    marginTop: 26,
    marginBottom: 12,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  // Two per row with a gap between, so the tiles line up with the macro card
  // below rather than sitting on their own rhythm.
  statCardWrapper: { width: '47.5%', flexGrow: 1 },
  statCardInner: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statGlyph: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 10 },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  statUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  // A 3pt track is enough to read as progress without becoming a second
  // headline competing with the number above it.
  statTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceHigh, marginTop: 12, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 2 },
  statHint: { color: colors.textFaint, fontSize: 11, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContentTasks: { backgroundColor: colors.sheet, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 26, width: '100%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  closeBtnContainer: { padding: 6, backgroundColor: colors.surfaceHigh, borderRadius: 14 },
  expandableSection: { width: '100%', paddingVertical: 10 },
  sectionMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabelMain: { color: colors.text, fontSize: 17, fontWeight: '700' },
  expandedContent: { marginTop: 20 },
  modalInput: { backgroundColor: colors.surfaceHigh, borderRadius: 18, padding: 20, color: colors.text, fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: colors.accent, padding: 20, borderRadius: 18, alignItems: 'center' },
  saveBtnText: { color: colors.onAccent, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.surfaceHigh, marginVertical: 16 },
  suggestedGridTasks: { flexDirection: 'row', justifyContent: 'space-between' },
  suggestedItem: { alignItems: 'center', paddingVertical: 26, borderRadius: 28, backgroundColor: colors.surfaceRaised, width: '48%', borderWidth: 1, borderColor: 'transparent' },
  selectedItem: { backgroundColor: '#252525', borderColor: colors.borderLight },
  suggestedText: { color: colors.textMuted, marginTop: 10, fontWeight: '600' },

  menuOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
  menuCloseArea: { flex: 1 },
  sideMenuContent: { width: width * 0.75, backgroundColor: colors.card, padding: 26, paddingTop: 60 },
  sidebarProfileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingVertical: 10 },
  sidebarName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  viewProfileSidebar: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },

  sidebarXpBarBg: { height: 4, backgroundColor: colors.surfaceHigh, borderRadius: 2, marginTop: 10, width: 100, overflow: 'hidden' },
  sidebarXpBarFill: { height: '100%', backgroundColor: colors.accent },
  sidebarXpText: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontWeight: '600' },

  menuDivider: { height: 1, backgroundColor: colors.surfaceHigh, marginVertical: 20 },
  menuGroupTitle: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 16 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  menuOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  menuOptionText: { color: colors.text, fontSize: 15, marginLeft: 16 },
  menuOptionValue: { color: colors.textMuted, fontSize: 13, marginRight: 10 },
  menuFooter: { marginTop: 'auto', paddingTop: 20 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600', marginLeft: 16 },

  loginButtonWrapper: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 'auto' },
  loginButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },

  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContentWater: { backgroundColor: colors.card, borderRadius: 32, padding: 26, width: '85%', alignItems: 'center' },
  modalTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 26 },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountButton: { backgroundColor: '#1c2533', paddingVertical: 20, borderRadius: 20, marginBottom: 16, width: '47%', alignItems: 'center' },
  amountButtonText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  undoWaterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 10,
  },
  undoWaterText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  closeBtnText: { color: colors.textMuted, fontSize: 15, marginTop: 10 },

  avatarBase: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, overflow: 'hidden' },
  avatarCrown: { position: 'absolute', top: -12 },
  avatarFlameBack: { position: 'absolute', opacity: 0.3, zIndex: -1 },
  avatarGlitchOverlay: { position: 'absolute', opacity: 0.5, marginLeft: 6 },

  profileContainer: { flex: 1, backgroundColor: colors.background },
  profileHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  backBtn: { padding: 6 },
  editBtn: { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mainInfoSection: { alignItems: 'center', marginTop: 10, marginBottom: 26 },
  bigAvatarContainer: { position: 'relative' },
  levelBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  levelText: { color: colors.onAccent, fontSize: 11, fontWeight: '600' },
  userNameBig: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 16 },

  xpBarContainer: { width: '80%', marginTop: 16 },
  xpBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpBarText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  xpBarBackground: { height: 10, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: colors.accent },

  userBio: { color: colors.textMuted, fontSize: 15, fontStyle: 'italic', marginTop: 6 },

  streakCard: { marginHorizontal: 20, marginBottom: 26, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(46, 211, 198, 0.3)' },
  streakGradient: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  streakIconContainer: { marginRight: 20, shadowColor: colors.accent, shadowRadius: 15, shadowOpacity: 0.6 },
  streakValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  streakLabel: { color: colors.accent, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  streakChartPlaceholder: { marginLeft: 'auto' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 26 },
  statBox: { backgroundColor: colors.card, width: '30%', padding: 16, borderRadius: 24, alignItems: 'center' },
  statBoxValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  statBoxLabel: { color: colors.textMuted, fontSize: 11, marginTop: 6 },

  sectionWrapper: { paddingHorizontal: 20, marginBottom: 26 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  profileSectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  seeMore: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  viewHistoryBtn: { flexDirection: 'row', alignItems: 'center' },
  historyEmptyText: { color: colors.textMuted, fontSize: 15, marginTop: 10 },

  recentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 22, marginBottom: 10 },
  recentLeft: { flexDirection: 'row', alignItems: 'center' },
  recentIconBox: { backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 10, borderRadius: 14, marginRight: 16 },
  recentTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  recentSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  intensityTag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  intensityText: { color: colors.text, fontSize: 11, fontWeight: '600' },

});