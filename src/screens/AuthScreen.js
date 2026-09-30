import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientGlow from '../components/AmbientGlow';
import { supabase } from '../lib/supabase';
import { X, ChevronLeft } from 'lucide-react-native';
import { colors, gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import { fromInputWeight, fromInputHeight, weightLabel, heightLabel } from '../lib/units';
import { track, EVENTS } from '../lib/analytics';
import { uploadPickedImage, pickImage } from '../lib/upload';
import { Camera } from 'lucide-react-native';
import { Image } from 'react-native';
import { GOALS } from '../constants/content';
import { SIGNUP_STEPS, WEEKLY_OPTIONS, STEP_GOAL_OPTIONS, DEFAULT_STEP_GOAL } from '../constants/onboarding';
import { parseBirthDate, ageOn } from '../lib/birthday';
import BirthDateInput from '../components/BirthDateInput';
import SplitPicker from '../components/SplitPicker';
import { useT } from '../i18n';
import { normaliseCode, REDEEM_ERRORS } from '../lib/invites';
import { getSetting, setSetting } from '../lib/settings';
import { authErrorMessage } from '../lib/authErrors';


export default function AuthScreen({ navigation, route }) {
  const { t } = useT();
  const { user: signedInUser, units, setUnits } = useAuth();
  // Opened from an invite link: straight to sign-up, code filled in.
  const [isRegistering, setIsRegistering] = useState(!!route?.params?.inviteCode);
  const [inviteCode, setInviteCode] = useState(route?.params?.inviteCode || '');
  useEffect(() => {
    if (inviteCode) return;
    getSetting('pendingInvite').then((code) => { if (code) setInviteCode(code); });
    // Once, on open: the stored code only fills an empty box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  /** Position in the sign-up flow. Login is one screen and ignores this. */
  const [step, setStep] = useState(0);
  /** Validation message for the current step, shown under the fields. */
  const [stepError, setStepError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  /** Chosen during sign-up, uploaded after the account exists — there is no
   *  user id to store it under until signUp returns. */
  const [avatarUri, setAvatarUri] = useState(null);
  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState({ day: '', month: '', year: '' });
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [workouts, setWorkouts] = useState('');
  const [goal, setGoal] = useState('');
  const [split, setSplit] = useState([]);
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);

  const toggleAuthMode = () => {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFirstName(''); setSex(''); setBirthDate({ day: '', month: '', year: '' }); setWeight(''); setAvatarUri(null);
    setHeight(''); setWorkouts(''); setGoal(''); setSplit([]); setStepGoal(DEFAULT_STEP_GOAL);
    setStep(0); setStepError(null);
    setIsRegistering(!isRegistering);
  };

  /** Everything the step validators read, in one object. */
  const form = { email, password, confirmPassword, firstName, birthDate, sex, weight, height, workouts, goal, split, stepGoal };
  /** Which question is on screen, by name: steps can be added without renumbering. */
  const current = SIGNUP_STEPS[step].id;

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

  /** An auth failure as a sentence, with a way to the login screen when that is the answer. */
  const showAuthError = (error) => {
    const { title, message, action } = authErrorMessage(error);
    Alert.alert(title, message, action === 'login'
      ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Log in', onPress: () => { toggleAuthMode(); setEmail(email); } }]
      : undefined);
  };

  const handleAuth = async () => {
    if (loading) return;
    // Registration is validated step by step on the way here, so this only has
    // to cover the login path — two fields, one screen, no steps.
    if (!isRegistering && (!email.trim() || !password)) {
      return Alert.alert('Email and password needed', 'Enter both to log in.');
    }

    setLoading(true);

    if (isRegistering) {
      // A second tap on "Create account" after the profile failed to save: the
      // account already exists and is signed in. Signing up again answered
      // "User already registered" and there was no way forward.
      let user = signedInUser;
      if (!user) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) {
          setLoading(false);
          return showAuthError(signUpError);
        }
        user = data?.user;
      }

      if (user) {
        const birth = parseBirthDate(birthDate);
        const details = {
          first_name: firstName.trim(),
          sex: sex.trim().toUpperCase(),
          // The age is derived from the date (also by a trigger), and kept for
          // anything that still reads the column.
          birth_date: birth,
          age: ageOn(birth),
          step_goal: stepGoal,
          // Stored metric whatever the boxes said, like everywhere else.
          weight: fromInputWeight(weight, units),
          height: fromInputHeight(height, units),
          workouts_per_week: parseInt(workouts),
          goal: goal,
          // Null rather than an empty array when skipped: the advice code tests
          // for a split's presence, and [] would read as "has one, it is empty".
          split: split.length ? split : null,
        };
        let { error: profileError } = await supabase.from('profiles').insert({ id: user.id, ...details });
        // On the retry the row may already be there. Not an upsert: that also
        // writes `id`, which the column grants refuse to anyone signed in.
        if (profileError?.code === '23505') {
          ({ error: profileError } = await supabase.from('profiles').update(details).eq('id', user.id));
        }

        if (profileError) {
          Alert.alert(
            'Your profile was not saved',
            'Your account is ready, but your details did not reach us. Check your connection and tap Create account again.',
          );
        } else {
          // After the profile row exists, and deliberately not awaited into the
          // failure path: an account that was created should not look like it
          // failed because a photo upload did.
          if (avatarUri) {
            uploadPickedImage({
              uri: avatarUri,
              bucket: 'avatars',
              pathPrefix: `${user.id}/avatar`,
              maxWidth: 512,
            })
              .then((url) => url && supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id))
              .catch(() => {});
          }

          // Whether the sign-up flow is too long is the first thing worth
          // knowing. Counts only — how many steps, whether a split was picked.
          track(EVENTS.onboardingFinished, {
            units,
            picked_split: split.length > 0,
            workouts_per_week: parseInt(workouts),
          });

          // Redeemed after the profile exists, and never blocking: a bad code
          // should not stand between someone and the account they just made.
          if (inviteCode) {
            const { data: redeemed } = await supabase.rpc('redeem_invite', { p_code: inviteCode });
            setSetting('pendingInvite', null);
            if (redeemed && !redeemed.ok && REDEEM_ERRORS[redeemed.reason]) {
              Alert.alert('Invite code not applied', REDEEM_ERRORS[redeemed.reason]);
            }
          }

          // signUp already returns an active session when email confirmation is
          // off, so send the user straight in instead of making them retype
          // the credentials they just chose.
          navigation.goBack();
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) showAuthError(error);
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

              <Text style={styles.title}>{t(SIGNUP_STEPS[step].title)}</Text>
              <Text style={styles.note}>{t(SIGNUP_STEPS[step].note)}</Text>

              <View style={styles.form}>
                {current === 'account' && (
                  <>
                    <CustomInput label={t('Email')} value={email} onChange={setEmail} placeholder="you@example.com" autoCap="none" keyboard="email-address" kind="email" />
                    <CustomInput label={t('Password')} value={password} onChange={setPassword} placeholder={t('At least 6 characters')} secure kind="newPassword" />
                    <CustomInput label={t('Confirm password')} value={confirmPassword} onChange={setConfirmPassword} placeholder={t('Type it again')} secure kind="newPassword" />
                    <CustomInput label={t('Invite code (optional)')} value={inviteCode} onChange={(text) => setInviteCode(normaliseCode(text))} placeholder={t('From a friend')} autoCap="characters" />
                  </>
                )}

                {current === 'goal' && (
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

                {current === 'about' && (
                  <>
                    {/* Optional, and said so. A required photo at sign-up is a
                        reason to close the app. */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.photoPick}
                      onPress={async () => {
                        const uri = await pickImage({ aspect: [1, 1] });
                        if (uri) setAvatarUri(uri);
                      }}
                      accessibilityLabel={avatarUri ? 'Change your photo' : 'Add a photo, optional'}
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.photoPreview} />
                      ) : (
                        <View style={styles.photoEmpty}>
                          <Camera color={colors.textMuted} size={22} />
                        </View>
                      )}
                      <Text style={styles.photoLabel}>
                        {avatarUri ? 'Change photo' : 'Add a photo · optional'}
                      </Text>
                    </TouchableOpacity>

                    <CustomInput label={t('First name')} value={firstName} onChange={setFirstName} placeholder="Alex" kind="givenName" />
                    <Text style={styles.label}>{t('Date of birth')}</Text>
                    <View style={styles.birthRow}>
                      <BirthDateInput value={birthDate} onChange={(next) => { setBirthDate(next); setStepError(null); }} />
                    </View>
                    <Text style={styles.label}>{t('Sex')}</Text>
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

                {current === 'body' && (
                  <>
                    {/* Guessed from the device region, and switchable right
                        here — someone typing 185 into a box labelled kg is a
                        wrong weight in the database forever. */}
                    <View style={styles.unitRow}>
                      {['metric', 'imperial'].map((option) => {
                        const active = units === option;
                        return (
                          <TouchableOpacity
                            key={option}
                            activeOpacity={0.8}
                            style={[styles.unitChip, active && styles.unitChipOn]}
                            onPress={() => setUnits(option)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text style={[styles.unitChipText, active && styles.unitChipTextOn]}>
                              {option === 'imperial' ? 'lb / ft' : 'kg / cm'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <CustomInput
                      label={`Weight (${weightLabel(units)})`}
                      value={weight} onChange={setWeight}
                      placeholder={units === 'imperial' ? '175' : '80'}
                      keyboard="decimal-pad"
                    />
                    <CustomInput
                      label={`Height (${heightLabel(units)})`}
                      value={height} onChange={setHeight}
                      placeholder={units === 'imperial' ? '73' : '185'}
                      keyboard="decimal-pad"
                    />
                  </>
                )}

                {current === 'split' && (
                  <SplitPicker value={split} perWeek={workouts} onChange={setSplit} />
                )}

                {current === 'commitment' && (
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

                {current === 'steps' && (
                  <View style={styles.stepList}>
                    {STEP_GOAL_OPTIONS.map((n) => {
                      const active = stepGoal === n;
                      return (
                        <TouchableOpacity
                          key={n}
                          activeOpacity={0.7}
                          style={[styles.stepOption, active && styles.stepOptionActive]}
                          onPress={() => { setStepGoal(n); setStepError(null); }}
                          accessibilityRole="button"
                          accessibilityLabel={t('{steps} steps a day', { steps: n.toLocaleString() })}
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.stepValue, active && styles.stepValueActive]}>{n.toLocaleString()}</Text>
                          <Text style={[styles.stepHint, active && styles.stepHintActive]}>{t(STEP_GOAL_HINTS[n])}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {stepError ? <Text style={styles.error}>{t(stepError)}</Text> : null}

                <TouchableOpacity activeOpacity={0.7} style={styles.mainButton} onPress={goNext} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={colors.onAccent} />
                    : <Text style={styles.mainButtonText}>
                        {step === SIGNUP_STEPS.length - 1 ? t('Create account') : t('Continue')}
                      </Text>}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.switchButton} onPress={toggleAuthMode}>
                  <Text style={styles.switchText}>{t('Already have an account? Log in')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('Welcome back')}</Text>
              <View style={styles.form}>
                <CustomInput label={t('Email')} value={email} onChange={setEmail} placeholder="you@example.com" autoCap="none" keyboard="email-address" kind="email" />
                <CustomInput label={t('Password')} value={password} onChange={setPassword} placeholder="••••••" secure kind="password" onSubmit={handleAuth} />

                <TouchableOpacity activeOpacity={0.7} style={styles.mainButton} onPress={handleAuth} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.mainButtonText}>{t('Log in')}</Text>}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.switchButton} onPress={toggleAuthMode}>
                  <Text style={styles.switchText}>{t("Don't have an account? Sign up for free")}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One line under each step goal, so the numbers mean something. */
const STEP_GOAL_HINTS = {
  5000: 'An easy start',
  7500: 'Most days active',
  10000: 'The classic goal',
  12500: 'Very active',
  15000: 'On your feet all day',
};

/**
 * What each field is, told to the system: iOS and Android offer saved logins
 * for `email`/`password`, suggest a strong password for `newPassword`, and
 * fill a name for `givenName`. Without it every login was typed by hand.
 */
const AUTOFILL = {
  email: { textContentType: 'username', autoComplete: 'email', autoCorrect: false },
  password: { textContentType: 'password', autoComplete: 'current-password', autoCorrect: false },
  newPassword: { textContentType: 'newPassword', autoComplete: 'new-password', autoCorrect: false, passwordRules: 'minlength: 6;' },
  givenName: { textContentType: 'givenName', autoComplete: 'given-name' },
};

function CustomInput({ label, value, onChange, placeholder, secure, autoCap, keyboard, kind, onSubmit }) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.textFaint} secureTextEntry={secure} autoCapitalize={autoCap || 'sentences'} keyboardType={keyboard || 'default'}
        accessibilityLabel={label}
        returnKeyType={onSubmit ? 'go' : 'next'}
        onSubmitEditing={onSubmit}
        {...(kind ? AUTOFILL[kind] : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photoPick: { alignItems: 'center', marginBottom: 22 },
  photoPreview: { width: 84, height: 84, borderRadius: 42 },
  photoEmpty: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 10 },

  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  unitChip: {
    flex: 1, paddingVertical: 11, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  unitChipOn: { backgroundColor: colors.accent },
  unitChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  unitChipTextOn: { color: colors.onAccent, fontWeight: '700' },
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

  birthRow: { marginBottom: 20 },
  stepList: { gap: 8, marginBottom: 10 },
  stepOption: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
  },
  stepOptionActive: { backgroundColor: colors.accent },
  stepValue: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stepValueActive: { color: colors.onAccent },
  stepHint: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  stepHintActive: { color: colors.onAccent },
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