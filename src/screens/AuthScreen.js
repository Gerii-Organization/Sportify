import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react-native';

const NEON_GREEN = '#1ED760';

const GOALS = [
  { id: 'lose_weight', label: 'Fat Loss' },
  { id: 'build_muscle', label: 'Muscle Gain' },
  { id: 'maintain', label: 'Maintenance' },
  { id: 'gain_strength', label: 'Strength' }
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
    if (!email || !password) return Alert.alert('Error', 'Email and password are required.');
    if (isRegistering) {
      if (!firstName || !age || !sex || !weight || !height || !workouts || !goal) {
        return Alert.alert('Missing fields', 'Please fill in all details and choose a goal.');
      }

      if (password.length < 6) {
        return Alert.alert('Invalid format', 'Password must be at least 6 characters long.');
      }
      if (password !== confirmPassword) {
        return Alert.alert('Error', 'Passwords do not match.');
      }

      const parsedAge = parseInt(age);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 100) {
        return Alert.alert('Invalid format', 'Age must be between 1 and 100.');
      }

      const upperSex = sex.trim().toUpperCase();
      if (upperSex !== 'M' && upperSex !== 'F') {
        return Alert.alert('Invalid format', 'Sex must be only "M" or "F".');
      }

      const parsedHeight = parseFloat(height);
      if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 210) {
        return Alert.alert('Invalid format', 'Height must be between 100 and 210 cm.');
      }

      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
        return Alert.alert('Invalid format', 'Please enter a valid weight (in kg).');
      }

      const parsedWorkouts = parseInt(workouts);
      if (isNaN(parsedWorkouts) || parsedWorkouts < 1 || parsedWorkouts > 7) {
        return Alert.alert('Invalid format', 'Workouts per week must be between 1 and 7.');
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

        if (profileError) Alert.alert('Profile Error', profileError.message);
        else {
          Alert.alert('Success', 'Account created! You can now log in.');
          toggleAuthMode();
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      
      if (error) Alert.alert('Error', error.message);
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
          <Text style={styles.title}>{isRegistering ? "Let's get started" : 'Welcome back'}</Text>

          <View style={styles.form}>
            <CustomInput label="Email" value={email} onChange={setEmail} placeholder="vic@test.com" autoCap="none" />
            <CustomInput label="Password" value={password} onChange={setPassword} placeholder="******" secure />

            {isRegistering && (
              <>
                <CustomInput label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="******" secure />
                
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Your Goal</Text>

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

                <Text style={styles.sectionTitle}>Personal Details</Text>
                
                <CustomInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Victor" />
                
                <View style={styles.row}>
                   <View style={{flex: 1}}>
                     <CustomInput label="Age (1-100)" value={age} onChange={setAge} placeholder="25" keyboard="numeric" />
                   </View>
                   <View style={{width: 15}} />
                   <View style={{flex: 1}}>
                     <CustomInput label="Sex (M/F)" value={sex} onChange={setSex} placeholder="M" autoCap="characters" />
                   </View>
                </View>

                <View style={styles.row}>
                   <View style={{flex: 1}}>
                     <CustomInput label="Weight (kg)" value={weight} onChange={setWeight} placeholder="80" keyboard="numeric" />
                   </View>
                   <View style={{width: 15}} />
                   <View style={{flex: 1}}>
                     <CustomInput label="Height (cm)" value={height} onChange={setHeight} placeholder="185" keyboard="numeric" />
                   </View>
                </View>

                <CustomInput label="Workouts / week (1-7)" value={workouts} onChange={setWorkouts} placeholder="4" keyboard="numeric" />
              </>
            )}

            <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.mainButtonText}>{isRegistering ? 'Create Account' : 'Log In'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchButton} onPress={toggleAuthMode}>
              <Text style={styles.switchText}>{isRegistering ? 'Already have an account? Log in' : "Don't have an account? Sign up for free"}</Text>
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