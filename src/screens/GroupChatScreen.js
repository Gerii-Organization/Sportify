import { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Hash, Users } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { unwrap } from '../lib/query';
import ErrorState from '../components/ErrorState';
import { colors } from '../theme';
import { formatClockTime } from '../lib/date';
import { gradients } from '../theme';
import GroupSheet from '../components/GroupSheet';
import DaySeparator, { needsSeparator, dayLabel } from '../components/DaySeparator';


export default function GroupChatScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [myId, setMyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  
  // Member names, keyed by user id, so each bubble can show its author.
  const [memberNames, setMemberNames] = useState({});
  const [group, setGroup] = useState(null);
  const [groupSheetVisible, setGroupSheetVisible] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    let subscription;

    const setupGroupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      try {
        setLoadError(null);

        // The group row carries created_by, which decides who may rename or
        // delete it. Without it the sheet cannot show the right controls.
        setGroup(await unwrap(supabase.from('groups').select('*').eq('id', groupId).maybeSingle()));

        // 1. Members first — we need their names before rendering messages.
        const members = await unwrap(supabase.from('group_members').select('user_id').eq('group_id', groupId));
        if (members && members.length > 0) {
          const memberIds = members.map(m => m.user_id);
          // Unwrapped for more than tidiness: on a failed read this was null and
          // the `.forEach` below threw, taking the screen down with it.
          const profiles = await unwrap(supabase.from('public_profiles').select('id, first_name').in('id', memberIds));
          const namesMap = {};
          (profiles || []).forEach(p => namesMap[p.id] = p.first_name);
          setMemberNames(namesMap);
        }

        // 2. Existing messages, oldest first so the list reads top to bottom.
        const initialMessages = await unwrap(supabase
          .from('group_messages')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true }));

        setMessages(initialMessages || []);
      } catch (e) {
        setLoadError(e?.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }

      // 3. Subscribe to new messages for this group only.
      subscription = supabase
        .channel(`public:group_messages:${groupId}`)
        .on('postgres_changes', { 
            event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` 
        }, (payload) => {
            if (payload.new.sender_id !== user.id) {
                setMessages(prev => [...prev, payload.new]);
            }
        }).subscribe();
    };

    setupGroupChat();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, [groupId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !myId) return;

    const newMessage = {
      group_id: groupId, sender_id: myId, content: inputText.trim(),
      id: Date.now().toString(), created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    await supabase.from('group_messages').insert([{
      group_id: groupId, sender_id: myId, content: newMessage.content
    }]);
  };



  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === myId;
    // Only label the first message in a run, and never our own.
    const showName = !isMe && (index === 0 || messages[index - 1].sender_id !== item.sender_id);
    const showDay = needsSeparator(item.created_at, messages[index - 1]?.created_at);

    return (
      <View style={{ marginBottom: 10 }}>
        {showDay && <DaySeparator label={dayLabel(item.created_at)} />}
        {showName && <Text style={styles.senderName}>{memberNames[item.sender_id] || 'Member'}</Text>}
        <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isMe ? {color: 'rgba(0,0,0,0.6)'} : {color: colors.textMuted}]}>
            {formatClockTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.flat} style={styles.gradientBg}>
        
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={28} />
          </TouchableOpacity>
          {/* The title doubles as the way into group settings — there is nowhere
              else to put it, and tapping a chat title is where people look. */}
          <TouchableOpacity activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }}
            onPress={() => setGroupSheetVisible(true)}
            accessibilityLabel="Group settings"
          >
            <Hash color={colors.accent} size={18} style={{marginRight: 6}} />
            <Text style={styles.headerName}>{group?.name || groupName}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => setGroupSheetVisible(true)}
            style={styles.backBtn}
            accessibilityLabel="Members"
          >
            <Users color={colors.textSecondary} size={22} />
          </TouchableOpacity>
        </View>

        {loadError ? (
          <ErrorState message={loadError} />
        ) : loading ? (
          <View style={styles.centerContainer}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <FlatList
            ref={flatListRef} data={messages} keyExtractor={(item) => item.id.toString()} renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={styles.inputContainer}>
            <TextInput style={styles.textInput} placeholder="Message the group..." placeholderTextColor={colors.textMuted} value={inputText} onChangeText={setInputText} multiline />
            <TouchableOpacity activeOpacity={0.7} style={[styles.sendBtn, !inputText.trim() ? { opacity: 0.5 } : {}]} onPress={sendMessage} disabled={!inputText.trim()} accessibilityLabel="Send message">
              <Send color={colors.onAccent} size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <GroupSheet
          visible={groupSheetVisible}
          onClose={() => setGroupSheetVisible(false)}
          group={group}
          currentUserId={myId}
          onChanged={() => {
            // A rename should show immediately; a leave or delete means this
            // screen no longer has anything to display.
            supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
              .then(({ data }) => (data ? setGroup(data) : navigation.goBack()));
          }}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 6 },
  headerName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  
  senderName: { color: colors.accent, fontSize: 11, fontWeight: '600', marginLeft: 10, marginBottom: 6 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15 },
  myMessageText: { color: colors.onAccent, fontWeight: '500' },
  theirMessageText: { color: colors.text },
  timeText: { fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginTop: 6 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  textInput: { flex: 1, backgroundColor: colors.surface, color: colors.text, minHeight: 45, maxHeight: 100, borderRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  sendBtn: { backgroundColor: colors.accent, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});