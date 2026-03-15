import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { 
  Plus, Dumbbell, Play, Trash2, Zap, Layout, ChevronDown, ChevronUp, Flame 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

export default function TrainingScreen({ navigation }) {
  const [myWorkouts, setMyWorkouts] = useState([]);
  const [suggestedWorkouts, setSuggestedWorkouts] = useState([]);
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  const [isBuiltInExpanded, setIsBuiltInExpanded] = useState(false);
  const [isNamingModalVisible, setIsNamingModalVisible] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  useFocusEffect(
    useCallback(() => {
      setMyWorkouts([]);
      setSuggestedWorkouts([]);
      
      fetchMyWorkouts();
      generateSmartWorkouts();
    }, [])
  );

  const fetchMyWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('user_workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setMyWorkouts(data);
    }
  };

  const generateSmartWorkouts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('weight, age, sex, goal, workouts_per_week').eq('id', user.id).single();
    
    const weight = parseFloat(profile?.weight) || 70;
    const age = parseInt(profile?.age) || 25;
    const sex = (profile?.sex || 'M').toUpperCase();
    const goal = profile?.goal || 'build_muscle';
    const days = parseInt(profile?.workouts_per_week) || 3;

    let targetReps = "10";
    let intensityStr = "Medium";
    let weightModifier = 1.0; 

    if (goal === 'gain_strength') { targetReps = "5"; intensityStr = "Insane"; weightModifier = 1.1; }
    else if (goal === 'build_muscle') { targetReps = "10"; intensityStr = "Hard"; weightModifier = 0.9; }
    else if (goal === 'maintain') { targetReps = "12"; intensityStr = "Medium"; weightModifier = 0.7; }
    else if (goal === 'lose_weight') { targetReps = "20"; intensityStr = "High"; weightModifier = 0.4; } 

    const ageMod = (age < 18 || age > 45) ? 0.85 : 1.0;
    const sexUpperMod = sex === 'F' ? 0.6 : 1.0; 
    const sexLowerMod = sex === 'F' ? 0.8 : 1.0;

    const calcWeight = (baseRatio, isUpper, isDb) => {
        if (baseRatio === 0) return "0";
        let w = weight * baseRatio * weightModifier * ageMod * (isUpper ? sexUpperMod : sexLowerMod);
        if (isDb) w = w / 2; 
        return Math.max(2.5, Math.round(w / 2.5) * 2.5).toString(); 
    };

    const genSets = (w, r) => Array.from({ length: 4 }).map(() => ({ 
      id: Math.random().toString(), weight: w, reps: r, prev: '-', completed: false 
    }));

    const EXERCISES = {
        heavy_push: [
            { name: 'Barbell Bench Press', ratio: 1.2, upper: true, isDb: false },
            { name: 'Overhead Press', ratio: 0.7, upper: true, isDb: false },
            { name: 'Incline DB Press', ratio: 0.9, upper: true, isDb: true }
        ],
        hyper_push: [
            { name: 'Chest Fly (Machine)', ratio: 0.7, upper: true, isDb: false },
            { name: 'Tricep Pushdown', ratio: 0.5, upper: true, isDb: false },
            { name: 'Lateral Raises', ratio: 0.2, upper: true, isDb: true },
            { name: 'DB Shoulder Press', ratio: 0.6, upper: true, isDb: true }
        ],
        heavy_pull: [
            { name: 'Barbell Row', ratio: 1.0, upper: true, isDb: false },
            { name: 'Deadlift', ratio: 1.5, upper: false, isDb: false },
            { name: 'Lat Pulldown', ratio: 0.9, upper: true, isDb: false },
            { name: 'Pull-ups', ratio: 0, upper: true, isDb: false }
        ],
        hyper_pull: [
            { name: 'Dumbbell Row', ratio: 0.8, upper: true, isDb: true },
            { name: 'Face Pulls', ratio: 0.3, upper: true, isDb: false },
            { name: 'DB Bicep Curl', ratio: 0.4, upper: true, isDb: true },
            { name: 'Hammer Curl', ratio: 0.35, upper: true, isDb: true }
        ],
        heavy_legs: [
            { name: 'Barbell Squat', ratio: 1.4, upper: false, isDb: false },
            { name: 'Leg Press', ratio: 2.0, upper: false, isDb: false },
            { name: 'Romanian Deadlift', ratio: 1.2, upper: false, isDb: false }
        ],
        hyper_legs: [
            { name: 'Bulgarian Split Squat', ratio: 0.6, upper: false, isDb: true },
            { name: 'Leg Extensions', ratio: 0.6, upper: false, isDb: false },
            { name: 'Leg Curls', ratio: 0.6, upper: false, isDb: false },
            { name: 'Calf Raises', ratio: 1.0, upper: false, isDb: false }
        ],
        cardio: [
            { name: 'Jumping Jacks', ratio: 0, upper: false, isDb: false },
            { name: 'Burpees', ratio: 0, upper: false, isDb: false },
            { name: 'High Knees', ratio: 0, upper: false, isDb: false },
            { name: 'Mountain Climbers', ratio: 0, upper: false, isDb: false },
            { name: 'Squat Jumps', ratio: 0, upper: false, isDb: false }
        ],
        core: [
            { name: 'Crunches', ratio: 0, upper: false, isDb: false },
            { name: 'Plank', ratio: 0, upper: false, isDb: false },
            { name: 'Russian Twists', ratio: 0, upper: false, isDb: false },
            { name: 'Leg Raises', ratio: 0, upper: false, isDb: false }
        ],
        light_fullbody: [
            { name: 'Push-ups', ratio: 0, upper: true, isDb: false },
            { name: 'Bodyweight Squats', ratio: 0, upper: false, isDb: false },
            { name: 'Light DB Thrusters', ratio: 0.3, upper: true, isDb: true },
            { name: 'Walking Lunges', ratio: 0, upper: false, isDb: false }
        ]
    };

    const buildWorkout = (name, categories, duration, specificReps = targetReps) => {
        let exercises = [];
        let itemsPerGroup = Math.ceil(5 / categories.length);
        
        categories.forEach(cat => {
            EXERCISES[cat].slice(0, itemsPerGroup).forEach(ex => {
                if (exercises.length < 5) {
                    let w = calcWeight(ex.ratio, ex.upper, ex.isDb);
                    let r = specificReps;
                    
                    if (ex.name === 'Plank') r = '60'; 
                    if (ex.ratio === 0 && ex.name !== 'Plank') r = (parseInt(specificReps) + 5).toString(); 
                    
                    exercises.push({
                        id: Math.random().toString(),
                        name: ex.name,
                        sets: genSets(w, r)
                    });
                }
            });
        });
        return { name, duration, intensity: intensityStr, exercises };
    };

    let workouts = [];

    if (goal === 'lose_weight') {
        workouts.push(buildWorkout('HIIT Cardio Blast', ['cardio', 'core'], '35 min', '30'));
        workouts.push(buildWorkout('Core & Fat Burn', ['core', 'cardio'], '30 min', '25'));
        workouts.push(buildWorkout('Full Body Sweat', ['light_fullbody', 'cardio'], '40 min', '20'));
        workouts.push(buildWorkout('Metabolic Conditioning', ['cardio', 'light_fullbody'], '45 min', '25'));
        workouts.push(buildWorkout('Active Recovery & Abs', ['core', 'light_fullbody'], '30 min', '20'));
    } 
    else if (goal === 'gain_strength') {
        workouts.push(buildWorkout('Heavy Push (Chest/Shoulders)', ['heavy_push', 'hyper_push'], '60 min'));
        workouts.push(buildWorkout('Heavy Pull (Back)', ['heavy_pull', 'hyper_pull'], '60 min'));
        workouts.push(buildWorkout('Heavy Legs', ['heavy_legs', 'hyper_legs'], '65 min'));
        workouts.push(buildWorkout('Upper Body Power', ['heavy_push', 'heavy_pull'], '60 min'));
        workouts.push(buildWorkout('Lower Body Power', ['heavy_legs', 'core'], '60 min'));
    }
    else if (goal === 'build_muscle') {
        if (days <= 3) {
            workouts.push(buildWorkout('Full Body A', ['heavy_push', 'hyper_legs', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Full Body B', ['heavy_pull', 'hyper_push', 'heavy_legs'], '55 min'));
            workouts.push(buildWorkout('Full Body C', ['heavy_legs', 'hyper_push', 'hyper_pull'], '55 min'));
        } else if (days === 4) {
            workouts.push(buildWorkout('Upper Body', ['heavy_push', 'hyper_pull', 'hyper_push'], '55 min'));
            workouts.push(buildWorkout('Lower Body', ['heavy_legs', 'hyper_legs', 'core'], '60 min'));
            workouts.push(buildWorkout('Upper Body Hypertrophy', ['heavy_pull', 'hyper_push', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Lower Body Hypertrophy', ['heavy_legs', 'hyper_legs'], '60 min'));
        } else {
            workouts.push(buildWorkout('Chest & Triceps', ['heavy_push', 'hyper_push'], '55 min'));
            workouts.push(buildWorkout('Back & Biceps', ['heavy_pull', 'hyper_pull'], '55 min'));
            workouts.push(buildWorkout('Leg Day', ['heavy_legs', 'hyper_legs'], '65 min'));
            workouts.push(buildWorkout('Shoulders & Core', ['hyper_push', 'core'], '50 min'));
            workouts.push(buildWorkout('Arm Day', ['hyper_pull', 'hyper_push'], '45 min'));
        }
    }
    else if (goal === 'maintain') {
        workouts.push(buildWorkout('Balanced Full Body', ['heavy_push', 'heavy_legs', 'hyper_pull'], '45 min'));
        workouts.push(buildWorkout('Core & Cardio', ['core', 'cardio'], '30 min'));
        workouts.push(buildWorkout('Upper Body Flow', ['heavy_pull', 'hyper_push'], '45 min'));
        workouts.push(buildWorkout('Lower Body Flow', ['heavy_legs', 'core'], '45 min'));
        workouts.push(buildWorkout('Functional Fitness', ['light_fullbody', 'cardio'], '40 min'));
    }

    setSuggestedWorkouts(workouts.slice(0, Math.max(1, Math.min(days, 5))));
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

    const { data } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: finalName, exercises: []
    }).select().single();

    if (data) {
      setMyWorkouts([data, ...myWorkouts]);
      openWorkoutDetail(data); 
    }
  };

  const addPreset = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('user_workouts').insert({
      user_id: user.id, name: item.name, duration: item.duration,
      intensity: item.intensity, exercises: item.exercises || []
    }).select().single();

    if (data) setMyWorkouts([data, ...myWorkouts]);
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
    navigation.navigate('WorkoutDetailScreen', { workout: workout, onSave: handleSaveWorkout });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <View style={styles.header}>
          <View style={styles.logoAndName}>
            <View style={styles.logoMark}><Flame size={18} color="black" fill="black" /></View>
            <Text style={styles.appName}>Sportify</Text>
          </View>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          <Text style={styles.title}>Your Library</Text>
        </View>

        <FlatList
        data={myWorkouts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Nu ai antrenamente salvate. Apasă + pentru a adăuga.</Text>}
        renderItem={({ item }) => (
          <View style={styles.glassCard}>
            <TouchableOpacity style={styles.workoutMain} onPress={() => openWorkoutDetail(item)}>
              <View style={styles.iconCircle}><Dumbbell color={NEON_GREEN} size={20} /></View>
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
              <Zap color={NEON_GREEN} size={22} /><Text style={styles.menuOptionText}>Creare Manuală</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuOption, isBuiltInExpanded && styles.menuOptionExpanded]} 
              onPress={() => setIsBuiltInExpanded(!isBuiltInExpanded)}
            >
              <Layout color={NEON_GREEN} size={22} />
              <Text style={styles.menuOptionText}>Antrenamente Generate (AI)</Text>
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
                    <Plus color={NEON_GREEN} size={20} />
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
              style={styles.nameInput} placeholder="Ex: Leg Day Killer" placeholderTextColor="#666"
              value={newWorkoutName} onChangeText={setNewWorkoutName} autoFocus
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  header: { padding: 20, paddingTop: 40 },
  logoAndName: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 32, height: 32, backgroundColor: NEON_GREEN, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  dateText: { color: '#666', marginTop: 15, fontSize: 14 },
  title: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  listContent: { padding: 20, paddingBottom: 100 },
  glassCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#222' },
  workoutMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 10, borderRadius: 12, marginRight: 15 },
  workoutName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  playBtn: { backgroundColor: NEON_GREEN, width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  deleteBtn: { padding: 8 },
  fab: { position: 'absolute', bottom: 90, right: 25, backgroundColor: NEON_GREEN, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  glassMenu: { backgroundColor: '#161616', width: '100%', borderRadius: 35, padding: 25, borderWidth: 1, borderColor: '#222' },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  menuOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 18, borderRadius: 15, marginBottom: 12 },
  menuOptionExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  menuOptionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 15 },
  chevron: { marginLeft: 'auto' },
  expandedContainer: { backgroundColor: '#1c1c1c', padding: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginBottom: 12, borderWidth: 1, borderColor: '#222', borderTopWidth: 0 },
  expandedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  expandedItemName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  expandedItemSub: { color: NEON_GREEN, fontSize: 12, marginTop: 4 },
  closeText: { color: '#666', textAlign: 'center', fontSize: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 50 },
  nameInput: { backgroundColor: '#222', color: '#fff', borderRadius: 15, padding: 18, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  saveNameBtn: { backgroundColor: NEON_GREEN, padding: 18, borderRadius: 15, alignItems: 'center' },
  saveNameBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});