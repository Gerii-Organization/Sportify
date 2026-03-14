import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Flame, User, LogIn, X, Bell, ShieldCheck,
  HelpCircle, Ruler, ChevronRight, Edit3, Footprints, Droplets, Clock, Moon,
  Trophy, TrendingUp, Target, Award, Activity, Crown, Dumbbell,
  CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp, Edit2, Check, Zap
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Polygon } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { Pedometer } from 'expo-sensors';

const { width } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const WATER_BLUE = '#3b82f6';
const SLEEP_PURPLE = '#a29bfe';
const CARD_BG = '#121212';

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

export default function DashboardScreen({ navigation, route }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isWaterModalVisible, setWaterModalVisible] = useState(false);
  const [isAddTaskModalVisible, setAddTaskModalVisible] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [stepsGoal, setStepsGoal] = useState(10000);
  const [dailyStats, setDailyStats] = useState({
    steps: 0,
    calories: 0,
    activity: 0,
    sleep: 7.5,
    water: 0
  });

  const [tasks, setTasks] = useState([]);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [taskType, setTaskType] = useState('manual');
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(null);
  const [deviceSteps, setDeviceSteps] = useState(0);

  const WATER_GOAL = 3000;

  // Actualizare vizuală imediată când te întorci de la antrenament
  useEffect(() => {
    if (route.params?.newActivityMinutes) {
      setDailyStats(prev => ({ ...prev, activity: prev.activity + route.params.newActivityMinutes }));
      navigation.setParams({ newActivityMinutes: undefined });
    }
  }, [route.params?.newActivityMinutes]);

  const saveStepsToSupabase = async (steps) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = new Date().toISOString().split('T')[0];

      const { data: existing } = await supabase.from('daily_steps').select('id').eq('user_id', user.id).eq('record_date', todayStr).maybeSingle();

      if (existing) {
        await supabase.from('daily_steps').update({ step_count: steps }).eq('id', existing.id);
      } else {
        await supabase.from('daily_steps').insert([{ user_id: user.id, record_date: todayStr, step_count: steps }]);
      }
    } catch (e) { }
  };

  useEffect(() => {
    let subscription;
    const subscribePedometer = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);
        if (!available) return;

        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const result = await Pedometer.getStepCountAsync(start, end);
        const initialSteps = result?.steps || 0;
        setDeviceSteps(initialSteps);
        setDailyStats(prev => ({ ...prev, steps: initialSteps }));
        saveStepsToSupabase(initialSteps);

        subscription = Pedometer.watchStepCount(stepResult => {
          setDeviceSteps(prev => {
            const updated = Math.max(prev, stepResult.steps);
            setDailyStats(p => ({ ...p, steps: updated }));
            saveStepsToSupabase(updated);
            return updated;
          });
        });
      } catch (e) {
        setIsPedometerAvailable(false);
      }
    };
    subscribePedometer();
    return () => { if (subscription) subscription.remove(); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfileAndStats();
    }, [])
  );

  const fetchProfileAndStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setIsLoggedIn(true);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profile) {
        setUserProfile(profile);
        setStepsGoal(profile.step_goal || 10000);
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const isoMidnight = new Date(year, now.getMonth(), now.getDate()).toISOString();

      const { data: foodLogs } = await supabase.from('scanned_foods').select('calories').eq('user_id', user.id).gte('scanned_at', isoMidnight);
      const totalCalories = foodLogs ? foodLogs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0) : 0;

      // CITIM MINUTELE DIN TABELUL ZILNIC
      const { data: statLog } = await supabase.from('daily_stats').select('activity_minutes').eq('user_id', user.id).eq('date', todayStr).maybeSingle();
      const totalActivityMinutes = statLog?.activity_minutes || 0;

      setDailyStats(prev => ({ ...prev, calories: totalCalories, activity: totalActivityMinutes }));

      const { data: tasksData } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
      if (tasksData) setTasks(tasksData);
    } else {
      setIsLoggedIn(false);
      setUserProfile(null);
      setDailyStats(prev => ({ ...prev, calories: 0, activity: 0, sleep: 7.5, water: 0 }));
      setTasks([]);
    }
  };

  const addWater = (amount) => {
    setDailyStats(prev => ({ ...prev, water: prev.water + amount }));
    setWaterModalVisible(false);
  };

  const handleAddTask = async (type = taskType) => {
    let finalTitle = "";
    let finalGoal = parseFloat(newTaskGoal) || 0;

    if (type === 'manual') {
      if (!newTaskTitle.trim()) return;
      finalTitle = newTaskTitle;
    } else if (type === 'water') {
      if (!finalGoal) return;
      finalTitle = `Drink ${finalGoal}L Water`;
    } else if (type === 'gym') {
      if (!finalGoal) return;
      finalTitle = `GYM for ${finalGoal.toLocaleString()} min`;
    }

    const tempId = Date.now().toString();
    const newTask = { id: tempId, title: finalTitle, goal: finalGoal, type: type, completed: false };

    setTasks(prev => [...prev, newTask]);
    resetAndCloseModal();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const { data } = await supabase.from('tasks').insert([{
          user_id: user.id, title: newTask.title, goal: newTask.goal, type: newTask.type, completed: false
        }]).select();
        if (data && data.length > 0) {
          setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
        }
      } catch (err) {}
    }
  };

  const resetAndCloseModal = () => {
    setAddTaskModalVisible(false);
    setIsCustomExpanded(false);
    setNewTaskTitle('');
    setNewTaskGoal('');
    setTaskType('manual');
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('tasks').delete().eq('id', id);
  };

  const toggleTask = async (id, currentStatus) => {
    if (isEditMode) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('tasks').update({ completed: !currentStatus }).eq('id', id);
  };

  const isTaskAutoCompleted = (task) => {
    if (task.type === 'water') return (dailyStats.water / 1000) >= task.goal;
    if (task.type === 'steps') return dailyStats.steps >= task.goal;
    if (task.type === 'gym') return dailyStats.activity >= task.goal;
    return task.completed;
  };

  const renderProgressShape = () => {
    const theme = RING_THEMES[userProfile?.equipped_ring] || RING_THEMES['r1'];
    const progress = Math.min(dailyStats.steps / stepsGoal, 1);
    const offset = theme.perimeter - (theme.perimeter * progress);

    return (
      <View style={styles.progressContainer}>
        <View style={styles.ringWrapper}>
          <Svg height={220} width={220} viewBox="0 0 100 100">
            {theme.type === 'toxic' ? (
              <G>
                <Polygon points="50,5 95,85 5,85" stroke="#1A1A1A" strokeWidth="4" fill="transparent" />
                <Polygon points="50,5 95,85 5,85" stroke={theme.color} strokeWidth="4" fill="transparent" strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round" />
              </G>
            ) : theme.type === 'cyber' ? (
              <G>
                <Polygon points="50,5 90,25 90,75 50,95 10,75 10,25" stroke="#1A1A1A" strokeWidth="4" fill="transparent" />
                <Polygon points="50,5 90,25 90,75 50,95 10,75 10,25" stroke={theme.color} strokeWidth="4" fill="transparent" strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round" />
              </G>
            ) : (
              <G transform="rotate(-90 50 50)">
                <Circle cx="50" cy="50" r="45" stroke="#1A1A1A" strokeWidth="6" fill="transparent" />
                <Circle cx="50" cy="50" r="45" stroke={theme.color} strokeWidth="6" fill="transparent" strokeDasharray={theme.perimeter} strokeDashoffset={offset} strokeLinecap="round" />
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
          <Text style={styles.stepGoal}>of {stepsGoal} steps</Text>
        </View>
      </View>
    );
  };

  const renderAvatar = (size, iconSize) => {
    const theme = AVATAR_THEMES[userProfile?.equipped_avatar] || AVATAR_THEMES['a1'];
    const strokeColor = isLoggedIn ? theme.color : '#444';

    return (
      <View style={[
        styles.avatarBase,
        { width: size, height: size, borderRadius: size / 2, borderColor: strokeColor },
        isLoggedIn && theme.type === 'royal' && { borderWidth: 3 },
        isLoggedIn && theme.type === 'demon' && { borderWidth: 2, borderStyle: 'dashed' },
        isLoggedIn && theme.type === 'glitch' && { borderWidth: 2, borderRadius: size / 4 },
        isLoggedIn && theme.type === 'standard' && { borderWidth: 1 }
      ]}>
        <User size={iconSize} color={isLoggedIn ? (theme.type === 'glitch' ? '#00EAFF' : theme.color) : '#888'} />
        {isLoggedIn && theme.type === 'royal' && <Crown color={theme.color} size={iconSize * 0.8} style={styles.avatarCrown} fill="rgba(255, 215, 0, 0.3)" />}
        {isLoggedIn && theme.type === 'demon' && <Flame color={theme.color} size={size * 0.8} style={styles.avatarFlameBack} />}
        {isLoggedIn && theme.type === 'glitch' && <User size={iconSize} color="#FF00FF" style={styles.avatarGlitchOverlay} />}
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
            <Text style={styles.welcomeText}>Hello, {isLoggedIn ? (userProfile?.first_name || 'User') : 'Guest'}</Text>
          </View>

          {renderProgressShape()}

          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Today's Focus</Text>
              {tasks.length > 2 && (
                <TouchableOpacity onPress={() => setIsTasksCollapsed(!isTasksCollapsed)} style={{ marginLeft: 12 }}>
                  {isTasksCollapsed ? <ChevronDown color={NEON_GREEN} size={22} /> : <ChevronUp color={NEON_GREEN} size={22} />}
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isEditMode && (
                <TouchableOpacity onPress={() => setAddTaskModalVisible(true)} style={[styles.editButtonBorder, { marginRight: 12 }]}>
                  <Plus color={NEON_GREEN} size={24} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)} style={styles.editButtonBorder}>
                {isEditMode ? <Check color={NEON_GREEN} size={24} /> : <Edit2 color={NEON_GREEN} size={22} />}
              </TouchableOpacity>
            </View>
          </View>

          <View>
            {tasks.length === 0 ? (
              <TouchableOpacity style={styles.emptyTaskPlaceholder} onPress={() => setAddTaskModalVisible(true)}>
                <Plus color="#333" size={40} />
                <Text style={styles.emptyTaskText}>Add your first task</Text>
              </TouchableOpacity>
            ) : (
              (isTasksCollapsed ? tasks.slice(0, 2) : tasks).map(item => {
                const completed = isTaskAutoCompleted(item);
                return (
                  <View key={item.id} style={[styles.taskCard, completed && styles.neonBorder]}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => toggleTask(item.id, item.completed)}>
                      {completed ? <CheckCircle2 size={24} color={NEON_GREEN} /> : <View style={styles.circleOutline} />}
                      <View style={{ marginLeft: 15 }}>
                        <Text style={styles.taskTitleText}>{item.title}</Text>
                        {item.type === 'water' && <Text style={styles.taskSub}>{(dailyStats.water / 1000).toFixed(2)}L / {item.goal}L</Text>}
                        {item.type === 'gym' && <Text style={styles.taskSub}>{dailyStats.activity} min / {item.goal} min</Text>}
                      </View>
                    </TouchableOpacity>
                    {isEditMode && <TouchableOpacity onPress={() => deleteTask(item.id)}><Trash2 color="#FF4444" size={20} /></TouchableOpacity>}
                  </View>
                );
              })
            )}
          </View>

          <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 25, marginBottom: 15 }]}>Daily Summary</Text>
          <View style={styles.statsGrid}>
            <StatCardWrapper icon={<Flame size={16} color={NEON_GREEN}/>} label="CALORIES" value={dailyStats.calories} unit="kcal" color={NEON_GREEN} />
            <StatCardWrapper icon={<Clock size={16} color="#4D79FF"/>} label="ACTIVITY" value={dailyStats.activity} unit="mins" color="#4D79FF" />
            <StatCardWrapper icon={<Moon size={16} color={SLEEP_PURPLE}/>} label="SLEEP" value={dailyStats.sleep} unit="hrs" color={SLEEP_PURPLE} />
            <StatCardWrapper icon={<Droplets size={16} color={WATER_BLUE}/>} label="WATER" value={(dailyStats.water / 1000).toFixed(2)} unit="L" color={WATER_BLUE} onPress={() => setWaterModalVisible(true)} />
          </View>

        </ScrollView>
      </LinearGradient>

      <Modal visible={isAddTaskModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={resetAndCloseModal}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContentTasks}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Task</Text>
                <TouchableOpacity onPress={resetAndCloseModal} style={styles.closeBtnContainer}>
                  <X color="#666" size={24} />
                </TouchableOpacity>
              </View>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <View style={styles.expandableSection}>
                  <TouchableOpacity style={styles.sectionMainRow} onPress={() => { setIsCustomExpanded(!isCustomExpanded); setTaskType('manual'); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Zap size={20} color={NEON_GREEN} style={{ marginRight: 15 }} /><Text style={styles.sectionLabelMain}>Custom Task</Text></View>
                    {isCustomExpanded ? <ChevronDown color={NEON_GREEN} size={20} /> : <ChevronRight color="#666" size={20} />}
                  </TouchableOpacity>
                  {isCustomExpanded && (
                    <View style={styles.expandedContent}>
                      <TextInput style={styles.modalInput} placeholder="E.g. Morning Yoga" placeholderTextColor="#444" value={newTaskTitle} onChangeText={setNewTaskTitle} />
                      <TouchableOpacity style={styles.saveBtn} onPress={() => handleAddTask('manual')}><Text style={styles.saveBtnText}>Add Task</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.divider} />
                <View style={styles.suggestedGridTasks}>
                  <TouchableOpacity style={[styles.suggestedItem, taskType === 'gym' && styles.selectedItem]} onPress={() => setTaskType('gym')}><Dumbbell color={taskType === 'gym' ? NEON_GREEN : "#666"} size={32} /><Text style={[styles.suggestedText, taskType === 'gym' && { color: NEON_GREEN }]}>GYM</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.suggestedItem, taskType === 'water' && styles.selectedItem]} onPress={() => setTaskType('water')}><Droplets color={taskType === 'water' ? WATER_BLUE : "#666"} size={32} /><Text style={[styles.suggestedText, taskType === 'water' && {color: WATER_BLUE}]}>Water</Text></TouchableOpacity>
                </View>
                {(taskType === 'gym' || taskType === 'water') && (
                  <View style={{ width: '100%', marginTop: 20 }}>
                    <TextInput style={styles.modalInput} placeholder={taskType === 'gym' ? "Goal: 45 min" : "Goal: 2.5 liters"} placeholderTextColor="#444" keyboardType="numeric" value={newTaskGoal} onChangeText={(t) => setNewTaskGoal(t.replace(/[^0-9.]/g, ''))} />
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: NEON_GREEN }]} onPress={() => handleAddTask(taskType)}><Text style={styles.saveBtnText}>Set Goal</Text></TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={styles.menuOverlaySide}>
          <TouchableOpacity style={styles.menuCloseArea} onPress={() => setMenuVisible(false)} />
          <View style={styles.sideMenuContent}>
            <View style={styles.sidebarProfileSection}>
              {renderAvatar(56, 30)}
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.sidebarName}>{isLoggedIn ? (userProfile?.first_name || 'User') : 'Guest'}</Text>
                {isLoggedIn ? (
                  <TouchableOpacity onPress={() => { setMenuVisible(false); setProfileModalVisible(true); }}>
                    <Text style={styles.viewProfileSidebar}>View Profile</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.viewProfileSidebar, { color: '#888' }]}>Neautentificat</Text>
                )}
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
              {isLoggedIn ? (
                <TouchableOpacity style={styles.logoutButton} onPress={async () => { await supabase.auth.signOut(); setMenuVisible(false); fetchProfileAndStats(); }}>
                  <LogIn color="#FF4444" size={20} /><Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.loginButtonWrapper} onPress={() => { setMenuVisible(false); navigation.navigate('AuthScreen'); }}>
                  <Text style={styles.loginButtonText}>Log In / Create Account</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isWaterModalVisible} animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContentWater}>
            <Droplets size={48} color={WATER_BLUE} style={{ marginBottom: 25 }} />
            <Text style={styles.modalTitle}>Add Water</Text>
            <View style={styles.selectionGrid}>
              {[250, 500, 750, 1000].map((amount) => (
                <TouchableOpacity key={amount} style={styles.amountButton} onPress={() => addWater(amount)}><Text style={styles.amountButtonText}>+{amount}ml</Text></TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setWaterModalVisible(false)}><Text style={styles.closeBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                      <Text style={styles.streakValue}>{userProfile?.current_streak || 0} Zile</Text>
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

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15, alignItems: 'center' },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  editButtonBorder: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#333', borderRadius: 12, backgroundColor: '#121212' },
  emptyTaskPlaceholder: { height: 120, marginHorizontal: 20, borderRadius: 25, borderStyle: 'dashed', borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center' },
  emptyTaskText: { color: '#333', marginTop: 10, fontWeight: '600' },
  taskCard: { backgroundColor: CARD_BG, marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  neonBorder: { borderColor: NEON_GREEN + 'AA' },
  circleOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#333' },
  taskTitleText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taskSub: { color: '#666', fontSize: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  statCardWrapper: { width: '48%', marginBottom: 12 },
  statCardInner: { backgroundColor: CARD_BG, borderRadius: 22, padding: 16, height: 110, justifyContent: 'space-between', borderWidth: 1, borderColor: '#222' },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginLeft: 8 },
  statValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  statUnit: { color: '#666', fontSize: 11, marginLeft: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContentTasks: { backgroundColor: '#161616', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, width: '100%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  closeBtnContainer: { padding: 6, backgroundColor: '#222', borderRadius: 12 },
  expandableSection: { width: '100%', paddingVertical: 10 },
  sectionMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabelMain: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  expandedContent: { marginTop: 20 },
  modalInput: { backgroundColor: '#222', borderRadius: 15, padding: 18, color: '#FFF', fontSize: 16, marginBottom: 15 },
  saveBtn: { backgroundColor: NEON_GREEN, padding: 18, borderRadius: 15, alignItems: 'center' },
  saveBtnText: { color: '#000', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 15 },
  suggestedGridTasks: { flexDirection: 'row', justifyContent: 'space-between' },
  suggestedItem: { alignItems: 'center', paddingVertical: 25, borderRadius: 25, backgroundColor: '#1c1c1c', width: '48%', borderWidth: 1, borderColor: 'transparent' },
  selectedItem: { backgroundColor: '#252525', borderColor: '#333' },
  suggestedText: { color: '#666', marginTop: 12, fontWeight: 'bold' },

  menuOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' },
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

  loginButtonWrapper: { backgroundColor: NEON_GREEN, paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 'auto' },
  loginButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },

  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContentWater: { backgroundColor: '#121212', borderRadius: 32, padding: 30, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountButton: { backgroundColor: '#1c2533', paddingVertical: 20, borderRadius: 16, marginBottom: 15, width: '47%', alignItems: 'center' },
  amountButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  closeBtnText: { color: '#666', fontSize: 16, marginTop: 10 },

  avatarBase: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', overflow: 'hidden' },
  avatarCrown: { position: 'absolute', top: -12 },
  avatarFlameBack: { position: 'absolute', opacity: 0.3, zIndex: -1 },
  avatarGlitchOverlay: { position: 'absolute', opacity: 0.5, marginLeft: 4 },

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