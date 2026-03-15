import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react-native';

const NEON_GREEN = '#1ED760';

const GOALS = [
  { id: 'lose_weight', label: 'Slabire' },
  { id: 'build_muscle', label: 'Masa musculara' },
  { id: 'maintain', label: 'Mentinere' },
  { id: 'gain_strength', label: 'Forta' }
];

export default function AuthScreen({ navigation }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [workouts, setWorkouts] = useState('');
  const [goal, setGoal] = useState('');

  const toggleAuthMode = () => {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFirstName(''); setSex(''); setAge(''); setWeight('');
    setHeight(''); setWorkouts(''); setGoal('');
    setIsRegistering(!isRegistering);
  };

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert('Eroare', 'Emailul și parola sunt obligatorii.');
    if (isRegistering) {
      if (!firstName || !age || !sex || !weight || !height || !workouts || !goal) {
        return Alert.alert('Câmpuri incomplete', 'Te rugăm să completezi toate datele și să alegi un obiectiv.');
      }

      if (password.length < 6) {
        return Alert.alert('Format invalid', 'Parola trebuie să conțină minimum 6 caractere.');
      }
      if (password !== confirmPassword) {
        return Alert.alert('Eroare', 'Parolele nu coincid!');
      }

      const parsedAge = parseInt(age);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 100) {
        return Alert.alert('Format invalid', 'Vârsta trebuie să fie între 1 și 100 de ani.');
      }

      const upperSex = sex.trim().toUpperCase();
      if (upperSex !== 'M' && upperSex !== 'F') {
        return Alert.alert('Format invalid', 'Sexul introdus trebuie să fie DOAR "M" sau "F".');
      }

      const parsedHeight = parseFloat(height);
      if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 210) {
        return Alert.alert('Format invalid', 'Înălțimea trebuie să fie între 100 și 210 cm.');
      }

      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
        return Alert.alert('Format invalid', 'Te rugăm să introduci o greutate validă (în kg).');
      }

      const parsedWorkouts = parseInt(workouts);
      if (isNaN(parsedWorkouts) || parsedWorkouts < 1 || parsedWorkouts > 7) {
        return Alert.alert('Format invalid', 'Numărul de antrenamente pe săptămână trebuie să fie între 1 și 7.');
      }
    }

    setLoading(true);

    if (isRegistering) {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });

      if (signUpError) Alert.alert('Eroare', signUpError.message);
      else if (user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          first_name: firstName.trim(),
          sex: sex.trim().toUpperCase(),
          age: parseInt(age),
          weight: parseFloat(weight),
          height: parseFloat(height),
          workouts_per_week: parseInt(workouts),
          goal: goal,
        });

        if (profileError) Alert.alert('Eroare Profil', profileError.message);
        else {
          Alert.alert('Succes', 'Cont creat! Acum te poți loga.');
          toggleAuthMode();
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      
      if (error) Alert.alert('Eroare', error.message);
      else {
        navigation.goBack();
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <X color="#FFF" size={32} />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>{isRegistering ? 'Hai să începem' : 'Bine ai revenit'}</Text>

          <View style={styles.form}>
            <CustomInput label="Email" value={email} onChange={setEmail} placeholder="vic@test.com" autoCap="none" />
            <CustomInput label="Parolă" value={password} onChange={setPassword} placeholder="******" secure />

            {isRegistering && (
              <>
                <CustomInput label="Confirmă Parola" value={confirmPassword} onChange={setConfirmPassword} placeholder="******" secure />
                
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Obiectivul Tău</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalContainer}>
                  {GOALS.map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.chip, goal === g.id && styles.chipActive]}
                      onPress={() => setGoal(g.id)}
                    >
                      <Text style={[styles.chipText, goal === g.id && styles.chipTextActive]}>{g.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionTitle}>Detalii Personale</Text>
                
                <CustomInput label="Prenume" value={firstName} onChange={setFirstName} placeholder="Victor" />
                
                <View style={styles.row}>
                   <View style={{flex: 1}}>
                     <CustomInput label="Vârstă (1-100)" value={age} onChange={setAge} placeholder="25" keyboard="numeric" />
                   </View>
                   <View style={{width: 15}} />
                   <View style={{flex: 1}}>
                     <CustomInput label="Sex (M/F)" value={sex} onChange={setSex} placeholder="M" autoCap="characters" />
                   </View>
                </View>

                <View style={styles.row}>
                   <View style={{flex: 1}}>
                     <CustomInput label="Greutate (kg)" value={weight} onChange={setWeight} placeholder="80" keyboard="numeric" />
                   </View>
                   <View style={{width: 15}} />
                   <View style={{flex: 1}}>
                     <CustomInput label="Înălțime (cm)" value={height} onChange={setHeight} placeholder="185" keyboard="numeric" />
                   </View>
                </View>

                <CustomInput label="Antrenamente / săptămână (1-7)" value={workouts} onChange={setWorkouts} placeholder="4" keyboard="numeric" />
              </>
            )}

            <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.mainButtonText}>{isRegistering ? 'Creează Cont' : 'Autentificare'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchButton} onPress={toggleAuthMode}>
              <Text style={styles.switchText}>{isRegistering ? 'Ai deja cont? Loghează-te' : 'Nu ai cont? Înregistrează-te gratuit'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CustomInput({ label, value, onChange, placeholder, secure, autoCap, keyboard }) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="#444" secureTextEntry={secure} autoCapitalize={autoCap || 'sentences'} keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 20, padding: 5 },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  card: { backgroundColor: '#121212', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: '#222' },
  title: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  sectionTitle: { color: NEON_GREEN, fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  goalContainer: { flexDirection: 'row', marginBottom: 20 },
  chip: { backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: NEON_GREEN, borderColor: NEON_GREEN },
  chipText: { color: '#888', fontWeight: 'bold' },
  chipTextActive: { color: '#000' },
  inputContainer: { marginBottom: 18 },
  label: { color: '#888', fontSize: 12, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
  input: { backgroundColor: '#1A1A1A', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  mainButton: { backgroundColor: NEON_GREEN, padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  mainButtonText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#888', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 20 }
});