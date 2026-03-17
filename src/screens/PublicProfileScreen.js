import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, 
  ActivityIndicator, Dimensions, Alert ,Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { 
  ChevronLeft, UserPlus, MessageCircle, Clock, Check, 
  Flame, Trophy, Activity, Crown, User, TrendingUp, UserMinus, Ban 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

const AVATAR_THEMES = {
  'a1': { color: '#1ED760', type: 'standard' },
  'a2': { color: '#FFD700', type: 'royal' },
  'a3': { color: '#9900FF', type: 'demon' },
  'a4': { color: '#FF00FF', type: 'glitch' },
};

export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params; 
  const [myId, setMyId] = useState(null);
  
  const [profile, setProfile] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [friendStatus, setFriendStatus] = useState('none'); 
  const [friendshipId, setFriendshipId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [userId])
  );

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    if (user.id === userId) {
      setFriendStatus('self');
    }

    // 🔴 1. VERIFICĂM DACĂ EXISTĂ BLOCK
    const { data: blockData } = await supabase.from('blocks').select('*')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`)
      .maybeSingle();

    if (blockData) {
      setIsBlocked(true);
      setLoading(false);
      return; // Oprim restul fetch-urilor dacă e blocat
    }

    // 2. Aducem datele profilului
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(pData);

    const { data: wData } = await supabase.from('workout_completions')
      .select('id, workout_name, completed_at, duration_minutes')
      .eq('user_id', userId).order('completed_at', { ascending: false }).limit(5);
    setRecentWorkouts(wData || []);

    // 3. Verificăm statusul prieteniei
    if (user.id !== userId) {
      const { data: fData } = await supabase.from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (fData) {
        setFriendshipId(fData.id);
        if (fData.status === 'accepted') setFriendStatus('friends');
        else if (fData.status === 'pending') {
          if (fData.user_id === user.id) setFriendStatus('pending_sent');
          else setFriendStatus('pending_received');
        }
      } else {
        setFriendStatus('none');
      }
    }
    setLoading(false);
  };

  const handleAction = async () => {
    if (friendStatus === 'none') {
      const { error } = await supabase.from('friendships').insert([{ user_id: myId, friend_id: userId, status: 'pending' }]);
      if (!error) { setFriendStatus('pending_sent'); Alert.alert("Succes", "Cerere trimisă!"); }
    } else if (friendStatus === 'pending_received') {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      if (!error) { setFriendStatus('friends'); }
    } else if (friendStatus === 'friends') {
      navigation.navigate('ChatScreen', { friendId: userId, friendName: profile.first_name });
    }
  };

  // 🔴 LOGICĂ UNFRIEND ȘI BLOCK
  const handleUnfriend = async () => {
    Alert.alert("Unfriend", "Sigur vrei să ștergi acest utilizator din lista de prieteni?", [
      { text: "Anulează", style: "cancel" },
      { text: "Șterge Prieten", style: "destructive", onPress: async () => {
          await supabase.from('friendships').delete().eq('id', friendshipId);
          setFriendStatus('none');
          setFriendshipId(null);
      }}
    ]);
  };

  const handleBlock = async () => {
    Alert.alert("Block", "Sigur vrei să blochezi utilizatorul? Nu vă veți mai putea căuta sau contacta.", [
      { text: "Anulează", style: "cancel" },
      { text: "Blochează", style: "destructive", onPress: async () => {
          if (friendshipId) await supabase.from('friendships').delete().eq('id', friendshipId);
          await supabase.from('blocks').insert([{ blocker_id: myId, blocked_id: userId }]);
          Alert.alert("Blocat", "Utilizatorul a fost blocat cu succes.");
          navigation.goBack();
      }}
    ]);
  };

  const renderAvatar = (size) => {
    const xp = profile?.xp || 0;
    const level = Math.floor(xp / 100) + 1;
    const theme = AVATAR_THEMES[profile?.equipped_avatar] || AVATAR_THEMES['a1'];
    let strokeColor = theme.color;
    let borderWidth = 2;

    if (level >= 40) { strokeColor = '#FF00FF'; borderWidth = 4; }
    else if (level >= 30) { strokeColor = '#00FFFF'; borderWidth = 3; }
    else if (level >= 20) { strokeColor = '#FFD700'; borderWidth = 3; }
    else if (level >= 10) { strokeColor = '#C0C0C0'; borderWidth = 2; }

    return (
      <View style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2, borderColor: strokeColor, borderWidth }]}>
        <User size={size * 0.5} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
        {theme.type === 'royal' && <Crown color={theme.color} size={size * 0.4} style={styles.crownRank} fill="rgba(255, 215, 0, 0.3)" />}
      </View>
    );
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color={NEON_GREEN} /></View>;

  if (isBlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navHeader}><TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><ChevronLeft color="#FFF" size={28} /></TouchableOpacity></View>
        <View style={styles.centerContainer}>
          <Ban color="#666" size={60} style={{marginBottom: 20}} />
          <Text style={{color: '#FFF', fontSize: 20, fontWeight: 'bold'}}>Utilizator Indisponibil</Text>
          <Text style={{color: '#666', marginTop: 10, textAlign: 'center', paddingHorizontal: 40}}>Acest profil nu mai este disponibil pentru tine.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const level = Math.floor((profile.xp || 0) / 100) + 1;
  let btnText = ''; let BtnIcon = null; let btnStyle = styles.actionBtnPrimary; let textStyle = styles.actionBtnTextPrimary;

  if (friendStatus === 'none') { btnText = 'Add Friend'; BtnIcon = UserPlus; }
  else if (friendStatus === 'friends') { btnText = 'Message'; BtnIcon = MessageCircle; btnStyle = styles.actionBtnSecondary; textStyle = styles.actionBtnTextSecondary; }
  else if (friendStatus === 'pending_sent') { btnText = 'Request Sent'; BtnIcon = Clock; btnStyle = styles.actionBtnDisabled; textStyle = styles.actionBtnTextDisabled; }
  else if (friendStatus === 'pending_received') { btnText = 'Accept Request'; BtnIcon = Check; }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#FFF" size={28} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <LinearGradient colors={['rgba(30, 215, 96, 0.15)', 'transparent']} style={styles.gradientHeader} />
          <View style={styles.avatarWrapper}>
            {renderAvatar(100)}
            <View style={styles.levelBadge}><Text style={styles.levelText}>LVL {level}</Text></View>
          </View>
          <Text style={styles.userName}>{profile.first_name}</Text>
          <Text style={styles.userTitle}>{profile.equipped_title || 'Novice Athlete'}</Text>

          {friendStatus !== 'self' && (
            <TouchableOpacity style={[styles.actionBtn, btnStyle]} onPress={handleAction} disabled={friendStatus === 'pending_sent'}>
              <BtnIcon color={textStyle.color} size={20} />
              <Text style={[styles.actionBtnText, textStyle]}>{btnText}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}><Flame color="#FF8800" size={28} fill="#FF8800" /><Text style={styles.statValue}>{profile.current_streak || 0}</Text><Text style={styles.statLabel}>Day Streak</Text></View>
          <View style={styles.divider} />
          <View style={styles.statBox}><Trophy color="#FFD700" size={28} fill="rgba(255, 215, 0, 0.2)" /><Text style={styles.statValue}>{profile.xp || 0}</Text><Text style={styles.statLabel}>Total XP</Text></View>
          <View style={styles.divider} />
          <View style={styles.statBox}><Activity color="#3b82f6" size={28} /><Text style={styles.statValue}>{profile.workouts_per_week || 0}</Text><Text style={styles.statLabel}>Workouts/Wk</Text></View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentWorkouts.length === 0 ? (
            <Text style={styles.emptyText}>{profile.first_name} nu are niciun antrenament recent.</Text>
          ) : (
            recentWorkouts.map((w, idx) => (
              <View key={w.id || idx} style={styles.recentItem}>
                <View style={styles.recentIconBox}><TrendingUp color={NEON_GREEN} size={20} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle}>{w.workout_name}</Text>
                  <Text style={styles.recentSub}>{new Date(w.completed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                </View>
                <View style={styles.durationTag}><Text style={styles.durationText}>{w.duration_minutes} min</Text></View>
              </View>
            ))
          )}
        </View>

        {/* 🔴 DANGER ZONE (Unfriend & Block) */}
        {friendStatus !== 'self' && (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Zona de Siguranță</Text>
            {friendStatus === 'friends' && (
              <TouchableOpacity style={styles.dangerBtn} onPress={handleUnfriend}>
                <UserMinus color="#ff4444" size={20} />
                <Text style={styles.dangerBtnText}>Șterge din prieteni</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.dangerBtn, { marginTop: 10 }]} onPress={handleBlock}>
              <Ban color="#ff4444" size={20} />
              <Text style={styles.dangerBtnText}>Blochează Utilizatorul</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navHeader: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 50, left: 15, zIndex: 10 },
  backBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  scrollContent: { paddingBottom: 50 },
  profileHeader: { alignItems: 'center', paddingTop: 80, paddingBottom: 30, position: 'relative' },
  gradientHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 250 },
  avatarWrapper: { position: 'relative', marginBottom: 15 },
  avatarBase: { backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  crownRank: { position: 'absolute', top: -20 },
  levelBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: NEON_GREEN, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#000' },
  levelText: { color: '#000', fontSize: 12, fontWeight: '900' },
  userName: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userTitle: { color: NEON_GREEN, fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 25 },
  actionBtnPrimary: { backgroundColor: NEON_GREEN, shadowColor: NEON_GREEN, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  actionBtnTextPrimary: { color: '#000' },
  actionBtnSecondary: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  actionBtnTextSecondary: { color: '#FFF' },
  actionBtnDisabled: { backgroundColor: '#222' },
  actionBtnTextDisabled: { color: '#666' },
  actionBtnText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: CARD_BG, marginHorizontal: 20, paddingVertical: 20, borderRadius: 25, borderWidth: 1, borderColor: '#222', marginBottom: 30 },
  statBox: { alignItems: 'center', flex: 1 },
  divider: { width: 1, backgroundColor: '#333', height: '80%', alignSelf: 'center' },
  statValue: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4, textTransform: 'uppercase', fontWeight: '600' },
  sectionContainer: { paddingHorizontal: 20 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  emptyText: { color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  recentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 15, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1A1A1A' },
  recentIconBox: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 12, borderRadius: 14, marginRight: 15 },
  recentTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  recentSub: { color: '#888', fontSize: 13, marginTop: 4 },
  durationTag: { backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  durationText: { color: NEON_GREEN, fontWeight: 'bold', fontSize: 12 },

  // Stiluri noi Danger Zone
  dangerZone: { marginTop: 40, paddingHorizontal: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#222' },
  dangerTitle: { color: '#666', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a0505', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#330a0a' },
  dangerBtnText: { color: '#ff4444', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }
});