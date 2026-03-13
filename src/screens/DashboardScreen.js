import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { User, CheckCircle, Droplets, Footprints } from 'lucide-react-native';

export default function DashboardScreen() {
  const [water, setWater] = useState(0);
  const [todos, setTodos] = useState([
    { id: 1, text: 'Mic dejun proteic', done: true },
    { id: 2, text: 'Antrenament picioare', done: false },
  ]);

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Salut!</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <User color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <BlurView intensity={20} tint="light" style={styles.glassCard}>
          <LinearGradient colors={['rgba(59, 130, 246, 0.5)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.cardGradient} />
          <Footprints color="#3b82f6" size={32} />
          <Text style={styles.cardVal}>1,337</Text>
          <Text style={styles.cardLabel}>Pași Parcurși</Text>
        </BlurView>

        <View style={styles.row}>
          <BlurView intensity={20} style={[styles.glassCard, {flex: 1, marginRight: 10}]}>
            <Droplets color="#0ea5e9" size={24} />
            <Text style={styles.smallVal}>{water.toFixed(1)}L</Text>
            <TouchableOpacity onPress={() => setWater(water + 0.25)} style={styles.addBtn}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>+</Text>
            </TouchableOpacity>
          </BlurView>

          <BlurView intensity={20} style={[styles.glassCard, {flex: 1.5}]}>
            <Text style={styles.todoTitle}>To-Do Zilnic</Text>
            {todos.map(todo => (
              <View key={todo.id} style={styles.todoItem}>
                <CheckCircle size={16} color={todo.done ? "#10b981" : "#475569"} />
                <Text style={[styles.todoText, todo.done && styles.todoDone]}>{todo.text}</Text>
              </View>
            ))}
          </BlurView>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#94a3b8' },
  profileBtn: { backgroundColor: '#334155', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#475569' },
  glassCard: { padding: 20, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  cardGradient: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  cardVal: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  cardLabel: { color: '#94a3b8', fontSize: 14 },
  row: { flexDirection: 'row' },
  smallVal: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginVertical: 8 },
  addBtn: { backgroundColor: '#0ea5e9', padding: 8, borderRadius: 12, alignItems: 'center' },
  todoTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 10 },
  todoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  todoText: { color: '#cbd5e1', marginLeft: 8, fontSize: 13 },
  todoDone: { textDecorationLine: 'line-through', color: '#475569' }
});