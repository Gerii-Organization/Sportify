import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Flame, User, Settings, LogIn, X, Bell, ShieldCheck,
  HelpCircle, Ruler, ChevronRight, Edit3, Footprints, Droplets, Clock, Moon, 
  Trophy, Calendar, TrendingUp, Target, Award, Activity, Crown
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Polygon } from 'react-native-svg';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const WATER_BLUE = '#3b82f6';
const SLEEP_PURPLE = '#a29bfe';
const CARD_BG = '#121212';

// Temele din noul tău Dashboard
const RING_THEMES = {
  'r1': { color: '#00FF66', type: 'standard', perimeter: 283 },
  'r2': { color: '#FF3300', type: 'inferno', perimeter: 283 },
  'r3': { color: '#00EAFF', type: 'cyber', perimeter: 268 },
  'r4': { color: '#39FF14', type: 'toxic', perimeter: 274 },
};

const AVATAR_THEMES = {
  'a1': { color: '#1ED760', type: 'standard' },
  'a2': { color: '#FFD700', type: 'royal' },
  'a3': { color: '#9900FF', type: 'demon' },
  'a4': { color: '#FF00FF', type: 'glitch' },
};

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
      // Preluăm profilul cu datele despre itemele echipate
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profile) setUserProfile(profile);

      // Logica nouă de preluare a caloriilor
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

  // Randarea dinamică a inelului de progres (Din Dashboard nou)
  const renderProgressShape = () => {
    const theme = RING_THEMES[userProfile?.equipped_ring] || RING_THEMES['r1'];
    const progress = Math.min(dailyStats.steps / STEPS_GOAL, 1);
    const offset = theme.perimeter - (theme.perimeter * progress);

    return (
      <View style={styles.progressContainer}>
        <View style={styles.ringWrapper}>
          <Svg height={220} width={220} viewBox="0 0 100 100">
            {theme.type === 'toxic' ? (
              <G>
                <Polygon points="50,5 95,85 5,85" stroke="#1A1A1A" strokeWidth="4" fill="transparent" />
                <Polygon
                  points="50,5 95,85 5,85" stroke={theme.color} strokeWidth="4" fill="transparent"
                  strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round"
                />
              </G>
            ) : theme.type === 'cyber' ? (
              <G>
                <Polygon points="50,5 90,25 90,75 50,95 10,75 10,25" stroke="#1A1A1A" strokeWidth="4" fill="transparent" />
                <Polygon
                  points="50,5 90,25 90,75 50,95 10,75 10,25" stroke={theme.color} strokeWidth="4" fill="transparent"
                  strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round"
                />
              </G>
            ) : (
              <G transform="rotate(-90 50 50)">
                <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                <Circle
                  cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="6" fill="transparent"
                  strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round"
                />
              </G>
            )}
          </Svg>

          {theme.type === 'inferno' && (
            <>
              <Flame color="#FF8800" size={35} style={[styles.absoluteIcon, { top: -15 }]} fill="#FF8800" />
              <Flame color="#FF8800" size={35} style={[styles.absoluteIcon, { bottom: -15, transform: [{rotate: '180deg'}] }]} fill="#FF8800" />
            </>
          )}
        </View>

        <View style={styles.stepsInfoContainer}>
          <Footprints size={24} color={theme.color} />
          <Text style={styles.stepCount}>{dailyStats.steps}</Text>
          <Text style={styles.stepGoal}>of {STEPS_GOAL} steps</Text>
        </View>
      </View>
    );
  };

  // Randarea dinamică a avatarului (Din Dashboard nou)
  const renderAvatar = (size, iconSize) => {
    const theme = AVATAR_THEMES[userProfile?.equipped_avatar] || AVATAR_THEMES['a1'];
    return (
      <View style={[
        styles.avatarBase,
        { width: size, height: size, borderRadius: size / 2, borderColor: theme.color },
        theme.type === 'royal' && { borderWidth: 3 },
        theme.type === 'demon' && { borderWidth: 2, borderStyle: 'dashed' },
        theme.type === 'glitch' && { borderWidth: 2, borderRadius: size / 4 },
        theme.type === 'standard' && { borderWidth: 1 }
      ]}>
        <User size={iconSize} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
        {theme.type === 'royal' && <Crown color={theme.color} size={iconSize * 0.8} style={styles.avatarCrown} fill="rgba(255, 215, 0, 0.3)" />}
        {theme.type === 'demon' && <Flame color={theme.color} size={size * 0.8} style={styles.avatarFlameBack} />}
        {theme.type === 'glitch' && <User size={iconSize} color="#FF00FF" style={styles.avatarGlitchOverlay} />}
      </View>
    );
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
              <TouchableOpacity onPress={() => setMenuVisible(true)}>
                {renderAvatar(44, 24)}
              </TouchableOpacity>
            </View>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.welcomeText}>Hello, {userProfile?.first_name || 'User'}</Text>
          </View>

          {/* Forma dinamică înlocuiește vechiul Svg static */}
          {renderProgressShape()}

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

      {/* --- SIDE MENU --- */}
      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuCloseArea} onPress={() => setMenuVisible(false)} />
          <View style={styles.sideMenuContent}>
            <View style={styles.sidebarProfileSection}>
              {renderAvatar(56, 30)}
              <View style={{ marginLeft: 15 }}>
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

      {/* --- MODAL APA --- */}
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

      {/* --- MODAL DETALII PROFIL --- */}
      <Modal visible={isProfileModalVisible} animationType="slide">
        <View style={styles.profileContainer}>
          <LinearGradient colors={['#000000', '#0a0a0a']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
              
              <View style={styles.profileHeaderContent}>
                <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.backBtn}>
                  <X color="#FFF" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <TouchableOpacity style={styles.editBtn}>
                  <Edit3 color="#000" size={18} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                
                <View style={styles.mainInfoSection}>
                  <View style={styles.bigAvatarContainer}>
                    {renderAvatar(110, 60)}
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>LVL 12</Text>
                    </View>
                  </View>
                  <Text style={styles.userNameBig}>{userProfile?.first_name || 'Athlete'}</Text>
                  <Text style={styles.userBio}>"Dedication has no off-season."</Text>
                </View>

                <View style={styles.streakCard}>
                  <LinearGradient 
                    colors={['rgba(30, 215, 96, 0.15)', 'rgba(0,0,0,0)']} 
                    start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                    style={styles.streakGradient}
                  >
                    <View style={styles.streakIconContainer}>
                      <Flame size={40} color={NEON_GREEN} fill={NEON_GREEN} />
                    </View>
                    <View>
                      <Text style={styles.streakValue}>14 Days</Text>
                      <Text style={styles.streakLabel}>Current Streak</Text>
                    </View>
                    <View style={styles.streakChartPlaceholder}>
                      <Activity size={24} color={NEON_GREEN} opacity={0.5} />
                    </View>
                  </LinearGradient>
                </View>

                <View style={styles.statsRow}>
                  <ProfileStatItem label="Weight" value={`${userProfile?.weight || 0}kg`} />
                  <ProfileStatItem label="Height" value={`${userProfile?.height || 0}cm`} />
                  <ProfileStatItem label="Workouts" value={`${userProfile?.workouts_per_week || 0}/wk`} />
                </View>

                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.profileSectionTitle}>Recent Activity</Text>
                    <TouchableOpacity><Text style={styles.seeMore}>View History</Text></TouchableOpacity>
                  </View>
                  
                  <RecentWorkoutItem title="Push Day" date="Yesterday" duration="55 min" intensity="Hard" />
                  <RecentWorkoutItem title="Back & Biceps" date="3 days ago" duration="42 min" intensity="Medium" />
                  <RecentWorkoutItem title="Leg Day" date="Last week" duration="65 min" intensity="Insane" />
                </View>

                <View style={styles.sectionWrapper}>
                  <Text style={styles.profileSectionTitle}>Achievements</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
                    <BadgeItem icon={<Trophy color={NEON_GREEN} size={20}/>} title="Early Bird" />
                    <BadgeItem icon={<Target color={NEON_GREEN} size={20}/>} title="Goal Getter" />
                    <BadgeItem icon={<Award color={NEON_GREEN} size={20}/>} title="Iron Man" />
                    <BadgeItem icon={<TrendingUp color={NEON_GREEN} size={20}/>} title="Progression" />
                  </ScrollView>
                </View>

              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// COMPONENTE HELPER
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

