import { useState, useCallback } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, TouchableOpacity, 
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Users, UserPlus, Search, X, Check, Clock, Plus, Bell, MessageSquare, Hash } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, TAB_BAR_CLEARANCE } from '../theme';
import { levelFromXp } from '../lib/level';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AmbientGlow from '../components/AmbientGlow';
import FeedScreen from './FeedScreen';
import LeaderboardScreen from './LeaderboardScreen';
import { SkeletonChats, SkeletonPeople } from '../components/Skeleton';
import useRefresh from '../lib/useRefresh';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ComposeSheet from '../components/ComposeSheet';
import { unwrap } from '../lib/query';
import { shortTime } from '../lib/date';


export default function FriendsScreen() {
  const { refreshControl } = useRefresh(() => fetchData());
  const { user } = useAuth();
  /**
   * Feed and chats are the same category — other people — and were two tabs
   * apart. The feed is what your friends did; this is who they are and what you
   * said to them. Splitting them meant the tab bar spent two of its five slots
   * on one idea.
   */
  // Feed first: it is the half of this screen that has something new on it
  // every time you open it. Chats only change when somebody writes to you.
  const [section, setSection] = useState('feed');

  const [loading, setLoading] = useState(true);
  /** A failed load of the friends/chats/groups set. Kept apart from the
   *  empty state: no friends and no connection are different facts, and on
   *  this screen the blank one reads as a verdict on your social life. */
  const [loadError, setLoadError] = useState(null);
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
  const [composeVisible, setComposeVisible] = useState(false);
  /** Bumped after posting so the embedded feed reloads. */
  const [feedNonce, setFeedNonce] = useState(0);
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
    setLoadError(null);

    try {
      await fetchFriendsAndChats(user.id);
    } catch (e) {
      setLoadError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }

    // Separately, and deliberately not fatal. Groups are a shelf at the top of
    // this screen; chats are the screen. A broken group policy taking the whole
    // list down with it is how one failure became "you have no conversations"
    // for someone with a year of them.
    try {
      await fetchGroups(user.id);
    } catch (e) {
      setGroups([]);
      console.warn(`[Sportify] Groups could not be loaded: ${e.message}`);
    }
  };

  /**
   * Only groups this user belongs to.
   * This previously selected every row in `groups`, so each user saw every
   * group in the app. The real fix is a row-level security policy — see
   * supabase/policies.sql — but the client must not ask for them either.
   */
  const fetchGroups = async (userId) => {
    const memberships = await unwrap(supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId));

    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      setGroups([]);
      return;
    }

    setGroups(await unwrap(supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false })) || []);
  };

 const fetchFriendsAndChats = async (userId) => {
    // 1. Load every friendship this user is part of.
    // This used to be `if (error || !fData) return;` — a silent bail that left
    // every list empty and the screen reporting no friends, no chats and no
    // requests. Throwing hands the failure to fetchData, which can say so.
    const fData = await unwrap(supabase.from('friendships')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`));

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
      const pData = await unwrap(supabase.from('public_profiles').select('*').in('id', acceptedIds));

      // Newest first, so the first row seen per partner is the latest message.
      const mData = await unwrap(supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false }));

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
      const pData = await unwrap(supabase.from('public_profiles').select('*').in('id', pendingIn));
      setReceivedRequests((pData || []).map(p => ({ ...p, friendship_id: fMap[p.id] })));
    } else setReceivedRequests([]);

    if (pendingOutIds.length > 0) {
      const pData = await unwrap(supabase.from('public_profiles').select('*').in('id', pendingOutIds));
      setSentRequests((pData || []).map(p => ({ ...p, friendship_id: fMap[p.id] })));
    } else setSentRequests([]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    // Searching people by name must not also hand over their measurements.
    const { data } = await supabase.from('public_profiles')
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

  const closeSearchModal = () => {
    setSearchModalVisible(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const closeGroupModal = () => {
    setCreateGroupModalVisible(false);
    setGroupName('');
    setSelectedFriends([]);
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
            <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} accessibilityLabel="Close" activeOpacity={0.7} style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
              <X color={colors.text} size={18} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} activeOpacity={0.7} accessibilityLabel="Confirm" style={styles.actionBtnAccept} onPress={() => acceptRequest(item.friendship_id)}>
              <Check color={colors.onAccent} size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.requestActions}>
            <View style={styles.pendingBadge}>
              <Clock color={colors.textSecondary} size={14} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} accessibilityLabel="Close" activeOpacity={0.7} style={styles.actionBtnReject} onPress={() => removeRequest(item.friendship_id)}>
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
            <Text style={styles.headerTitle}>Social</Text>
            {totalUnread > 0 && (
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Press
              scale={0.9}
              accessibilityLabel={receivedRequests.length > 0
                ? `${receivedRequests.length} friend requests`
                : 'Friend requests'}
              style={styles.bellBtn}
              onPress={() => setRequestsModalVisible(true)}
              hitSlop={12}
            >
              <Bell
                color={receivedRequests.length > 0 ? colors.accent : colors.textSecondary}
                size={23}
              />
              {receivedRequests.length > 0 && (
                <View style={styles.bellCount}>
                  <Text style={styles.bellCountText}>
                    {receivedRequests.length > 9 ? '9+' : receivedRequests.length}
                  </Text>
                </View>
              )}
            </Press>
          </View>
        </View>

        <View style={styles.sectionTabs}>
          {[{ id: 'feed', label: 'Feed' }, { id: 'chats', label: 'Chats' }, { id: 'ranking', label: 'Ranking' }].map((t) => {
            const active = section === t.id;
            return (
              <Press
                key={t.id}
                scale={0.98}
                style={[styles.sectionTab, active && styles.sectionTabOn]}
                onPress={() => setSection(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.sectionTabText, active && styles.sectionTabTextOn]}>
                  {t.label}
                </Text>
              </Press>
            );
          })}
        </View>

        {section === 'feed' ? (
          <FeedScreen embedded reloadKey={feedNonce} />
        ) : section === 'ranking' ? (
          <LeaderboardScreen embedded />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchData} />
        ) : loading ? (
          <SkeletonChats />
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
                message="Send a friend a message to get started."
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

      {/* FAB OVERLAY & MENIU — chats only. It adds friends and starts groups,
          neither of which is an action on a feed. */}
      {isFabMenuOpen && section === 'chats' && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setIsFabMenuOpen(false)} />
      )}
      {/* On the feed the button writes a post; on chats it opens the menu. The
          ranking has nothing to add, so it has no button. */}
      <View style={[styles.fabContainer, section === 'ranking' && { display: 'none' }]}>
        {isFabMenuOpen && section === 'chats' && (
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
        <TouchableOpacity
          accessibilityLabel={section === 'feed' ? 'Write a post' : 'Add a friend or start a group'}
          activeOpacity={0.7}
          style={[styles.fabMain, isFabMenuOpen && styles.fabMainOpen]}
          onPress={() => (section === 'feed' ? setComposeVisible(true) : setIsFabMenuOpen(!isFabMenuOpen))}
        >
          <Plus color={isFabMenuOpen ? colors.text : colors.onAccent} size={28} style={{ transform: [{ rotate: isFabMenuOpen ? '45deg' : '0deg' }] }} />
        </TouchableOpacity>
      </View>

      {/* Start a chat — friends you have never messaged. */}
      <Modal visible={startChatModalVisible} animationType="slide" transparent onRequestClose={() => setStartChatModalVisible(false)}>
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
      <Modal
        visible={requestsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRequestsModalVisible(false)}
      >
        {/* A sheet, not a dialog. It slides from the edge it is attached to and
            the backdrop closes it — the same gesture as every other panel in the
            app, which is what makes it feel like part of it. */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRequestsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Requests</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setRequestsModalVisible(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {receivedRequests.length === 0 && sentRequests.length === 0 ? (
                <View style={styles.requestsEmpty}>
                  <View style={styles.requestsEmptyGlyph}>
                    <Bell color={colors.textFaint} size={26} />
                  </View>
                  <Text style={styles.requestsEmptyTitle}>Nothing waiting</Text>
                  <Text style={styles.requestsEmptyText}>
                    Requests you send or receive will show up here.
                  </Text>
                </View>
              ) : (
                <>
                  {receivedRequests.length > 0 && (
                    <View style={{ marginBottom: spacing.lg }}>
                      <View style={styles.sheetLabelRow}>
                        <Text style={styles.sheetLabel}>Waiting on you</Text>
                        <Text style={styles.sheetCount}>{receivedRequests.length}</Text>
                      </View>
                      {receivedRequests.map(req => renderRequestItem(req, 'received'))}
                    </View>
                  )}
                  {sentRequests.length > 0 && (
                    <View>
                      <View style={styles.sheetLabelRow}>
                        <Text style={styles.sheetLabel}>Waiting on them</Text>
                        <Text style={styles.sheetCount}>{sentRequests.length}</Text>
                      </View>
                      {sentRequests.map(req => renderRequestItem(req, 'sent'))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: ADD FRIEND (Search) */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeSearchModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.grabber} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find people</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={closeSearchModal}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {/* Searching on submit, not behind a button: a search box with a
                Search button beside it asks you to do the same thing twice. */}
            <View style={styles.searchBar}>
              <Search color={colors.textFaint} size={19} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by first name"
                placeholderTextColor={colors.textFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity accessibilityLabel="Clear" activeOpacity={0.7} onPress={() => { setSearchQuery(''); setSearchResults([]); }} hitSlop={8}>
                  <X color={colors.textFaint} size={16} />
                </TouchableOpacity>
              )}
            </View>

            {isSearching ? (
              <SkeletonPeople count={3} />
            ) : (
              <ScrollView style={{ marginTop: spacing.md, maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {searchResults.length === 0 ? (
                  <Text style={styles.sheetEmpty}>
                    {searchQuery.trim()
                      ? `Nobody called "${searchQuery.trim()}".`
                      : 'Type a name and press search.'}
                  </Text>
                ) : (
                  searchResults.map(res => (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      key={res.id}
                      style={styles.pickRow}
                      onPress={() => { closeSearchModal(); navigation.navigate('PublicProfileScreen', { userId: res.id }); }}
                    >
                      <Avatar profile={res} size={40} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.pickName} numberOfLines={1}>{res.first_name}</Text>
                        <Text style={styles.userTitle}>Level {levelFromXp(res.xp)}</Text>
                      </View>
                      <TouchableOpacity
                        accessibilityLabel={`Add ${res.first_name}`}
                        activeOpacity={0.7}
                        style={styles.sendReqBtn}
                        onPress={() => sendFriendRequest(res.id)}
                      >
                        <UserPlus color={colors.accent} size={18} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: CREATE GROUP */}
      <Modal visible={createGroupModalVisible} animationType="slide" transparent onRequestClose={closeGroupModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.grabber} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New group</Text>
              <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={closeGroupModal}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {/* Its own style, not the search bar's. `searchInput` carries
                flex: 1 for the row it belongs in; in a column that makes the
                field stretch vertically and swallow the rest of the sheet —
                which is why the name could not be typed. */}
            <TextInput
              style={styles.sheetInput}
              placeholder="Group name"
              placeholderTextColor={colors.textFaint}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={40}
              returnKeyType="done"
            />

            <View style={styles.sheetLabelRow}>
              <Text style={styles.sheetLabel}>Members</Text>
              <Text style={styles.sheetCount}>
                {selectedFriends.length} selected
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {activeChats.concat(inactiveChats).length === 0 ? (
                <Text style={styles.sheetEmpty}>Add a friend first to start a group.</Text>
              ) : (
                activeChats.concat(inactiveChats).map(f => {
                  const picked = selectedFriends.includes(f.id);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      key={f.id}
                      style={[styles.pickRow, picked && styles.pickRowOn]}
                      onPress={() => toggleFriendSelection(f.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: picked }}
                    >
                      <Avatar profile={f} size={40} />
                      <Text style={styles.pickName} numberOfLines={1}>{f.first_name}</Text>
                      <View style={[styles.checkbox, picked && styles.checkboxSelected]}>
                        {picked && <Check color={colors.onAccent} size={14} strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Disabled rather than hidden, so it is obvious what is missing. */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.sheetPrimary, !groupName.trim() && styles.sheetPrimaryOff]}
              onPress={handleCreateGroup}
              disabled={!groupName.trim()}
            >
              <Text style={[styles.sheetPrimaryText, !groupName.trim() && styles.sheetPrimaryTextOff]}>
                {groupName.trim() ? `Create "${groupName.trim()}"` : 'Name the group first'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ComposeSheet
        visible={composeVisible}
        onClose={() => setComposeVisible(false)}
        onPosted={() => setFeedNonce((n) => n + 1)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  sectionTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  sectionTabOn: { backgroundColor: colors.surfaceHigh },
  sectionTabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  sectionTabTextOn: { color: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 20 },
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
  // No surface behind it. A single icon in a header corner does not need a
  // button drawn around it to read as tappable, and the count says the rest.
  bellBtn: { padding: 4, position: 'relative' },
  bellCount: {
    position: 'absolute', top: -3, right: -5,
    minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  bellCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  
  scrollContent: { padding: 20, paddingBottom: 130 },

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
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  userTitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  // An unread preview reads brighter, so the row is scannable without relying
  // on the badge alone — colour and weight both carry the state.
  
  requestActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtnReject: { backgroundColor: colors.surfaceHigh, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  actionBtnAccept: { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 10 },
  pendingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 6 },


  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.sheet, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: spacing.xl, paddingTop: 10, paddingBottom: 40, maxHeight: '90%' },
  // The handle every sheet in the OS has. Without it a panel that slid up from
  // the bottom reads as a screen that arrived, not as one you can push back.
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, alignSelf: 'center', marginBottom: spacing.md },

  sheetInput: {
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  sheetLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sheetLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  sheetCount: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  sheetEmpty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, paddingVertical: spacing.lg, textAlign: 'center' },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8,
  },
  pickRowOn: { backgroundColor: colors.accentSoft },
  pickName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },

  sheetPrimary: {
    height: 54, borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.lg,
  },
  sheetPrimaryOff: { backgroundColor: colors.surfaceHigh },
  sheetPrimaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  sheetPrimaryTextOff: { color: colors.textMuted },

  requestsEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
  requestsEmptyGlyph: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  requestsEmptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.md },
  requestsEmptyText: {
    color: colors.textMuted, fontSize: 14, lineHeight: 20,
    textAlign: 'center', marginTop: 6, paddingHorizontal: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 16, height: 52 },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', padding: 0 },
  
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, padding: 16, borderRadius: 18, marginBottom: 10 },
  sendReqBtn: { backgroundColor: 'rgba(155, 157, 214, 0.1)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.accent + '55' },

  fabOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99 },
  // TAB_BAR_CLEARANCE, not a guessed 90: the floating bar is 62 tall with a
  // 16 margin, and the old number put the button partly behind it.
  fabContainer: { position: 'absolute', bottom: TAB_BAR_CLEARANCE + 4, right: 20, alignItems: 'flex-end', zIndex: 100 },
  fabMenu: { marginBottom: 16, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fabMenuItemText: { color: colors.text, fontWeight: '600', fontSize: 15, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden', marginRight: 10 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  fabMain: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 },
  fabMainOpen: { backgroundColor: colors.surfaceHigh },

  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent }
});