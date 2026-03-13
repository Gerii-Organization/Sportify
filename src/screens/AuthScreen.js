import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, SafeAreaView 
} from 'react-native';

export default function AuthScreen({ onManualLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (email.toLowerCase().trim() === 'vic@gmail.com' && password === 'vic') {
      onManualLogin();
    } else {
      Alert.alert('Eroare', 'Date incorecte! Folosește vic@gmail.com și parola vic');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>Fitness App</Text>
        <Text style={styles.subtitle}>Mod Testare Activat 🛠️</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email (vic@gmail.com)"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Parolă (vic)"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>INTRĂ ÎN DASHBOARD</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Login rapid: vic@gmail.com / vic
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  logo: { fontSize: 40, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#00FF41', textAlign: 'center', marginBottom: 40 },
  form: { width: '100%' },
  input: { 
    backgroundColor: '#1E1E1E', 
    color: '#fff', 
    padding: 18, 
    borderRadius: 12, 
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  button: { 
    backgroundColor: '#007AFF', 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 10 
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  footer: { color: '#666', textAlign: 'center', marginTop: 30, fontSize: 12 }
});