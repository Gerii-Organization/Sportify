import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, Vibration, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Minus, Plus, Pause, Play, RotateCcw, Timer } from 'lucide-react-native';
import { colors, gradients, spacing } from '../theme';
import {
  MODES, DEFAULTS, buildPlan, stateAt, totalSeconds, roundsIn, elapsedOf, formatClock, normaliseSettings,
} from '../lib/intervals';
import { schedule, cancel } from '../lib/notify';
import ProgressArc from '../components/ProgressArc';
import Button from '../components/Button';
import Press from '../components/Press';
import AmbientGlow from '../components/AmbientGlow';
import { useConfirm } from '../components/ConfirmDialog';

/**
 * EMOM, AMRAP and Tabata on one screen (roadmap T4).
 *
 * The rest timer between sets already existed; circuits had nothing, so people
 * ran a second app next to this one. The clock is lib/intervals.js — elapsed
 * time from a start timestamp, so locking the phone mid-round does not freeze it.
 *
 * Phase changes vibrate, with short pulses for the last three seconds, because
 * during a burpee nobody is looking at the screen. The end of the whole session
 * is also scheduled as a local notification, which is the only cue that still
 * arrives while the app is in the background.
 */

const MODE_INFO = {
  emom: { label: 'EMOM', blurb: 'Every minute on the minute: do the work, rest for what is left of the interval.' },
  amrap: { label: 'AMRAP', blurb: 'As many rounds as possible before the clock runs out. Tap +1 after each round.' },
  tabata: { label: 'Tabata', blurb: 'Short all-out bursts with short rests. Classic is 8 × 20 s on, 10 s off.' },
};

/** What each mode lets you change, and by how much per tap. */
const FIELDS = {
  emom: [
    { key: 'rounds', label: 'Rounds', step: 1, format: (v) => String(v) },
    { key: 'interval', label: 'Every', step: 15, format: formatClock },
  ],
  amrap: [{ key: 'minutes', label: 'Minutes', step: 1, format: (v) => String(v) }],
  tabata: [
    { key: 'rounds', label: 'Rounds', step: 1, format: (v) => String(v) },
    { key: 'work', label: 'Work', step: 5, format: (v) => `${v} s` },
    { key: 'rest', label: 'Rest', step: 5, format: (v) => `${v} s` },
  ],
};

const PHASE = {
  prep: { label: 'Get ready', tint: colors.textSecondary },
  work: { label: 'Work', tint: colors.streak },
  rest: { label: 'Rest', tint: colors.water },
};

