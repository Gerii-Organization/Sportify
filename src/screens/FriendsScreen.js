import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, 
  TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation,useFocusEffect } from '@react-navigation/native';
import { 
  Users, Trophy, UserPlus, Search, X, Check, Flame, Crown, User, Clock 
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

const AVATAR_THEMES = {
  'a1': { color: '#1ED760', type: 'standard' },
  'a2': { color: '#FFD700', type: 'royal' },
  'a3': { color: '#9900FF', type: 'demon' },
  'a4': { color: '#FF00FF', type: 'glitch' },
};

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState('friends'); 
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const navigation = useNavigation();

  // 🔴 Liste de date actualizate
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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
      await fetchFriendsData(user.id);
    } else {
      await fetchGlobalLeaderboard();
    }
    setLoading(false);
  };

  const fetchFriendsData = async (userId) => {
    const { data: fData, error } = await supabase.from('friendships')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error || !fData) return;

    const acceptedIds = [];
    const pendingIn = [];  // Cereri primite
    const pendingOutIds = []; // Cereri trimise
    const fMap = {}; 

    fData.forEach(f => {
      const otherId = f.user_id === userId ? f.friend_id : f.user_id;
      fMap[otherId] = f.id;
      
      if (f.status === 'accepted') acceptedIds.push(otherId);
      else if (f.status === 'pending') {
        if (f.friend_id === userId) pendingIn.push(otherId); // Eu am primit
        else pendingOutIds.push(otherId); // Eu am trimis
      }
    });

    // 1. Prieteni
    if (acceptedIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('*').in('id', acceptedIds).order('xp', { ascending: false });
      setFriends(pData || []);
    } else setFriends([]);

    // 2. 🔴 Cereri Primite (Received)
    if (pendingIn.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('*').in('id', pendingIn);
      setReceivedRequests((pData || []).map(p => ({ ...p, friendship_id: fMap[p.id] })));
    } else setReceivedRequests([]);

    // 3. 🔴 Cereri Trimise (Sent)
    if (pendingOutIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('*').in('id', pendingOutIds);
      setSentRequests((pData || []).map(p => ({ ...p, friendship_id: fMap[p.id] })));
    } else setSentRequests([]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data } = await supabase.from('profiles')
      .select('*')
      .ilike('first_name', `%${searchQuery.trim()}%`)
      .neq('id', myId)
      .limit(10);
    
    setSearchResults(data || []);
    setIsSearching(false);
  };

  const sendFriendRequest = async (targetId) => {
    const { error } = await supabase.from('friendships').insert([{
      user_id: myId,
      friend_id: targetId,
      status: 'pending'
    }]);

    if (error) Alert.alert("Eroare", "Există deja o cerere sau sunteți deja prieteni!");
    else {
      Alert.alert("Succes", "Cererea de prietenie a fost trimisă!");
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchData(); // Reîmprospătăm listele ca să apară la "Sent Requests"
    }
  };

  const acceptRequest = async (friendshipId) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    fetchData(); 
  };

  // Folosit și pentru a respinge o cerere primită, și pentru a anula una trimisă
  const removeRequest = async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    fetchData(); 
  };

  const fetchGlobalLeaderboard = async () => {
    const { data } = await supabase.from('profiles')
      .select('*')
      .order('xp', { ascending: false })
      .limit(50);
    setGlobalLeaderboard(data || []);
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
    if (activeTab === 'global' && rank === 1) crownColor = '#FFD700'; 
    if (activeTab === 'global' && rank === 2) crownColor = '#C0C0C0'; 
    if (activeTab === 'global' && rank === 3) crownColor = '#CD7F32'; 

    return (
      <View style={[styles.avatarBase, { borderColor: strokeColor, borderWidth }]}>
        <User size={20} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
        {crownColor && <Crown color={crownColor} size={20} fill={crownColor} style={styles.crownRank} />}
      </View>
    );
  };

  // 🔴 Aici controlăm ce butoane apar în funcție de tipul listei
  const renderUserItem = (item, index, listType = 'friend') => {
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
          {listType === 'friend' || listType === 'global' ? (
            <Text style={styles.rankText}>#{index + 1}</Text>
          ) : (
            <User color="#666" size={20} />
          )}
        </View>

        {renderMiniAvatar(item, index + 1)}

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name || 'Athlete'} {isMe && '(Tu)'}</Text>
          <Text style={styles.userTitle}>{item.equipped_title || 'Novice'} • Lvl {level}</Text>
        </View>

        {listType === 'friend' || listType === 'global' ? (
          <View style={styles.userStats}>
            <View style={styles.statChip}>
              <Flame color="#FF8800" size={14} fill="#FF8800" />
              <Text style={styles.statChipText}>{item.current_streak || 0}</Text>
            </View>
            <View style={styles.statChipXP}>
              <Text style={styles.statChipTextXP}>{item.xp || 0} XP</Text>
            </View>
          </View>
        ) : listType === 'received' ? (
          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
              <X color="#fff" size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnAccept} onPress={() => acceptRequest(item.friendship_id)}>
              <Check color="#000" size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.requestActions}>
            <View style={styles.pendingBadge}>
              <Clock color="#888" size={14} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
            <TouchableOpacity style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
              <X color="#ff4444" size={18} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, activeTab === 'friends' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Users color={activeTab === 'friends' ? '#000' : '#888'} size={18} />
              <Text style={[styles.toggleText, activeTab === 'friends' && styles.toggleTextActive]}>Friends</Text>
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
            
            {activeTab === 'friends' && (
              <>
                {/* 🔴 Secțiunea Cereri Primite */}
                {receivedRequests.length > 0 && (
                  <View style={{ marginBottom: 25 }}>
                    <Text style={styles.sectionTitle}>Received Requests</Text>
                    {receivedRequests.map((req, idx) => renderUserItem(req, idx, 'received'))}
                  </View>
                )}

                {/* 🔴 Secțiunea Cereri Trimise */}
                {sentRequests.length > 0 && (
                  <View style={{ marginBottom: 25 }}>
                    <Text style={styles.sectionTitle}>Sent Requests</Text>
                    {sentRequests.map((req, idx) => renderUserItem(req, idx, 'sent'))}
                  </View>
                )}

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>My Friends</Text>
                  <TouchableOpacity style={styles.addFriendBtn} onPress={() => setSearchModalVisible(true)}>
                    <UserPlus color={NEON_GREEN} size={18} />
                    <Text style={styles.addFriendText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {friends.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Users color="#333" size={60} style={{ marginBottom: 15 }} />
                    <Text style={styles.emptyTitle}>Niciun prieten încă</Text>
                    <Text style={styles.emptySub}>Caută prieteni pentru a vă întrece în XP și Streak-uri!</Text>
                    <TouchableOpacity style={styles.bigAddBtn} onPress={() => setSearchModalVisible(true)}>
                      <Text style={styles.bigAddBtnText}>Găsește Prieteni</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  friends.map((friend, index) => renderUserItem(friend, index, 'friend'))
                )}
              </>
            )}

            {activeTab === 'global' && (
              <>
                <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Top 50 Athletes</Text>
                {globalLeaderboard.map((user, index) => renderUserItem(user, index, 'global'))}
              </>
            )}

          </ScrollView>
        )}
      </LinearGradient>

      {/* MODAL CĂUTARE */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Căutare Sportivi</Text>
              <TouchableOpacity onPress={() => { setSearchModalVisible(false); setSearchResults([]); }}><X color="#666" size={24} /></TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search color="#888" size={20} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Caută după prenume..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}><Text style={{color: '#000', fontWeight: 'bold'}}>Caută</Text></TouchableOpacity>
            </View>

            {isSearching ? <ActivityIndicator color={NEON_GREEN} style={{ marginTop: 20 }} /> : (
              <ScrollView style={{ marginTop: 15, maxHeight: 300 }}>
                {searchResults.length === 0 && searchQuery !== '' ? (
                  <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>Niciun utilizator găsit.</Text>
                ) : (
                  searchResults.map(res => (
                    <TouchableOpacity 
                        key={res.id} 
                        style={styles.searchResultItem}
                        onPress={() => navigation.navigate('PublicProfileScreen', { userId: res.id })}
                        activeOpacity={0.7}>
                      <View style={[styles.avatarBase, { width: 40, height: 40, borderRadius: 20 }]}><User color="#888" size={20} /></View>
                      <View style={{ marginLeft: 15, flex: 1 }}>
                        <Text style={styles.userName}>{res.first_name}</Text>
                        <Text style={styles.userTitle}>Lvl {Math.floor((res.xp || 0) / 100) + 1}</Text>
                      </View>
                      <TouchableOpacity style={styles.sendReqBtn} onPress={() => sendFriendRequest(res.id)}>
                        <UserPlus color={NEON_GREEN} size={18} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  header: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerTitle: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 5 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  toggleBtnActive: { backgroundColor: NEON_GREEN },
  toggleText: { color: '#888', fontWeight: 'bold', marginLeft: 8 },
  toggleTextActive: { color: '#000' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 215, 96, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: NEON_GREEN + '55' },
  addFriendText: { color: NEON_GREEN, fontWeight: 'bold', marginLeft: 5, fontSize: 12 },

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

  requestActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtnReject: { backgroundColor: '#222', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#333' },
  actionBtnAccept: { backgroundColor: NEON_GREEN, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 10 },
  pendingText: { color: '#888', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptySub: { color: '#666', textAlign: 'center', marginBottom: 25 },
  bigAddBtn: { backgroundColor: NEON_GREEN, paddingHorizontal: 25, paddingVertical: 15, borderRadius: 15 },
  bigAddBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161616', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 15, paddingHorizontal: 15 },
  searchInput: { flex: 1, color: '#FFF', paddingVertical: 15, marginLeft: 10 },
  searchBtn: { backgroundColor: NEON_GREEN, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 15, borderRadius: 15, marginBottom: 10 },
  sendReqBtn: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: NEON_GREEN + '55' }
});