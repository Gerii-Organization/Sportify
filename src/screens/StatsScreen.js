import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Dimensions, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Activity, Flame, Trophy, Dumbbell, TrendingUp, Target, Lock
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

export default function StatsScreen() {
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
      fetchStats();
    }, [timeframe])
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
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

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
      const pastWeekDates = Array.from({length: 7}, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

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
        <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={NEON_GREEN} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoAndName}>
              <View style={styles.logoMark}><Flame size={18} color="black" fill="black" /></View>
              <Text style={styles.appName}>Sportify</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          <Text style={styles.title}>Analytics</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {!isLoggedIn && (
          <View style={styles.glassContainerGuest}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <Lock color="#FF4444" size={32} style={{ marginBottom: 10 }} />
              <Text style={styles.guestTitle}>Guest Mode</Text>
              <Text style={styles.guestText}>Create an account to save and view your stats, history, and progress.</Text>
            </BlurView>
          </View>
        )}

        <View style={styles.toggleContainerWrapper}>
          <BlurView intensity={30} tint="dark" style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, timeframe === 'week' && styles.toggleBtnActive]}
              onPress={() => setTimeframe('week')}
            >
              <Text style={[styles.toggleText, timeframe === 'week' && styles.toggleTextActive]}>Last 7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
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
                <Flame color="#FF8800" size={26} style={styles.iconGlowOrange} />
              </View>
              <Text style={styles.statVal}>{stats.totalCalories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories Burned</Text>
            </BlurView>
          </View>

          <View style={styles.statBoxContainer}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(30, 215, 96, 0.1)' }]}>
                <Dumbbell color={NEON_GREEN} size={26} style={styles.iconGlowGreen} />
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
                <Trophy color="#FFD700" size={26} style={styles.iconGlowYellow} />
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
                        colors={isToday ? [NEON_GREEN, '#055924'] : ['#333', '#1A1A1A']}
                        style={[styles.barFill, { height: barHeight }, isToday && styles.activeBarGlow]}
                      />
                    </View>
                    <Text style={[styles.barLabel, isToday && {color: NEON_GREEN, fontWeight: 'bold'}]}>
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
            <LinearGradient colors={['rgba(30, 215, 96, 0.1)', 'transparent']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.muscleGradient}>
              <View style={styles.muscleLeft}>
                <View style={styles.targetIconBg}>
                  <Target color={NEON_GREEN} size={32} style={styles.iconGlowGreen} />
                </View>
                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.muscleTitle}>Primary Muscle Group</Text>
                  <Text style={styles.muscleValue}>{stats.topMuscle}</Text>
                </View>
              </View>
              <TrendingUp color="#666" size={24} />
            </LinearGradient>
          </BlurView>
        </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 40 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: NEON_GREEN, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10 },
  appName: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  dateText: { color: '#666', marginTop: 15, fontSize: 14 },
  title: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  scrollContent: { paddingBottom: 100 },

  glassContainerGuest: { marginHorizontal: 20, marginBottom: 25, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.4)' },
  glassBlur: { padding: 20, alignItems: 'center' },
  guestTitle: { color: '#FF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textShadowColor: 'rgba(255, 68, 68, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  guestText: { color: '#fff', fontSize: 14, textAlign: 'center', opacity: 0.8 },

  toggleContainerWrapper: { marginHorizontal: 20, marginBottom: 25, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  toggleContainer: { flexDirection: 'row', padding: 5 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: 'rgba(30, 215, 96, 0.2)', shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 },
  toggleText: { color: '#aaa', fontWeight: 'bold' },
  toggleTextActive: { color: NEON_GREEN, textShadowColor: 'rgba(30, 215, 96, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
  statBoxContainer: { width: '48%', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
  statIconWrapper: { padding: 12, borderRadius: 15, marginBottom: 15 },
  statVal: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

  iconGlowOrange: { shadowColor: '#FF8800', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowGreen: { shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowBlue: { shadowColor: '#00EAFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  iconGlowYellow: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },

  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 20, marginTop: 20, marginBottom: 15, letterSpacing: 0.5 },

  chartCardWrapper: { marginHorizontal: 20, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.02)' },
  glassBlurChart: { padding: 20 },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 190 },
  barWrapper: { alignItems: 'center', width: width * 0.08 },
  barLabelTop: { color: '#888', fontSize: 9, marginBottom: 5, height: 12, fontWeight: 'bold' },
  barBg: { width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  barFill: { width: '100%', borderRadius: 8 },
  activeBarGlow: { shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  barLabel: { color: '#666', fontSize: 12, marginTop: 10, fontWeight: '600' },

  muscleCardWrapper: { marginHorizontal: 20, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(30, 215, 96, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.02)', marginBottom: 20 },
  glassBlurMuscle: { width: '100%' },
  muscleGradient: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  muscleLeft: { flexDirection: 'row', alignItems: 'center' },
  targetIconBg: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 12, borderRadius: 16 },
  muscleTitle: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  muscleValue: { color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 }
});