export default function IntervalTimerScreen({ navigation }) {
  const confirmAction = useConfirm();
  const [mode, setMode] = useState('tabata');
  const [settings, setSettings] = useState(DEFAULTS);
  /** `{ startedAt, pausedAt, pausedMs }` while a session exists, else null. */
  const [clock, setClock] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [amrapRounds, setAmrapRounds] = useState(0);

  const current = normaliseSettings(mode, settings[mode]);
  const plan = useMemo(() => buildPlan(mode, current), [mode, JSON.stringify(current)]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = stateAt(plan, elapsedOf(clock, now));
  const paused = !!clock?.pausedAt;
  const running = !!clock && !paused && !state.done;

  // Ticks only while running. The value shown is still derived from the clock,
  // so a slow tick shows late, never wrong.
  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 200);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [running]);

  // Cues: a pulse per second for the last three, a longer buzz on every phase
  // change, a pattern at the end.
  const lastIndex = useRef(-1);
  const lastSecond = useRef(null);
  useEffect(() => {
    if (!clock) {
      lastIndex.current = -1;
      lastSecond.current = null;
      return;
    }
    if (state.done) {
      if (lastIndex.current !== Infinity) Vibration.vibrate([0, 400, 150, 400, 150, 700]);
      lastIndex.current = Infinity;
      return;
    }
    if (state.index !== lastIndex.current) {
      if (lastIndex.current >= 0) Vibration.vibrate(350);
      lastIndex.current = state.index;
    } else if (!paused && state.remaining <= 3 && state.remaining !== lastSecond.current) {
      Vibration.vibrate(60);
    }
    lastSecond.current = state.remaining;
  }, [clock, paused, state.done, state.index, state.remaining]);

  // The one cue that reaches a locked phone: the end of the session.
  const alertId = useRef(null);
  /**
   * Scheduling is asynchronous. A pause, reset or exit before it resolved
   * cancelled nothing — the id was not back yet — and "Tabata finished"
   * arrived later for a timer that no longer existed. Each schedule carries a
   * number; one that resolves after being superseded cancels itself.
   */
  const alertSeq = useRef(0);
  const clearAlert = () => {
    alertSeq.current += 1;
    cancel(alertId.current);
    alertId.current = null;
  };
  const scheduleEnd = (secondsLeft) => {
    clearAlert();
    if (secondsLeft < 5) return;
    const mine = alertSeq.current;
    schedule({
      title: `${MODE_INFO[mode].label} finished`,
      body: 'Nice work. Log it or start another round.',
      seconds: Math.round(secondsLeft),
    }).then((id) => {
      if (mine === alertSeq.current) alertId.current = id;
      else cancel(id);
    });
  };
  useEffect(() => () => {
    alertSeq.current += 1;
    cancel(alertId.current);
  }, []);

  // Back used to throw away a timer mid-round without a word.
  const active = !!clock && !state.done;
  useEffect(() => {
    if (!active) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      confirmAction({
        tone: 'danger',
        icon: Timer,
        title: 'Stop the timer?',
        message: 'The session in progress ends here.',
        confirmLabel: 'Stop',
        cancelLabel: 'Keep going',
      }).then((ok) => { if (ok) navigation.dispatch(e.data.action); });
    });
  }, [active, navigation, confirmAction]);

  const start = () => {
    const startedAt = Date.now();
    setAmrapRounds(0);
    setNow(startedAt);
    setClock({ startedAt, pausedAt: null, pausedMs: 0 });
    scheduleEnd(totalSeconds(plan));
  };

  const pause = () => {
    clearAlert();
    setClock((c) => (c ? { ...c, pausedAt: Date.now() } : c));
  };

  const resume = () => {
    const at = Date.now();
    setClock((c) => (c ? { ...c, pausedMs: c.pausedMs + (at - c.pausedAt), pausedAt: null } : c));
    setNow(at);
    scheduleEnd(state.totalRemaining);
  };

  const reset = () => {
    clearAlert();
    setClock(null);
  };

  const adjust = (key, delta) => {
    setSettings((all) => ({ ...all, [mode]: normaliseSettings(mode, { ...all[mode], [key]: (all[mode]?.[key] ?? 0) + delta }) }));
  };

  const phase = state.done ? { label: 'Done', tint: colors.success } : PHASE[state.segment.kind];
  const rounds = roundsIn(plan);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone={clock && state.segment.kind === 'work' && !state.done ? 'warm' : 'accent'} height={360} intensity={0.4} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>Interval timer</Text>
          <View style={{ width: 40 }} />
        </View>

        {!clock ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modes}>
              {MODES.map((m) => (
                <Press
                  key={m}
                  scale={0.97}
                  onPress={() => setMode(m)}
                  style={[styles.mode, mode === m && styles.modeOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                >
                  <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{MODE_INFO[m].label}</Text>
                </Press>
              ))}
            </View>
            <Text style={styles.blurb}>{MODE_INFO[mode].blurb}</Text>

            <View style={styles.card}>
              {FIELDS[mode].map((field, i) => (
                <View key={field.key} style={[styles.field, i > 0 && styles.fieldBorder]}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {/* One adjustable control to VoiceOver — swipe up or down —
                      rather than a minus, a number and a plus read separately. */}
                  <View
                    style={styles.stepper}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={field.label}
                    accessibilityValue={{ text: field.format(current[field.key]) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(e) => adjust(field.key, e.nativeEvent.actionName === 'increment' ? field.step : -field.step)}
                  >
                    <Press hitSlop={4}
                      scale={0.9}
                      onPress={() => adjust(field.key, -field.step)}
                      style={styles.stepBtn}
                      accessibilityLabel={`Less ${field.label.toLowerCase()}`}
                    >
                      <Minus color={colors.text} size={16} />
                    </Press>
                    <Text style={styles.fieldValue}>{field.format(current[field.key])}</Text>
                    <Press hitSlop={4}
                      scale={0.9}
                      onPress={() => adjust(field.key, field.step)}
                      style={styles.stepBtn}
                      accessibilityLabel={`More ${field.label.toLowerCase()}`}
                    >
                      <Plus color={colors.text} size={16} />
                    </Press>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.total}>
              Total {formatClock(totalSeconds(plan))}, including a {plan[0].seconds}-second countdown
            </Text>

            <Button label="Start" icon={<Play color={colors.onAccent} size={18} fill={colors.onAccent} />} onPress={start} />
          </ScrollView>
        ) : (
          <View style={styles.run}>
            <Text style={[styles.phase, { color: phase.tint }]}>{phase.label.toUpperCase()}</Text>

            <View style={styles.ringWrap}>
              <ProgressArc
                progress={state.done ? 1 : state.progress}
                color={phase.tint}
                trackColor={colors.surfaceHigh}
                size={270}
                strokeWidth={12}
                animate={false}
              />
              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={styles.bigTime} accessibilityRole="timer">
                  {state.done ? '0:00' : formatClock(state.remaining)}
                </Text>
                <Text style={styles.roundText}>
                  {mode === 'amrap'
                    ? `${amrapRounds} round${amrapRounds === 1 ? '' : 's'}`
                    : state.round > 0 ? `Round ${state.round} of ${rounds}` : `${rounds} rounds`}
                </Text>
              </View>
            </View>

            <Text style={styles.left}>
              {state.done ? `${MODE_INFO[mode].label} complete` : `${formatClock(state.totalRemaining)} left${paused ? ' · paused' : ''}`}
            </Text>

            {mode === 'amrap' && !state.done ? (
              <Press
                scale={0.95}
                onPress={() => setAmrapRounds((n) => n + 1)}
                style={styles.roundBtn}
                accessibilityLabel="Count a finished round"
              >
                <Plus color={colors.onAccent} size={20} />
                <Text style={styles.roundBtnText}>Round</Text>
              </Press>
            ) : null}

            <View style={styles.controls}>
              <Press scale={0.92} onPress={reset} style={styles.ctrl} accessibilityLabel={state.done ? 'Set up another timer' : 'Stop and reset'}>
                <RotateCcw color={colors.text} size={22} />
              </Press>
              {!state.done ? (
                <Press
                  scale={0.92}
                  onPress={paused ? resume : pause}
                  style={[styles.ctrl, styles.ctrlMain]}
                  accessibilityLabel={paused ? 'Resume' : 'Pause'}
                >
                  {paused
                    ? <Play color={colors.onAccent} size={26} fill={colors.onAccent} />
                    : <Pause color={colors.onAccent} size={26} fill={colors.onAccent} />}
                </Press>
              ) : null}
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  scroll: { padding: spacing.lg, paddingBottom: 60 },

  modes: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 4 },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12 },
  modeOn: { backgroundColor: colors.accent },
  modeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  modeTextOn: { color: colors.onAccent },
  blurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: spacing.md, marginBottom: spacing.lg },

  card: { backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: spacing.md },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  fieldBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  fieldValue: { color: colors.text, fontSize: 17, fontWeight: '800', minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
  total: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: spacing.lg },

  run: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  phase: { fontSize: 15, fontWeight: '800', letterSpacing: 3, marginBottom: spacing.lg },
  ringWrap: { width: 270, height: 270, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bigTime: { color: colors.text, fontSize: 72, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  roundText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  left: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: spacing.lg, fontVariant: ['tabular-nums'] },
  roundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.streak,
  },
  roundBtnText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: spacing.xl },
  ctrl: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  ctrlMain: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accent },
});
