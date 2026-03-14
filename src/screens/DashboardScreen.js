import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, SafeAreaView, 
  Dimensions, Platform, TouchableOpacity, Modal, Animated 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { 
  Flame, Clock, Moon, CheckCircle2, Circle as CircleIcon, 
  Footprints, Droplets, User, Settings, LogIn, X 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const WATER_BLUE = '#3b82f6';
const SLEEP_PURPLE = '#a29bfe';
const CARD_BG = '#121212';

export default function DashboardScreen() {
  const [waterAmount, setWaterAmount] = useState(0); 
  const [isWaterModalVisible, setWaterModalVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', steps: 0 });
  
  const WATER_GOAL = 3000; 

  useEffect(() => {
    fetchTodayData();
  }, []);

  const fetchTodayData = async () => {
    setWaterAmount(0);
  };

  const addWater = async (amount) => {
    const newTotal = waterAmount + amount;
    setWaterAmount(newTotal);
    setWaterModalVisible(false);
      };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoAndName}>
                <View style={styles.logoMark}><Flame size={18} color="black" fill="black" /></View>
                <Text style={styles.appName}>Sportify</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.avatarButton} 
                onPress={() => setMenuVisible(true)}
              >
                <User size={24} color={NEON_GREEN} />
              </TouchableOpacity>
            </View>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.welcomeText}>Hello, {userData.name}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.ringShadowWrapper}>
              <Svg height={200} width={200} viewBox="0 0 100 100">
                <G rotation="-90" origin="50, 50">
                  <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                  <Circle 
                    cx="50" cy="50" r="45" stroke={NEON_GREEN} strokeWidth="6" fill="transparent" 
                    strokeDasharray="283" 
                    strokeDashoffset={283 - (283 * (userData.steps / 10000))} 
                    strokeLinecap="round"
                  />
                </G>
              </Svg>
            </View>
            <View style={styles.stepsInfoContainer}>
              <Footprints size={24} color={NEON_GREEN} />
              <Text style={styles.stepCount}>{userData.steps}</Text>
              <Text style={styles.stepGoal}>of 10,000 steps</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Focus</Text>
          </View>

          <TouchableOpacity 
            style={[styles.taskCard, waterAmount >= WATER_GOAL && styles.neonBorder]}
            onPress={() => setWaterModalVisible(true)}
          >
            {waterAmount >= WATER_GOAL ? (
              <CheckCircle2 size={24} color={NEON_GREEN} />
            ) : (
              <Droplets size={24} color={WATER_BLUE} />
            )}
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Hydration Goal</Text>
              <Text style={styles.taskDescription}>
                {(waterAmount / 1000).toFixed(2)}L / {(WATER_GOAL / 1000).toFixed(1)}L
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 25 }]}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <StatCardWrapper icon={<Flame size={16} color={NEON_GREEN}/>} label="CALORIES" value="0" unit="kcal" color={NEON_GREEN} />
            <StatCardWrapper icon={<Clock size={16} color="#4D79FF"/>} label="ACTIVITY" value="0" unit="mins" color="#4D79FF" />
            <StatCardWrapper icon={<Moon size={16} color={SLEEP_PURPLE}/>} label="SLEEP" value="0" unit="hrs" color={SLEEP_PURPLE} />
            <StatCardWrapper 
               icon={<Droplets size={16} color={WATER_BLUE}/>} 
               label="WATER" value={(waterAmount / 1000).toFixed(2)} 
               unit="L" color={WATER_BLUE} 
               onPress={() => setWaterModalVisible(true)}
            />
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuCloseArea} 
            onPress={() => setMenuVisible(false)} 
          />
          <Animated.View style={styles.sideMenuContent}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Profile</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuItems}>
              <TouchableOpacity style={styles.menuButton}>
                <LogIn color={NEON_GREEN} size={20} />
                <Text style={styles.menuButtonText}>Account / Register</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuButton}>
                <Settings color="#666" size={20} />
                <Text style={styles.menuButtonText}>Settings</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.logoutBtn}
              onPress={async () => await supabase.auth.signOut()}
            >
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={isWaterModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Droplets size={48} color={WATER_BLUE} style={{ marginBottom: 25 }} />
            <Text style={styles.modalTitle}>Add Water</Text>
            <View style={styles.selectionGrid}>
              {[250, 500, 750, 1000].map((amount) => (
                <TouchableOpacity key={amount} style={styles.amountButton} onPress={() => addWater(amount)}>
                  <Text style={styles.amountButtonText}>+{amount}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setWaterModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCardWrapper({ icon, label, value, unit, color, onPress }) {
  return (
    <TouchableOpacity style={styles.statCardWrapper} onPress={onPress} disabled={!onPress}>
      <View style={styles.statCardInner}>
        <View style={styles.statHeader}>{icon}<Text style={[styles.statLabel, { color }]}>{label}</Text></View>
        <View style={styles.statValueContainer}><Text style={styles.statValue}>{value}</Text><Text style={styles.statUnit}>{unit}</Text></View>
      </View>
    </TouchableOpacity>
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
  avatarButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  dateText: { color: '#666', marginTop: 20, fontSize: 14 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  progressContainer: { alignItems: 'center', marginVertical: 20, justifyContent: 'center' },
  ringShadowWrapper: { shadowColor: NEON_GREEN, shadowRadius: 15, shadowOpacity: 0.5 },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: '#FFF', fontSize: 42, fontWeight: 'bold' },
  stepGoal: { color: '#666', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  taskCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  neonBorder: { borderColor: NEON_GREEN + '66' },
  taskTextContainer: { marginLeft: 15 },
  taskTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taskDescription: { color: '#666', fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', marginTop: 15 },
  statCardWrapper: { width: '48%', marginBottom: 12 },
  statCardInner: { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, height: 115, justifyContent: 'space-between', borderWidth: 1, borderColor: '#222' },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginLeft: 8 },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statUnit: { color: '#666', fontSize: 11, marginLeft: 5 },
  
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', flexDirection: 'row' },
  menuCloseArea: { flex: 1 },
  sideMenuContent: { width: width * 0.75, backgroundColor: '#121212', height: '100%', padding: 30, paddingTop: 60, borderLeftWidth: 1, borderLeftColor: '#333' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  menuTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  menuItems: { flex: 1 },
  menuButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, padding: 10 },
  menuButtonText: { color: '#FFF', fontSize: 18, marginLeft: 15 },
  logoutBtn: { borderTopWidth: 1, borderTopColor: '#222', paddingTop: 20 },
  logoutText: { color: '#FF4444', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#121212', borderRadius: 32, padding: 30, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountButton: { backgroundColor: '#1c2533', paddingVertical: 20, borderRadius: 16, marginBottom: 15, width: '47%', alignItems: 'center' },
  amountButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { marginTop: 25 },
  closeBtnText: { color: '#666', fontSize: 16 }
});