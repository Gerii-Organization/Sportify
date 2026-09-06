import { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react-native';
import { colors } from '../theme';
import { GOALS } from '../constants/content';


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

      if (signUpError) Alert.alert('Error', signUpError.message);
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
          // signUp already returns an active session when email confirmation is
          // off, so send the user straight in instead of making them retype
          // the credentials they just chose.
          navigation.goBack();
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

        <TouchableOpacity accessibilityLabel="Close" activeOpacity={0.7} style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <X color={colors.text} size={32} />
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
                    <TouchableOpacity activeOpacity={0.7}
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

            <TouchableOpacity activeOpacity={0.7} style={styles.mainButton} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.mainButtonText}>{isRegistering ? 'Create Account' : 'Log In'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.switchButton} onPress={toggleAuthMode}>
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
        placeholderTextColor={colors.textFaint} secureTextEntry={secure} autoCapitalize={autoCap || 'sentences'} keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 20, padding: 6 },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 30, padding: 26 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 26, textAlign: 'center' },
  sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '600', marginBottom: 10, marginTop: 10 },
  goalContainer: { flexDirection: 'row', marginBottom: 20 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 10 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.onAccent },
  inputContainer: { marginBottom: 20 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 10, fontWeight: '600', marginLeft: 6 },
  input: { backgroundColor: colors.surface, color: colors.text, padding: 16, borderRadius: 14, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  mainButton: { backgroundColor: colors.accent, padding: 20, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  mainButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 17 },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: colors.textSecondary, fontSize: 15 },
  divider: { height: 1, backgroundColor: colors.surfaceHigh, marginVertical: 20 }
});