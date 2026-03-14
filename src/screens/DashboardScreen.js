import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Flame, User, Settings, LogIn, X, Bell, ShieldCheck,
  HelpCircle, Ruler, ChevronRight, Edit3, Footprints, Droplets, Clock, Moon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const WATER_BLUE = '#3b82f6';
const SLEEP_PURPLE = '#a29bfe';
const CARD_BG = '#121212';

export default function DashboardScreen() {
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isWaterModalVisible, setWaterModalVisible] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [dailyStats, setDailyStats] = useState({
    steps: 0,
    calories: 0,
    activity: 0,
    sleep: 0,
    water: 0
  });

  const WATER_GOAL = 3000;
  const STEPS_GOAL = 10000;

  useFocusEffect(
    useCallback(() => {
      fetchProfileAndStats();
    }, [])
  );

  const fetchProfileAndStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) setUserProfile(profile);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isoToday = today.toISOString();

      const { data: foodLogs, error } = await supabase
        .from('scanned_foods')
        .select('calories')
        .eq('user_id', user.id)
        .gte('scanned_at', isoToday);

      if (error) {
        console.error("Eroare preluare calorii:", error);
      }

      const totalCalories = foodLogs ? foodLogs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0) : 0;

      setDailyStats(prev => ({
        ...prev,
        calories: totalCalories
      }));
    }
  };

  const addWater = (amount) => {
    setDailyStats(prev => ({ ...prev, water: prev.water + amount }));
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
              <TouchableOpacity style={styles.avatarButton} onPress={() => setMenuVisible(true)}>
                <User size={24} color={NEON_GREEN} />
              </TouchableOpacity>
            </View>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.welcomeText}>Hello, {userProfile?.first_name || 'User'}</Text>
          </View>

          <View style={styles.progressContainer}>
            <Svg height={200} width={200} viewBox="0 0 100 100">
              <G rotation="-90" origin="50, 50">
                <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                <Circle 
                  cx="50" cy="50" r="45" stroke={NEON_GREEN} strokeWidth="6" fill="transparent" 
                  strokeDasharray="283" 
                  strokeDashoffset={283 - (283 * (dailyStats.steps / STEPS_GOAL))} 
                  strokeLinecap="round"
                />
              </G>
            </Svg>
            <View style={styles.stepsInfoContainer}>
              <Footprints size={24} color={NEON_GREEN} />
              <Text style={styles.stepCount}>{dailyStats.steps}</Text>
              <Text style={styles.stepGoal}>of {STEPS_GOAL} steps</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Today's Focus</Text></View>
          
          <TouchableOpacity 
            style={[styles.taskCard, dailyStats.water >= WATER_GOAL && styles.neonBorder]}
            onPress={() => setWaterModalVisible(true)}
          >
            <Droplets size={24} color={WATER_BLUE} />
            <View style={styles.taskTextContainer}>
              <Text style={styles.taskTitle}>Hydration Goal</Text>
              <Text style={styles.taskDescription}>
                {(dailyStats.water / 1000).toFixed(2)}L / {(WATER_GOAL / 1000).toFixed(1)}L
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 25, marginBottom: 15 }]}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <StatCardWrapper icon={<Flame size={16} color={NEON_GREEN}/>} label="CALORIES" value={dailyStats.calories} unit="kcal" color={NEON_GREEN} />
            <StatCardWrapper icon={<Clock size={16} color="#4D79FF"/>} label="ACTIVITY" value={dailyStats.activity} unit="mins" color="#4D79FF" />
            <StatCardWrapper icon={<Moon size={16} color={SLEEP_PURPLE}/>} label="SLEEP" value={dailyStats.sleep} unit="hrs" color={SLEEP_PURPLE} />
            <StatCardWrapper 
              icon={<Droplets size={16} color={WATER_BLUE}/>} 
              label="WATER" 
              value={(dailyStats.water / 1000).toFixed(2)} 
              unit="L" 
              color={WATER_BLUE} 
              onPress={() => setWaterModalVisible(true)}
            />
          </View>

        </ScrollView>
      </LinearGradient>

      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuCloseArea} onPress={() => setMenuVisible(false)} />
          <View style={styles.sideMenuContent}>
            <View style={styles.sidebarProfileSection}>
              <View style={styles.sidebarAvatar}><User size={30} color={NEON_GREEN} /></View>
              <View>
                <Text style={styles.sidebarName}>{userProfile?.first_name || 'User'}</Text>
                <TouchableOpacity onPress={() => { setMenuVisible(false); setProfileModalVisible(true); }}>
                  <Text style={styles.viewProfileSidebar}>View Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.menuDivider} />
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.menuGroupTitle}>General Settings</Text>
              <MenuOption icon={<Bell color="#666" size={20}/>} label="Notifications" />
              <MenuOption icon={<ShieldCheck color="#666" size={20}/>} label="Privacy & Security" />
              <MenuOption icon={<Ruler color="#666" size={20}/>} label="Units (Metric)" />
              <MenuOption icon={<HelpCircle color="#666" size={20}/>} label="Help & Support" />
            </ScrollView>
            <View style={styles.menuFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={async () => await supabase.auth.signOut()}>
                <LogIn color="#FF4444" size={20} /><Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isWaterModalVisible} animationType="fade">
        <View style={styles.modalOverlayFull}>
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
            <TouchableOpacity onPress={() => setWaterModalVisible(false)}><Text style={styles.closeBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isProfileModalVisible} animationType="slide">
        <SafeAreaView style={styles.profileContainer}>
          <View style={styles.profileHeaderContent}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)}><X color="#FFF" size={30} /></TouchableOpacity>
            <TouchableOpacity style={styles.editBtn}><Edit3 color="#000" size={18} /><Text style={styles.editBtnText}>Edit</Text></TouchableOpacity>
          </View>
          <View style={styles.profileDetails}>
            <View style={styles.bigAvatar}><User size={60} color={NEON_GREEN} /></View>
            <Text style={styles.userNameBig}>{userProfile?.first_name}</Text>
            <View style={styles.statsRow}>
              <ProfileStat label="Weight" value={`${userProfile?.weight} kg`} />
              <ProfileStat label="Height" value={`${userProfile?.height} cm`} />
              <ProfileStat label="Age" value={`${userProfile?.age} y/o`} />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function MenuOption({ icon, label }) {
  return (
    <TouchableOpacity style={styles.menuOption}>
      <View style={styles.menuOptionLeft}>{icon}<Text style={styles.menuOptionText}>{label}</Text></View>
      <ChevronRight color="#333" size={18} />
    </TouchableOpacity>
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

function ProfileStat({ label, value }) {
  return (
    <View style={styles.pStat}>
      <Text style={styles.pStatValue}>{value}</Text>
      <Text style={styles.pStatLabel}>{label}</Text>
    </View>
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
  avatarButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  dateText: { color: '#666', marginTop: 15, fontSize: 14 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  progressContainer: { alignItems: 'center', marginVertical: 30, justifyContent: 'center' },
  stepsInfoContainer: { position: 'absolute', alignItems: 'center' },
  stepCount: { color: '#FFF', fontSize: 42, fontWeight: 'bold' },
  stepGoal: { color: '#666', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  taskCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  neonBorder: { borderColor: NEON_GREEN + 'AA' },
  taskTextContainer: { marginLeft: 15 },
  taskTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taskDescription: { color: '#666', fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  statCardWrapper: { width: '48%', marginBottom: 12 },
  statCardInner: { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, height: 110, justifyContent: 'space-between', borderWidth: 1, borderColor: '#222' },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginLeft: 8 },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statUnit: { color: '#666', fontSize: 11, marginLeft: 5 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
  menuCloseArea: { flex: 1 },
  sideMenuContent: { width: width * 0.75, backgroundColor: '#121212', padding: 25, paddingTop: 60 },
  sidebarProfileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sidebarAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: NEON_GREEN },
  sidebarName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  viewProfileSidebar: { color: NEON_GREEN, fontSize: 12, fontWeight: '600', marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#222', marginVertical: 20 },
  menuGroupTitle: { color: '#444', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  menuOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  menuOptionText: { color: '#FFF', fontSize: 16, marginLeft: 15 },
  menuFooter: { marginTop: 'auto', paddingTop: 20 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  logoutText: { color: '#FF4444', fontSize: 16, fontWeight: 'bold', marginLeft: 15 },
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#121212', borderRadius: 32, padding: 30, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountButton: { backgroundColor: '#1c2533', paddingVertical: 20, borderRadius: 16, marginBottom: 15, width: '47%', alignItems: 'center' },
  amountButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  closeBtnText: { color: '#666', fontSize: 16, marginTop: 10 },
  profileContainer: { flex: 1, backgroundColor: '#000' },
  profileHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  editBtn: { backgroundColor: NEON_GREEN, flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  editBtnText: { color: '#000', fontWeight: 'bold', marginLeft: 5 },
  profileDetails: { alignItems: 'center', marginTop: 20 },
  bigAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: NEON_GREEN },
  userNameBig: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 30 },
  pStat: { alignItems: 'center' },
  pStatValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  pStatLabel: { color: '#666', fontSize: 12 }
});
