import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Dimensions, TouchableOpacity, Platform, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Flame, Trophy, Menu, User, Crown, Plus, Edit2, Check, Star, CloudOff, Trash2, TriangleAlert } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Polygon, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import Reanimated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing } from 'react-native-reanimated';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedPolygon = Reanimated.createAnimatedComponent(Polygon);
import { supabase } from '../lib/supabase';
import { colors, levelTiers, radius, spacing } from '../theme';
import { getAvatar, getRing } from '../constants/cosmetics';
import { levelInfo } from '../lib/level';
import { todayKey, formatDuration } from '../lib/date';
import { gradients } from '../theme';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import MacroRings from '../components/MacroRings';
import { calorieTarget, macroTargets } from '../lib/nutrition';
import { WATER_GOAL_ML } from '../constants/content';
import WeightSheet from '../components/WeightSheet';
import { syncReminders } from '../lib/reminders';
import { readSleepMinutes } from '../lib/health';
import { deleteAccount } from '../lib/deleteAccount';
import { exportMyData } from '../lib/exportData';
import WaterSheet from '../components/WaterSheet';
import AmbientGlow from '../components/AmbientGlow';
import useRefresh from '../lib/useRefresh';
import { unwrap } from '../lib/query';
import SettingsDrawer from '../components/dashboard/SettingsDrawer';
import SummaryArc from '../components/dashboard/SummaryArc';
import TaskGoalSheet from '../components/dashboard/TaskGoalSheet';
import useDeviceSettings from '../lib/useDeviceSettings';
import useStepCounter from '../lib/useStepCounter';
import Press from '../components/Press';
import DailyQuests from '../components/DailyQuests';
import WeeklyQuests from '../components/WeeklyQuests';
import { useConfirm } from '../components/ConfirmDialog';
import { useT } from '../i18n';

const { width } = Dimensions.get('window');

