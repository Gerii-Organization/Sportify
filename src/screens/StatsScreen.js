import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Flame, Trophy } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

export default function StatsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Statistici</Text>
      
      <View style={styles.anatomyContainer}>
        <BlurView intensity={30} style={styles.anatomyCard}>
           <Activity color="#ef4444" size={100} strokeWidth={1} />
        </BlurView>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Flame color="#f97316" />
          <Text style={styles.statVal}>12,400</Text>
          <Text style={styles.statLabel}>Kcal Arse</Text>
        </View>
        <View style={styles.statBox}>
          <Trophy color="#facc15" />
          <Text style={styles.statVal}>12 zile</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 60, padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  anatomyContainer: { height: 350, marginBottom: 20 },
  anatomyCard: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  anatomyText: { color: '#fff', marginTop: 20, fontWeight: 'bold', letterSpacing: 2 },
  muscleBadge: { position: 'absolute', top: 100, right: 30, backgroundColor: '#ef4444', padding: 8, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 25, width: '48%', alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 10 },
  statLabel: { color: '#94a3b8', fontSize: 12 }
});