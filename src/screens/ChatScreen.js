import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

export default function ChatScreen({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const [myId, setMyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const flatListRef = useRef(null);

  useEffect(() => {
    let subscription;

    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      const { data: initialMessages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (!error && initialMessages) {
        setMessages(initialMessages);
      }
      setLoading(false);

      subscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `receiver_id=eq.${user.id}` 
        }, (payload) => {
            if (payload.new.sender_id === friendId) {
                setMessages(prev => [...prev, payload.new]);
            }
        })
        .subscribe();
    };

    setupChat();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [friendId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !myId) return;

    const newMessage = {
      sender_id: myId,
      receiver_id: friendId,
      content: inputText.trim(),
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    await supabase.from('messages').insert([{
      sender_id: myId,
      receiver_id: friendId,
      content: newMessage.content
    }]);
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === myId;

    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
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
          <Text style={styles.headerName}>{friendName || 'Chat'}</Text>
          <View style={{width: 28}} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color={NEON_GREEN} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Scrie un mesaj..."
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() ? { opacity: 0.5 } : {}]} 
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
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
  messageBubble: { maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginBottom: 10 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: NEON_GREEN, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#333' },
  messageText: { fontSize: 16 },
  myMessageText: { color: '#000', fontWeight: '500' },
  theirMessageText: { color: '#FFF' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 15, backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: '#222' },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', minHeight: 45, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  sendBtn: { backgroundColor: NEON_GREEN, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});