function ProfileStatItem({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function RecentWorkoutItem({ title, date, duration, intensity }) {
  return (
    <View style={styles.recentItem}>
      <View style={styles.recentLeft}>
        <View style={styles.recentIconBox}><TrendingUp color={NEON_GREEN} size={18}/></View>
        <View>
          <Text style={styles.recentTitle}>{title}</Text>
          <Text style={styles.recentSub}>{date} • {duration}</Text>
        </View>
      </View>
      <View style={[styles.intensityTag, {borderColor: intensity === 'Hard' || intensity === 'Insane' ? '#ff4444' : NEON_GREEN}]}>
        <Text style={styles.intensityText}>{intensity}</Text>
      </View>
    </View>
  );
}

function BadgeItem({ icon, title }) {
  return (
    <View style={styles.badgeContainer}>
      <View style={styles.badgeCircle}>{icon}</View>
      <Text style={styles.badgeTitle}>{title}</Text>
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
  dateText: { color: '#666', marginTop: 15, fontSize: 14 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  
  progressContainer: { alignItems: 'center', marginVertical: 40, justifyContent: 'center' },
  ringWrapper: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
  absoluteIcon: { position: 'absolute' },
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

  // STILURI NOI PENTRU AVATAR DIN SHOP
  avatarBase: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', overflow: 'hidden' },
  avatarCrown: { position: 'absolute', top: -12 },
  avatarFlameBack: { position: 'absolute', opacity: 0.3, zIndex: -1 },
  avatarGlitchOverlay: { position: 'absolute', opacity: 0.5, marginLeft: 4 },

  // PROFILE STYLES
  profileContainer: { flex: 1, backgroundColor: '#000' },
  profileHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },
  editBtn: { backgroundColor: NEON_GREEN, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mainInfoSection: { alignItems: 'center', marginTop: 10, marginBottom: 30 },
  bigAvatarContainer: { position: 'relative' },
  levelBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: NEON_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  levelText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  userNameBig: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginTop: 15 },
  userBio: { color: '#666', fontSize: 14, fontStyle: 'italic', marginTop: 5 },

  streakCard: { marginHorizontal: 20, marginBottom: 25, borderRadius: 25, overflow: 'hidden', backgroundColor: '#121212', borderWidth: 1, borderColor: 'rgba(30, 215, 96, 0.3)' },
  streakGradient: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  streakIconContainer: { marginRight: 20, shadowColor: NEON_GREEN, shadowRadius: 15, shadowOpacity: 0.6 },
  streakValue: { color: '#FFF', fontSize: 26, fontWeight: 'bold' },
  streakLabel: { color: NEON_GREEN, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  streakChartPlaceholder: { marginLeft: 'auto' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 30 },
  statBox: { backgroundColor: '#121212', width: '30%', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  statBoxValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statBoxLabel: { color: '#666', fontSize: 11, marginTop: 4 },

  sectionWrapper: { paddingHorizontal: 20, marginBottom: 30 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  profileSectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  seeMore: { color: NEON_GREEN, fontSize: 13, fontWeight: 'bold' },

  recentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121212', padding: 15, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#1A1A1A' },
  recentLeft: { flexDirection: 'row', alignItems: 'center' },
  recentIconBox: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 10, borderRadius: 12, marginRight: 15 },
  recentTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  recentSub: { color: '#666', fontSize: 12, marginTop: 2 },
  intensityTag: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  intensityText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  badgeScroll: { flexDirection: 'row', marginTop: 10 },
  badgeContainer: { alignItems: 'center', marginRight: 20 },
  badgeCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 8 },
  badgeTitle: { color: '#666', fontSize: 11, fontWeight: '600' }
});