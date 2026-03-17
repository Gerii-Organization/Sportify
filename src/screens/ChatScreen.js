import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Check, CheckCheck, Edit2, Trash2, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

export default function ChatScreen({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const [myId, setMyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Stări pentru Editare
  const [editingMessage, setEditingMessage] = useState(null);
  const [editInput, setEditInput] = useState('');

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
        markUnreadAsSeen(initialMessages, user.id);
      }
      setLoading(false);

      // Ascultăm schimbările în timp real (INSERT, UPDATE, DELETE)
      subscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            if (payload.eventType === 'INSERT' && payload.new.sender_id === friendId) {
                setMessages(prev => [...prev, payload.new]);
                // Marcăm ca citit instant
                supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then();
            }
            if (payload.eventType === 'UPDATE') {
                setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
            }
        })
        .subscribe();
    };

    setupChat();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, [friendId]);

  const markUnreadAsSeen = async (msgs, currentUserId) => {
    const unreadIds = msgs.filter(m => m.receiver_id === currentUserId && !m.is_read).map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !myId) return;

    const newMessage = {
      sender_id: myId, receiver_id: friendId, content: inputText.trim(),
      id: Date.now().toString(), created_at: new Date().toISOString(),
      is_read: false, is_edited: false, is_deleted: false
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    await supabase.from('messages').insert([{ sender_id: myId, receiver_id: friendId, content: newMessage.content }]);
  };

  const handleLongPress = (item) => {
    if (item.sender_id !== myId || item.is_deleted) return;

    Alert.alert(
      "Acțiuni mesaj", "Alege ce vrei să faci cu acest mesaj",
      [
        { text: "Editează", onPress: () => { setEditingMessage(item); setEditInput(item.content); } },
        { text: "Șterge", onPress: () => deleteMessage(item.id), style: "destructive" },
        { text: "Anulează", style: "cancel" }
      ]
    );
  };

  const deleteMessage = async (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true } : m));
    await supabase.from('messages').update({ is_deleted: true, content: 'Acest mesaj a fost șters' }).eq('id', id);
  };

  const saveEdit = async () => {
    if (!editInput.trim()) return;
    setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editInput.trim(), is_edited: true } : m));
    await supabase.from('messages').update({ content: editInput.trim(), is_edited: true }).eq('id', editingMessage.id);
    setEditingMessage(null);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === myId;
    const isLastMessage = index === messages.length - 1;

    return (
      <TouchableOpacity 
        style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, item.is_deleted && { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' }]}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        delayLongPress={300}
      >
        {item.is_deleted ? (
          <Text style={{ color: '#666', fontStyle: 'italic', fontSize: 15 }}>🚫 Acest mesaj a fost șters</Text>
        ) : (
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.content}
          </Text>
        )}

        <View style={styles.messageFooter}>
          <Text style={[styles.timeText, isMe ? {color: 'rgba(0,0,0,0.6)'} : {color: '#666'}]}>
            {formatTime(item.created_at)} {item.is_edited && !item.is_deleted && '(editat)'}
          </Text>
          
          {isMe && !item.is_deleted && (
            <View style={{ marginLeft: 5 }}>
              {item.is_read ? <CheckCheck size={14} color="#000" /> : <Check size={14} color="rgba(0,0,0,0.5)" />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#0a0a0a']} style={styles.gradientBg}>
        
        {/* HEADER CU REDIRECȚIONARE CĂTRE PROFIL */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color="#FFF" size={28} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfileScreen', { userId: friendId })}>
            <Text style={styles.headerName}>{friendName}</Text>
            <Text style={{color: NEON_GREEN, fontSize: 10, textAlign: 'center', marginTop: 2}}>Vezi Profilul</Text>
          </TouchableOpacity>
          <View style={{width: 28}} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator color={NEON_GREEN} /></View>
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

        {/* INPUT NORMAL */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput} placeholder="Scrie un mesaj..." placeholderTextColor="#666"
              value={inputText} onChangeText={setInputText} multiline
            />
            <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={sendMessage} disabled={!inputText.trim()}>
              <Send color="#000" size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* MODAL PENTRU EDITARE */}
        <Modal visible={editingMessage !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editează mesajul</Text>
                <TouchableOpacity onPress={() => setEditingMessage(null)}><X color="#666" size={24}/></TouchableOpacity>
              </View>
              <TextInput 
                style={[styles.textInput, { backgroundColor: '#222', minHeight: 50 }]}
                value={editInput} onChangeText={setEditInput} multiline autoFocus
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Text style={{color: '#000', fontWeight: 'bold'}}>Salvează modificarea</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
  
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginBottom: 12 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: NEON_GREEN, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#333' },
  messageText: { fontSize: 16 },
  myMessageText: { color: '#000', fontWeight: '500' },
  theirMessageText: { color: '#FFF' },
  
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10, fontWeight: 'bold' },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 15, backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: '#222' },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', minHeight: 45, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  sendBtn: { backgroundColor: NEON_GREEN, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161616', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  saveBtn: { backgroundColor: NEON_GREEN, padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 15 }
});