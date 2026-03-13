import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { Plus, Dumbbell, ChevronRight, Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BUILT_IN = [
  { id: '1', name: 'Back + Chest', type: 'built-in' },
  { id: '2', name: 'Arms Day', type: 'built-in' },
  { id: '3', name: 'Ab + Legs', type: 'built-in' },
  { id: '4', name: 'Cardio', type: 'built-in' },
  { id: '5', name: 'Full Body', type: 'built-in' },
];

export default function TrainingScreen({ navigation }) {
  const [workouts, setWorkouts] = useState(BUILT_IN);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  const addCustomWorkout = () => {
    if (newWorkoutName.trim()) {
      const newEntry = { id: Date.now().toString(), name: newWorkoutName, type: 'custom' };
      setWorkouts([newEntry, ...workouts]);
      setNewWorkoutName('');
      setModalVisible(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus color="#000" size={20} strokeWidth={3} />
          <Text style={styles.addBtnText}>ADD WORKOUT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {workouts.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            onPress={() => navigation.navigate('WorkoutDetail', { workoutName: item.name })}
          >
            <BlurView intensity={20} tint="light" style={styles.workoutCard}>
              <View style={[styles.iconBox, { backgroundColor: item.type === 'built-in' ? '#3b82f6' : '#a855f7' }]}>
                <Dumbbell color="#fff" size={20} />
              </View>
              <Text style={styles.workoutName}>{item.name}</Text>
              <Play color="#475569" size={18} fill="#475569" />
            </BlurView>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal pentru New Workout Name */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nume Antrenament</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: Push Day..." 
              placeholderTextColor="#94a3b8"
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={{color: '#fff'}}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addCustomWorkout} style={styles.saveBtn}>
                <Text style={{fontWeight: 'bold'}}>Salvează</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  addBtn: { 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    padding: 16, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#3b82f6', shadowRadius: 15, shadowOpacity: 0.4
  },
  addBtnText: { fontWeight: '900', marginLeft: 8, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  workoutCard: { 
    flexDirection: 'row', alignItems: 'center', padding: 18, 
    borderRadius: 25, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' 
  },
  iconBox: { padding: 12, borderRadius: 15 },
  workoutName: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 15 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1e293b', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 15, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelBtn: { padding: 10, marginRight: 15 },
  saveBtn: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 }
});