import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { Flame, Clock, Heart, Moon, CheckCircle2, Circle as CircleIcon, Footprints } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const NEON_GREEN = '#1ED760';
const DARK_BG = '#000000';
const CARD_BG = '#121212';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoAndName}>
                <View style={styles.logoMark}>
                  <Flame size={18} color="black" fill="black" />
                </View>
                <Text style={styles.appName}>Sportify</Text>
              </View>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarPlaceholder} />
                <View style={styles.statusIndicator} />
              </View>
            </View>
            <Text style={styles.dateText}>Monday, Oct 24</Text>
            <Text style={styles.welcomeText}>Hello, Alex</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.ringShadowWrapper}>
              <Svg height={width < 400 ? 180 : 220} width={width < 400 ? 180 : 220} viewBox="0 0 100 100">
                <G rotation="-90" origin="50, 50">
                  <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                  <Circle 
                    cx="50" cy="50" r="45" 
                    stroke={NEON_GREEN} 
                    strokeWidth="6" 
                    fill="transparent" 
                    strokeDasharray="283"
                    strokeDashoffset="70" 
                    strokeLinecap="round"
                  />
                </G>
              </Svg>
            </View>
            <View style={styles.stepsInfoContainer}>
              <Footprints size={24} color={NEON_GREEN} />
              <Text style={styles.stepCount}>8,420</Text>
              <Text style={styles.stepGoal}>of 10,000 steps</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Focus</Text>
            <Text style={styles.seeAllText}>See All</Text>
          </View>

          <View style={[styles.taskCard, styles.neonBorder]}>
            <CheckCircle2 size={24} color={NEON_GREEN} />
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Morning 5k Run</Text>
              <Text style={styles.taskDescription}>Completed at 7:30 AM</Text>
            </View>
          </View>

          <View style={styles.taskCard}>
            <CircleIcon size={24} color="#333" />
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Drink 3L Water</Text>
              <Text style={styles.taskDescription}>Progress: 2.1L / 3.0L</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 25 }]}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <StatCard icon={<Flame size={16} color={NEON_GREEN}/>} label="CALORIES" value="1,240" unit="kcal" color={NEON_GREEN} />
            <StatCard icon={<Clock size={16} color="#4D79FF"/>} label="ACTIVITY" value="42" unit="mins" color="#4D79FF" />
            <StatCard icon={<Heart size={16} color="#FF6B6B"/>} label="AVG BPM" value="72" unit="bpm" color="#FF6B6B" />
            <StatCard icon={<Moon size={16} color="#A29BFE"/>} label="SLEEP" value="7.5" unit="hrs" color="#A29BFE" />
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, unit, color }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        {icon}
        <Text style={[styles.statLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.statValueContainer}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  
  header: { padding: 20 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: NEON_GREEN, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, backgroundColor: NEON_GREEN, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#000' },
  dateText: { color: '#666', marginTop: 20, fontSize: 14 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  
  progressContainer: { alignItems: 'center', marginVertical: 20, justifyContent: 'center' },
  ringShadowWrapper: {
    ...Platform.select({
      web: { filter: 'drop-shadow(0px 0px 15px rgba(30, 215, 96, 0.4))' },
      ios: { shadowColor: NEON_GREEN, shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.5, shadowRadius: 15 }
    })
  },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: '#FFF', fontSize: 42, fontWeight: 'bold' },
  stepGoal: { color: '#666', fontSize: 14 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  seeAllText: { color: NEON_GREEN, fontWeight: 'bold' },

  taskCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  neonBorder: {
    borderColor: NEON_GREEN + '66',
    ...Platform.select({
      web: { boxShadow: '0px 0px 15px rgba(30, 215, 96, 0.15)' },
      ios: { shadowColor: NEON_GREEN, shadowOpacity: 0.2, shadowRadius: 10 }
    })
  },
  taskTextContainer: { marginLeft: 15 },
  taskTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taskDescription: { color: '#666', fontSize: 12 },

  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 12, 
    justifyContent: 'space-between', 
    marginTop: 15 
  },
  statCard: { 
    backgroundColor: CARD_BG, 
    width: '48%',
    marginVertical: 6,
    borderRadius: 22, 
    padding: 16, 
    height: 115, 
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#222'
  },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginLeft: 8 },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statUnit: { color: '#666', fontSize: 11, marginLeft: 5 },
});