/** Morning / afternoon / evening, from the device clock. */
/** "7h 30m" back to 7.5, for the sleep dial. */
function sleepHours(label) {
  const m = /^(\d+)h\s*(\d+)?m?/.exec(String(label || ''));
  if (!m) return 0;
  return Number(m[1]) + (Number(m[2]) || 0) / 60;
}

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation, route }) {
  const { t } = useT();
  const confirmAction = useConfirm();
  const { refreshControl } = useRefresh(() => fetchProfileAndStats());
  const { user, refreshProfile, pendingWorkouts, syncPending, units, setUnits } = useAuth();
  const scrollViewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isWeightSheetVisible, setWeightSheetVisible] = useState(false);
  // Rest and reminder preferences live on the device; see lib/useDeviceSettings.
  // The callback runs at tap time, by when refreshReminders below exists.
  const {
    restAlerts, restSeconds, streakReminders, waterReminders,
    toggleRestAlerts, cycleRestLength, toggleStreakReminders, toggleWaterReminders,
  } = useDeviceSettings({ onRemindersChanged: () => refreshReminders() });

  const [isWaterModalVisible, setWaterModalVisible] = useState(false);
  const [isAddTaskModalVisible, setAddTaskModalVisible] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [stepsGoal, setStepsGoal] = useState(10000);
  /** A failed refresh. Shown as a strip rather than an error screen: the
   *  dashboard still holds the last figures it managed to read, and blanking
   *  a whole screen of them to report a timeout is the worse trade. */
  const [statsError, setStatsError] = useState(null);
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

  /** Drives the step ring's fill. Held here so it survives re-renders. */
  /**
   * Rebuilds the evening reminders from today's state.
   *
   * Deliberately reads `dailyStats` and `userProfile` rather than taking
   * arguments: it is called from the toggles as well as after a fetch, and
   * threading four values through both call sites is how they drift apart.
   */
  const streakDays = userProfile?.current_streak || 0;

  /**
   * Deletes the account, after saying plainly what goes.
   *
   * Two prompts rather than one. The first names what is destroyed; the second
   * exists because the list is long enough that people stop reading, and this
   * is the one action in the app with no undo. Play requires the feature; it
   * does not require making it easy to do by accident.
   */
  const confirmDeleteAccount = async () => {
    const first = await confirmAction({
      tone: 'danger',
      icon: Trash2,
      title: 'Delete your account?',
      message: 'Your profile, workouts, history, records, photos, messages and friendships will be permanently deleted.',
      confirmLabel: 'Continue',
      cancelLabel: 'Keep account',
    });
    if (!first) return;

    // Asked twice on purpose: the list above is long enough that people stop
    // reading, and this is the one action in the app with no undo.
    const sure = await confirmAction({
      tone: 'danger',
      icon: TriangleAlert,
      title: 'This cannot be undone',
      message: 'Everything is deleted right away and cannot be recovered.',
      confirmLabel: 'Delete forever',
    });
    if (!sure) return;

    try {
      await deleteAccount(user?.id);
      // The session change re-runs the focus fetch as a guest; fetching here
      // would still carry the deleted user and fail.
      setMenuVisible(false);
    } catch (e) {
      Alert.alert('Could not delete the account', 'Nothing was deleted. Check your connection and try again.');
    }
  };

  const refreshReminders = useCallback(() => {
    if (!isLoggedIn) return;
    syncReminders({
      trainedToday: dailyStats.activity > 0,
      streak: userProfile?.current_streak || 0,
      waterMl: dailyStats.water,
      waterGoalMl: WATER_GOAL_ML,
    });
  }, [isLoggedIn, dailyStats.activity, dailyStats.water, userProfile?.current_streak]);

  // Reschedules whenever the numbers it depends on change — finishing a workout
  // cancels tonight's nudge without needing a relaunch.
  useEffect(() => { refreshReminders(); }, [refreshReminders]);

  const ringFill = useSharedValue(0);

  useEffect(() => {
    const goal = stepsGoal > 0 ? stepsGoal : 10000;
    ringFill.value = withDelay(
      200,
      withTiming(Math.min(dailyStats.steps / goal, 1), {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [dailyStats.steps, stepsGoal, ringFill]);

  // The equipped ring decides the outline's perimeter, so it is resolved here
  // rather than inside the render helper — the animated props depend on it.
  const ringTheme = getRing(userProfile?.equipped_ring);

  // This shape can be a polygon and carries a blur filter, so it draws its own
  // outline instead of using ProgressArc. The fill comes from the same shared
  // value, on the UI thread, so the whole screen moves together.
  const animatedOutline = useAnimatedProps(() => ({
    strokeDashoffset: ringTheme.perimeter * (1 - ringFill.value),
  }));

  const animatedPulse = useAnimatedProps(() => ({
    strokeDashoffset: 190 * (1 - ringFill.value * 0.7),
  }));

  const [tasks, setTasks] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [taskType, setTaskType] = useState('manual');

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
    if (!user) return;

    const { error } = await supabase.from('daily_stats').upsert(
      { user_id: user.id, date: todayKey(), sleep_minutes: totalSleepMinutes },
      { onConflict: 'user_id,date' }
    );

    // Not worth an alert — the figure is read again on the next launch — but
    // swallowing it entirely is how the sleep column stayed empty without
    // anyone finding out.
    if (error) console.warn(`[Sportify] Could not save sleep: ${error.message}`);
  };

  useEffect(() => {
    if (route.params?.newActivityMinutes) {
      setDailyStats(prev => ({ ...prev, activity: prev.activity + route.params.newActivityMinutes }));
      navigation.setParams({ newActivityMinutes: undefined });
    }
  }, [route.params?.newActivityMinutes, navigation]);

  // Live steps from the motion sensor, saved as they change — lib/useStepCounter.
  useStepCounter(user, (steps) => setDailyStats((prev) => ({ ...prev, steps })));

  /**
   * Last night's sleep from Apple Health.
   *
   * The reading, the window and the overlap handling live in lib/health.js —
   * see the note there for the three bugs this replaces, which together are why
   * every stored sleep figure was zero.
   */
  // `user?.id` is in the deps, not an empty array. The session resolves after
  // the first render, so an effect that runs once captures the version of
  // saveSleepToSupabase that closed over `user === null` — and its `if (!user)
  // return` means the write never happens. Same stale-closure shape that left
  // screens empty after signing in.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    (async () => {
      const minutes = await readSleepMinutes();
      // null means "could not read" — a missing native module, a refused
      // permission. Writing 0 for that would record a night of no sleep.
      if (cancelled || minutes === null) return;

      await saveSleepToSupabase(minutes);
      if (!cancelled) setDailyStats((prev) => ({ ...prev, sleep: formatDuration(minutes) }));
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    // user?.id is in the deps because useCallback pins the closure: without it
    // the memoised function keeps the `user` from first render (null, before the
    // session loads) and every later focus re-runs that stale copy — which is
    // why signing in left the screen empty until something forced a remount.
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    fetchProfileAndStats();
  }, [user?.id]));

  // Shared with MetricScreen through lib/nutrition, so the ring and the
  // history cannot disagree about the same day's target.
  const getRecommendedCalories = () => calorieTarget(userProfile);

  const fetchProfileAndStats = async () => {
    if (user) {
      setIsLoggedIn(true);
      setStatsError(null);

      try {
        const now = new Date();
        const todayStr = todayKey();
        const isoMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Five independent reads, sent together. They used to go one after
        // another — five round trips before the screen could show today.
        //
        // Workouts are unwrapped for a reason that is not cosmetic: a failed
        // read came back null, which made the activity total 0, which the
        // upsert below then WROTE over the real figure. A failed read must not
        // cause a write, so any failure lands in the catch before it.
        const [profile, foodLogs, workoutsToday, statLog, tasksData] = await Promise.all([
          unwrap(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()),
          unwrap(supabase
            .from('scanned_foods')
            .select('calories, protein, carbs, fats')
            .eq('user_id', user.id)
            .gte('scanned_at', isoMidnight)),
          unwrap(supabase.from('workout_completions').select('duration_minutes').eq('user_id', user.id).gte('completed_at', isoMidnight)),
          unwrap(supabase.from('daily_stats').select('activity_minutes, water_ml, sleep_minutes').eq('user_id', user.id).eq('date', todayStr).maybeSingle()),
          unwrap(supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: true })),
        ]);

        if (profile) {
          setUserProfile(profile);
          setStepsGoal(profile.step_goal || 10000);
        }

        const macroTotals = (foodLogs || []).reduce(
          (sum, log) => ({
            calories: sum.calories + (Number(log.calories) || 0),
            protein: sum.protein + (Number(log.protein) || 0),
            carbs: sum.carbs + (Number(log.carbs) || 0),
            fats: sum.fats + (Number(log.fats) || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );

        const totalActivityMinutes = workoutsToday ? workoutsToday.reduce((sum, w) => sum + (Number(w.duration_minutes) || 0), 0) : 0;
        const totalWaterMl = statLog?.water_ml ?? 0;
        const totalSleepMinutes = statLog?.sleep_minutes ?? 0;

        // Only activity is written here, because only activity is computed here.
        //
        // This used to send water and sleep back too, straight from the read a
        // few lines above — a read-modify-write on values this function does not
        // own. Sleep syncs from Apple Health on its own timer: if that landed
        // between the read and this write, the fresh figure was overwritten with
        // the stale zero. Same for water if you tapped +250 in the gap. It is the
        // shape that wiped people's XP on the daily spin.
        //
        // And only when it changed: the screen is focused many times a day, and
        // each focus used to write the same number back.
        if ((statLog?.activity_minutes ?? null) !== totalActivityMinutes) {
          await supabase.from('daily_stats').upsert(
            { user_id: user.id, date: todayStr, activity_minutes: totalActivityMinutes },
            { onConflict: 'user_id,date' }
          );
        }

        setDailyStats(prev => ({
          ...prev,
          ...macroTotals,
          activity: totalActivityMinutes,
          water: totalWaterMl,
          sleep: formatDuration(totalSleepMinutes),
        }));

        if (tasksData) setTasks(tasksData);
      } catch (e) {
        // Nothing is zeroed and nothing is written. Whatever was last read stays
        // on screen, with a strip saying it may be stale.
        setStatsError(e?.message || 'Could not refresh.');
      }
    } else {
      setIsLoggedIn(false); setUserProfile(null);
      // A strip left over from the signed-in session would tell a guest their
      // data failed to load.
      setStatsError(null);
      setDailyStats(prev => ({ ...prev, calories: 0, protein: 0, carbs: 0, fats: 0, activity: 0, sleep: '0 m', water: 0 })); setTasks([]);
    }
  };

  /**
   * Logs water through one server call.
   *
   * Was a read-modify-write: select the row, add the amount, write it back. Two
   * taps of +250 in quick succession both read the same starting value and both
   * write the same total, so one is lost. The goal XP had the same race one
   * level up — both could observe the crossing and award twice.
   *
   * add_water locks the day's row, does the arithmetic and the award in a
   * single transaction, and returns the resulting total. The optimistic update
   * below is replaced by that figure rather than trusted.
   */
  /**
   * What to do once the sheet has logged something.
   *
   * The sheet owns the call, so the total comes back from the server rather
   * than being recomputed here — adding the amount locally is the shape that
   * loses one of two quick taps.
   */
  const onWaterLogged = (result) => {
    setDailyStats((prev) => ({ ...prev, water: result.water_ml }));

    if (result.goal_reached) {
      setUserProfile((prev) => (prev ? { ...prev, xp: (prev.xp || 0) + result.xp } : prev));
      showXpToast(result.xp, 'Water goal reached');
      checkAchievements();
    }
  };

  /**
   * Asks the server which achievements this action unlocked, and announces any
   * that came back. Safe to call often — it only ever returns what is new.
   */
  const checkAchievements = async () => {
    const { data: unlocked } = await supabase.rpc('check_achievements');
    if (unlocked?.length) {
      showXpToast(0, `${unlocked[0].name} unlocked`);
    }
  };

  const handleAddTask = async (type = taskType) => {
    let finalTitle = "";
    let finalGoal = parseFloat(newTaskGoal) || 0;

    // Stored titles for goal quests are a fallback only: the list draws them
    // from the goal (buildQuests), in the reader's language.
    if (type === 'manual') { if (!newTaskTitle.trim()) return; finalTitle = newTaskTitle.trim(); }
    else if (type === 'water') { if (!finalGoal) return; finalTitle = `Drink ${finalGoal} L of water`; }
    else if (type === 'gym') { if (!finalGoal) return; finalTitle = `Train for ${finalGoal} minutes`; }

    resetAndCloseModal();
    if (!user) return;

    const existing = tasks.find(task => task.type === type);
    if ((type === 'gym' || type === 'water') && existing) {
      setTasks(prev => prev.map(task => task.id === existing.id ? { ...task, title: finalTitle, goal: finalGoal } : task));
      const { error } = await supabase.from('tasks').update({ title: finalTitle, goal: finalGoal }).eq('id', existing.id);
      if (error) {
        setTasks(prev => prev.map(task => task.id === existing.id ? existing : task));
        Alert.alert('Could not save the new goal', 'Check your connection and try again.');
      }
      return;
    }

    const tempId = Date.now().toString();
    const newTask = { id: tempId, title: finalTitle, goal: finalGoal, type: type, completed: false };
    setTasks(prev => [...prev, newTask]);

    // A quest that only ever existed on screen would vanish at the next
    // refresh; better to take it back now and say why.
    const { data, error } = await supabase.from('tasks').insert([{ user_id: user.id, title: newTask.title, goal: newTask.goal, type: newTask.type, completed: false }]).select();
    if (error || !data?.length) {
      setTasks(prev => prev.filter(task => task.id !== tempId));
      Alert.alert('Could not add the quest', 'Check your connection and try again.');
      return;
    }
    setTasks(prev => prev.map(task => task.id === tempId ? data[0] : task));
  };

  const resetAndCloseModal = () => {
    setAddTaskModalVisible(false); setNewTaskTitle(''); setNewTaskGoal(''); setTaskType('manual');
  };

  const deleteTask = async (id) => {
    const before = tasks;
    setTasks(prev => prev.filter(task => task.id !== id));
    if (!user) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      setTasks(before);
      Alert.alert('Could not remove the quest', 'Check your connection and try again.');
    }
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

    const before = tasks.find((task) => task.id === id);
    setTasks(prev =>
      prev.map(task => (task.id === id ? { ...task, completed: nowCompleted, completed_on: completedOn } : task))
    );

    if (!user) return;
    const { error } = await supabase
      .from('tasks')
      .update({ completed: nowCompleted, completed_on: completedOn })
      .eq('id', id);

    if (error) {
      // Put the whole row back, `completed_on` included: whether a quest is
      // done today is read from that date, so restoring only `completed` left
      // the tick on screen after the save had failed.
      if (before) setTasks(prev => prev.map(task => (task.id === id ? before : task)));
      Alert.alert('Could not save that', 'Check your connection and try again.');
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
        // From theme.levelTiers, the same ladder Avatar.js reads.
        //
        // This block used to carry its own copy, still on the pre-redesign
        // magenta and cyan — so a level 40 account showed #FF6BD6 in every list
        // and #FF00FF here, two colours for one rank on one screen.
        const tier = levelTiers.find((t) => currentLevel >= t.minLevel);
        if (tier) {
          strokeColor = tier.color;
          borderWidth = tier.borderWidth;
          if (tier.glow) {
            extraStyles = { shadowColor: tier.color, shadowOpacity: 0.7, shadowRadius: 10 };
          }
        }
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
        <User size={iconSize} color={isLoggedIn ? (theme.type === 'glitch' ? '#00EAFF' : theme.color) : colors.textFaint} />
        {isLoggedIn && theme.type === 'royal' && <Crown color={theme.color} size={iconSize * 0.8} style={styles.avatarCrown} fill="rgba(222, 184, 102, 0.3)" />}
        {isLoggedIn && (theme.type === 'demon' || theme.type === 'inferno_avatar') && <Flame color={theme.color} size={size * 0.8} style={styles.avatarFlameBack} />}
        {isLoggedIn && theme.type === 'glitch' && <User size={iconSize} color="#FF00FF" style={styles.avatarGlitchOverlay} />}
      </View>
    );
  };

