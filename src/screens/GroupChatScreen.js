import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Hash } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

export default function GroupChatScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [myId, setMyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Stocăm numele membrilor grupului ca să știm cine a scris
  const [memberNames, setMemberNames] = useState({});

  const flatListRef = useRef(null);

  useEffect(() => {
    let subscription;

    const setupGroupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // 1. Aducem toți membrii grupului ca să le știm numele
      const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
      if (members && members.length > 0) {
        const memberIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, first_name').in('id', memberIds);
        const namesMap = {};
        profiles.forEach(p => namesMap[p.id] = p.first_name);
        setMemberNames(namesMap);
      }

      // 2. Aducem mesajele de pe grup
      const { data: initialMessages } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      setMessages(initialMessages || []);
      setLoading(false);

      // 3. Ascultăm în timp real pe grup
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

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === myId;
    // Nu mai scriem numele nostru dacă noi am trimis mesajul
    const showName = !isMe && (index === 0 || messages[index - 1].sender_id !== item.sender_id);

    return (
      <View style={{ marginBottom: 12 }}>
        {showName && <Text style={styles.senderName}>{memberNames[item.sender_id] || 'Membru'}</Text>}
        <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isMe ? {color: 'rgba(0,0,0,0.6)'} : {color: '#666'}]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#0a0a0a']} style={styles.gradientBg}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color="#FFF" size={28} />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Hash color={NEON_GREEN} size={18} style={{marginRight: 6}} />
            <Text style={styles.headerName}>{groupName}</Text>
          </View>
          <View style={{width: 28}} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator color={NEON_GREEN} /></View>
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
            <TextInput style={styles.textInput} placeholder="Mesaj pe grup..." placeholderTextColor="#666" value={inputText} onChangeText={setInputText} multiline />
            <TouchableOpacity style={[styles.sendBtn, !inputText.trim() ? { opacity: 0.5 } : {}]} onPress={sendMessage} disabled={!inputText.trim()}>
              <Send color="#000" size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradientBg: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomWidth: 1, borderBottomColor: '#222' },
  backBtn: { padding: 5 },
  headerName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 15, flexGrow: 1, justifyContent: 'flex-end' },
  
  senderName: { color: NEON_GREEN, fontSize: 11, fontWeight: 'bold', marginLeft: 10, marginBottom: 4 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: NEON_GREEN, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#333' },
  messageText: { fontSize: 16 },
  myMessageText: { color: '#000', fontWeight: '500' },
  theirMessageText: { color: '#FFF' },
  timeText: { fontSize: 10, fontWeight: 'bold', alignSelf: 'flex-end', marginTop: 4 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 15, backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: '#222' },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', minHeight: 45, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  sendBtn: { backgroundColor: NEON_GREEN, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});