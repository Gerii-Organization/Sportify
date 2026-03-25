import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Check, CheckCheck, X, MoreVertical, ImageIcon, User, Crown } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker'; // 🔴 Pachetul nou

const NEON_GREEN = '#1ED760';
const CARD_BG = '#121212';

const AVATAR_THEMES = {
  'a1': { color: '#1ED760', type: 'standard' }, 'a2': { color: '#FFD700', type: 'royal' },
  'a3': { color: '#9900FF', type: 'demon' }, 'a4': { color: '#FF00FF', type: 'glitch' },
};

export default function ChatScreen({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const [myId, setMyId] = useState(null);
  const [friendProfile, setFriendProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [editingMessage, setEditingMessage] = useState(null);
  const [editInput, setEditInput] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    let subscription;
    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // Aducem profilul prietenului pentru poză
      const { data: fProfile } = await supabase.from('profiles').select('*').eq('id', friendId).single();
      setFriendProfile(fProfile);

      const { data: initialMessages } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (initialMessages) {
        setMessages(initialMessages);
        markUnreadAsSeen(initialMessages, user.id);
      }
      setLoading(false);

      subscription = supabase.channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            if (payload.eventType === 'INSERT' && payload.new.sender_id === friendId) {
                setMessages(prev => [...prev, payload.new]);
                supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then();
            }
            if (payload.eventType === 'UPDATE') {
                setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
            }
        }).subscribe();
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

  // 🔴 FUNCȚIA DE TRIMIS POZE
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

        // Luăm URL-ul public
        const { data } = supabase.storage.from('chat_images').getPublicUrl(filePath);
        await sendMessage(data.publicUrl); // Trimitem mesajul cu poza

      } catch (e) { Alert.alert("Eroare", "Nu s-a putut încărca imaginea: " + e.message); }
      setLoading(false);
    }
  };

  const handleLongPress = (item) => {
    if (item.sender_id !== myId || item.is_deleted) return;
    Alert.alert("Acțiuni", "Alege ce vrei să faci", [
        { text: "Editează textul", onPress: () => { setEditingMessage(item); setEditInput(item.content); } },
        { text: "Șterge", onPress: () => deleteMessage(item.id), style: "destructive" },
        { text: "Anulează", style: "cancel" }
    ]);
  };

  const deleteMessage = async (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true } : m));
    await supabase.from('messages').update({ is_deleted: true, content: 'Acest mesaj a fost șters', image_url: null }).eq('id', id);
  };

  const saveEdit = async () => {
    if (!editInput.trim()) return;
    setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editInput.trim(), is_edited: true } : m));
    await supabase.from('messages').update({ content: editInput.trim(), is_edited: true }).eq('id', editingMessage.id);
    setEditingMessage(null);
  };

  const showMoreOptions = () => {
    Alert.alert("Opțiuni Chat", "Aceste funcții vor fi disponibile în curând:", [
      { text: "Schimbă Fundalul" }, { text: "Caută în conversație" }, { text: "Media & Linkuri" }, { text: "Închide", style: "cancel" }
    ]);
  };

  const renderMiniAvatar = () => {
    if (!friendProfile) return <View style={[styles.avatarBase, { width: 36, height: 36, borderRadius: 18 }]}><User size={18} color="#888"/></View>;
    const theme = AVATAR_THEMES[friendProfile.equipped_avatar] || AVATAR_THEMES['a1'];
    return (
      <View style={[styles.avatarBase, { width: 36, height: 36, borderRadius: 18, borderColor: theme.color, borderWidth: 1, marginRight: 10 }]}>
        <User size={18} color={theme.type === 'glitch' ? '#00EAFF' : theme.color} />
      </View>
    );
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === myId;
    return (
      <TouchableOpacity 
        style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, item.is_deleted && { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' }]}
        onLongPress={() => handleLongPress(item)} activeOpacity={0.8} delayLongPress={300}
      >
        {item.is_deleted ? (
          <Text style={{ color: '#666', fontStyle: 'italic', fontSize: 15 }}>🚫 Acest mesaj a fost șters</Text>
        ) : (
          <>
            {/* Afișăm imaginea dacă există */}
            {item.image_url && <Image source={{uri: item.image_url}} style={styles.chatImage} />}
            {item.content ? <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>{item.content}</Text> : null}
          </>
        )}

        <View style={styles.messageFooter}>
          <Text style={[styles.timeText, isMe ? {color: 'rgba(0,0,0,0.6)'} : {color: '#666'}]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {item.is_edited && !item.is_deleted && '(editat)'}
          </Text>
          {/* 🔴 Bifa Albastră Mărită */}
          {isMe && !item.is_deleted && (
            <View style={{ marginLeft: 5 }}>
              {item.is_read ? <CheckCheck size={18} color="#3b82f6" /> : <Check size={16} color="rgba(0,0,0,0.5)" />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#000000', '#0a0a0a']} style={styles.gradientBg}>
        
        {/* HEADER CENTRAT */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft color="#FFF" size={28} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate('PublicProfileScreen', { userId: friendId })}>
            {renderMiniAvatar()}
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerName}>{friendName}</Text>
              <Text style={{color: NEON_GREEN, fontSize: 10, marginTop: 2}}>Vezi Profilul</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={showMoreOptions} style={styles.headerBtn}>
            <MoreVertical color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}><ActivityIndicator color={NEON_GREEN} /></View>
        ) : (
          <FlatList
            ref={flatListRef} data={messages} keyExtractor={(item) => item.id.toString()} renderItem={renderMessage}
            contentContainerStyle={styles.chatList} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* INPUT AREA CU BUTON PENTRU POZE */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickAndSendImage}>
              <ImageIcon color="#888" size={24} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput} placeholder="Mesaj..." placeholderTextColor="#666"
              value={inputText} onChangeText={setInputText} multiline
            />
            <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!inputText.trim()}>
              <Send color="#000" size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* MODAL EDITARE */}
        <Modal visible={editingMessage !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editează mesajul</Text>
                <TouchableOpacity onPress={() => setEditingMessage(null)}><X color="#666" size={24}/></TouchableOpacity>
              </View>
              <TextInput style={[styles.textInput, { backgroundColor: '#222', minHeight: 50 }]} value={editInput} onChangeText={setEditInput} multiline autoFocus />
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}><Text style={{color: '#000', fontWeight: 'bold'}}>Salvează</Text></TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 15, backgroundColor: '#121212', borderBottomWidth: 1, borderBottomColor: '#222' },
  headerBtn: { padding: 5, width: 40, alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  avatarBase: { backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 15, flexGrow: 1, justifyContent: 'flex-end' },
  
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginBottom: 12 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: NEON_GREEN, borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#333' },
  messageText: { fontSize: 16, marginTop: 4 },
  myMessageText: { color: '#000', fontWeight: '500' },
  theirMessageText: { color: '#FFF' },
  chatImage: { width: 200, height: 200, borderRadius: 15, marginBottom: 5, backgroundColor: 'rgba(0,0,0,0.1)' },
  
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10, fontWeight: 'bold' },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: '#222' },
  attachBtn: { padding: 12, marginRight: 5, marginBottom: 2 },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', minHeight: 45, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  sendBtn: { backgroundColor: NEON_GREEN, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161616', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  saveBtn: { backgroundColor: NEON_GREEN, padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 15 }
});