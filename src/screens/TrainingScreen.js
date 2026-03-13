import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Plus, Dumbbell, ChevronRight } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const WORKOUTS = [
  { id: '1', name: 'Full Body', exercises: 8, time: '45 min' },
  { id: '2', name: 'Push Day', exercises: 6, time: '60 min' },
];

export default function TrainingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Antrenamente</Text>
        <TouchableOpacity style={styles.createBtn}>
          <Plus color="#000" size={20} />
          <Text style={styles.createBtnText}>Create Workout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={WORKOUTS}
        contentContainerStyle={{ padding: 20 }}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <BlurView intensity={15} tint="dark" style={styles.workoutCard}>
            <View style={styles.workoutIcon}>
              <Dumbbell color="#fff" size={20} />
            </View>
            <View style={{flex: 1, marginLeft: 15}}>
              <Text style={styles.workoutName}>{item.name}</Text>
              <Text style={styles.workoutSub}>{item.exercises} exerciții • {item.time}</Text>
            </View>
            <ChevronRight color="#475569" />
          </BlurView>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  createBtn: { 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    padding: 15, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowRadius: 15,
    shadowOpacity: 0.3
  },
  createBtnText: { fontWeight: 'bold', marginLeft: 8 },
  workoutCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 22, 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  workoutIcon: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 15 },
  workoutName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  workoutSub: { color: '#94a3b8', fontSize: 14 }
});