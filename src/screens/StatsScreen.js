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
    topMuscle: 'N/A'
  });

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        setStats({
          totalWorkouts: 0,
          totalVolume: 0,
          totalCalories: 0,
          currentStreak: 0,
          weeklySteps: [0, 0, 0, 0, 0, 0, 0],
          topMuscle: 'N/A'
        });
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', user.id)
        .maybeSingle();

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

      let topMuscle = 'N/A';
      let maxCount = 0;
      Object.keys(muscleCount).forEach(m => {
        if (muscleCount[m] > maxCount) {
          maxCount = muscleCount[m];
          topMuscle = m;
        }
      });

      const today = new Date();
      const pastWeekDates = Array.from({length: 7}, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const { data: stepsData } = await supabase
        .from('daily_steps')
        .select('record_date, step_count')
        .eq('user_id', user.id)
        .gte('record_date', pastWeekDates[0])
        .lte('record_date', pastWeekDates[6]);

      const weeklyStepsArray = pastWeekDates.map(date => {
        const found = stepsData?.find(s => s.record_date === date);
        return found ? found.step_count : 0;
      });

      const { data: foods } = await supabase
        .from('scanned_foods')
        .select('calories')
        .eq('user_id', user.id);

      const cals = foods ? foods.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) : 0;

      setStats({
        totalWorkouts: workouts ? workouts.length : 0,
        totalVolume: volume,
        totalCalories: cals,
        currentStreak: profile?.current_streak || 0,
        weeklySteps: weeklyStepsArray,
        topMuscle: topMuscle
      });
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const maxSteps = Math.max(...stats.weeklySteps, 10000);
  const daysOfWeek = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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
          <View style={styles.guestCard}>
            <Lock color="#FF4444" size={32} style={{ marginBottom: 10 }} />
            <Text style={styles.guestTitle}>Mod Vizitator</Text>
            <Text style={styles.guestText}>Creează un cont pentru a-ți salva și vizualiza statisticile, istoricul și progresul.</Text>
          </View>
        )}

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, timeframe === 'week' && styles.toggleBtnActive]}
            onPress={() => setTimeframe('week')}
          >
            <Text style={[styles.toggleText, timeframe === 'week' && styles.toggleTextActive]}>Săptămâna Asta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, timeframe === 'all' && styles.toggleBtnActive]}
            onPress={() => setTimeframe('all')}
          >
            <Text style={[styles.toggleText, timeframe === 'all' && styles.toggleTextActive]}>Dintotdeauna</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}><Flame color="#FF8800" size={24} /></View>
            <Text style={styles.statVal}>{stats.totalCalories}</Text>
            <Text style={styles.statLabel}>Kcal Arse</Text>
          </View>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}><Dumbbell color={NEON_GREEN} size={24} /></View>
            <Text style={styles.statVal}>{(stats.totalVolume / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>Tonaj (Kg)</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}><Activity color="#00EAFF" size={24} /></View>
            <Text style={styles.statVal}>{stats.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Antrenamente</Text>
          </View>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}><Trophy color="#FFD700" size={24} /></View>
            <Text style={styles.statVal}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Zile Streak</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activitate Pași</Text>
        <View style={styles.chartCard}>
          <View style={styles.barsContainer}>
            {stats.weeklySteps.map((stepCount, index) => {
              const barHeight = Math.max((stepCount / maxSteps) * 150, 10);
              const isToday = index === 6;
              return (
                <View key={index} style={styles.barWrapper}>
                  <Text style={styles.barLabelTop}>{stepCount > 0 ? (stepCount/1000).toFixed(1) + 'k' : ''}</Text>
                  <View style={[styles.barBg, { height: 150 }]}>
                    <LinearGradient
                      colors={isToday ? [NEON_GREEN, '#055924'] : ['#333', '#1A1A1A']}
                      style={[styles.barFill, { height: barHeight }]}
                    />
                  </View>
                  <Text style={[styles.barLabel, isToday && {color: NEON_GREEN, fontWeight: 'bold'}]}>
                    {daysOfWeek[index]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Focus Muscular</Text>
        <View style={styles.muscleCard}>
          <View style={styles.muscleLeft}>
            <Target color={NEON_GREEN} size={32} />
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.muscleTitle}>Grupa Principală</Text>
              <Text style={styles.muscleValue}>{stats.topMuscle}</Text>
            </View>
          </View>
          <TrendingUp color="#666" size={24} />
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
  logoMark: { width: 32, height: 32, backgroundColor: NEON_GREEN, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  dateText: { color: '#666', marginTop: 15, fontSize: 14 },
  title: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  scrollContent: { paddingBottom: 100 },

  guestCard: { backgroundColor: 'rgba(255, 68, 68, 0.1)', marginHorizontal: 20, marginBottom: 25, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.3)', alignItems: 'center' },
  guestTitle: { color: '#FF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  guestText: { color: '#fff', fontSize: 14, textAlign: 'center', opacity: 0.8 },

  toggleContainer: { flexDirection: 'row', backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 15, padding: 5, marginBottom: 25, borderWidth: 1, borderColor: '#222' },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: 'rgba(30, 215, 96, 0.15)' },
  toggleText: { color: '#666', fontWeight: 'bold' },
  toggleTextActive: { color: NEON_GREEN },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
  statBox: { backgroundColor: CARD_BG, width: '48%', padding: 20, borderRadius: 22, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  statIconWrapper: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 15, marginBottom: 10 },
  statVal: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 5, fontWeight: '600' },

  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 20, marginTop: 20, marginBottom: 15 },

  chartCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#222' },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 190 },
  barWrapper: { alignItems: 'center', width: width * 0.08 },
  barLabelTop: { color: '#666', fontSize: 9, marginBottom: 5, height: 12 },
  barBg: { width: '100%', backgroundColor: '#1A1A1A', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 8 },
  barLabel: { color: '#888', fontSize: 12, marginTop: 10 },

  muscleCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#222', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  muscleLeft: { flexDirection: 'row', alignItems: 'center' },
  muscleTitle: { color: '#666', fontSize: 12, fontWeight: '600' },
  muscleValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 2 }
});