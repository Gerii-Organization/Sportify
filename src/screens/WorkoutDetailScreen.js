import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform, FlatList 
} from 'react-native';
import { ChevronLeft, MoreVertical, Plus, X } from 'lucide-react-native';

const EXERCISE_DB = [
  { id: 'ex1', name: 'Barbell Bench Press', muscle: 'Chest' },
  { id: 'ex2', name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { id: 'ex3', name: 'Machine Chest Fly', muscle: 'Chest' },
  { id: 'ex4', name: 'Push-ups', muscle: 'Chest' },
  { id: 'ex5', name: 'Lat Pulldown', muscle: 'Back' },
  { id: 'ex6', name: 'Barbell Row', muscle: 'Back' },
  { id: 'ex7', name: 'Pull-ups', muscle: 'Back' },
  { id: 'ex8', name: 'Deadlift', muscle: 'Back' },
  { id: 'ex9', name: 'Barbell Squat', muscle: 'Legs' },
  { id: 'ex10', name: 'Leg Press', muscle: 'Legs' },
  { id: 'ex11', name: 'Romanian Deadlift', muscle: 'Legs' },
  { id: 'ex12', name: 'Calf Raises', muscle: 'Legs' },
  { id: 'ex13', name: 'Overhead Press', muscle: 'Shoulders' },
  { id: 'ex14', name: 'Lateral Raises', muscle: 'Shoulders' },
  { id: 'ex15', name: 'Barbell Bicep Curl', muscle: 'Arms' },
  { id: 'ex16', name: 'Hammer Curl', muscle: 'Arms' },
  { id: 'ex17', name: 'Cable Tricep Pushdown', muscle: 'Arms' },
  { id: 'ex18', name: 'Skull Crushers', muscle: 'Arms' },
  { id: 'ex19', name: 'Crunches', muscle: 'Core' },
  { id: 'ex20', name: 'Plank', muscle: 'Core' },
];

export default function WorkoutDetailScreen({ route, navigation }) {
  const { workout, onSave } = route.params;
  
  const [currentWorkout, setCurrentWorkout] = useState(workout);
  const [isExerciseSelectorVisible, setIsExerciseSelectorVisible] = useState(false);

  const updateSetData = (exerciseId, setId, field, value) => {
    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) };
      }
      return ex;
    });
    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
  };

  // 💡 LOGICĂ NOUĂ: Copierea datelor de la ultimul set
  const addSetToExercise = (exerciseId) => {
    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        // Căutăm ultimul set existent
        const lastSet = ex.sets.length > 0 ? ex.sets[ex.sets.length - 1] : null;
        
        // Dacă există un set anterior, îi copiem greutatea și repetările
        const newSet = { 
          id: Math.random().toString(), 
          weight: lastSet ? lastSet.weight : '', 
          reps: lastSet ? lastSet.reps : '', 
          prev: '-' 
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      }
      return ex;
    });
    setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
  };

  const addNewExercise = (exerciseName) => {
    const newExercise = {
      id: Math.random().toString(),
      name: exerciseName,
      sets: [{ id: Math.random().toString(), weight: '', reps: '', prev: '-' }]
    };
    setCurrentWorkout({ 
      ...currentWorkout, 
      exercises: [...(currentWorkout.exercises || []), newExercise] 
    });
    setIsExerciseSelectorVisible(false);
  };

  const saveWorkoutAndGoBack = () => {
    if (onSave) {
      onSave(currentWorkout);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ChevronLeft color="#fff" size={30} /></TouchableOpacity>
        <Text style={styles.detailTitle}>{currentWorkout?.name}</Text>
        <MoreVertical color="#fff" size={24} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 15 }}>
          
          {currentWorkout?.exercises?.map((exercise) => (
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

              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetToExercise(exercise.id)}>
                <Text style={styles.addSetText}>+ Adaugă Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setIsExerciseSelectorVisible(true)}>
            <Plus color="#1DB954" size={24} />
            <Text style={styles.addExerciseText}>Adaugă Exercițiu</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={styles.finishBtn} onPress={saveWorkoutAndGoBack}>
        <Text style={styles.finishBtnText}>Finish Workout</Text>
      </TouchableOpacity>

      <Modal visible={isExerciseSelectorVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.glassMenu, { height: '80%', padding: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.menuTitle}>Alege Exercițiul</Text>
              <TouchableOpacity onPress={() => setIsExerciseSelectorVisible(false)}>
                <X color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={EXERCISE_DB}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.exerciseDbItem} onPress={() => addNewExercise(item.name)}>
                  <View>
                    <Text style={styles.exerciseDbName}>{item.name}</Text>
                    <Text style={styles.exerciseDbMuscle}>{item.muscle}</Text>
                  </View>
                  <Plus color="#1DB954" size={20} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: Platform.OS === 'android' ? 40 : 15 },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  exerciseCard: { backgroundColor: '#1c1c1e', borderRadius: 15, padding: 15, marginBottom: 20 },
  exerciseName: { color: '#1DB954', fontSize: 16, fontWeight: '700', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', marginBottom: 10 },
  tableHeaderText: { color: '#666', fontSize: 12, textAlign: 'center', fontWeight: 'bold' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  setText: { color: '#fff', textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 8, padding: 8, marginHorizontal: 5, textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  addSetBtn: { marginTop: 15, alignItems: 'center', paddingVertical: 5 },
  addSetText: { color: '#888', fontSize: 14, fontWeight: '600' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29, 185, 84, 0.1)', padding: 15, borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.3)' },
  addExerciseText: { color: '#1DB954', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  finishBtn: { backgroundColor: '#1DB954', margin: 20, padding: 18, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', padding: 15 },
  glassMenu: { backgroundColor: '#1c1c1e', width: '100%', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  exerciseDbItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  exerciseDbName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  exerciseDbMuscle: { color: '#888', fontSize: 12, marginTop: 4 }
});