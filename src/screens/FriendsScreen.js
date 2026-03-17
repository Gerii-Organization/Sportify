import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, 
  TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { 
  Users, Trophy, UserPlus, Search, X, Check, Flame, User, Clock, Plus, Bell, MessageSquare, Hash
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
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const navigation = useNavigation();

  // Liste de date
  const [activeChats, setActiveChats] = useState([]);
  const [inactiveChats, setInactiveChats] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  // Stări pentru Modale
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [startChatModalVisible, setStartChatModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  // Formulare
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    
    await fetchFriendsAndChats(user.id);
    await fetchGroups();
    
    setLoading(false);
  };

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    setGroups(data || []);
  };

 const fetchFriendsAndChats = async (userId) => {
    // 1. Aducem prieteniile
    const { data: fData, error } = await supabase.from('friendships')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error || !fData) return;

    const acceptedIds = [];
    const pendingIn = [];
    const pendingOutIds = [];
    const fMap = {}; 

    fData.forEach(f => {
      const otherId = f.user_id === userId ? f.friend_id : f.user_id;
      fMap[otherId] = f.id;
      if (f.status === 'accepted') acceptedIds.push(otherId);
      else if (f.status === 'pending') {
        if (f.friend_id === userId) pendingIn.push(otherId);
        else pendingOutIds.push(otherId);
      }
    });

    if (acceptedIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('*').in('id', acceptedIds);
      
      // 🔴 NOU: Aducem mesajele ordonate pentru a afla ULTIMUL mesaj
      const { data: mData } = await supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const lastMessagesMap = {};
      if (mData) {
        mData.forEach(m => {
          const partnerId = m.sender_id === userId ? m.receiver_id : m.sender_id;
          if (!lastMessagesMap[partnerId]) lastMessagesMap[partnerId] = m;
        });
      }

      const allFriends = pData || [];
      
      // Separăm și sortăm chaturile active după data ultimului mesaj
      const active = allFriends
        .filter(f => lastMessagesMap[f.id])
        .map(f => ({ ...f, lastMessage: lastMessagesMap[f.id] }))
        .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
        
      const inactive = allFriends.filter(f => !lastMessagesMap[f.id]);

      setActiveChats(active);
      setInactiveChats(inactive);
    } else {
      setActiveChats([]);
      setInactiveChats([]);
    }

    if (pendingIn.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('*').in('id', pendingIn);
      setReceivedRequests((pData || []).map(p => ({ ...p, friendship_id: fMap[p.id] })));
    } else setReceivedRequests([]);

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
    const { error } = await supabase.from('friendships').insert([{ user_id: myId, friend_id: targetId, status: 'pending' }]);
    if (error) Alert.alert("Eroare", "Există deja o cerere sau sunteți deja prieteni!");
    else {
      Alert.alert("Succes", "Cererea de prietenie a fost trimisă!");
      setSearchModalVisible(false); setSearchQuery(''); setSearchResults([]);
      fetchData(); 
    }
  };

  const acceptRequest = async (friendshipId) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    fetchData(); 
  };

  const removeRequest = async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    fetchData(); 
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return Alert.alert("Eroare", "Introdu un nume pentru grup.");
    if (selectedFriends.length === 0) return Alert.alert("Eroare", "Selectează cel puțin un prieten.");

    setLoading(true);
    try {
      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert([{ name: groupName.trim(), created_by: myId }])
        .select().single();
      if (groupErr) throw groupErr;

      const membersToInsert = [
        { group_id: newGroup.id, user_id: myId },
        ...selectedFriends.map(fId => ({ group_id: newGroup.id, user_id: fId }))
      ];
      const { error: membersErr } = await supabase.from('group_members').insert(membersToInsert);
      if (membersErr) throw membersErr;

      Alert.alert("Succes", "Grupul a fost creat!");
      setCreateGroupModalVisible(false); setGroupName(''); setSelectedFriends([]);
      fetchData();
    } catch (e) { Alert.alert("Eroare la creare", e.message); } 
    finally { setLoading(false); }
  };

  const toggleFriendSelection = (id) => {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]);
  };

  const renderMiniAvatar = (profile) => {
    const xp = profile?.xp || 0;
    const level = Math.floor(xp / 100) + 1;
    const theme = AVATAR_THEMES[profile?.equipped_avatar] || AVATAR_THEMES['a1'];
    
    let strokeColor = theme.color;
    let borderWidth = 1;

    if (level >= 40) { strokeColor = '#FF00FF'; borderWidth = 3; }
    else if (level >= 30) { strokeColor = '#00FFFF'; borderWidth = 2; }
    else if (level >= 20) { strokeColor = '#FFD700'; borderWidth = 2; }
    else if (level >= 10) { strokeColor = '#C0C0C0'; borderWidth = 2; }

    return (
      <View style={[styles.avatarBase, { borderColor: strokeColor, borderWidth }]}>
        <User size={20} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
      </View>
    );
  };

  const renderChatUserItem = (item) => {
    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.userCard}
        onPress={() => navigation.navigate('ChatScreen', { friendId: item.id, friendName: item.first_name })}
        activeOpacity={0.7}
      >
        {renderMiniAvatar(item)}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name}</Text>
          <Text style={styles.userTitle} numberOfLines={1}>
            {item.lastMessage?.is_deleted ? '🚫 Mesaj șters' : 
             (item.lastMessage?.sender_id === myId ? 'Tu: ' : '') + item.lastMessage?.content}
          </Text>
        </View>
        <MessageSquare color="#666" size={20} />
      </TouchableOpacity>
    );
  };

  const renderGroupItem = (item) => {
    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.userCard}
        onPress={() => Alert.alert('În curând!', 'Chat-ul de grup va fi implementat la pasul următor.')}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarBase, { borderColor: NEON_GREEN, borderWidth: 1 }]}>
          <Hash color={NEON_GREEN} size={20} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userTitle}>Grup</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequestItem = (item, type) => {
    return (
      <View key={item.id} style={styles.userCard}>
        {renderMiniAvatar(item)}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name}</Text>
          <Text style={styles.userTitle}>Lvl {Math.floor((item.xp || 0) / 100) + 1}</Text>
        </View>
        
        {type === 'received' ? (
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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#05180B']} style={styles.gradientBg}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.headerIconBtn, { marginRight: 10 }]}
              onPress={() => setRequestsModalVisible(true)}
            >
              <Bell color="#FFF" size={20} />
              {receivedRequests.length > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.leaderboardBtn}
              onPress={() => navigation.navigate('LeaderboardScreen')}
            >
              <Trophy color="#000" size={16} fill="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator size="large" color={NEON_GREEN} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* GRUPURI */}
            {groups.length > 0 && (
              <View style={{ marginBottom: 25 }}>
                <Text style={styles.sectionTitle}>My Groups</Text>
                {groups.map(g => renderGroupItem(g))}
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Chats</Text>
            </View>

            {/* CHATURI ACTIVE SAU START A CHAT */}
            {activeChats.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MessageSquare color="#333" size={60} style={{ marginBottom: 15 }} />
                <Text style={styles.emptyTitle}>Niciun chat activ</Text>
                <Text style={styles.emptySub}>Nu ai discutat cu nimeni încă. Sparge gheața!</Text>
                <TouchableOpacity style={styles.bigAddBtn} onPress={() => setStartChatModalVisible(true)}>
                  <Text style={styles.bigAddBtnText}>Start a chat</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeChats.map(friend => renderChatUserItem(friend))
            )}

          </ScrollView>
        )}
      </LinearGradient>

      {/* FAB OVERLAY & MENIU */}
      {isFabMenuOpen && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setIsFabMenuOpen(false)} />
      )}
      <View style={styles.fabContainer}>
        {isFabMenuOpen && (
          <View style={styles.fabMenu}>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setIsFabMenuOpen(false); setSearchModalVisible(true); }}>
              <Text style={styles.fabMenuItemText}>Add Friend</Text>
              <View style={styles.fabMenuIcon}><UserPlus color="#000" size={20} /></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setIsFabMenuOpen(false); setCreateGroupModalVisible(true); }}>
              <Text style={styles.fabMenuItemText}>Create Group</Text>
              <View style={styles.fabMenuIcon}><Users color="#000" size={20} /></View>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity 
          style={[styles.fabMain, isFabMenuOpen && styles.fabMainOpen]} 
          onPress={() => setIsFabMenuOpen(!isFabMenuOpen)}
          activeOpacity={0.8}
        >
          <Plus color="#000" size={32} style={{ transform: [{ rotate: isFabMenuOpen ? '45deg' : '0deg' }] }} />
        </TouchableOpacity>
      </View>

      {/* MODAL: START A CHAT (Lista cu prieteni cu care n-ai vorbit) */}
      <Modal visible={startChatModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start a Chat</Text>
              <TouchableOpacity onPress={() => setStartChatModalVisible(false)}><X color="#666" size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {inactiveChats.length === 0 ? (
                <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>Ai deschis deja un chat cu toți prietenii tăi!</Text>
              ) : (
                inactiveChats.map(friend => (
                  <TouchableOpacity 
                    key={friend.id} 
                    style={styles.searchResultItem}
                    onPress={() => {
                      setStartChatModalVisible(false);
                      navigation.navigate('ChatScreen', { friendId: friend.id, friendName: friend.first_name });
                    }}
                  >
                    {renderMiniAvatar(friend)}
                    <View style={{ marginLeft: 15, flex: 1 }}>
                      <Text style={styles.userName}>{friend.first_name}</Text>
                      <Text style={styles.userTitle}>Atinge pentru a trimite un mesaj</Text>
                    </View>
                    <MessageSquare color={NEON_GREEN} size={20} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: FRIEND REQUESTS */}
      <Modal visible={requestsModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friend Requests</Text>
              <TouchableOpacity onPress={() => setRequestsModalVisible(false)}><X color="#666" size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {receivedRequests.length === 0 && sentRequests.length === 0 ? (
                <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>Nu ai nicio cerere în așteptare.</Text>
              ) : (
                <>
                  {receivedRequests.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={styles.sectionTitle}>Primite</Text>
                      {receivedRequests.map(req => renderRequestItem(req, 'received'))}
                    </View>
                  )}
                  {sentRequests.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>Trimise</Text>
                      {sentRequests.map(req => renderRequestItem(req, 'sent'))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: ADD FRIEND (Search) */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Caută Sportivi</Text>
              <TouchableOpacity onPress={() => { setSearchModalVisible(false); setSearchResults([]); }}><X color="#666" size={24} /></TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Search color="#888" size={20} />
              <TextInput 
                style={styles.searchInput} placeholder="Caută după prenume..." placeholderTextColor="#666"
                value={searchQuery} onChangeText={setSearchQuery} autoFocus onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}><Text style={{color: '#000', fontWeight: 'bold'}}>Caută</Text></TouchableOpacity>
            </View>
            {isSearching ? <ActivityIndicator color={NEON_GREEN} style={{ marginTop: 20 }} /> : (
              <ScrollView style={{ marginTop: 15, maxHeight: 300 }}>
                {searchResults.map(res => (
                  <TouchableOpacity key={res.id} style={styles.searchResultItem} onPress={() => navigation.navigate('PublicProfileScreen', { userId: res.id })}>
                    <View style={[styles.avatarBase, { width: 40, height: 40, borderRadius: 20 }]}><User color="#888" size={20} /></View>
                    <View style={{ marginLeft: 15, flex: 1 }}>
                      <Text style={styles.userName}>{res.first_name}</Text>
                      <Text style={styles.userTitle}>Lvl {Math.floor((res.xp || 0) / 100) + 1}</Text>
                    </View>
                    <TouchableOpacity style={styles.sendReqBtn} onPress={() => sendFriendRequest(res.id)}>
                      <UserPlus color={NEON_GREEN} size={18} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: CREATE GROUP */}
      <Modal visible={createGroupModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Creează un Grup Nou</Text>
              <TouchableOpacity onPress={() => { setCreateGroupModalVisible(false); setGroupName(''); setSelectedFriends([]); }}><X color="#666" size={24} /></TouchableOpacity>
            </View>
            <TextInput 
              style={[styles.searchInput, { backgroundColor: '#222', borderRadius: 15, paddingHorizontal: 15, marginBottom: 20, width: '100%' }]}
              placeholder="Numele Grupului (ex: Gym Bros)" placeholderTextColor="#666" value={groupName} onChangeText={setGroupName}
            />
            <Text style={styles.sectionTitle}>Selectează Membrii</Text>
            <ScrollView style={{ maxHeight: 250, marginTop: 10 }}>
              {activeChats.concat(inactiveChats).map(f => (
                <TouchableOpacity key={f.id} style={styles.searchResultItem} onPress={() => toggleFriendSelection(f.id)} activeOpacity={0.8}>
                  {renderMiniAvatar(f)}
                  <Text style={[styles.userName, { flex: 1, marginLeft: 15 }]}>{f.first_name}</Text>
                  <View style={[styles.checkbox, selectedFriends.includes(f.id) && styles.checkboxSelected]}>
                    {selectedFriends.includes(f.id) && <Check color="#000" size={14} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.bigAddBtn, { marginTop: 20 }]} onPress={handleCreateGroup}>
              <Text style={styles.bigAddBtnText}>Confirmă & Creează</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerTitle: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  headerIconBtn: { backgroundColor: '#1A1A1A', padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#333', position: 'relative' },
  notificationDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4444', borderWidth: 1, borderColor: '#000' },
  leaderboardBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: NEON_GREEN, padding: 10, borderRadius: 15 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 130 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  avatarBase: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1, marginLeft: 15 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  userTitle: { color: '#888', fontSize: 12, marginTop: 2 },
  
  requestActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtnReject: { backgroundColor: '#222', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#333' },
  actionBtnAccept: { backgroundColor: NEON_GREEN, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 10 },
  pendingText: { color: '#888', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptySub: { color: '#666', textAlign: 'center', marginBottom: 25 },
  bigAddBtn: { backgroundColor: NEON_GREEN, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, alignItems: 'center' },
  bigAddBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161616', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 15, paddingHorizontal: 15 },
  searchInput: { flex: 1, color: '#FFF', paddingVertical: 15, marginLeft: 10 },
  searchBtn: { backgroundColor: NEON_GREEN, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 15, borderRadius: 15, marginBottom: 10 },
  sendReqBtn: { backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: NEON_GREEN + '55' },

  fabOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99 },
  fabContainer: { position: 'absolute', bottom: 90, right: 20, alignItems: 'flex-end', zIndex: 100 },
  fabMenu: { marginBottom: 15, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fabMenuItemText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden', marginRight: 10 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: NEON_GREEN, justifyContent: 'center', alignItems: 'center' },
  fabMain: { width: 60, height: 60, borderRadius: 30, backgroundColor: NEON_GREEN, justifyContent: 'center', alignItems: 'center', shadowColor: NEON_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  fabMainOpen: { backgroundColor: '#FFF' },

  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: NEON_GREEN, borderColor: NEON_GREEN }
});