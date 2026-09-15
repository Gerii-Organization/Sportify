import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Dumbbell, Layout, ChevronDown, Bookmark, Compass, Pencil, Search, X, Check, Trash2, Copy, Globe, Timer } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { gradients } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import AmbientGlow from '../components/AmbientGlow';
import { unwrap } from '../lib/query';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import useRefresh from '../lib/useRefresh';
import { todayKey, currentWeekKeys, startOfWeekIso } from '../lib/date';
import { exercisesInGroup, MUSCLES } from '../constants/exercises';
import { trainingAdvice } from '../lib/advice';
import { useAuth } from '../context/AuthContext';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import WorkoutCard from '../components/WorkoutCard';
import TodayCard from '../components/TodayCard';
import SplitSheet from '../components/SplitSheet';
import ScheduleSheet from '../components/ScheduleSheet';
import { planFor, applyPlan, normaliseSchedule, isEmptySchedule } from '../lib/schedule';
import BottomSheet from '../components/BottomSheet';
import { sortWorkouts, popularId, musclesOf } from '../lib/workoutStats';
import { weeklyTarget } from '../lib/split';
import NewRoutineSheet from '../components/NewRoutineSheet';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonRoutines } from '../components/Skeleton';


/** The heading above the list. Mine is the default, so it names itself. */
const VIEW_TITLES = { mine: 'My routines', saved: 'Saved routines', browse: 'Browse' };

/**
 * Orders each list offers. Browse sorts on the server, where the whole table
 * is; the other two are short lists already on the phone.
 */
const SORTS = {
  mine: [['recent', 'Recent'], ['trained', 'Most trained'], ['name', 'Name']],
  saved: [['recent', 'Recent'], ['name', 'Name']],
  browse: [['recent', 'Newest'], ['saves', 'Most saved']],
};

