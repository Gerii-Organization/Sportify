import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Users, Trophy, ChevronLeft, Flame, Crown, User } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

const AVATAR_THEMES = {
  'a1': { color: '#1ED760', type: 'standard' },
  'a2': { color: '#FFD700', type: 'royal' },
  'a3': { color: '#9900FF', type: 'demon' },
  'a4': { color: '#FF00FF', type: 'glitch' },
};

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState('friends');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab])
  );

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    if (activeTab === 'friends') {
      await fetchFriendsLeaderboard(user.id);
    } else {
      await fetchGlobalLeaderboard();
    }
    setLoading(false);
  };

  const fetchFriendsLeaderboard = async (userId) => {
    // Aducem prieteniile acceptate
    const { data: fData } = await supabase.from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    let ids = [userId]; // 🔴 Includem și user-ul curent în clasament!
    if (fData) {
      fData.forEach(f => {
        ids.push(f.user_id === userId ? f.friend_id : f.user_id);
      });
    }

    // Aducem profilele ordonate după XP
    const { data: pData } = await supabase.from('profiles')
      .select('*')
      .in('id', ids)
      .order('xp', { ascending: false });
    
    setLeaderboardData(pData || []);
  };

  const fetchGlobalLeaderboard = async () => {
    const { data } = await supabase.from('profiles')
      .select('*')
      .order('xp', { ascending: false })
      .limit(50);
    setLeaderboardData(data || []);
  };

  const renderMiniAvatar = (profile, rank) => {
    const xp = profile?.xp || 0;
    const level = Math.floor(xp / 100) + 1;
    const theme = AVATAR_THEMES[profile?.equipped_avatar] || AVATAR_THEMES['a1'];
    
    let strokeColor = theme.color;
    let borderWidth = 1;

    if (level >= 40) { strokeColor = '#FF00FF'; borderWidth = 3; }
    else if (level >= 30) { strokeColor = '#00FFFF'; borderWidth = 2; }
    else if (level >= 20) { strokeColor = '#FFD700'; borderWidth = 2; }
    else if (level >= 10) { strokeColor = '#C0C0C0'; borderWidth = 2; }
    else if (level >= 5) { strokeColor = '#CD7F32'; borderWidth = 2; }

    let crownColor = null;
    if (rank === 1) crownColor = '#FFD700'; 
    if (rank === 2) crownColor = '#C0C0C0'; 
    if (rank === 3) crownColor = '#CD7F32'; 

    return (
      <View style={[styles.avatarBase, { borderColor: strokeColor, borderWidth }]}>
        <User size={20} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
        {crownColor && <Crown color={crownColor} size={20} fill={crownColor} style={styles.crownRank} />}
      </View>
    );
  };

  const renderUserItem = (item, index) => {
    const level = Math.floor((item.xp || 0) / 100) + 1;
    const isMe = item.id === myId;

    return (
      <TouchableOpacity 
        key={item.id || index} 
        style={[styles.userCard, isMe && styles.myUserCard]}
        onPress={() => navigation.navigate('PublicProfileScreen', { userId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.rankBox}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        {renderMiniAvatar(item, index + 1)}

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name || 'Athlete'} {isMe && '(Tu)'}</Text>
          <Text style={styles.userTitle}>{item.equipped_title || 'Novice'} • Lvl {level}</Text>
        </View>

        <View style={styles.userStats}>
          <View style={styles.statChip}>
            <Flame color="#FF8800" size={14} fill="#FF8800" />
            <Text style={styles.statChipText}>{item.current_streak || 0}</Text>
          </View>
          <View style={styles.statChipXP}>
            <Text style={styles.statChipTextXP}>{item.xp || 0} XP</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        
        {/* HEADER DE NAVIGARE */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color="#FFF" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{width: 28}} /> {/* Spacer pentru centrare */}
        </View>

        {/* TOGGLE PENTRU CLASAMENTE */}
        <View style={styles.toggleContainerWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, activeTab === 'friends' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Users color={activeTab === 'friends' ? '#000' : '#888'} size={18} />
              <Text style={[styles.toggleText, activeTab === 'friends' && styles.toggleTextActive]}>Friends Top</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toggleBtn, activeTab === 'global' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('global')}
            >
              <Trophy color={activeTab === 'global' ? '#000' : '#888'} size={18} />
              <Text style={[styles.toggleText, activeTab === 'global' && styles.toggleTextActive]}>Global Top</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={NEON_GREEN} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {leaderboardData.map((user, index) => renderUserItem(user, index))}
          </ScrollView>
        )}

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  
  toggleContainerWrapper: { paddingHorizontal: 20, marginBottom: 15 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 5 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  toggleBtnActive: { backgroundColor: NEON_GREEN },
  toggleText: { color: '#888', fontWeight: 'bold', marginLeft: 8 },
  toggleTextActive: { color: '#000' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  myUserCard: { borderColor: NEON_GREEN + '55', backgroundColor: 'rgba(30, 215, 96, 0.05)' },
  rankBox: { width: 30, alignItems: 'center' },
  rankText: { color: '#666', fontWeight: 'bold', fontSize: 14 },
  
  avatarBase: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  crownRank: { position: 'absolute', top: -14, left: -6, transform: [{rotate: '-15deg'}] },
  
  userInfo: { flex: 1, marginLeft: 15 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  userTitle: { color: NEON_GREEN, fontSize: 12, marginTop: 2 },
  
  userStats: { alignItems: 'flex-end' },
  statChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 136, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 4 },
  statChipText: { color: '#FF8800', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
  statChipXP: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statChipTextXP: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
});