import { useState, useCallback } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, 
  TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Users, Trophy, UserPlus, Search, X, Check, Clock, Plus, Bell, MessageSquare, Hash } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { levelFromXp } from '../lib/level';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AmbientGlow from '../components/AmbientGlow';
import { SkeletonRows } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import EmptyState from '../components/EmptyState';
import { shortTime } from '../lib/date';


export default function FriendsScreen() {
  const { refreshControl } = useRefresh(() => fetchData());
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const navigation = useNavigation();

  // Chat and group lists
  const [activeChats, setActiveChats] = useState([]);
  const [inactiveChats, setInactiveChats] = useState([]);
  const [groups, setGroups] = useState([]);
  /** Sum across every conversation — drives the header badge. */
  const [totalUnread, setTotalUnread] = useState(0);
  
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  // Modal visibility
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [startChatModalVisible, setStartChatModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user?.id])
  );

  const fetchData = async () => {
    setLoading(true);
    if (!user) {
      // Signed out: clear everything and stop, rather than leaving the spinner up.
      setMyId(null);
      setActiveChats([]);
      setInactiveChats([]);
      setGroups([]);
      setReceivedRequests([]);
      setSentRequests([]);
      setLoading(false);
      return;
    }
    setMyId(user.id);

    await fetchFriendsAndChats(user.id);
    await fetchGroups(user.id);

    setLoading(false);
  };

  /**
   * Only groups this user belongs to.
   * This previously selected every row in `groups`, so each user saw every
   * group in the app. The real fix is a row-level security policy — see
   * supabase/policies.sql — but the client must not ask for them either.
   */
  const fetchGroups = async (userId) => {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      setGroups([]);
      return;
    }

    const { data } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });
    setGroups(data || []);
  };

 const fetchFriendsAndChats = async (userId) => {
    // 1. Load every friendship this user is part of.
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
      
      // Newest first, so the first row seen per partner is the latest message.
      const { data: mData } = await supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      // Messages arrive newest-first, so the first one seen for a partner is
      // the latest. The same pass counts what is still unread, which saves a
      // second round-trip per conversation.
      const lastMessagesMap = {};
      const unreadCounts = {};

      (mData || []).forEach(m => {
        const partnerId = m.sender_id === userId ? m.receiver_id : m.sender_id;
        if (!lastMessagesMap[partnerId]) lastMessagesMap[partnerId] = m;
        // Only messages sent TO you count — your own are read by definition.
        if (m.receiver_id === userId && !m.is_read && !m.is_deleted) {
          unreadCounts[partnerId] = (unreadCounts[partnerId] || 0) + 1;
        }
      });

      const allFriends = pData || [];

      // Split friends into those with a conversation and those without,
      const active = allFriends
        .filter(f => lastMessagesMap[f.id])
        .map(f => ({ ...f, lastMessage: lastMessagesMap[f.id], unread: unreadCounts[f.id] || 0 }))
        .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

      setTotalUnread(Object.values(unreadCounts).reduce((sum, n) => sum + n, 0));
        
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
    if (error) Alert.alert("Already connected", "A request already exists, or you are already friends.");
    else {
      Alert.alert("Sent", "Friend request sent.");
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
    if (!groupName.trim()) return Alert.alert("Name required", "Enter a name for the group.");
    if (selectedFriends.length === 0) return Alert.alert("Pick members", "Select at least one friend.");

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

      Alert.alert("Created", "Your group is ready.");
      setCreateGroupModalVisible(false); setGroupName(''); setSelectedFriends([]);
      fetchData();
    } catch (e) { Alert.alert("Could not create group", e.message); } 
    finally { setLoading(false); }
  };

  const toggleFriendSelection = (id) => {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]);
  };


  const renderChatUserItem = (item, index) => {
    const hasUnread = item.unread > 0;

    return (
      <FadeIn key={item.id} index={index}>
        <Press
          scale={0.985}
          style={styles.chatRow}
          onPress={() => navigation.navigate('ChatScreen', { friendId: item.id, friendName: item.first_name })}
          accessibilityLabel={`Chat with ${item.first_name}${hasUnread ? `, ${item.unread} unread` : ''}`}
        >
          <View>
            <Avatar profile={item} size={52} />
            {hasUnread && <View style={styles.presenceDot} />}
          </View>

          <View style={styles.chatText}>
            <View style={styles.chatTopLine}>
              <Text style={[styles.chatName, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
                {item.first_name}
              </Text>
              <Text style={styles.chatTime}>{shortTime(item.lastMessage?.created_at)}</Text>
            </View>

            <View style={styles.chatBottomLine}>
              <Text style={[styles.chatPreview, hasUnread && styles.chatPreviewUnread]} numberOfLines={1}>
                {item.lastMessage?.is_deleted
                  ? 'Message deleted'
                  : (item.lastMessage?.sender_id === myId ? 'You: ' : '') + (item.lastMessage?.content || 'Photo')}
              </Text>
              {hasUnread && (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                </View>
              )}
            </View>
          </View>
        </Press>
      </FadeIn>
    );
  };

  const renderGroupItem = (item, index) => (
    <FadeIn key={item.id} index={index}>
      <Press
        scale={0.96}
        style={styles.groupTile}
        onPress={() => navigation.navigate('GroupChatScreen', { groupId: item.id, groupName: item.name })}
        accessibilityLabel={`Open group ${item.name}`}
      >
        <View style={styles.groupGlyph}>
          <Hash color={colors.accent} size={20} />
        </View>
        <Text style={styles.groupName} numberOfLines={2}>{item.name}</Text>
      </Press>
    </FadeIn>
  );

  const renderRequestItem = (item, type) => {
    return (
      <View key={item.id} style={styles.userCard}>
        <Avatar profile={item} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.first_name}</Text>
          <Text style={styles.userTitle}>Lvl {levelFromXp(item.xp)}</Text>
        </View>
        
        {type === 'received' ? (
          <View style={styles.requestActions}>
            <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
              <X color={colors.text} size={18} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} accessibilityLabel="Confirm" style={styles.actionBtnAccept} onPress={() => acceptRequest(item.friendship_id)}>
              <Check color={colors.onAccent} size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.requestActions}>
            <View style={styles.pendingBadge}>
              <Clock color={colors.textSecondary} size={14} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
              <X color={colors.danger} size={18} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="accent" height={260} intensity={0.28} />
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Chats</Text>
            {totalUnread > 0 && (
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity accessibilityLabel="Friend requests" activeOpacity={0.7} 
              style={[styles.headerIconBtn, { marginRight: 10 }]}
              onPress={() => setRequestsModalVisible(true)}
            >
              <Bell color={colors.text} size={20} />
              {receivedRequests.length > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity accessibilityLabel="Leaderboard" activeOpacity={0.7} 
              style={styles.leaderboardBtn}
              onPress={() => navigation.navigate('LeaderboardScreen')}
            >
              <Trophy color={colors.onAccent} size={16} fill="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <SkeletonRows count={6} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
            
            {groups.length > 0 && (
              <View style={styles.shelfBlock}>
                <Text style={styles.eyebrow}>Groups</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shelf}
                >
                  {groups.map((g, i) => renderGroupItem(g, i))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.eyebrow}>Messages</Text>

            {activeChats.length === 0 ? (
              <EmptyState
                icon={<MessageSquare color={colors.textFaint} size={44} />}
                title="No conversations yet"
                message="Start one with a friend — training is easier when someone notices you stopped."
                actionLabel={inactiveChats.length > 0 ? 'Start a chat' : 'Find friends'}
                onAction={() =>
                  inactiveChats.length > 0 ? setStartChatModalVisible(true) : setSearchModalVisible(true)
                }
              />
            ) : (
              <View style={styles.chatList}>
                {activeChats.map((friend, i) => renderChatUserItem(friend, i))}
              </View>
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
            <TouchableOpacity activeOpacity={0.7} style={styles.fabMenuItem} onPress={() => { setIsFabMenuOpen(false); setSearchModalVisible(true); }}>
              <Text style={styles.fabMenuItemText}>Add Friend</Text>
              <View style={styles.fabMenuIcon}><UserPlus color={colors.onAccent} size={20} /></View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={styles.fabMenuItem} onPress={() => { setIsFabMenuOpen(false); setCreateGroupModalVisible(true); }}>
              <Text style={styles.fabMenuItemText}>Create Group</Text>
              <View style={styles.fabMenuIcon}><Users color={colors.onAccent} size={20} /></View>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity accessibilityLabel="Add" activeOpacity={0.7} 
          style={[styles.fabMain, isFabMenuOpen && styles.fabMainOpen]} 
          onPress={() => setIsFabMenuOpen(!isFabMenuOpen)}
        >
          <Plus color={colors.onAccent} size={32} style={{ transform: [{ rotate: isFabMenuOpen ? '45deg' : '0deg' }] }} />
        </TouchableOpacity>
      </View>

      {/* Start a chat — friends you have never messaged. */}
      <Modal visible={startChatModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start a Chat</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setStartChatModalVisible(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {inactiveChats.length === 0 ? (
                <Text style={{color: colors.textMuted, textAlign: 'center', marginTop: 20}}>You already have a chat open with every friend.</Text>
              ) : (
                inactiveChats.map(friend => (
                  <TouchableOpacity accessibilityLabel="Open chat" activeOpacity={0.7} 
                    key={friend.id} 
                    style={styles.searchResultItem}
                    onPress={() => {
                      setStartChatModalVisible(false);
                      navigation.navigate('ChatScreen', { friendId: friend.id, friendName: friend.first_name });
                    }}
                  >
                    <Avatar profile={friend} />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text style={styles.userName}>{friend.first_name}</Text>
                      <Text style={styles.userTitle}>Tap to send a message</Text>
                    </View>
                    <MessageSquare color={colors.accent} size={20} />
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
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setRequestsModalVisible(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {receivedRequests.length === 0 && sentRequests.length === 0 ? (
                <Text style={{color: colors.textMuted, textAlign: 'center', marginTop: 20}}>No pending requests.</Text>
              ) : (
                <>
                  {receivedRequests.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={styles.sectionTitle}>Received</Text>
                      {receivedRequests.map(req => renderRequestItem(req, 'received'))}
                    </View>
                  )}
                  {sentRequests.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>Sent</Text>
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
              <Text style={styles.modalTitle}>Find athletes</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => { setSearchModalVisible(false); setSearchResults([]); }}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Search color={colors.textSecondary} size={20} />
              <TextInput 
                style={styles.searchInput} placeholder="Search by first name..." placeholderTextColor={colors.textMuted}
                value={searchQuery} onChangeText={setSearchQuery} autoFocus onSubmitEditing={handleSearch}
              />
              <TouchableOpacity activeOpacity={0.7} onPress={handleSearch} style={styles.searchBtn}><Text style={{color: colors.onAccent, fontWeight: '600'}}>Search</Text></TouchableOpacity>
            </View>
            {isSearching ? <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} /> : (
              <ScrollView style={{ marginTop: 16, maxHeight: 300 }}>
                {searchResults.map(res => (
                  <TouchableOpacity activeOpacity={0.7} key={res.id} style={styles.searchResultItem} onPress={() => navigation.navigate('PublicProfileScreen', { userId: res.id })}>
                    <Avatar profile={res} size={40} />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text style={styles.userName}>{res.first_name}</Text>
                      <Text style={styles.userTitle}>Lvl {levelFromXp(res.xp)}</Text>
                    </View>
                    <TouchableOpacity accessibilityLabel="Add friend" activeOpacity={0.7} style={styles.sendReqBtn} onPress={() => sendFriendRequest(res.id)}>
                      <UserPlus color={colors.accent} size={18} />
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
              <Text style={styles.modalTitle}>New group</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => { setCreateGroupModalVisible(false); setGroupName(''); setSelectedFriends([]); }}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <TextInput 
              style={[styles.searchInput, { backgroundColor: colors.surfaceHigh, borderRadius: 18, paddingHorizontal: 16, marginBottom: 20, width: '100%' }]}
              placeholder="Group name (e.g. Gym Bros)" placeholderTextColor={colors.textMuted} value={groupName} onChangeText={setGroupName}
            />
            <Text style={styles.sectionTitle}>Select members</Text>
            <ScrollView style={{ maxHeight: 250, marginTop: 10 }}>
              {activeChats.concat(inactiveChats).map(f => (
                <TouchableOpacity activeOpacity={0.7} key={f.id} style={styles.searchResultItem} onPress={() => toggleFriendSelection(f.id)}>
                  <Avatar profile={f} />
                  <Text style={[styles.userName, { flex: 1, marginLeft: 16 }]}>{f.first_name}</Text>
                  <View style={[styles.checkbox, selectedFriends.includes(f.id) && styles.checkboxSelected]}>
                    {selectedFriends.includes(f.id) && <Check color={colors.onAccent} size={14} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity activeOpacity={0.7} style={[styles.bigAddBtn, { marginTop: 20 }]} onPress={handleCreateGroup}>
              <Text style={styles.bigAddBtnText}>Create group</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
  headerIconBtn: { backgroundColor: colors.surface, padding: 10, borderRadius: 18, position: 'relative' },
  notificationDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1, borderColor: '#000' },
  leaderboardBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, padding: 10, borderRadius: 18 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 130 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },

  // --- Section labels -----------------------------------------------------
  // Small, tracked, muted. A section label competing with the content it
  // introduces is the fastest way to make a screen look busy.
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },

  // --- Groups: a shelf, so they never compete with the message list --------
  shelfBlock: { marginBottom: 26 },
  shelf: { gap: 10, paddingRight: 20 },
  groupTile: {
    width: 108,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  groupGlyph: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  groupName: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 17 },

  // --- Message rows -------------------------------------------------------
  // No card, no border: rows sit directly on the ground with generous height.
  // Boxing every row is what made the list read as a spreadsheet.
  chatList: { gap: 2 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 14,
  },
  presenceDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 2.5, borderColor: colors.background,
  },
  chatText: { flex: 1, gap: 4 },
  chatTopLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  chatNameUnread: { fontWeight: '700' },
  chatTime: { color: colors.textFaint, fontSize: 12 },
  chatBottomLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatPreview: { color: colors.textMuted, fontSize: 14, flex: 1 },
  chatPreviewUnread: { color: colors.textSecondary, fontWeight: '600' },
  unreadPill: {
    minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 24, marginBottom: 10 },
  avatarBase: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  userNameUnread: { fontWeight: '700' },
  userTitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  // An unread preview reads brighter, so the row is scannable without relying
  // on the badge alone — colour and weight both carry the state.
  previewUnread: { color: colors.text, fontWeight: '600' },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
  
  requestActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtnReject: { backgroundColor: colors.surfaceHigh, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  actionBtnAccept: { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 10 },
  pendingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 6 },

  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySub: { color: colors.textMuted, textAlign: 'center', marginBottom: 26 },
  bigAddBtn: { backgroundColor: colors.accent, paddingVertical: 16, paddingHorizontal: 26, borderRadius: 18, alignItems: 'center' },
  bigAddBtnText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 26, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, borderRadius: 18, paddingHorizontal: 16 },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 16, marginLeft: 10 },
  searchBtn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, padding: 16, borderRadius: 18, marginBottom: 10 },
  sendReqBtn: { backgroundColor: 'rgba(46, 211, 198, 0.1)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.accent + '55' },

  fabOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99 },
  fabContainer: { position: 'absolute', bottom: 90, right: 20, alignItems: 'flex-end', zIndex: 100 },
  fabMenu: { marginBottom: 16, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fabMenuItemText: { color: colors.text, fontWeight: '600', fontSize: 15, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden', marginRight: 10 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  fabMain: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  fabMainOpen: { backgroundColor: '#FFF' },

  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent }
});