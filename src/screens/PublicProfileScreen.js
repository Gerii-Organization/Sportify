import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, UserPlus, MessageCircle, Clock, Check, Flame, Trophy, Activity, TrendingUp, UserMinus, Ban } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { levelFromXp } from '../lib/level';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';


export default function PublicProfileScreen({ route, navigation }) {
  const { user } = useAuth();
  const { userId } = route.params; 
  const [myId, setMyId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState('none'); 
  const [friendshipId, setFriendshipId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useFocusEffect(useCallback(() => { fetchData(); }, [userId, user?.id]));

  const fetchData = async () => {
    setLoading(true);
    if (!user) {
      // Guests can still read a public profile, they just get no action buttons.
      setMyId(null);
      setFriendStatus('none');
      const { data: guestProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setProfile(guestProfile);
      setLoading(false);
      return;
    }
    setMyId(user.id);
    if (user.id === userId) setFriendStatus('self');

    const { data: blockData } = await supabase.from('blocks').select('*')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`).maybeSingle();
    
    if (blockData) { setIsBlocked(true); setLoading(false); return; }

    const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(pData);
    const { data: wData } = await supabase.from('workout_completions').select('id, workout_name, completed_at, duration_minutes').eq('user_id', userId).order('completed_at', { ascending: false }).limit(5);
    setRecentWorkouts(wData || []);

    if (user.id !== userId) {
      const { data: fData } = await supabase.from('friendships').select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`).maybeSingle();
      if (fData) {
        setFriendshipId(fData.id);
        if (fData.status === 'accepted') setFriendStatus('friends');
        else if (fData.status === 'pending') {
          if (fData.user_id === user.id) setFriendStatus('pending_sent');
          else setFriendStatus('pending_received');
        }
      } else setFriendStatus('none');
    }
    setLoading(false);
  };

  const handleAction = async () => {
    if (friendStatus === 'none') {
      const { error } = await supabase.from('friendships').insert([{ user_id: myId, friend_id: userId, status: 'pending' }]);
      if (!error) { setFriendStatus('pending_sent'); Alert.alert("Sent", "Friend request sent."); }
    } else if (friendStatus === 'pending_received') {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      if (!error) setFriendStatus('friends');
    } else if (friendStatus === 'friends') {
      navigation.navigate('ChatScreen', { friendId: userId, friendName: profile.first_name });
    }
  };

  const handleUnfriend = async () => {
    Alert.alert("Remove friend", "Remove this person from your friends?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          await supabase.from('friendships').delete().eq('id', friendshipId);
          setFriendStatus('none'); setFriendshipId(null);
      }}
    ]);
  };

  const handleBlock = async () => {
    Alert.alert("Block", "Block this user? You will no longer be able to contact each other.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: async () => {
          if (friendshipId) await supabase.from('friendships').delete().eq('id', friendshipId);
          await supabase.from('blocks').insert([{ blocker_id: myId, blocked_id: userId }]);
          Alert.alert("Blocked", "This user has been blocked."); navigation.goBack();
      }}
    ]);
  };


  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (isBlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navHeader}><TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}><ChevronLeft color={colors.text} size={28} /></TouchableOpacity></View>
        <View style={styles.centerContainer}>
          <Ban color={colors.textMuted} size={60} style={{marginBottom: 20}} />
          <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>User unavailable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const level = levelFromXp(profile.xp);
  let btnText = ''; let BtnIcon = null; let btnStyle = styles.actionBtnPrimary; let textStyle = styles.actionBtnTextPrimary;
  if (friendStatus === 'none') { btnText = 'Add Friend'; BtnIcon = UserPlus; }
  else if (friendStatus === 'friends') { btnText = 'Message'; BtnIcon = MessageCircle; btnStyle = styles.actionBtnSecondary; textStyle = styles.actionBtnTextSecondary; }
  else if (friendStatus === 'pending_sent') { btnText = 'Request Sent'; BtnIcon = Clock; btnStyle = styles.actionBtnDisabled; textStyle = styles.actionBtnTextDisabled; }
  else if (friendStatus === 'pending_received') { btnText = 'Accept Request'; BtnIcon = Check; }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}><TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}><ChevronLeft color={colors.text} size={28} /></TouchableOpacity></View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <LinearGradient colors={['rgba(46, 211, 198, 0.15)', 'transparent']} style={styles.gradientHeader} />
          <View style={styles.avatarWrapper}><Avatar profile={profile} size={100} /><View style={styles.levelBadge}><Text style={styles.levelText}>LVL {level}</Text></View></View>
          <Text style={styles.userName}>{profile.first_name}</Text>
          <Text style={styles.userTitle}>{profile.equipped_title || 'Novice Athlete'}</Text>


          {friendStatus !== 'self' && (
            <View style={styles.actionButtonsRow}>
              
              <TouchableOpacity activeOpacity={0.7} style={[styles.actionBtn, btnStyle, {flex: 1}]} onPress={handleAction} disabled={friendStatus === 'pending_sent'}>
                <BtnIcon color={textStyle.color} size={20} />
                <Text style={[styles.actionBtnText, textStyle]}>{btnText}</Text>
              </TouchableOpacity>

              {friendStatus === 'friends' && (
                <TouchableOpacity activeOpacity={0.7} style={[styles.iconBtn, { backgroundColor: '#333' }]} onPress={handleUnfriend} accessibilityLabel="Remove friend">
                  <UserMinus color={colors.text} size={20} />
                </TouchableOpacity>
              )}

              <TouchableOpacity activeOpacity={0.7} style={[styles.iconBtn, { backgroundColor: colors.danger }]} onPress={handleBlock} accessibilityLabel="Block user">
                <Ban color={colors.text} size={20} />
              </TouchableOpacity>

            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}><Flame color={colors.streak} size={28} fill={colors.streak} /><Text style={styles.statValue}>{profile.current_streak || 0}</Text><Text style={styles.statLabel}>Day Streak</Text></View><View style={styles.divider} /><View style={styles.statBox}><Trophy color={colors.energy} size={28} fill="rgba(255, 215, 0, 0.2)" /><Text style={styles.statValue}>{profile.xp || 0}</Text><Text style={styles.statLabel}>Total XP</Text></View><View style={styles.divider} /><View style={styles.statBox}><Activity color={colors.water} size={28} /><Text style={styles.statValue}>{profile.workouts_per_week || 0}</Text><Text style={styles.statLabel}>Workouts/Wk</Text></View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentWorkouts.length === 0 ? <EmptyState message="No workouts in the last few sessions." /> : recentWorkouts.map((w, idx) => (
            <View key={w.id || idx} style={styles.recentItem}>
              <View style={styles.recentIconBox}><TrendingUp color={colors.accent} size={20} /></View>
              <View style={{ flex: 1 }}><Text style={styles.recentTitle}>{w.workout_name}</Text><Text style={styles.recentSub}>{new Date(w.completed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text></View>
              <View style={styles.durationTag}><Text style={styles.durationText}>{w.duration_minutes} min</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, navHeader: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 50, left: 15, zIndex: 10 }, backBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 24 }, scrollContent: { paddingBottom: 50 }, profileHeader: { alignItems: 'center', paddingTop: 80, paddingBottom: 26, position: 'relative' }, gradientHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 250 }, avatarWrapper: { position: 'relative', marginBottom: 16 }, avatarBase: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, crownRank: { position: 'absolute', top: -20 }, levelBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: '#000' }, levelText: { color: colors.onAccent, fontSize: 13, fontWeight: '900' }, userName: { color: colors.text, fontSize: 26, fontWeight: '800' }, userTitle: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 6, marginBottom: 20 },
  
  // Action button row
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26, width: '100%', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18 },
  iconBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  
  actionBtnPrimary: { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, actionBtnTextPrimary: { color: colors.onAccent }, actionBtnSecondary: { backgroundColor: colors.surface }, actionBtnTextSecondary: { color: colors.text }, actionBtnDisabled: { backgroundColor: colors.surfaceHigh }, actionBtnTextDisabled: { color: colors.textMuted }, actionBtnText: { fontSize: 15, fontWeight: '600', marginLeft: 10 }, statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: colors.card, marginHorizontal: 20, paddingVertical: 20, borderRadius: 28, marginBottom: 26 }, statBox: { alignItems: 'center', flex: 1 }, divider: { width: 1, backgroundColor: '#333', height: '80%', alignSelf: 'center' }, statValue: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 10 }, statLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 6, textTransform: 'uppercase', fontWeight: '600' }, sectionContainer: { paddingHorizontal: 20 }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 }, emptyText: { color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }, recentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 22, marginBottom: 10 }, recentIconBox: { backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 10, borderRadius: 16, marginRight: 16 }, recentTitle: { color: colors.text, fontSize: 15, fontWeight: '600' }, recentSub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 }, durationTag: { backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }, durationText: { color: colors.accent, fontWeight: '600', fontSize: 13 }
});