export default function TrainingScreen({ navigation }) {
  const { user, profile, patchProfile } = useAuth();
  const confirmAction = useConfirm();
  const { refreshControl } = useRefresh(() => fetchMyWorkouts());
  const [myWorkouts, setMyWorkouts] = useState([]);
  const [suggestedWorkouts, setSuggestedWorkouts] = useState([]);
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  /** Local day keys, this calendar week, on which a workout was finished. */
  const [trainedDays, setTrainedDays] = useState([]);
  /** This week's sessions with their set snapshots, for the advice card. */
  const [weekSessions, setWeekSessions] = useState([]);
  /** 'mine' = your own plans, 'saved' = other people's you bookmarked,
   *  'browse' = everything public. */
  const [view, setView] = useState('mine');
  const [publicWorkouts, setPublicWorkouts] = useState([]);
  const [savedWorkouts, setSavedWorkouts] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  /** True while picking a workout to edit. Nothing else on the screen is
   *  reachable, so there is one thing to do and one way out. */
  const [editMode, setEditMode] = useState(false);
  const [splitSheetVisible, setSplitSheetVisible] = useState(false);
  /** Local copy so the card updates the moment the sheet saves, without
   *  waiting for the profile to be re-fetched. */
  const [split, setSplit] = useState(profile?.split || null);
  /** Browse filter. null means every muscle group. */
  const [browseMuscle, setBrowseMuscle] = useState(null);
  /** One box for both the workout's name and the person who wrote it. */
  const [browseQuery, setBrowseQuery] = useState('');
  /** 'recent' or 'saves'. */
  const [browseSort, setBrowseSort] = useState('recent');
  /** Set by whichever list fetch is feeding the current view. Shown only
   *  where the empty state would otherwise go, so a failed refresh with rows
   *  already on screen leaves those rows alone. */
  const [listError, setListError] = useState(null);
  /** Whether each list has finished its first load, so an empty list reads
   *  as loading rather than as "no routines" while the fetch is still out. */
  const [loadedViews, setLoadedViews] = useState({ mine: false, saved: false });
  /** Set while the name sheet is renaming rather than creating. */
  const [renaming, setRenaming] = useState(null);
  /** Filter over your own and saved routines. Browse has its own box. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  /** Order for the two lists sorted on the phone. Browse keeps browseSort. */
  const [sortBy, setSortBy] = useState({ mine: 'recent', saved: 'recent' });
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  /** workout_id → sessions in the last 30 days. Feeds "Most trained" and POPULAR. */
  const [timesTrained, setTimesTrained] = useState({});

  // The split was seeded once from the profile at mount — before the profile
  // had loaded on a cold start, so a saved split showed as "Set a split" and
  // the week counted against the sign-up number instead.
  useEffect(() => {
    setSplit(profile?.split || null);
  }, [profile?.split]);

  /** The week plan: a routine id or null per weekday — see lib/schedule.js. */
  const [schedule, setSchedule] = useState(profile?.training_schedule || null);
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);
  useEffect(() => {
    setSchedule(profile?.training_schedule || null);
  }, [profile?.training_schedule]);

  // Browse brings its own search box; a second one above it would be noise.
  useEffect(() => {
    if (view === 'browse') {
      setSearchOpen(false);
      setSearchQuery('');
    }
  }, [view]);

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
    if (!user) {
      setLoadedViews((v) => ({ ...v, mine: true }));
      return;
    }

    setListError(null);

    try {
      const data = await unwrap(supabase
        .from('user_workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }));
      if (data) setMyWorkouts(data);

      // Distinct days, not sessions: two workouts on Monday is one day of the
      // weekly target, which is how anyone counts "four times a week".
      // The snapshots come back too: the advice card needs to know which
      // muscles the week actually contained, not just that a session happened.
      const thisWeek = await unwrap(supabase
        .from('workout_completions')
        .select('completed_at, exercises')
        .eq('user_id', user.id)
        .gte('completed_at', startOfWeekIso()));

      setWeekSessions(thisWeek || []);
      setTrainedDays([...new Set((thisWeek || []).map((w) => todayKey(new Date(w.completed_at))))]);
    } catch (e) {
      // "No workouts yet" is a claim about your list. A dead network is a claim
      // about the connection. They rendered identically before this.
      setListError(e?.message || 'Something went wrong.');
    }

    setLoadedViews((v) => ({ ...v, mine: true }));

    // Which plans you actually run. Not worth an error state: without it the
    // list still works, it just cannot rank by use.
    const { data: recent } = await supabase
      .from('workout_completions')
      .select('workout_id')
      .eq('user_id', user.id)
      .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const counts = {};
    for (const row of recent || []) {
      if (row.workout_id) counts[row.workout_id] = (counts[row.workout_id] || 0) + 1;
    }
    setTimesTrained(counts);
  };

  const fetchPublicWorkouts = useCallback(async () => {
    setBrowseLoading(true);
    // The muscle filter runs on the server. Filtering here would apply to the
    // 30 rows that already came back, so "Legs only" would quietly miss plans
    // that fell outside the first page.
    setListError(null);

    try {
      const data = await unwrap(supabase.rpc('browse_workouts', {
        p_limit: 30,
        p_search: browseQuery.trim() || null,
        p_muscle: browseMuscle,
        p_sort: browseSort,
      }));
      setPublicWorkouts(data || []);
    } catch (e) {
      setListError(e?.message || 'Something went wrong.');
    } finally {
      setBrowseLoading(false);
    }
  }, [browseMuscle, browseQuery, browseSort]);

  const fetchSavedWorkouts = useCallback(async () => {
    setListError(null);

    try {
      setSavedWorkouts(await unwrap(supabase.rpc('get_saved_workouts')) || []);
    } catch (e) {
      setListError(e?.message || 'Something went wrong.');
    } finally {
      setLoadedViews((v) => ({ ...v, saved: true }));
    }
  }, []);

  useEffect(() => {
    if (view === 'browse') fetchPublicWorkouts();
  }, [view, browseMuscle, browseQuery, browseSort, fetchPublicWorkouts]);

  useEffect(() => {
    if (view === 'saved') fetchSavedWorkouts();
  }, [view, fetchSavedWorkouts]);

  /**
   * Bookmark, distinct from copying.
   *
   * Copying clones the plan into your own list, which is right when you mean to
   * change it and wrong when you only want to find it again — the copy stops
   * following the author's edits, and your list fills with plans you never
   * tried. Saving keeps the pointer.
   */
  const toggleSave = async (workoutId) => {
    const { data: nowSaved, error } = await supabase.rpc('toggle_saved_workout', {
      p_workout_id: workoutId,
    });

    if (error) return Alert.alert('Could not save this', error.message);

    setPublicWorkouts((list) =>
      list.map((w) => (w.id === workoutId ? { ...w, is_saved: nowSaved } : w))
    );
    if (!nowSaved) setSavedWorkouts((list) => list.filter((w) => w.id !== workoutId));
    else fetchSavedWorkouts();
  };

  const handleCopy = async (workoutId, name) => {
    const { data, error } = await supabase.rpc('copy_workout', { p_workout_id: workoutId });
    if (error || !data?.ok) {
      return Alert.alert('Could not copy it', 'This routine is no longer available.');
    }
    Alert.alert('Added', `"${name}" was added to your routines.`);
    fetchMyWorkouts();
    setView('mine');
  };

  /**
   * Opening something you saved rather than wrote.
   *
   * A saved workout is a bookmark on someone else's row. Editing it in place
   * would change their plan for everyone who saved it, so changing it means
   * taking a copy first — and that is a decision worth naming rather than
   * doing silently behind an edit button.
   *
   * Starting it is different, and needs no copy: you can run anyone's plan.
   */
  const openSavedWorkout = async (workout) => {
    if (!editMode) return openWorkoutDetail(workout);

    const ok = await confirmAction({
      icon: Copy,
      title: 'Edit your own copy?',
      message: `"${workout.name}" belongs to ${workout.author_name || 'someone else'}. You will edit a copy, and theirs stays the same.`,
      confirmLabel: 'Copy and edit',
    });
    if (ok) forkAndEdit(workout);
  };

  const forkAndEdit = async (workout) => {
    const { data, error } = await supabase.rpc('copy_workout', { p_workout_id: workout.id });

    if (error || !data?.ok) {
      return Alert.alert('Could not copy it', 'This routine is no longer available.');
    }

    await fetchMyWorkouts();
    setView('mine');

    // copy_workout returns the new row's id; open that, not the original.
    const copy = { ...workout, id: data.workout_id ?? data.id, is_public: false, is_saved: false };
    openWorkoutDetail(copy, true);
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

  /**
   * Publish or unpublish, from the list.
   *
   * The confirmation names what actually becomes visible — the plan, not the
   * weights you logged against it, which `copy_workout` strips before anyone
   * else sees them. People decline to share because they assume otherwise.
   */
  const toggleVisibility = async (workout) => {
    const next = !workout.is_public;

    const apply = async () => {
      const { error } = await supabase
        .from('user_workouts')
        .update({ is_public: next })
        .eq('id', workout.id);

      if (error) return Alert.alert('Could not change that', error.message);
      setMyWorkouts((list) => list.map((w) => (w.id === workout.id ? { ...w, is_public: next } : w)));
    };

    if (!next) return apply();

    const ok = await confirmAction({
      icon: Globe,
      title: 'Share this routine?',
      message: 'Anyone can find and copy it in Browse. The weights you lifted stay private.',
      confirmLabel: 'Share',
    });
    if (ok) apply();
  };

  /**
   * Renaming, from the list. Nothing else about the plan changes.
   *
   * Uses the same name sheet as creating one, rather than
   * `Alert.prompt` — that is iOS-only and silently does nothing on Android.
   */
  const promptRename = (workout) => {
    setRenaming(workout);
  };

  const commitRename = async (typed) => {
    const name = (typed || '').trim();
    const target = renaming;

    setRenaming(null);

    if (!target || !name || name === target.name) return;

    const { error } = await supabase
      .from('user_workouts')
      .update({ name })
      .eq('id', target.id);

    if (error) return Alert.alert('Could not rename it', error.message);
    setMyWorkouts((list) => list.map((w) => (w.id === target.id ? { ...w, name } : w)));
  };

  const confirmDeleteWorkout = async (workout) => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Trash2,
      title: `Delete "${workout.name}"?`,
      message: 'It will be removed from your routines. Workouts you already finished stay in your history.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    setMyWorkouts((list) => list.filter((w) => w.id !== workout.id));
    const { error } = await supabase.from('user_workouts').delete().eq('id', workout.id);
    if (error) {
      Alert.alert('Could not delete it', error.message);
      fetchMyWorkouts();
    }
  };

  const closeNewSheet = () => {
    setMainMenuVisible(false);
    setRenaming(null);
  };

  const handleCreateNamedWorkout = async (typed) => {
    const finalName = (typed || '').trim() || 'Custom Session';
    setMainMenuVisible(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: finalName, exercises: []
    }).select().single();

    if (data) {
      setMyWorkouts((list) => [data, ...list]);
      openWorkoutDetail(data);
    }
  };

  /**
   * Adds a suggested plan and leaves the sheet open. Resolves true once the
   * row is written, which is what turns its button into a tick.
   */
  const addPreset = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: item.name, duration: item.duration,
      intensity: item.intensity, exercises: item.exercises || []
    }).select().single();

    if (error || !data) {
      Alert.alert('Could not add it', error?.message || 'Please try again.');
      return false;
    }
    setMyWorkouts((list) => [data, ...list]);
    return true;
  };

  const handleSaveWorkout = (updatedWorkout) => {
    setMyWorkouts(prevWorkouts => prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
  };

  /** Sessions this week, reconciled with the split — see weeklyTarget. */
  const weekTarget = weeklyTarget(split, profile?.workouts_per_week);

  const advice = useMemo(
    () => applyPlan(
      trainingAdvice({
        sessions: weekSessions,
        target: weekTarget,
        today: todayKey(),
        trainedDays,
        split,
        weekKeys: currentWeekKeys(),
      }),
      planFor(schedule, myWorkouts),
      { trainedToday: trainedDays.includes(todayKey()) }
    ),
    [weekSessions, weekTarget, trainedDays, split, schedule, myWorkouts]
  );

  const baseRows = view === 'mine' ? myWorkouts : view === 'saved' ? savedWorkouts : publicWorkouts;
  const query = searchQuery.trim().toLowerCase();
  const rows = useMemo(() => {
    if (view === 'browse') return baseRows;
    const sorted = sortWorkouts(baseRows, sortBy[view], timesTrained);
    if (!query) return sorted;
    // Name, muscle or author: "chest" finds the plans that train it even when
    // one of them is called "Monday".
    return sorted.filter((w) =>
      (w.name || '').toLowerCase().includes(query)
      || musclesOf(w).some((m) => m.toLowerCase().includes(query))
      || (w.author_name || '').toLowerCase().includes(query)
    );
  }, [baseRows, view, sortBy, timesTrained, query]);

  const listLoading = view === 'browse' ? browseLoading : !loadedViews[view];

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
      return;
    }
    if (view === 'browse') setView('mine');
    setSearchOpen(true);
  };
  // Your own: the plan you clearly run most, twice or more this month.
  // Everyone else's: the clear favourite, saved by at least three people.
  const popular = useMemo(
    () => (view === 'mine'
      ? popularId(rows, (w) => timesTrained[String(w.id)], 2)
      : popularId(rows, (w) => w.save_count, 3)),
    [rows, view, timesTrained]
  );
  const activeSort = view === 'browse' ? browseSort : sortBy[view];
  const sortLabel = (SORTS[view].find(([key]) => key === activeSort) || SORTS[view][0])[1];

  const chooseSort = (key) => {
    setSortSheetVisible(false);
    if (view === 'browse') setBrowseSort(key);
    else setSortBy((prev) => ({ ...prev, [view]: key }));
  };

  /** Jumps to Browse already filtered to what the advice suggested. */
  const actOnAdvice = (item) => {
    // A planned routine opens ready to start; anything else goes looking for
    // a workout for the muscle that is due.
    if (item?.routine) {
      openWorkoutDetail(item.routine);
      return;
    }
    setBrowseMuscle(item?.muscle);
    setView('browse');
  };

  const openWorkoutDetail = (workout, startInEdit = false) => {
    navigation.navigate('WorkoutDetailScreen', {
      workout,
      onSave: handleSaveWorkout,
      // Chosen from edit mode, so the detail screen opens with its fields
      // already editable instead of making you press its pencil as well.
      startInEdit,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={300} intensity={0.38} />
        {/* The tools live beside the screen title now, so the row above the
            list can be what the list is: its name, its size, its order.
            Saved and Browse light up when you are in them, and tapping the lit
            one comes back; the pair after the divider do something. */}
        <ScreenHeader
          title="Workouts"
          right={editMode ? null : (
            <View style={styles.toolRow}>
              <Press
                scale={0.9}
                style={styles.tool}
                onPress={toggleSearch}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                accessibilityLabel={searchOpen ? 'Close search' : 'Search your routines'}
                accessibilityState={{ expanded: searchOpen }}
              >
                <Search color={searchOpen ? colors.accent : colors.textSecondary} size={18} />
              </Press>

              <Press hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                scale={0.9}
                style={[styles.tool, view === 'saved' && styles.toolOn]}
                onPress={() => setView(view === 'saved' ? 'mine' : 'saved')}
                accessibilityLabel="Saved workouts"
                accessibilityState={{ selected: view === 'saved' }}
              >
                <Bookmark
                  color={view === 'saved' ? colors.accent : colors.textSecondary}
                  fill={view === 'saved' ? colors.accent : 'transparent'}
                  size={18}
                />
              </Press>

              <Press hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                scale={0.9}
                style={[styles.tool, view === 'browse' && styles.toolOn]}
                onPress={() => setView(view === 'browse' ? 'mine' : 'browse')}
                accessibilityLabel="Browse public workouts"
                accessibilityState={{ selected: view === 'browse' }}
              >
                <Compass
                  color={view === 'browse' ? colors.accent : colors.textSecondary}
                  size={18}
                />
              </Press>

              {/* Circuits: EMOM, AMRAP, Tabata. A tool, not a view, so it sits
                  with the actions after the divider. */}
              <View style={styles.toolDivider} />

              <Press hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                scale={0.9}
                style={styles.tool}
                onPress={() => navigation.navigate('IntervalTimerScreen')}
                accessibilityLabel="Interval timer"
              >
                <Timer color={colors.textSecondary} size={18} />
              </Press>

              <Press hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                scale={0.9}
                style={styles.tool}
                onPress={() => { setView('mine'); setEditMode(true); }}
                accessibilityLabel="Edit a workout"
              >
                <Pencil color={colors.textSecondary} size={17} />
              </Press>

              <Press hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                scale={0.9}
                style={[styles.tool, styles.toolPrimary]}
                onPress={() => setMainMenuVisible(true)}
                accessibilityLabel="Create or add a workout"
              >
                <Plus color={colors.onAccent} size={19} />
              </Press>
            </View>
          )}
        />

        {/* Above the segments, not inside the list.
            It answers "what should I do today", which is a question you ask
            before choosing between Mine, Saved and Browse — under the tabs it
            read as a property of whichever tab was open. */}
        {!editMode && (
        <TodayCard
          advice={advice}
          onAct={actOnAdvice}
          week={{
            target: weekTarget,
            doneDays: trainedDays,
            weekKeys: currentWeekKeys(),
            splitName: split?.length ? `${split.length}-day split` : null,
            planned: !isEmptySchedule(schedule),
            plannedDays: currentWeekKeys().filter((_, i) => normaliseSchedule(schedule)[i]),
          }}
          onEditSplit={() => setSplitSheetVisible(true)}
          onPlanWeek={() => setScheduleSheetVisible(true)}
        />
        )}

        <View style={styles.listHead}>
          <View style={styles.listHeadTitle}>
            <Text style={styles.viewTitle} numberOfLines={1}>
              {editMode ? 'Choose one to edit' : VIEW_TITLES[view]}
            </Text>
            {!editMode ? (
              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {rows.length} {view === 'browse' ? 'shown' : 'total'}
                </Text>
              </View>
            ) : null}
          </View>

          {editMode ? (
            <Press
              scale={0.96}
              style={styles.doneBtn}
              onPress={() => setEditMode(false)}
              accessibilityLabel="Finish editing"
            >
              <Text style={styles.doneText}>Done</Text>
            </Press>
          ) : (
            <Press
              scale={0.96}
              style={styles.sortBtn}
              onPress={() => setSortSheetVisible(true)}
              hitSlop={8}
              accessibilityLabel={`Sort by ${sortLabel.toLowerCase()}. Change order`}
            >
              <Text style={styles.sortText}>Sort by {sortLabel.toLowerCase()}</Text>
              <ChevronDown color={colors.accent} size={16} />
            </Press>
          )}
        </View>

        {searchOpen && view !== 'browse' ? (
          <View style={styles.mySearchRow}>
            <Search color={colors.textFaint} size={17} />
            <TextInput
              style={styles.browseSearchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={view === 'saved' ? 'Search saved routines' : 'Search your routines'}
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search routines by name, muscle or author"
            />
            <Press scale={0.9} onPress={toggleSearch} hitSlop={8} accessibilityLabel="Close search">
              <X color={colors.textFaint} size={16} />
            </Press>
          </View>
        ) : null}

        <FlatList
        refreshControl={refreshControl}
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          view === 'browse' ? (
            <>
            <View style={styles.browseSearchRow}>
              <Search color={colors.textFaint} size={17} />
              <TextInput
                style={styles.browseSearchInput}
                value={browseQuery}
                onChangeText={setBrowseQuery}
                placeholder="Search routines or people"
                placeholderTextColor={colors.textFaint}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search workouts by name or author"
              />
              {browseQuery.length > 0 && (
                <Press scale={0.9} onPress={() => setBrowseQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <X color={colors.textFaint} size={16} />
                </Press>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.muscleFilterRow}
            >
              {[null, ...MUSCLES].map((muscle) => {
                const active = browseMuscle === muscle;
                return (
                  <Press
                    key={muscle || 'all'}
                    scale={0.96}
                    style={[styles.muscleChip, active && styles.muscleChipOn]}
                    onPress={() => setBrowseMuscle(muscle)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.muscleChipText, active && styles.muscleChipTextOn]}>
                      {muscle || 'All'}
                    </Text>
                  </Press>
                );
              })}
            </ScrollView>
            </>
          ) : null
        }

        ListEmptyComponent={
          listLoading && !listError ? (
            <SkeletonRoutines count={4} />
          ) : listError ? (
            <ErrorState
              message={listError}
              onRetry={() => {
                if (view === 'browse') fetchPublicWorkouts();
                else if (view === 'saved') fetchSavedWorkouts();
                else fetchMyWorkouts();
              }}
            />
          ) : query && view !== 'browse' ? (
            <EmptyState
              icon={<Search color={colors.textFaint} size={44} />}
              title={`Nothing matches "${searchQuery.trim()}"`}
              message="Try a different name or muscle group."
              actionLabel="Clear search"
              onAction={() => setSearchQuery('')}
            />
          ) : view === 'saved' ? (
            <EmptyState
              icon={<Bookmark color={colors.textFaint} size={44} />}
              title="Nothing saved"
              message="Save routines from Browse and they will show up here."
              actionLabel="Browse routines"
              onAction={() => setView('browse')}
            />
          ) : view === 'browse' ? (
            browseLoading ? null : (
              <EmptyState
                icon={<Layout color={colors.textFaint} size={44} />}
                title={browseMuscle ? `No ${browseMuscle.toLowerCase()} routines` : 'No shared routines yet'}
                message={browseMuscle
                  ? 'Nobody has shared one for this muscle group yet.'
                  : 'Be the first to share one.'}
                actionLabel="Create a routine"
                onAction={() => setMainMenuVisible(true)}
              />
            )
          ) : (
          <EmptyState
            icon={<Dumbbell color={colors.textFaint} size={44} />}
            title="No routines yet"
            message="Create your own or add one of our suggestions."
            actionLabel="Create a routine"
            onAction={() => setMainMenuVisible(true)}
          />
          )
        }
        renderItem={({ item, index }) => (
          <FadeIn index={Math.min(index, 6)}>
            <WorkoutCard
              workout={item}
              variant={view}
              editing={editMode}
              highlight={!editMode && index === 0}
              popular={item.id === popular}
              weightKg={profile?.weight}
              onOpen={() =>
                view === 'saved'
                  ? openSavedWorkout(item)
                  : openWorkoutDetail(item, editMode)
              }
              onDelete={() => confirmDeleteWorkout(item)}
              onRename={() => promptRename(item)}
              onToggleVisibility={() => toggleVisibility(item)}
              onCopy={() => handleCopy(item.id, item.name)}
              onToggleSave={() => toggleSave(item.id)}
            />
          </FadeIn>
        )}
      />

      <NewRoutineSheet
        visible={mainMenuVisible || !!renaming}
        onClose={closeNewSheet}
        renaming={renaming}
        suggestions={suggestedWorkouts}
        weightKg={profile?.weight}
        onCreate={handleCreateNamedWorkout}
        onRename={commitRename}
        onAddPreset={addPreset}
        onBrowse={() => { setMainMenuVisible(false); setView('browse'); }}
      />

        <BottomSheet
          visible={sortSheetVisible}
          onClose={() => setSortSheetVisible(false)}
          title="Sort routines"
          avoidKeyboard={false}
        >
          {SORTS[view].map(([key, label]) => {
            const on = key === activeSort;
            return (
              <Press
                key={key}
                scale={0.98}
                style={[styles.sortOption, on && styles.sortOptionOn]}
                onPress={() => chooseSort(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.sortOptionText, on && styles.sortOptionTextOn]}>{label}</Text>
                {on ? <Check color={colors.accent} size={18} /> : null}
              </Press>
            );
          })}
        </BottomSheet>
        <ScheduleSheet
          visible={scheduleSheetVisible}
          onClose={() => setScheduleSheetVisible(false)}
          profile={profile}
          routines={myWorkouts}
          split={split}
          sessionsPerWeek={weekTarget || profile?.workouts_per_week}
          schedule={schedule}
          onSaved={(value) => {
            setSchedule(value);
            patchProfile?.({ training_schedule: value });
          }}
        />

        <SplitSheet
          visible={splitSheetVisible}
          onClose={() => setSplitSheetVisible(false)}
          profile={profile}
          onSaved={setSplit}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  header: { padding: 20, paddingTop: 40 },
  dateText: { color: colors.textMuted, marginTop: 16, fontSize: 15 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 6 },
  // --- List head -----------------------------------------------------------
  listHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 2, gap: 12,
  },
  listHeadTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  viewTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  countPill: {
    borderWidth: 1, borderColor: colors.borderLight,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  countText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // Bare icons. The lit colour already says which list you are in; a tile
  // behind every icon made five buttons compete with the one that creates.
  tool: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  toolOn: {},
  toolPrimary: { width: 36, marginLeft: 2, borderRadius: 13, backgroundColor: colors.accent },
  // A hairline between the pair on the left and the pair on the right: the
  // first two say where you are, the last two do something.
  toolDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 5 },
  doneBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.accent,
  },
  doneText: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  browseSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 14, height: 44,
    marginHorizontal: spacing.lg, marginBottom: 10,
  },
  browseSearchInput: { flex: 1, color: colors.text, fontSize: 15, padding: 0 },
  mySearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, height: 44,
    marginHorizontal: 20, marginTop: 12,
  },
  sortOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 52, borderRadius: radius.md, marginBottom: 6,
    backgroundColor: colors.surfaceRaised,
  },
  sortOptionOn: { backgroundColor: colors.accentSoft },
  sortOptionText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  sortOptionTextOn: { color: colors.text },

  muscleFilterRow: { flexDirection: 'row', gap: 8, paddingBottom: 14, paddingRight: 20 },
  muscleChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surface,
  },
  muscleChipOn: { backgroundColor: colors.accent },
  muscleChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  muscleChipTextOn: { color: colors.onAccent },

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


  listContent: { padding: 20, paddingBottom: 100 },
  glassCard: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { backgroundColor: 'rgba(155, 157, 214, 0.1)', padding: 10, borderRadius: 14, marginRight: 16 },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { backgroundColor: colors.accent, width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  deleteBtn: { padding: 10 },
  emptyText: { color: colors.textDisabled, textAlign: 'center', marginTop: 50 },
});