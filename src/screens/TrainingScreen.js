import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { 
  Plus, Dumbbell, Play, Trash2, Zap, Layout, ChevronDown, ChevronUp 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function TrainingScreen({ navigation }) {
  const [myWorkouts, setMyWorkouts] = useState([]);
  const [suggestedWorkouts, setSuggestedWorkouts] = useState([]); 
  
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  const [isBuiltInExpanded, setIsBuiltInExpanded] = useState(false);
  const [isNamingModalVisible, setIsNamingModalVisible] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  useEffect(() => {
    fetchMyWorkouts();
    fetchUserDataAndGenerateWorkouts();
  }, []);

  const fetchMyWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setMyWorkouts(data);
      if (error) console.error("Eroare la preluarea antrenamentelor:", error.message);
    }
  };

  const fetchUserDataAndGenerateWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('goal, sex').eq('id', user.id).single();
      const goal = profile?.goal || 'maintain';
      const sex = profile?.sex || 'M';
      let generated = [];

      if (goal === 'lose_weight') {
        generated = [
          { name: 'Cardio & Core Burn', duration: '30 min', intensity: 'Medium', exercises: [{ id: 'e1', name: 'Crunches', sets: [{ id: 's1', weight: '0', reps: '15', prev: '-', completed: false }] }] },
          { name: 'Fat Burner HIIT', duration: '45 min', intensity: 'Hard', exercises: [{ id: 'e1', name: 'Burpees', sets: [{ id: 's1', weight: '0', reps: '20', prev: '-', completed: false }] }] },
        ];
      } else if (goal === 'build_muscle') {
        if (sex.toUpperCase() === 'M') {
          generated = [
            { name: 'Piept & Triceps', duration: '60 min', intensity: 'Hard', exercises: [{ id: 'e1', name: 'Barbell Bench Press', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
            { name: 'Spate & Biceps', duration: '55 min', intensity: 'Hard', exercises: [{ id: 'e1', name: 'Lat Pulldown', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
          ];
        } else {
          generated = [
            { name: 'Glutes & Legs Focus', duration: '55 min', intensity: 'Hard', exercises: [{ id: 'e1', name: 'Barbell Squat', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
            { name: 'Upper Body Toning', duration: '45 min', intensity: 'Medium', exercises: [{ id: 'e1', name: 'Lat Pulldown', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
          ];
        }
      } else if (goal === 'gain_strength') {
        generated = [
          { name: '5x5 Lifts (Picioare)', duration: '60 min', intensity: 'Insane', exercises: [{ id: 'e1', name: 'Barbell Squat', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
          { name: 'Push Power (Piept/Umeri)', duration: '55 min', intensity: 'Hard', exercises: [{ id: 'e1', name: 'Overhead Press', sets: [{ id: 's1', weight: '', reps: '', prev: '-', completed: false }] }] },
        ];
      } else {
        generated = [
          { name: 'Full Body Maintenance', duration: '45 min', intensity: 'Medium', exercises: [{ id: 'e1', name: 'Push-ups', sets: [{ id: 's1', weight: '0', reps: '15', prev: '-', completed: false }] }] },
        ];
      }
      setSuggestedWorkouts(generated);
    }
  };

  const confirmDeleteWorkout = (id) => {
    Alert.alert("Ștergere Antrenament", "Ești sigur că vrei să ștergi acest antrenament?", [
      { text: "Anulează", style: "cancel" },
      { text: "Șterge", style: "destructive", onPress: async () => {
          setMyWorkouts(myWorkouts.filter(w => w.id !== id));
          await supabase.from('user_workouts').delete().eq('id', id);
        } 
      }
    ]);
  };

  const triggerCustomWorkoutCreation = () => {
    closeMainMenu();
    setNewWorkoutName('');
    setIsNamingModalVisible(true);
  };

  const handleCreateNamedWorkout = async () => {
    const finalName = newWorkoutName.trim() || 'Custom Session';
    setIsNamingModalVisible(false);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('user_workouts').insert({
      user_id: user.id,
      name: finalName,
      exercises: []
    }).select().single();

    if (data) {
      setMyWorkouts([data, ...myWorkouts]);
      openWorkoutDetail(data);
    } else if (error) {
      Alert.alert("Eroare", "Nu s-a putut crea antrenamentul.");
    }
  };

  const addPreset = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('user_workouts').insert({
      user_id: user.id,
      name: item.name,
      duration: item.duration,
      intensity: item.intensity,
      exercises: item.exercises || []
    }).select().single();

    if (data) {
      setMyWorkouts([data, ...myWorkouts]);
    }
    closeMainMenu();
  };

  const closeMainMenu = () => {
    setMainMenuVisible(false);
    setIsBuiltInExpanded(false); 
  };

  const handleSaveWorkout = (updatedWorkout) => {
    setMyWorkouts(prevWorkouts => prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
  };

  const openWorkoutDetail = (workout) => {
    navigation.navigate('WorkoutDetailScreen', {
      workout: workout,
      onSave: handleSaveWorkout
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Your Library</Text></View>

      <FlatList
        data={myWorkouts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Nu ai antrenamente salvate. Apasă + pentru a adăuga.</Text>}
        renderItem={({ item }) => (
          <View style={styles.glassCard}>
            <TouchableOpacity style={styles.workoutMain} onPress={() => openWorkoutDetail(item)}>
              <View style={styles.iconCircle}><Dumbbell color="#1DB954" size={20} /></View>
              <View>
                <Text style={styles.workoutName}>{item.name}</Text>
                {item.duration && <Text style={{color: '#666', fontSize: 12}}>{item.duration} • {item.intensity}</Text>}
              </View>
            </TouchableOpacity>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => confirmDeleteWorkout(item.id)} style={styles.deleteBtn}>
                <Trash2 color="#ff4444" size={18} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={() => openWorkoutDetail(item)}>
                <Play color="#000" size={16} fill="#000" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setMainMenuVisible(true)}>
        <Plus color="#000" size={30} />
      </TouchableOpacity>

      <Modal visible={mainMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeMainMenu}>
          <TouchableOpacity activeOpacity={1} style={styles.glassMenu}>
            <Text style={styles.menuTitle}>Alege o opțiune</Text>
            
            <TouchableOpacity style={styles.menuOption} onPress={triggerCustomWorkoutCreation}>
              <Zap color="#1DB954" size={22} /><Text style={styles.menuOptionText}>Creare Manuală</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuOption, isBuiltInExpanded && styles.menuOptionExpanded]} 
              onPress={() => setIsBuiltInExpanded(!isBuiltInExpanded)}
            >
              <Layout color="#1DB954" size={22} />
              <Text style={styles.menuOptionText}>Antrenamente Built-in</Text>
              {isBuiltInExpanded ? <ChevronUp color="#666" size={20} style={styles.chevron} /> : <ChevronDown color="#666" size={20} style={styles.chevron} />}
            </TouchableOpacity>
            
            {isBuiltInExpanded && (
              <View style={styles.expandedContainer}>
                {suggestedWorkouts.map((item, index) => (
                  <TouchableOpacity key={index} style={styles.expandedItem} onPress={() => addPreset(item)}>
                    <View>
                      <Text style={styles.expandedItemName}>{item.name}</Text>
                      <Text style={styles.expandedItemSub}>{item.duration} • {item.intensity}</Text>
                    </View>
                    <Plus color="#1DB954" size={20} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <TouchableOpacity onPress={closeMainMenu} style={{ marginTop: 20 }}>
              <Text style={styles.closeText}>Anulează</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isNamingModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.glassMenu}>
            <Text style={styles.menuTitle}>Numește Antrenamentul</Text>
            
            <TextInput 
              style={styles.nameInput}
              placeholder="Ex: Leg Day Killer"
              placeholderTextColor="#666"
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
              autoFocus
            />
            
            <TouchableOpacity style={styles.saveNameBtn} onPress={handleCreateNamedWorkout}>
              <Text style={styles.saveNameBtnText}>Creează și Editează</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setIsNamingModalVisible(false)} style={{ marginTop: 20 }}>
              <Text style={styles.closeText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 25, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  listContent: { padding: 20, paddingBottom: 100 },
  
  glassCard: { backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 20, padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  workoutMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { backgroundColor: 'rgba(29, 185, 84, 0.1)', padding: 10, borderRadius: 12, marginRight: 15 },
  workoutName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { backgroundColor: '#1DB954', width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  deleteBtn: { padding: 8 },
  
  fab: { position: 'absolute', bottom: 90, right: 25, backgroundColor: '#1DB954', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1DB954', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  glassMenu: { backgroundColor: '#1c1c1e', width: '100%', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  
  menuOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 18, borderRadius: 15, marginBottom: 12 },
  menuOptionExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  menuOptionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 15 },
  chevron: { marginLeft: 'auto' },
  
  expandedContainer: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderTopWidth: 0 },
  expandedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  expandedItemName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  expandedItemSub: { color: '#1DB954', fontSize: 12, marginTop: 4 },
  
  closeText: { color: '#b3b3b3', textAlign: 'center', fontSize: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 50 },

  nameInput: { backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  saveNameBtn: { backgroundColor: '#1DB954', padding: 15, borderRadius: 15, alignItems: 'center' },
  saveNameBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});