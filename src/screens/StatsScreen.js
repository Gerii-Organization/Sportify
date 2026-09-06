import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Activity, Flame, Trophy, Dumbbell, TrendingUp, Target, Lock
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { todayKey, recentDayKeys } from '../lib/date';
import { gradients } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import AmbientGlow from '../components/AmbientGlow';
import { SkeletonRows } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const { user } = useAuth();
  const { refreshControl } = useRefresh(() => fetchStats());
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [timeframe, setTimeframe] = useState('week');
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalCalories: 0,
    currentStreak: 0,
    weeklySteps: [0, 0, 0, 0, 0, 0, 0],
    topMuscle: 'More data needed'
  });

  useFocusEffect(
    useCallback(() => {
    // user?.id is in the deps because useCallback pins the closure: without it
    // the memoised function keeps the `user` from first render (null, before the
    // session loads) and every later focus re-runs that stale copy — which is
    // why signing in left the screen empty until something forced a remount.
      fetchStats();
    }, [timeframe, user?.id])
  );

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        setStats({
          totalWorkouts: 0, totalVolume: 0, totalCalories: 0,
          currentStreak: 0, weeklySteps: [0, 0, 0, 0, 0, 0, 0], topMuscle: 'More data needed'
        });
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekAgoStr = todayKey(weekAgo);

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', user.id)
        .maybeSingle();

      let completionsQuery = supabase.from('workout_completions').select('duration_minutes, completed_at').eq('user_id', user.id);
      if (timeframe === 'week') {
        completionsQuery = completionsQuery.gte('completed_at', weekAgo.toISOString());
      }
      const { data: completions } = await completionsQuery;

      const totalWorkouts = completions?.length || 0;
      const totalMinutes = completions?.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) || 0;

      let stepsQuery = supabase.from('daily_steps').select('step_count, record_date').eq('user_id', user.id);
      if (timeframe === 'week') {
        stepsQuery = stepsQuery.gte('record_date', weekAgoStr);
      }
      const { data: stepsDataAll } = await stepsQuery;
      const totalStepsAll = stepsDataAll?.reduce((sum, s) => sum + (s.step_count || 0), 0) || 0;

      const calculatedCalories = Math.floor((totalMinutes * 7) + (totalStepsAll * 0.04));

      const { data: workouts } = await supabase
        .from('user_workouts')
        .select('exercises')
        .eq('user_id', user.id);

      let volume = 0;
      const muscleCount = {};

      if (workouts) {
        workouts.forEach(w => {
          if (w.exercises) {
            w.exercises.forEach(ex => {
              if (ex.muscle) {
                muscleCount[ex.muscle] = (muscleCount[ex.muscle] || 0) + 1;
              }
              if (ex.sets) {
                ex.sets.forEach(set => {
                  if (set.completed && set.weight && set.reps) {
                    volume += (parseFloat(set.weight) * parseInt(set.reps));
                  }
                });
              }
            });
          }
        });
      }

      let topMuscle = 'More data needed';
      let maxCount = 0;
      Object.keys(muscleCount).forEach(m => {
        if (muscleCount[m] > maxCount) {
          maxCount = muscleCount[m];
          topMuscle = m;
        }
      });
      const pastWeekDates = recentDayKeys(7);

      const { data: chartStepsData } = await supabase
        .from('daily_steps')
        .select('record_date, step_count')
        .eq('user_id', user.id)
        .in('record_date', pastWeekDates);

      const weeklyStepsArray = pastWeekDates.map(date => {
        const found = chartStepsData?.find(s => s.record_date === date);
        return found ? found.step_count : 0;
      });

      setStats({
        totalWorkouts: totalWorkouts,
        totalVolume: volume,
        totalCalories: calculatedCalories,
        currentStreak: profile?.current_streak || 0,
        weeklySteps: weeklyStepsArray,
        topMuscle: topMuscle
      });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const maxSteps = Math.max(...stats.weeklySteps, 5000);
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="accent" height={300} intensity={0.3} />
          <View style={styles.loadingContainer}>
            <SkeletonRows count={4} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <ScreenHeader title="Analytics" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}>

        {!isLoggedIn && (
          <View style={styles.glassContainerGuest}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <Lock color={colors.danger} size={32} style={{ marginBottom: 10 }} />
              <Text style={styles.guestTitle}>Guest Mode</Text>
              <Text style={styles.guestText}>Create an account to save and view your stats, history, and progress.</Text>
            </BlurView>
          </View>
        )}

        <View style={styles.toggleContainerWrapper}>
          <BlurView intensity={30} tint="dark" style={styles.toggleContainer}>
            <TouchableOpacity activeOpacity={0.7}
              style={[styles.toggleBtn, timeframe === 'week' && styles.toggleBtnActive]}
              onPress={() => setTimeframe('week')}
            >
              <Text style={[styles.toggleText, timeframe === 'week' && styles.toggleTextActive]}>Last 7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}
              style={[styles.toggleBtn, timeframe === 'all' && styles.toggleBtnActive]}
              onPress={() => setTimeframe('all')}
            >
              <Text style={[styles.toggleText, timeframe === 'all' && styles.toggleTextActive]}>All Time</Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBoxContainer}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(255, 136, 0, 0.1)' }]}>
                <Flame color={colors.streak} size={26} style={styles.iconGlowOrange} />
              </View>
              <Text style={styles.statVal}>{stats.totalCalories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories Burned</Text>
            </BlurView>
          </View>

          <View style={styles.statBoxContainer}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(46, 211, 198, 0.1)' }]}>
                <Dumbbell color={colors.accent} size={26} style={styles.iconGlowGreen} />
              </View>
              <Text style={styles.statVal}>{(stats.totalVolume / 1000).toFixed(1)}k</Text>
              <Text style={styles.statLabel}>Weight lifted (kg)</Text>
            </BlurView>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBoxContainer}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(0, 234, 255, 0.1)' }]}>
                <Activity color="#00EAFF" size={26} style={styles.iconGlowBlue} />
              </View>
              <Text style={styles.statVal}>{stats.totalWorkouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </BlurView>
          </View>

          <View style={styles.statBoxContainer}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
                <Trophy color={colors.energy} size={26} style={styles.iconGlowYellow} />
              </View>
              <Text style={styles.statVal}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Streak Days</Text>
            </BlurView>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Weekly Step Activity</Text>
        <View style={styles.chartCardWrapper}>
          <BlurView intensity={30} tint="dark" style={styles.glassBlurChart}>
            <View style={styles.barsContainer}>
              {stats.weeklySteps.map((stepCount, index) => {
                const barHeight = Math.max((stepCount / maxSteps) * 150, 5);
                const isToday = index === 6;
                return (
                  <View key={index} style={styles.barWrapper}>
                    <Text style={styles.barLabelTop}>{stepCount > 0 ? (stepCount/1000).toFixed(1) + 'k' : ''}</Text>
                    <View style={[styles.barBg, { height: 150 }]}>
                      <LinearGradient
                        colors={isToday ? [colors.accent, '#055924'] : ['#333', '#1A1A1A']}
                        style={[styles.barFill, { height: barHeight }, isToday && styles.activeBarGlow]}
                      />
                    </View>
                    <Text style={[styles.barLabel, isToday && {color: colors.accent, fontWeight: '600'}]}>
                      {daysOfWeek[index]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </BlurView>
        </View>

        <Text style={styles.sectionTitle}>Muscle Focus</Text>
        <View style={styles.muscleCardWrapper}>
          <BlurView intensity={40} tint="dark" style={styles.glassBlurMuscle}>
            <LinearGradient colors={['rgba(46, 211, 198, 0.1)', 'transparent']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.muscleGradient}>
              <View style={styles.muscleLeft}>
                <View style={styles.targetIconBg}>
                  <Target color={colors.accent} size={32} style={styles.iconGlowGreen} />
                </View>
                <View style={{ marginLeft: 16 }}>
                  <Text style={styles.muscleTitle}>Primary Muscle Group</Text>
                  <Text style={styles.muscleValue}>{stats.topMuscle}</Text>
                </View>
              </View>
              <TrendingUp color={colors.textMuted} size={24} />
            </LinearGradient>
          </BlurView>
        </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 40 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10 },
  appName: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 10 },
  dateText: { color: colors.textMuted, marginTop: 16, fontSize: 15 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 6 },
  scrollContent: { paddingBottom: 100 },

  glassContainerGuest: { marginHorizontal: 20, marginBottom: 26, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.4)' },
  glassBlur: { padding: 20, alignItems: 'center' },
  guestTitle: { color: colors.danger, fontSize: 17, fontWeight: '600', marginBottom: 10, textShadowColor: 'rgba(255, 107, 90, 0.45)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  guestText: { color: colors.text, fontSize: 15, textAlign: 'center', opacity: 0.8 },

  toggleContainerWrapper: { marginHorizontal: 20, marginBottom: 26, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  toggleContainer: { flexDirection: 'row', padding: 6 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  toggleBtnActive: { backgroundColor: 'rgba(46, 211, 198, 0.2)', shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 },
  toggleText: { color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: colors.accent, textShadowColor: 'rgba(46, 211, 198, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  statBoxContainer: { width: '48%', borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
  statIconWrapper: { padding: 10, borderRadius: 18, marginBottom: 16 },
  statVal: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  statLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

  iconGlowOrange: { shadowColor: colors.streak, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowGreen: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowBlue: { shadowColor: '#00EAFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowYellow: { shadowColor: colors.energy, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },

  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginLeft: 20, marginTop: 20, marginBottom: 16, letterSpacing: 0.5 },

  chartCardWrapper: { marginHorizontal: 20, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
  glassBlurChart: { padding: 20 },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 190 },
  barWrapper: { alignItems: 'center', width: width * 0.08 },
  barLabelTop: { color: colors.textSecondary, fontSize: 11, marginBottom: 6, height: 12, fontWeight: '600' },
  barBg: { width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  barFill: { width: '100%', borderRadius: 10 },
  activeBarGlow: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  barLabel: { color: colors.textMuted, fontSize: 13, marginTop: 10, fontWeight: '600' },

  muscleCardWrapper: { marginHorizontal: 20, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(46, 211, 198, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.02)', marginBottom: 20 },
  glassBlurMuscle: { width: '100%' },
  muscleGradient: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  muscleLeft: { flexDirection: 'row', alignItems: 'center' },
  targetIconBg: { backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 10, borderRadius: 20 },
  muscleTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  muscleValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 }
});
