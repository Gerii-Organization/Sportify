import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Check, CheckCheck, X, Search, ImageIcon } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { unwrap } from '../lib/query';
import ErrorState from '../components/ErrorState';
import * as ImagePicker from 'expo-image-picker';


export default function ChatScreen({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const [myId, setMyId] = useState(null);
  const [friendProfile, setFriendProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  /** A conversation that would not load. Blank here reads as "no messages",
   *  which is a claim about a chat the user knows they have. */
  const [loadError, setLoadError] = useState(null);
  
  /** Conversation search. The messages are already in memory, so this filters
   *  what is rendered rather than going back to the server. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingMessage, setEditingMessage] = useState(null);
  const [editInput, setEditInput] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    let subscription;
    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      try {
        setLoadError(null);

        // Load the friend's profile so we can show their avatar in the header.
        setFriendProfile(await unwrap(supabase.from('public_profiles').select('*').eq('id', friendId).single()));

        const initialMessages = await unwrap(supabase.from('messages').select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true }));

        if (initialMessages) {
          setMessages(initialMessages);
          markUnreadAsSeen(initialMessages, user.id);
        }
      } catch (e) {
        setLoadError(e?.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }

      // Scoped to this conversation. The previous version subscribed to every
      // row in `messages` and filtered client-side, so every user's traffic
      // was delivered to every open client.
      subscription = supabase
        .channel(`messages:${friendId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${friendId}` },
          (payload) => {
            if (payload.new?.receiver_id !== user.id) return;
            if (payload.eventType === 'INSERT') {
              setMessages((prev) => [...prev, payload.new]);
              supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then();
            }
            if (payload.eventType === 'UPDATE') {
              setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
            }
          }
        )
        .subscribe();
    };

    setupChat();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, [friendId]);

  const markUnreadAsSeen = async (msgs, currentUserId) => {
    const unreadIds = msgs.filter(m => m.receiver_id === currentUserId && !m.is_read).map(m => m.id);
    if (unreadIds.length > 0) await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
  };

  const sendMessage = async (imageUrl = null) => {
    if ((!inputText.trim() && !imageUrl) || !myId) return;

    const newMessage = {
      sender_id: myId, receiver_id: friendId, content: inputText.trim(), image_url: imageUrl,
      id: Date.now().toString(), created_at: new Date().toISOString(), is_read: false, is_edited: false, is_deleted: false
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    await supabase.from('messages').insert([{ 
      sender_id: myId, receiver_id: friendId, content: newMessage.content, image_url: imageUrl 
    }]);
  };

  // Pick an image, upload it to Supabase Storage, then send its public URL.
  const pickAndSendImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.7,
    });

    if (!result.canceled) {
      setLoading(true);
      try {
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileExt = uri.substring(uri.lastIndexOf('.') + 1);
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${myId}/${fileName}`;

        // Upload in Supabase Storage
        const { error } = await supabase.storage.from('chat_images').upload(filePath, blob);
        if (error) throw error;

        // Storage paths are private by default; getPublicUrl gives a shareable link.
        const { data } = supabase.storage.from('chat_images').getPublicUrl(filePath);
        await sendMessage(data.publicUrl); // Trimitem mesajul cu poza

      } catch (e) { Alert.alert("Upload failed", "Could not upload the image: " + e.message); }
      setLoading(false);
    }
  };

  const handleLongPress = (item) => {
    if (item.sender_id !== myId || item.is_deleted) return;
    Alert.alert("Message", "What would you like to do?", [
        { text: "Edit text", onPress: () => { setEditingMessage(item); setEditInput(item.content); } },
        { text: "Delete", onPress: () => deleteMessage(item.id), style: "destructive" },
        { text: "Cancel", style: "cancel" }
    ]);
  };

  const deleteMessage = async (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true } : m));
    await supabase.from('messages').update({ is_deleted: true, content: 'This message was deleted', image_url: null }).eq('id', id);
  };

  const saveEdit = async () => {
    if (!editInput.trim()) return;
    setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editInput.trim(), is_edited: true } : m));
    await supabase.from('messages').update({ content: editInput.trim(), is_edited: true }).eq('id', editingMessage.id);
    setEditingMessage(null);
  };

  /**
   * The header button used to open an alert listing three things that were
   * "coming soon" — every one of them a no-op. A control that does nothing when
   * tapped is worse than no control: it spends the user's attention and returns
   * nothing. Of the three, search is the one worth having, so the button is now
   * search and the other two are gone rather than promised.
   */
  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter(
      (m) => !m.is_deleted && (m.content || '').toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };


  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === myId;
    // FlatList gives us the index, so the previous message is one lookup away —
    // no need to precompute a grouped structure.
    const showDay = needsSeparator(item.created_at, visibleMessages[index - 1]?.created_at);

    return (
      <>
      {showDay && <DaySeparator label={dayLabel(item.created_at)} />}
      <TouchableOpacity activeOpacity={0.7} 
        style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, item.is_deleted && { backgroundColor: 'transparent' }]}
        onLongPress={() => handleLongPress(item)} delayLongPress={300}
      >
        {item.is_deleted ? (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 15 }}>🚫 This message was deleted</Text>
        ) : (
          <>
            {/* Image messages carry an image_url instead of, or as well as, text. */}
            {item.image_url && <Image source={{uri: item.image_url}} style={styles.chatImage} />}
            {item.content ? <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>{item.content}</Text> : null}
          </>
        )}

        <View style={styles.messageFooter}>
          <Text style={[styles.timeText, isMe ? {color: 'rgba(0,0,0,0.6)'} : {color: colors.textMuted}]}>
            {formatClockTime(item.created_at)} {item.is_edited && !item.is_deleted && '(edited)'}
          </Text>
          {/* Read receipt: double tick once the recipient has opened the chat. */}
          {isMe && !item.is_deleted && (
            <View style={{ marginLeft: 6 }}>
              {item.is_read ? <CheckCheck size={18} color={colors.water} /> : <Check size={16} color="rgba(0,0,0,0.5)" />}
            </View>
          )}
        </View>
      </TouchableOpacity>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.flat} style={styles.gradientBg}>
        
        {/* HEADER CENTRAT */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft color={colors.text} size={28} />
          </TouchableOpacity>
          
          <TouchableOpacity activeOpacity={0.7} style={styles.headerCenter} onPress={() => navigation.navigate('PublicProfileScreen', { userId: friendId })}>
            <Avatar profile={friendProfile} size={36} />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerName}>{friendName}</Text>
              <Text style={{color: colors.accent, fontSize: 11, marginTop: 2}}>View profile</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            style={styles.headerBtn}
            accessibilityLabel={searchOpen ? 'Close search' : 'Search conversation'}
          >
            {searchOpen
              ? <X color={colors.text} size={24} />
              : <Search color={colors.text} size={22} />}
          </TouchableOpacity>
        </View>

        {searchOpen && (
          <View style={styles.searchBar}>
            <Search color={colors.textFaint} size={16} />
            <TextInput
              style={styles.searchField}
              placeholder="Search this conversation"
              placeholderTextColor={colors.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.trim() ? (
              <Text style={styles.searchCount}>
                {visibleMessages.length}
              </Text>
            ) : null}
          </View>
        )}

        {loadError ? (
          <ErrorState message={loadError} />
        ) : loading ? (
          <View style={styles.centerContainer}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            ListEmptyComponent={
              searchQuery.trim()
                ? <Text style={styles.searchEmpty}>No messages match "{searchQuery.trim()}".</Text>
                : null
            }
            onContentSizeChange={() => { if (!searchQuery.trim()) flatListRef.current?.scrollToEnd({ animated: true }); }}
            onLayout={() => { if (!searchQuery.trim()) flatListRef.current?.scrollToEnd({ animated: true }); }}
          />
        )}

        {/* INPUT AREA CU BUTON PENTRU POZE */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={styles.inputContainer}>
            <TouchableOpacity activeOpacity={0.7} style={styles.attachBtn} onPress={pickAndSendImage} accessibilityLabel="Choose from gallery">
              <ImageIcon color={colors.textSecondary} size={24} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput} placeholder="Message..." placeholderTextColor={colors.textMuted}
              value={inputText} onChangeText={setInputText} multiline
            />
            <TouchableOpacity accessibilityLabel="Send message" activeOpacity={0.7} style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!inputText.trim()}>
              <Send color={colors.onAccent} size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* MODAL EDITARE */}
        <Modal visible={editingMessage !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit message</Text>
                <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} onPress={() => setEditingMessage(null)}><X color={colors.textMuted} size={24}/></TouchableOpacity>
              </View>
              <TextInput style={[styles.textInput, { backgroundColor: colors.surfaceHigh, minHeight: 50 }]} value={editInput} onChangeText={setEditInput} multiline autoFocus />
              <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={saveEdit}><Text style={{color: colors.onAccent, fontWeight: '600'}}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { padding: 6, width: 40, alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  avatarBase: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchField: { flex: 1, color: colors.text, fontSize: 15, padding: 0 },
  searchCount: { color: colors.textMuted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  searchEmpty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  chatList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  
  messageBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginBottom: 10 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15, marginTop: 6 },
  myMessageText: { color: colors.onAccent, fontWeight: '500' },
  theirMessageText: { color: colors.text },
  chatImage: { width: 200, height: 200, borderRadius: 18, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.1)' },
  
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 6 },
  timeText: { fontSize: 11, fontWeight: '600' },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  attachBtn: { padding: 10, marginRight: 6, marginBottom: 2 },
  textInput: { flex: 1, backgroundColor: colors.surface, color: colors.text, minHeight: 45, maxHeight: 100, borderRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  sendBtn: { backgroundColor: colors.accent, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.sheet, padding: 26, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  saveBtn: { backgroundColor: colors.accent, padding: 16, borderRadius: 18, alignItems: 'center', marginTop: 16 }
});
import { colors } from '../theme';
import { formatClockTime } from '../lib/date';
import { gradients } from '../theme';
import Avatar from '../components/Avatar';
import DaySeparator, { needsSeparator, dayLabel } from '../components/DaySeparator';