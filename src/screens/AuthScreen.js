import { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientGlow from '../components/AmbientGlow';
import { supabase } from '../lib/supabase';
import { X, ChevronLeft } from 'lucide-react-native';
import { colors, gradients } from '../theme';
import { GOALS } from '../constants/content';
import { SIGNUP_STEPS, WEEKLY_OPTIONS } from '../constants/onboarding';
import SplitPicker from '../components/SplitPicker';


export default function AuthScreen({ navigation }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Position in the sign-up flow. Login is one screen and ignores this. */
  const [step, setStep] = useState(0);
  /** Validation message for the current step, shown under the fields. */
  const [stepError, setStepError] = useState(null);

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
  const [split, setSplit] = useState([]);

  const toggleAuthMode = () => {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFirstName(''); setSex(''); setAge(''); setWeight('');
    setHeight(''); setWorkouts(''); setGoal(''); setSplit([]);
    setStep(0); setStepError(null);
    setIsRegistering(!isRegistering);
  };

  /** Everything the step validators read, in one object. */
  const form = { email, password, confirmPassword, firstName, age, sex, weight, height, workouts, goal, split };

  const goNext = () => {
    const error = SIGNUP_STEPS[step].validate(form);
    if (error) return setStepError(error);

    setStepError(null);
    if (step < SIGNUP_STEPS.length - 1) setStep(step + 1);
    else handleAuth();
  };

  const goBack = () => {
    setStepError(null);
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  const handleAuth = async () => {
    // Registration is validated step by step on the way here, so this only has
    // to cover the login path — two fields, one screen, no steps.
    if (!isRegistering && (!email.trim() || !password)) {
      return Alert.alert('Error', 'Email and password are required.');
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
          // Null rather than an empty array when skipped: the advice code tests
          // for a split's presence, and [] would read as "has one, it is empty".
          split: split.length ? split : null,
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
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      <AmbientGlow tone="ember" height={320} intensity={0.42} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Back one step, or out of the flow from the first one. Closing from
            step four and losing four answers is the worst thing this screen
            could do. */}
        <TouchableOpacity
          accessibilityLabel={isRegistering && step > 0 ? 'Previous step' : 'Close'}
          activeOpacity={0.7}
          style={styles.closeBtn}
          onPress={isRegistering ? goBack : () => navigation.goBack()}
        >
          {isRegistering && step > 0
            ? <ChevronLeft color={colors.text} size={32} />
            : <X color={colors.text} size={32} />}
        </TouchableOpacity>

        <View style={styles.card}>
          {isRegistering ? (
            <>
              {/* A bar rather than a count: "step 3 of 5" is a number to read,
                  a filled bar is understood without reading. */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((step + 1) / SIGNUP_STEPS.length) * 100}%` }]} />
              </View>

              <Text style={styles.title}>{SIGNUP_STEPS[step].title}</Text>
              <Text style={styles.note}>{SIGNUP_STEPS[step].note}</Text>

              <View style={styles.form}>
                {step === 0 && (
                  <>
                    <CustomInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" autoCap="none" keyboard="email-address" />
                    <CustomInput label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" secure />
                    <CustomInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Type it again" secure />
                  </>
                )}

                {step === 1 && (
                  <View style={styles.goalGrid}>
                    {GOALS.map((g) => (
                      <TouchableOpacity
                        key={g.id}
                        activeOpacity={0.7}
                        style={[styles.goalCard, goal === g.id && styles.goalCardActive]}
                        onPress={() => { setGoal(g.id); setStepError(null); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: goal === g.id }}
                      >
                        <Text style={[styles.goalText, goal === g.id && styles.goalTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {step === 2 && (
                  <>
                    <CustomInput label="First name" value={firstName} onChange={setFirstName} placeholder="Victor" />
                    <CustomInput label="Age" value={age} onChange={setAge} placeholder="25" keyboard="numeric" />
                    <Text style={styles.label}>Sex</Text>
                    <View style={styles.pickRow}>
                      {[['M', 'Male'], ['F', 'Female']].map(([value, label]) => (
                        <TouchableOpacity
                          key={value}
                          activeOpacity={0.7}
                          style={[styles.pick, sex === value && styles.pickActive]}
                          onPress={() => { setSex(value); setStepError(null); }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sex === value }}
                        >
                          <Text style={[styles.pickText, sex === value && styles.pickTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {step === 3 && (
                  <>
                    <CustomInput label="Weight (kg)" value={weight} onChange={setWeight} placeholder="80" keyboard="numeric" />
                    <CustomInput label="Height (cm)" value={height} onChange={setHeight} placeholder="185" keyboard="numeric" />
                  </>
                )}

                {step === 5 && (
                  <SplitPicker value={split} perWeek={workouts} onChange={setSplit} />
                )}

                {step === 4 && (
                  <View style={styles.weekRow}>
                    {WEEKLY_OPTIONS.map((n) => (
                      <TouchableOpacity
                        key={n}
                        activeOpacity={0.7}
                        style={[styles.weekPick, String(n) === workouts && styles.weekPickActive]}
                        onPress={() => { setWorkouts(String(n)); setStepError(null); }}
                        accessibilityLabel={`${n} workouts per week`}
                        accessibilityState={{ selected: String(n) === workouts }}
                      >
                        <Text style={[styles.weekText, String(n) === workouts && styles.weekTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {stepError ? <Text style={styles.error}>{stepError}</Text> : null}

                <TouchableOpacity activeOpacity={0.7} style={styles.mainButton} onPress={goNext} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={colors.onAccent} />
                    : <Text style={styles.mainButtonText}>
                        {step === SIGNUP_STEPS.length - 1 ? 'Create account' : 'Continue'}
                      </Text>}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.switchButton} onPress={toggleAuthMode}>
                  <Text style={styles.switchText}>Already have an account? Log in</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Welcome back</Text>
              <View style={styles.form}>
                <CustomInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" autoCap="none" keyboard="email-address" />
                <CustomInput label="Password" value={password} onChange={setPassword} placeholder="******" secure />

                <TouchableOpacity activeOpacity={0.7} style={styles.mainButton} onPress={handleAuth} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.mainButtonText}>Log in</Text>}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.switchButton} onPress={toggleAuthMode}>
                  <Text style={styles.switchText}>Don't have an account? Sign up for free</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginBottom: 24 },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: -14, marginBottom: 24 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginBottom: 4 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  goalCard: {
    width: '48%', flexGrow: 1, backgroundColor: colors.surface,
    borderRadius: 18, paddingVertical: 22, alignItems: 'center',
  },
  goalCardActive: { backgroundColor: colors.accent },
  goalText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  goalTextActive: { color: colors.onAccent },

  pickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pick: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  pickActive: { backgroundColor: colors.accent },
  pickText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  pickTextActive: { color: colors.onAccent },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 10 },
  weekPick: { flex: 1, aspectRatio: 1, backgroundColor: colors.surface, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  weekPickActive: { backgroundColor: colors.accent },
  weekText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  weekTextActive: { color: colors.onAccent },
  inputContainer: { marginBottom: 20 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 10, fontWeight: '600', marginLeft: 6 },
  input: { backgroundColor: colors.surface, color: colors.text, padding: 16, borderRadius: 14, fontSize: 15 },
  mainButton: { backgroundColor: colors.accent, padding: 20, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  mainButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 17 },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: colors.textSecondary, fontSize: 15 },
});