const renderProgressShape = () => {
    const theme = ringTheme;
    // Guard against divide-by-zero when the user has no step goal set.
    const safeStepsGoal = stepsGoal > 0 ? stepsGoal : 10000;
    const progress = Math.min(dailyStats.steps / safeStepsGoal, 1);


    // Each ring is drawn three times: a blurred copy for the glow, a dark
    const renderShape = (points, isCircle = false) => {
      if (isCircle) {
        return (
          <G transform="rotate(-90 50 50)">
            {/* Glow: same shape, thicker stroke, Gaussian blur. */}
            <Circle cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="8" fill="transparent" opacity="0.7" filter="url(#glow)" />
            {/* Track and progress arc, drawn sharp on top of the glow. */}
            <Circle cx="50" cy="50" r="45" stroke={colors.surface} strokeWidth="3" fill="transparent" />
            <AnimatedCircle cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="3" fill="transparent" strokeDasharray={theme.perimeter} strokeLinecap="round" animatedProps={animatedOutline} />
          </G>
        );
      }
      return (
        <G>
          {/* Glow, following the exact polygon outline. */}
          <Polygon points={points} stroke={theme.color} strokeWidth="8" fill="transparent" strokeLinejoin="round" opacity="0.7" filter="url(#glow)" />
          {/* Track and progress outline. */}
          <Polygon points={points} stroke={colors.surface} strokeWidth="3" fill="transparent" strokeLinejoin="round" />
          <AnimatedPolygon points={points} stroke={theme.color} strokeWidth="3" fill="transparent" strokeDasharray={theme.perimeter} strokeLinecap="round" strokeLinejoin="round" animatedProps={animatedOutline} />
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
              <AnimatedCircle cx="50" cy="50" r="32" stroke={theme.color} strokeWidth="1.5" fill="transparent" opacity={0.4} strokeDasharray={190} filter="url(#glow)" animatedProps={animatedPulse} />
            )}
          </Svg>
          
          {theme.type === 'inferno' && (
            <>
              <Flame color={colors.streak} size={35} style={[styles.absoluteIcon, { top: -15 }]} fill={colors.streak} />
              <Flame color={colors.streak} size={35} style={[styles.absoluteIcon, { bottom: -15, transform: [{rotate: '180deg'}] }]} fill={colors.streak} />
            </>
          )}
        </View>
        
        {/* No emblem and no info button. The ring is already a picture of
            steps, so a footprint above the number said it twice; and where the
            figure comes from is a fact, not an action — it belongs in a line of
            text rather than behind a button that opens an alert to say it. */}
        <View style={styles.stepsInfoContainer}>
          <Text style={styles.stepCount}>{Number(dailyStats.steps || 0).toLocaleString()}</Text>
          <Text style={styles.stepGoal}>{t('of {goal} steps', { goal: Number(stepsGoal).toLocaleString() })}</Text>
          <Text style={styles.stepSource}>from your phone's motion sensor</Text>
        </View>
      </View>
    );
  };

  /**
   * The quest list, as plain data.
   *
   * Rendering used to happen here — two helpers returning JSX, assembled into an
   * array. Describing each quest instead lets DailyQuests decide how to draw it,
   * and keeps the "is this done" rules in one place rather than split between a
   * predicate and two renderers.
   */
  const buildQuests = () => {
    const list = [];
    const gymTask = tasks.find((t) => t.type === 'gym');
    const waterTask = tasks.find((t) => t.type === 'water');

    if (gymTask) {
      list.push({
        key: gymTask.id,
        id: gymTask.id,
        type: 'gym',
        title: t('Train for {count} minutes', { count: Number(gymTask.goal) || 0 }),
        done: isTaskAutoCompleted(gymTask),
        detail: `${dailyStats.activity} / ${gymTask.goal} min`,
        raw: gymTask,
      });
    } else {
      list.push({ key: 'setup-gym', type: 'gym', title: t('Train for -- minutes'), setup: true });
    }

    if (waterTask) {
      list.push({
        key: waterTask.id,
        id: waterTask.id,
        type: 'water',
        title: t('Drink {liters} L of water', { liters: waterTask.goal }),
        done: isTaskAutoCompleted(waterTask),
        detail: `${(dailyStats.water / 1000).toFixed(1)} / ${waterTask.goal} L`,
        accessibilityLabel: t('Log water'),
        raw: waterTask,
      });
    } else {
      list.push({ key: 'setup-water', type: 'water', title: t('Drink -- L of water'), setup: true });
    }

    tasks.filter((t) => t.type === 'manual').forEach((t) => {
      list.push({
        key: t.id,
        id: t.id,
        type: 'manual',
        title: t.title,
        done: isTaskAutoCompleted(t),
        raw: t,
      });
    });

    return list;
  };

  const quests = buildQuests();

  /** Water is measured, so its row logs rather than ticks. */
  const onPressQuest = (quest) => {
    if (quest.type === 'water') return setWaterModalVisible(true);
    if (quest.type === 'gym') return;
    toggleTask(quest.id, quest.raw.completed);
  };

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

          {/* Stale, not empty. The figures below are the last ones that loaded,
              so the strip says which is which instead of letting zeros pass for
              a day in which you ate and drank nothing. */}
          {/* Sessions finished in a basement gym. Saying so beats an XP total
              that silently disagrees with what the user knows they did. */}
          {pendingWorkouts > 0 ? (
            <Press
              scale={0.99}
              style={styles.pendingStrip}
              onPress={syncPending}
              accessibilityLabel="Upload workouts waiting on this phone"
            >
              <CloudOff color={colors.energy} size={15} />
              <Text style={styles.pendingText} numberOfLines={1}>
                {pendingWorkouts} workout{pendingWorkouts === 1 ? '' : 's'} waiting to upload
              </Text>
              <Text style={styles.pendingAction}>Upload</Text>
            </Press>
          ) : null}

          {statsError ? (
            <Press
              scale={0.99}
              style={styles.staleStrip}
              onPress={fetchProfileAndStats}
              accessibilityLabel="Retry loading today's figures"
            >
              <CloudOff color={colors.textFaint} size={15} />
              <Text style={styles.staleText} numberOfLines={1}>
                Showing saved data
              </Text>
              <Text style={styles.staleAction}>Retry</Text>
            </Press>
          ) : null}

          {/* Avatar on the left, beside the name it belongs to — that is where a
              profile photo reads as "you" rather than as a control. The menu
              moves right as a hamburger, which says "settings" far more plainly
              than a face does.

              The streak and energy pills drop to their own row: in the top-right
              slot they were competing with the avatar for the same corner, and
              here they get room to be read rather than glanced past. */}
          {/* Everything on one row: identity left, status and menu right.
              The status pills sat on their own line before, which cost a whole
              band of vertical space to show two numbers. As compact chips they
              stay glanceable and the ring moves up into view. */}
          <View style={styles.topBar}>
            <Press
              scale={0.95}
              style={styles.identity}
              onPress={() => navigation.navigate(isLoggedIn ? 'ProfileScreen' : 'AuthScreen')}
              accessibilityLabel={isLoggedIn ? 'Open your profile' : 'Sign in'}
            >
              <Avatar profile={userProfile} size={42} muted={!isLoggedIn} />
              <View style={styles.identityText}>
                <Text style={styles.greeting}>{greetingFor(new Date())}</Text>
                {/* shrink + truncate so a long name gives way to the streak
                    rather than pushing it off the row. */}
                <Text style={styles.userName} numberOfLines={1}>
                  {isLoggedIn ? userProfile?.first_name || 'Athlete' : 'Guest'}
                </Text>
              </View>
            </Press>

            {/* Beside the name, not in the corner.
                A separate Press rather than nested inside the identity one —
                nesting two pressables means the inner swallows the outer's
                taps, and both here go somewhere different.

                Just the number. "5 days" reads as a label; the flame already
                says what is being counted, and the pill's raised surface and
                chevron say it goes somewhere. */}
            {isLoggedIn && (
              <Press
                scale={0.9}
                style={styles.streakPill}
                onPress={() => navigation.navigate('StreakScreen')}
                accessibilityRole="button"
                accessibilityLabel={`Streak: ${streakDays} ${streakDays === 1 ? 'day' : 'days'}. Open the calendar.`}
                hitSlop={10}
              >
                <Flame
                  color={streakDays > 0 ? colors.streak : colors.textFaint}
                  size={19}
                  fill={streakDays > 0 ? colors.streak : 'transparent'}
                />
                <Text style={[styles.streakPillText, streakDays > 0 && { color: colors.streak }]}>
                  {streakDays}
                </Text>
              </Press>
            )}

            <View style={{ flex: 1 }} />

            <View style={styles.topRight}>
              <Press
                scale={0.92}
                style={styles.menuBtn}
                onPress={() => setMenuVisible(true)}
                accessibilityLabel="Open menu"
              >
                <Menu color={colors.text} size={20} />
              </Press>
            </View>
          </View>

          {renderProgressShape()}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Quests</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isEditMode && (
                <TouchableOpacity accessibilityLabel="Add" activeOpacity={0.7} onPress={() => { setTaskType('manual'); setAddTaskModalVisible(true); }} style={[styles.editButtonBorder, { marginRight: 10 }]}>
                  <Plus color={colors.accent} size={24} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsEditMode(!isEditMode)}
                style={styles.editButtonBorder}
                accessibilityLabel={isEditMode ? 'Done editing tasks' : 'Edit tasks'}
              >
                {isEditMode ? <Check color={colors.accent} size={24} /> : <Edit2 color={colors.accent} size={22} />}
              </TouchableOpacity>
            </View>
          </View>

          <DailyQuests
            quests={quests}
            isEditMode={isEditMode}
            onPressQuest={onPressQuest}
            onSetup={(type) => { setTaskType(type); setAddTaskModalVisible(true); }}
            onDelete={deleteTask}
          />

          {/* The energy and XP a claim pays show up in the header straight away. */}
          <WeeklyQuests onClaimed={() => fetchProfileAndStats()} />

          <Text style={styles.eyebrow}>Daily Summary</Text>
          {/* Calories leads. It is the figure with a real target, the one
              people check most, and treating all four as equal rows made the
              block read as a settings list. The other three are supporting
              numbers and are sized like it. */}
          {/* Four columns in one band, each with its own gauge.
              Previous versions treated the four as either equal rows or one
              hero plus three extras. Both spent a lot of height. A band reads
              in a single glance, keeps the four comparable, and leaves the
              vertical space for the macro rings underneath.

              The gauge is a vertical bar rather than a ring, so it does not
              repeat the shape used by the step ring above and the macros
              below. */}
          {/* Colour as surface rather than as an accent line.
              Every earlier version kept the same neutral card and coloured a
              glyph or a bar inside it, so the four blocks were distinguished by
              a detail you had to look at. Tinting the tile itself makes each
              one recognisable before you read anything — and it lets the number
              sit on its own without a gauge competing beside it. */}
          <View style={styles.arcRow}>
            <SummaryArc
              index={0}
              color={colors.calories}
              icon="flame"
              value={Math.round(dailyStats.calories)}
              unit=""
              label="Calories"
              progress={dailyStats.calories / getRecommendedCalories()}
              onPress={() => navigation.navigate('MetricScreen', { metric: 'calories' })}
            />
            <SummaryArc
              index={1}
              color={colors.activity}
              icon="clock"
              value={dailyStats.activity}
              unit="min"
              label="Active"
              // Against your own training goal when you have set one.
              progress={dailyStats.activity / (Number(tasks.find((task) => task.type === 'gym')?.goal) || 60)}
              onPress={() => navigation.navigate('MetricScreen', { metric: 'activity' })}
            />
            <SummaryArc
              index={2}
              color={colors.water}
              icon="drop"
              value={(dailyStats.water / 1000).toFixed(1)}
              unit="L"
              label="Water"
              progress={dailyStats.water / WATER_GOAL_ML}
              onPress={() => navigation.navigate('MetricScreen', { metric: 'water' })}
            />
            <SummaryArc
              index={3}
              color={colors.sleep}
              icon="moon"
              value={dailyStats.sleep}
              unit=""
              label="Sleep"
              scaleMax={12}
              raw={sleepHours(dailyStats.sleep)}
              onPress={() => navigation.navigate('MetricScreen', { metric: 'sleep' })}
            />
          </View>

          <Text style={styles.eyebrow}>Macros</Text>
          <MacroRings
            totals={dailyStats}
            targets={macroTargets(userProfile, getRecommendedCalories())}
          />
        </ScrollView>
      </LinearGradient>

      <TaskGoalSheet
        visible={isAddTaskModalVisible}
        type={taskType}
        title={newTaskTitle}
        goal={newTaskGoal}
        onChangeTitle={setNewTaskTitle}
        onChangeGoal={setNewTaskGoal}
        onSave={handleAddTask}
        onClose={resetAndCloseModal}
      />

      <SettingsDrawer
        visible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        isLoggedIn={isLoggedIn}
        userProfile={userProfile}
        level={currentLevel}
        levelXp={currentLevelXp}
        xpPercentage={xpPercentage}
        renderAvatar={renderAvatar}
        units={units}
        setUnits={setUnits}
        restAlerts={restAlerts}
        streakReminders={streakReminders}
        waterReminders={waterReminders}
        onToggleRestAlerts={toggleRestAlerts}
        restSeconds={restSeconds}
        onCycleRestLength={cycleRestLength}
        onToggleStreakReminders={toggleStreakReminders}
        onToggleWaterReminders={toggleWaterReminders}
        onOpenProfile={() => navigation.navigate('ProfileScreen')}
        onOpenWeight={() => setWeightSheetVisible(true)}
        onOpenWater={() => setWaterModalVisible(true)}
        onOpenProgress={() => navigation.navigate('ProgressScreen')}
        onDeleteAccount={confirmDeleteAccount}
        onExportData={async () => {
          const result = await exportMyData();
          if (!result.ok) Alert.alert('Could not export your data', 'Check your connection and try again.');
        }}
        onSignOut={async () => { await supabase.auth.signOut(); setMenuVisible(false); }}
        onSignIn={() => navigation.navigate('AuthScreen')}
      />

      <WaterSheet
        visible={isWaterModalVisible}
        onClose={() => setWaterModalVisible(false)}
        currentMl={dailyStats.water}
        onLogged={onWaterLogged}
      />

      <WeightSheet
        visible={isWeightSheetVisible}
        onClose={() => setWeightSheetVisible(false)}
        profile={userProfile}
        onSaved={(weight) => {
          setUserProfile((prev) => ({ ...prev, weight }));
          refreshProfile();
        }}
      />


    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  staleStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  staleText: { flex: 1, color: colors.textMuted, fontSize: 12 },
  staleAction: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  pendingStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(222, 184, 102, 0.10)', borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  pendingText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '600' },
  pendingAction: { color: colors.energy, fontSize: 12, fontWeight: '700' },
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  // Pills, not cards: small, self-contained, and clearly separate from the
  // avatar beside them. The value carries the colour so the number is the
  // thing you read, not the container.

  xpToastContainer: { position: 'absolute', top: 0, left: 20, right: 20, zIndex: 9999, alignItems: 'center' },
  xpToastContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.water, shadowColor: colors.water, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, width: '100%' },
  xpToastIconBg: { backgroundColor: 'rgba(182, 184, 240, 0.2)', padding: 10, borderRadius: 18 },
  xpToastTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  xpToastAmount: { color: colors.water, fontSize: 15, fontWeight: '900', marginTop: 2 },

  progressContainer: { alignItems: 'center', marginVertical: 40, justifyContent: 'center' },
  ringWrapper: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
  absoluteIcon: { position: 'absolute' },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: colors.text, fontSize: 40, fontWeight: '800' },
  stepGoal: { color: colors.textMuted, fontSize: 15 },
  stepSource: { color: colors.textFaint, fontSize: 10, marginTop: 5, letterSpacing: 0.2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16, alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  editButtonBorder: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 21, backgroundColor: colors.card },


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
  // Two per row with a gap between, so the tiles line up with the macro card
  // below rather than sitting on their own rhythm.
  // A 3pt track is enough to read as progress without becoming a second
  // headline competing with the number above it.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // Chips, not pills: icon plus number only. At this size a word would wrap or
  // truncate, and the icon already says which number it is.
  // The flame and the number, nothing behind them. A chip needs a surface when
  // it sits among other chips; this one sits alone beside a name, and the
  // surface was doing nothing but taking up room.
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginLeft: 12,
  },
  streakPillText: {
    color: colors.textMuted, fontSize: 15, fontWeight: '800',
    letterSpacing: -0.3, fontVariant: ['tabular-nums'],
  },
  // shrink rather than flex:1 — the name yields to the streak beside it.
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, maxWidth: '62%' },
  identityText: { flexShrink: 1 },
  greeting: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  userName: { color: colors.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginTop: 1 },
  menuBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  // Equal halves rather than content-width pills: two numbers of similar
  // importance should not be sized by how many digits they happen to have.

  // The glyph sits inside the ring rather than beside it, so the tile has one
  // visual anchor instead of two.
  // 3pt, inset to the text column so it reads as belonging to this row rather
  // than as a divider between rows.

  // What is left is more actionable than what is eaten, so it gets the accent.


  // 44pt tall, 4pt wide: enough to read as a level without becoming a chart.

  // Along the bottom edge, full bleed: progress belongs to the tile rather than
  // sitting inside it as another element.

  arcRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    marginHorizontal: 16,
    paddingVertical: 18,
    paddingHorizontal: 6,
  },


  avatarBase: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, overflow: 'hidden' },
  avatarCrown: { position: 'absolute', top: -12 },
  avatarFlameBack: { position: 'absolute', opacity: 0.3, zIndex: -1 },
  avatarGlitchOverlay: { position: 'absolute', opacity: 0.5, marginLeft: 6 },


});