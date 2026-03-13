import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, PlusCircle, Save } from 'lucide-react-native';

export default function WorkoutDetailScreen({ route, navigation }) {
  const { workoutName } = route.params;
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [weight, setWeight] = useState('');

  const addExercise = () => {
    if (name && sets) {
      setExercises([...exercises, { id: Date.now(), name, sets, weight }]);
      setName(''); setSets(''); setWeight('');
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{workoutName}</Text>
      </View>

      <BlurView intensity={20} style={styles.inputCard}>
        <TextInput 
          style={styles.input} placeholder="Nume exercițiu (ex: Bench Press)" 
          placeholderTextColor="#64748b" value={name} onChangeText={setName} 
        />
        <View style={styles.row}>
          <TextInput 
            style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Seturi" 
            keyboardType="numeric" placeholderTextColor="#64748b" value={sets} onChangeText={setSets}
          />
          <TextInput 
            style={[styles.input, {flex: 1}]} placeholder="Kg" 
            keyboardType="numeric" placeholderTextColor="#64748b" value={weight} onChangeText={setWeight}
          />
        </View>
        <TouchableOpacity style={styles.addExBtn} onPress={addExercise}>
          <PlusCircle color="#000" size={20} />
          <Text style={styles.addExText}>Adaugă în listă</Text>
        </TouchableOpacity>
      </BlurView>

      <ScrollView style={{padding: 20}}>
        {exercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseRow}>
             <Text style={styles.exName}>{ex.name}</Text>
             <Text style={styles.exDetails}>{ex.sets} sets x {ex.weight} kg</Text>
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 15, marginRight: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  inputCard: { margin: 20, padding: 20, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: 'row' },
  addExBtn: { backgroundColor: '#fff', flexDirection: 'row', padding: 15, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  addExText: { fontWeight: 'bold', marginLeft: 8 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
  exName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  exDetails: { color: '#3b82f6', fontWeight: 'bold' }
});