import { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Check, CheckCheck, X, Search, ImageIcon, Reply, Pencil, Trash2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import CachedImage from '../components/CachedImage';
import { unwrap } from '../lib/query';
import ErrorState from '../components/ErrorState';
import { REACTIONS, summarise, toggleLocally } from '../lib/reactions';
import * as ImagePicker from 'expo-image-picker';
import { SkeletonMessages } from '../components/Skeleton';


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
  /** The message being replied to, or null. */
  const [replyTo, setReplyTo] = useState(null);
  /** The message whose action sheet is open. */
  const [actionsFor, setActionsFor] = useState(null);
  /** True while the other person is typing, from the presence channel. */
  const [theyAreTyping, setTheyAreTyping] = useState(false);
  const [theyAreOnline, setTheyAreOnline] = useState(false);
  const presenceRef = useRef(null);
  const typingTimer = useRef(null);
  
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

  /**
   * Who is here, and who is typing.
   *
   * Presence rather than a table: neither fact outlives the moment, and writing
   * "is typing" to the database would mean a row per keystroke and a stale true
   * every time somebody's app is killed mid-sentence.
   *
   * The channel name is the pair sorted, so both sides compute the same one
   * without either having to be the host.
   */
  useEffect(() => {
    if (!myId || !friendId) return undefined;

    const room = [myId, friendId].sort().join(':');
    const channel = supabase.channel(`chat-presence:${room}`, {
      config: { presence: { key: myId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const theirs = state[friendId]?.[0];
        setTheyAreOnline(!!theirs);
        setTheyAreTyping(!!theirs?.typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ typing: false });
      });

    presenceRef.current = channel;

    return () => {
      clearTimeout(typingTimer.current);
      supabase.removeChannel(channel);
      presenceRef.current = null;
    };
  }, [myId, friendId]);

  /**
   * Announces typing, and stops announcing it two seconds after you stop.
   *
   * Without the timeout the flag stays true until the next keystroke, so
   * pausing to think reads as still typing — and sending the message would be
   * the only thing that ever cleared it.
   */
  const announceTyping = () => {
    const channel = presenceRef.current;
    if (!channel) return;

    channel.track({ typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => channel.track({ typing: false }), 2000);
  };

  const sendMessage = async (imageUrl = null) => {
    if ((!inputText.trim() && !imageUrl) || !myId) return;

    const quoted = replyTo;

    const newMessage = {
      sender_id: myId, receiver_id: friendId, content: inputText.trim(), image_url: imageUrl,
      id: Date.now().toString(), created_at: new Date().toISOString(),
      is_read: false, is_edited: false, is_deleted: false,
      reply_to: quoted?.id ?? null, reactions: {},
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setReplyTo(null);

    // Sending ends the sentence; leaving the flag set would show you as still
    // typing until the timer happened to fire.
    clearTimeout(typingTimer.current);
    presenceRef.current?.track({ typing: false });

    await supabase.from('messages').insert([{
      sender_id: myId, receiver_id: friendId, content: newMessage.content, image_url: imageUrl,
      reply_to: quoted?.id ?? null,
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

  /**
   * Every message opens the same sheet; what is in it depends on whose it is.
   *
   * It used to be an Alert, and only on your own messages — so there was no way
   * to reply to or react to anything anyone else said, which is most of a
   * conversation.
   */
  const handleLongPress = (item) => {
    if (item.is_deleted) return;
    setActionsFor(item);
  };

  /**
   * Applies a reaction immediately, then lets the server's answer replace it.
   *
   * The round trip is long enough that waiting for it makes the tap feel
   * broken, and the server recomputes the same map from the same rule.
   */
  const react = async (message, emoji) => {
    setActionsFor(null);
    setMessages((prev) => prev.map((m) =>
      m.id === message.id ? { ...m, reactions: toggleLocally(m.reactions, emoji, myId) } : m
    ));

    const { data, error } = await supabase.rpc('toggle_reaction', {
      p_message_id: message.id,
      p_emoji: emoji,
    });

    if (error || !data?.ok) return;
    setMessages((prev) => prev.map((m) =>
      m.id === message.id ? { ...m, reactions: data.reactions } : m
    ));
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
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 15 }}>This message was deleted</Text>
        ) : (
          <>
            {/* The quoted message, when this is a reply. Looked up rather than
                stored: the original can be edited or deleted after the reply
                was sent, and a copy would keep showing what it used to say. */}
            {item.reply_to ? (
              <View style={[styles.quote, isMe ? styles.quoteMine : styles.quoteTheirs]}>
                <Text style={styles.quoteText} numberOfLines={2}>
                  {quotedTextFor(item.reply_to)}
                </Text>
              </View>
            ) : null}

            {/* Image messages carry an image_url instead of, or as well as, text. */}
            {item.image_url && <CachedImage source={{ uri: item.image_url }} style={styles.chatImage} />}
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

        {reactionRows(item).length > 0 && (
          <View style={styles.reactionRow}>
            {reactionRows(item).map((r) => (
              <TouchableOpacity
                key={r.emoji}
                activeOpacity={0.7}
                style={[styles.reactionChip, r.mine && styles.reactionChipMine]}
                onPress={() => react(item, r.emoji)}
                accessibilityLabel={`${r.count} ${r.emoji}${r.mine ? ', including yours' : ''}`}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                {r.count > 1 ? <Text style={styles.reactionCount}>{r.count}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </TouchableOpacity>
      </>
    );
  };

  const reactionRows = (item) => summarise(item.reactions, myId);

  /** What a reply is quoting, read from the list rather than from a copy. */
  const quotedTextFor = (id) => {
    const original = messages.find((m) => String(m.id) === String(id));
    if (!original) return 'Message unavailable';
    if (original.is_deleted) return 'Deleted message';
    return original.content || (original.image_url ? 'Photo' : '');
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
              {/* Typing wins over online: it says both, and it is the one that
                  is about to change what is on screen. */}
              {theyAreTyping ? (
                <Text style={styles.headerTyping}>typing…</Text>
              ) : theyAreOnline ? (
                <View style={styles.headerOnline}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.headerOnlineText}>online</Text>
                </View>
              ) : (
                <Text style={styles.headerProfileLink}>View profile</Text>
              )}
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
          <SkeletonMessages />
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
          {/* What you are replying to, above the box you are typing in — the
              only place it can be where you can still see both. */}
          {replyTo ? (
            <View style={styles.replyBar}>
              <View style={styles.replyStripe} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.replyWho}>
                  {replyTo.sender_id === myId ? 'Replying to yourself' : `Replying to ${friendProfile?.first_name || 'them'}`}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {replyTo.content || (replyTo.image_url ? 'Photo' : '')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel="Cancel reply">
                <X color={colors.textMuted} size={18} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <TouchableOpacity activeOpacity={0.7} style={styles.attachBtn} onPress={pickAndSendImage} accessibilityLabel="Choose from gallery">
              <ImageIcon color={colors.textSecondary} size={24} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput} placeholder="Message..." placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={(t) => { setInputText(t); announceTyping(); }}
              multiline
            />
            <TouchableOpacity accessibilityLabel="Send message" activeOpacity={0.7} style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!inputText.trim()}>
              <Send color={colors.onAccent} size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* MODAL EDITARE */}
        <Modal visible={editingMessage !== null} transparent animationType="slide" onRequestClose={() => setEditingMessage(null)}>
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
      {/* The long-press sheet. Reactions first: it is the most common thing
          anyone wants to do to a message, and it takes one tap from here. */}
      <Modal visible={!!actionsFor} transparent animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setActionsFor(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />

            <View style={styles.emojiRow}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.7}
                  style={styles.emojiBtn}
                  onPress={() => react(actionsFor, emoji)}
                  accessibilityLabel={`React with ${emoji}`}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => { setReplyTo(actionsFor); setActionsFor(null); }}
            >
              <Reply color={colors.text} size={19} />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>

            {actionsFor?.sender_id === myId && (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionRow}
                  onPress={() => { setEditingMessage(actionsFor); setEditInput(actionsFor.content); setActionsFor(null); }}
                >
                  <Pencil color={colors.text} size={19} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionRow}
                  onPress={() => { const id = actionsFor.id; setActionsFor(null); deleteMessage(id); }}
                >
                  <Trash2 color={colors.danger} size={19} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { padding: 6, width: 40, alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
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

  headerTyping: { color: colors.accent, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  headerOnline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  headerOnlineText: { color: colors.success, fontSize: 11, fontWeight: '600' },
  headerProfileLink: { color: colors.accent, fontSize: 11, marginTop: 2 },

  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  replyStripe: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.accent },
  replyWho: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  replyText: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  quote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, opacity: 0.85 },
  quoteMine: { borderLeftColor: 'rgba(0,0,0,0.35)' },
  quoteTheirs: { borderLeftColor: colors.accent },
  quoteText: { color: colors.textMuted, fontSize: 13 },

  reactionRow: { flexDirection: 'row', gap: 5, marginTop: 7 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  reactionChipMine: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: colors.text, fontSize: 11, fontWeight: '700' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 20, paddingTop: 10, paddingBottom: 34,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, alignSelf: 'center', marginBottom: 18 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  actionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
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