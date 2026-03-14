import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { 
  Plus, Dumbbell, Play, Trash2, X, 
  ChevronLeft, Zap, Layout, MoreVertical 
} from 'lucide-react-native';

const PRESET_WORKOUTS = [
  { 
    id: 'p1', name: 'Full Body Blast', 
    exercises: [
      { id: 'e1', name: 'Dumbbell Bench Press', sets: [{ id: 's1', weight: '', reps: '', prev: '20kg x 12' }, { id: 's2', weight: '', reps: '', prev: '-' }] },
      { id: 'e2', name: 'Squats', sets: [{ id: 's1', weight: '', reps: '', prev: '60kg x 10' }] }
    ] 
  },
  { id: 'p2', name: 'Upper Body Power', exercises: [] },
];

export default function TrainingScreen() {
  const [myWorkouts, setMyWorkouts] = useState([
    { id: '1', name: 'Piept', exercises: [] }
  ]);
  
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  const [presetsVisible, setPresetsVisible] = useState(false);

  const deleteWorkout = (id) => {
    setMyWorkouts(myWorkouts.filter(w => w.id !== id));
  };

  const addCustomWorkout = () => {
    const newW = { id: Math.random().toString(), name: 'Custom Session', exercises: [] };
    setMyWorkouts([newW, ...myWorkouts]);
    setMainMenuVisible(false);
  };

  const addPreset = (item) => {
    const newW = { ...item, id: Math.random().toString() };
    setMyWorkouts([newW, ...myWorkouts]);
    setPresetsVisible(false);
    setMainMenuVisible(false);
  };

  const updateSetData = (exerciseId, setId, field, value) => {
    const updatedExercises = selectedWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
        };
      }
      return ex;
    });
    setSelectedWorkout({ ...selectedWorkout, exercises: updatedExercises });
  };

  const renderWorkoutItem = ({ item }) => (
    <View style={styles.glassCard}>
      <TouchableOpacity 
        style={styles.workoutMain} 
        onPress={() => { setSelectedWorkout(item); setIsDetailVisible(true); }}
      >
        <View style={styles.iconCircle}><Dumbbell color="#1DB954" size={20} /></View>
        <Text style={styles.workoutName}>{item.name}</Text>
      </TouchableOpacity>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={() => deleteWorkout(item.id)} style={styles.deleteBtn}>
          <Trash2 color="#ff4444" size={18} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={() => { setSelectedWorkout(item); setIsDetailVisible(true); }}>
          <Play color="#000" size={16} fill="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Workouts</Text></View>

      <FlatList
        data={myWorkouts}
        renderItem={renderWorkoutItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No workouts yet</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setMainMenuVisible(true)}>
        <Plus color="#000" size={30} />
      </TouchableOpacity>

      <Modal visible={mainMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMainMenuVisible(false)}>
          <View style={styles.glassMenu}>
            <Text style={styles.menuTitle}>New Workout</Text>
            <TouchableOpacity style={styles.menuOption} onPress={addCustomWorkout}>
              <Zap color="#1DB954" size={22} /><Text style={styles.menuOptionText}>Custom Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={() => setPresetsVisible(true)}>
              <Layout color="#1DB954" size={22} /><Text style={styles.menuOptionText}>Suggested Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMainMenuVisible(false)}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={presetsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.glassMenu, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.menuTitle}>Suggestions</Text>
              <TouchableOpacity onPress={() => setPresetsVisible(false)}><X color="#fff" size={24} /></TouchableOpacity>
            </View>
            <FlatList
              data={PRESET_WORKOUTS}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.presetCard} onPress={() => addPreset(item)}>
                  <Text style={styles.presetName}>{item.name}</Text>
                  <Plus color="#1DB954" size={20} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={isDetailVisible} animationType="slide">
        <View style={styles.detailContainer}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setIsDetailVisible(false)}><ChevronLeft color="#fff" size={30} /></TouchableOpacity>
              <Text style={styles.detailTitle}>{selectedWorkout?.name}</Text>
              <MoreVertical color="#fff" size={24} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: 15 }}>
                {selectedWorkout?.exercises?.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>SET</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>PREV</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>KG</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>REPS</Text>
                    </View>
                    {exercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={[styles.setText, { flex: 0.5 }]}>{index + 1}</Text>
                        <Text style={[styles.setText, { flex: 1, color: '#555' }]}>{set.prev}</Text>
                        <TextInput style={styles.setInput} keyboardType="numeric" value={set.weight} onChangeText={(v) => updateSetData(exercise.id, set.id, 'weight', v)} placeholder="0" placeholderTextColor="#444"/>
                        <TextInput style={styles.setInput} keyboardType="numeric" value={set.reps} onChangeText={(v) => updateSetData(exercise.id, set.id, 'reps', v)} placeholder="0" placeholderTextColor="#444"/>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </KeyboardAvoidingView>
            <TouchableOpacity style={styles.finishBtn} onPress={() => setIsDetailVisible(false)}><Text style={styles.finishBtnText}>Finish Workout</Text></TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 25, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  listContent: { padding: 20, paddingBottom: 100 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 20, padding: 15, marginBottom: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { backgroundColor: 'rgba(29, 185, 84, 0.1)', padding: 10, borderRadius: 12, marginRight: 15 },
  workoutName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { backgroundColor: '#1DB954', width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  deleteBtn: { padding: 8 },
  fab: { position: 'absolute', bottom: 90, right: 25, backgroundColor: '#1DB954', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  glassMenu: { backgroundColor: '#1c1c1e', width: '100%', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  menuOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 18, borderRadius: 15, marginBottom: 12 },
  menuOptionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 15 },
  closeText: { color: '#b3b3b3', textAlign: 'center', marginTop: 10 },
  presetCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, marginBottom: 10 },
  presetName: { color: '#fff', fontWeight: '600' },
  detailContainer: { flex: 1, backgroundColor: '#121212' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  exerciseCard: { backgroundColor: '#1c1c1e', borderRadius: 15, padding: 15, marginBottom: 20 },
  exerciseName: { color: '#1DB954', fontSize: 16, fontWeight: '700', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', marginBottom: 10 },
  tableHeaderText: { color: '#666', fontSize: 12, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  setText: { color: '#fff', textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 8, padding: 6, marginHorizontal: 5, textAlign: 'center' },
  finishBtn: { backgroundColor: '#1DB954', margin: 20, padding: 18, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: '#000', fontWeight: 'bold' },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 50 }
});