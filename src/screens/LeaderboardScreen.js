import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Users, Trophy, ChevronLeft, Flame } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { levelFromXp } from '../lib/level';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AmbientGlow from '../components/AmbientGlow';
import { SkeletonRows } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';


export default function LeaderboardScreen() {
  const { refreshControl } = useRefresh(() => fetchData());
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('friends');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab, user?.id])
  );

  const fetchData = async () => {
    setLoading(true);
    if (!user) {
      // The global board is public, so guests still get to see it.
      setMyId(null);
      await fetchGlobalLeaderboard();
      setLoading(false);
      return;
    }
    setMyId(user.id);

    if (activeTab === 'friends') {
      await fetchFriendsLeaderboard(user.id);
    } else {
      await fetchGlobalLeaderboard();
    }
    setLoading(false);
  };

  const fetchFriendsLeaderboard = async (userId) => {
    // Accepted friendships only.
    const { data: fData } = await supabase.from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    let ids = [userId]; // The current user ranks alongside their friends.
    if (fData) {
      fData.forEach(f => {
        ids.push(f.user_id === userId ? f.friend_id : f.user_id);
      });
    }

    // Profiles, highest XP first.
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


  const renderUserItem = (item, index) => {
    const level = levelFromXp(item.xp);
    const isMe = item.id === myId;

    return (
      <TouchableOpacity activeOpacity={0.7} 
        key={item.id || index} 
        style={[styles.userCard, isMe && styles.myUserCard]}
        onPress={() => navigation.navigate('PublicProfileScreen', { userId: item.id })}
      >
        <View style={styles.rankBox}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        <Avatar profile={item} rank={index + 1} />

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name || 'Athlete'} {isMe && '(Tu)'}</Text>
          <Text style={styles.userTitle}>{item.equipped_title || 'Novice'} • Lvl {level}</Text>
        </View>

        <View style={styles.userStats}>
          <View style={styles.statChip}>
            <Flame color={colors.streak} size={14} fill={colors.streak} />
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
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={280} intensity={0.4} />
        
        {/* HEADER DE NAVIGARE */}
        <View style={styles.navHeader}>
          <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{width: 28}} /> {/* Spacer pentru centrare */}
        </View>

        {/* TOGGLE PENTRU CLASAMENTE */}
        <View style={styles.toggleContainerWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity activeOpacity={0.7} 
              style={[styles.toggleBtn, activeTab === 'friends' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Users color={activeTab === 'friends' ? '#000' : '#888'} size={18} />
              <Text style={[styles.toggleText, activeTab === 'friends' && styles.toggleTextActive]}>Friends Top</Text>
            </TouchableOpacity>
            
            <TouchableOpacity activeOpacity={0.7} 
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
            <SkeletonRows count={7} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
            {leaderboardData.map((user, index) => renderUserItem(user, index))}
          </ScrollView>
        )}

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 16 },
  backBtn: { padding: 6 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  
  toggleContainerWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 6 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14 },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontWeight: '600', marginLeft: 10 },
  toggleTextActive: { color: colors.onAccent },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 24, marginBottom: 10 },
  myUserCard: { borderColor: colors.accent + '55', backgroundColor: 'rgba(46, 211, 198, 0.05)' },
  rankBox: { width: 30, alignItems: 'center' },
  rankText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  
  avatarBase: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  crownRank: { position: 'absolute', top: -14, left: -6, transform: [{rotate: '-15deg'}] },
  
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  userTitle: { color: colors.accent, fontSize: 13, marginTop: 2 },
  
  userStats: { alignItems: 'flex-end' },
  statChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 138, 43, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 6 },
  statChipText: { color: colors.streak, fontWeight: '600', fontSize: 13, marginLeft: 6 },
  statChipXP: { backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statChipTextXP: { color: colors.text, fontWeight: '600', fontSize: 13 },
});