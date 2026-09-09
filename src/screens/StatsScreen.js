import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, ChevronRight, Dumbbell, Flame, Weight, Clock,
  History, Trophy, Lock,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { todayKey, recentDayKeys, currentWeekKeys, startOfWeekIso } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import WeeklyGoal from '../components/WeeklyGoal';

/** Shape of the screen's data before anything loads, and after a failure. */
const EMPTY = { sessions: [], steps: [], streak: 0, weights: [], trainedDays: [], meals: [] };

/**
 * Training over time.
 *
 * Two things were wrong with the numbers this screen used to show. Volume was
 * recomputed from `user_workouts` — the live templates — so editing a plan
 * changed how much you had lifted last month. And muscle focus counted how many
 * times an exercise appeared in a saved plan, not how often you actually
 * trained it, which is why it sat on "More data needed" for anyone who trained
 * without saving templates.
 *
 * Both now read from `workout_completions`, which since the session-log change
 * carries a snapshot of the sets that were performed. History is history: it
 * only changes when you train.
 */
/**
 * `embedded` drops the screen's own chrome — back button, gradient, glow — so it
 * can render as a panel inside ProgressScreen, which already paints them.
 * ProgressScreen owns the single back button, and two stacked gradients would
 * double the ambient glow.
 */
export default function StatsScreen({ navigation, embedded = false }) {
  const { user, profile } = useAuth();
  const [timeframe, setTimeframe] = useState('week');

  const load = useCallback(async () => {
    if (!user) return EMPTY;

    const days = recentDayKeys(7);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    let completions = supabase
      .from('workout_completions')
      .select('duration_minutes, total_volume_kg, exercises, completed_at')
      .eq('user_id', user.id);

    if (timeframe === 'week') {
      completions = completions.gte('completed_at', weekStart.toISOString());
    }

    const [sessions, steps, me, thisWeek, meals, weights] = await Promise.all([
      unwrap(completions),
      unwrap(
        supabase.from('daily_steps')
          .select('record_date, step_count')
          .eq('user_id', user.id)
          .in('record_date', days)
      ),
      unwrap(supabase.from('profiles').select('current_streak').eq('id', user.id).maybeSingle()),
      // Separate from `sessions` because that list follows the timeframe toggle,
      // while the weekly target is always this calendar week.
      unwrap(
        supabase.from('workout_completions')
          .select('completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', startOfWeekIso())
      ),
      // Nutrition is the one area with no long view anywhere: the food screen
      // shows today, the metric screen shows a week. Without it "Progress" only
      // ever meant training.
      unwrap(
        supabase.from('scanned_foods')
          .select('calories, protein, carbs, fats, scanned_at')
          .eq('user_id', user.id)
          .gte('scanned_at', new Date(Date.now() - 29 * 86400000).toISOString())
      ),
      unwrap(
        supabase.from('body_weight_log')
          .select('weight_kg, logged_on')
          .eq('user_id', user.id)
          .order('logged_on', { ascending: true })
          .limit(60)
      ),
    ]);

    return {
      sessions: sessions || [],
      steps: days.map((key) => ({
        key,
        value: (steps || []).find((s) => s.record_date === key)?.step_count || 0,
      })),
      streak: me?.current_streak || 0,
      weights: weights || [],
      // Distinct days, not sessions — two workouts on Monday is one day.
      trainedDays: [...new Set((thisWeek || []).map((w) => todayKey(new Date(w.completed_at))))],
      meals: meals || [],
    };
  }, [user, timeframe]);

  const { data, loading, error, reload, refreshControl } = useLoad(load, EMPTY);

  const summary = useMemo(() => summarise(data.sessions), [data]);
  const muscles = useMemo(() => muscleSplit(data.sessions), [data]);
  const nutrition = useMemo(() => summariseMeals(data.meals), [data]);

  const peakSteps = Math.max(...data.steps.map((s) => s.value), 5000);

  const content = (
    <>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !user ? (
          <EmptyState
            icon={<Lock color={colors.textFaint} size={34} />}
            title="Signed out"
            message="Create an account to keep your history, records and progress."
            actionLabel="Sign in"
            onAction={() => navigation.navigate('AuthScreen')}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <FadeIn style={styles.toggle}>
              {[['week', 'Last 7 days'], ['all', 'All time']].map(([value, label]) => (
                <Press
                  key={value}
                  scale={0.97}
                  onPress={() => setTimeframe(value)}
                  style={[styles.toggleBtn, timeframe === value && styles.toggleBtnOn]}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.toggleText, timeframe === value && styles.toggleTextOn]}>
                    {label}
                  </Text>
                </Press>
              ))}
            </FadeIn>

            <FadeIn index={1}>
              <WeeklyGoal
                target={profile?.workouts_per_week}
                doneDays={data.trainedDays}
                weekKeys={currentWeekKeys()}
              />
            </FadeIn>

            <FadeIn index={2} style={styles.grid}>
              <Tile
                icon={<Dumbbell color={colors.accent} size={20} />}
                value={String(summary.workouts)}
                label="Workouts"
              />
              <Tile
                icon={<Weight color={colors.energy} size={20} />}
                value={formatVolume(summary.volume)}
                label="Weight lifted"
              />
              <Tile
                icon={<Clock color={colors.activity} size={20} />}
                value={formatHours(summary.minutes)}
                label="Time trained"
              />
              <Tile
                icon={<Flame color={colors.streak} size={20} />}
                value={String(data.streak)}
                label="Day streak"
              />
            </FadeIn>

            {/* Volume is only known for sessions finished since the set log
                existed. Quietly reporting a smaller total would make it look
                like training had dropped off. */}
            {summary.unlogged > 0 && (
              <FadeIn index={3}>
                <Text style={styles.footnote}>
                  {summary.unlogged} earlier session{summary.unlogged === 1 ? ' was' : 's were'} recorded
                  before sets were tracked, so {summary.unlogged === 1 ? 'it is' : 'they are'} not counted
                  in the weight total.
                </Text>
              </FadeIn>
            )}

            <FadeIn index={4} style={styles.card}>
              <Text style={styles.cardTitle}>Steps this week</Text>
              <View style={styles.chart}>
                {data.steps.map((point) => {
                  const isToday = point.key === todayKey();
                  const height = Math.max((point.value / peakSteps) * 100, point.value > 0 ? 6 : 2);

                  return (
                    <View key={point.key} style={styles.barSlot}>
                      <Text style={styles.barTop} numberOfLines={1}>
                        {point.value > 0 ? `${(point.value / 1000).toFixed(1)}k` : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${height}%`,
                              backgroundColor: isToday ? colors.accent : `${colors.accent}3D`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barDay, isToday && { color: colors.accent }]}>
                        {weekdayOf(point.key)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </FadeIn>

            {data.weights.length > 1 && (
              <FadeIn index={5} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Body weight</Text>
                  <Text style={styles.cardAside}>
                    {trim(data.weights[data.weights.length - 1].weight_kg)}kg
                    {' · '}
                    {formatChange(data.weights)}
                  </Text>
                </View>
                <WeightTrend readings={data.weights} />
              </FadeIn>
            )}

            {muscles.length > 0 && (
              <FadeIn index={6} style={styles.card}>
                <Text style={styles.cardTitle}>Muscle focus</Text>
                {muscles.map((muscle) => (
                  <View key={muscle.name} style={styles.muscleRow}>
                    <Text style={styles.muscleName}>{muscle.name}</Text>
                    <View style={styles.muscleTrack}>
                      <View style={[styles.muscleFill, { width: `${muscle.share}%` }]} />
                    </View>
                    <Text style={styles.muscleShare}>{muscle.share}%</Text>
                  </View>
                ))}
                <Text style={styles.muscleNote}>
                  Share of the sets you actually completed, not of what your plans contain.
                </Text>
              </FadeIn>
            )}

            {nutrition && (
              <FadeIn index={7} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Nutrition</Text>
                  <Text style={styles.cardAside}>{nutrition.days} days logged</Text>
                </View>

                <View style={styles.macroRow}>
                  <Macro label="Avg daily" value={nutrition.avgCalories.toLocaleString()} unit="kcal" tint={colors.calories} />
                  <Macro label="Protein" value={nutrition.protein} unit="g/day" tint={colors.activity} />
                  <Macro label="Carbs" value={nutrition.carbs} unit="g/day" tint={colors.water} />
                  <Macro label="Fats" value={nutrition.fats} unit="g/day" tint={colors.sleep} />
                </View>

                <Text style={styles.muscleNote}>
                  Averaged over the days you actually logged something, not over
                  the last thirty — a day with no entries is a day you did not
                  record, which is different from a day you ate nothing.
                </Text>
              </FadeIn>
            )}

            <FadeIn index={8}>
              <Link
                icon={<History color={colors.accent} size={20} />}
                title="Workout history"
                subtitle="Every session, with the sets you logged"
                onPress={() => navigation.navigate('HistoryScreen')}
              />
              <Link
                icon={<Trophy color={colors.energy} size={20} />}
                title="Personal records"
                subtitle="Best set per exercise, and how it got there"
                onPress={() => navigation.navigate('RecordsScreen')}
              />
            </FadeIn>
          </ScrollView>
        )}
    </>
  );

  if (embedded) return content;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={300} intensity={0.24} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>

        {content}
      </LinearGradient>
    </SafeAreaView>
  );
}

function Tile({ icon, value, label }) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Link({ icon, title, subtitle, onPress }) {
  return (
    <Press scale={0.99} onPress={onPress} style={styles.link} accessibilityLabel={title}>
      <View style={styles.linkIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSub}>{subtitle}</Text>
      </View>
      <ChevronRight color={colors.textFaint} size={18} />
    </Press>
  );
}

/**
 * Body weight as a sparkline of bars.
 *
 * Scaled between the lightest and heaviest readings rather than from zero: a
 * two-kilo change over a month is the entire signal, and against a 0–80kg axis
 * it is invisible.
 */
function WeightTrend({ readings }) {
  const values = readings.map((r) => Number(r.weight_kg));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;

  return (
    <View style={styles.weightChart}>
      {readings.slice(-30).map((reading, i) => {
        const height = 18 + ((Number(reading.weight_kg) - low) / range) * 82;
        const isLast = i === Math.min(readings.length, 30) - 1;

        return (
          <View key={reading.logged_on} style={styles.weightSlot}>
            <View
              style={[
                styles.weightBar,
                {
                  height: `${height}%`,
                  backgroundColor: isLast ? colors.water : `${colors.water}3D`,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function Macro({ label, value, unit, tint }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

/**
 * Thirty days of meals, averaged per logged day.
 *
 * Dividing by 30 would report someone who logs carefully twice a week as
 * eating 400 kcal a day. The denominator is days with entries.
 */
function summariseMeals(meals) {
  if (!meals?.length) return null;

  const days = new Set(meals.map((m) => todayKey(new Date(m.scanned_at))));
  const n = days.size || 1;

  const total = meals.reduce(
    (t, m) => ({
      calories: t.calories + (Number(m.calories) || 0),
      protein: t.protein + (Number(m.protein) || 0),
      carbs: t.carbs + (Number(m.carbs) || 0),
      fats: t.fats + (Number(m.fats) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  // A zero macro almost always means the field was never recorded rather than
  // that the food had none of it, so it shows a dash instead of a claim.
  const per = (v) => (v > 0 ? String(Math.round(v / n)) : '—');

  return {
    days: n,
    avgCalories: Math.round(total.calories / n),
    protein: per(total.protein),
    carbs: per(total.carbs),
    fats: per(total.fats),
  };
}

/** Totals across the sessions in view. */
function summarise(sessions) {
  return {
    workouts: sessions.length,
    minutes: sessions.reduce((t, s) => t + (s.duration_minutes || 0), 0),
    volume: sessions.reduce((t, s) => t + Number(s.total_volume_kg || 0), 0),
    unlogged: sessions.filter((s) => !s.exercises).length,
  };
}

/**
 * Share of completed sets per muscle group, biggest first, top five.
 *
 * Counting sets rather than exercises: three sets of squats is more leg work
 * than one set of leg curls, and the old count treated them as equal.
 */
function muscleSplit(sessions) {
  const counts = {};

  sessions.forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      if (!exercise.muscle) return;
      counts[exercise.muscle] = (counts[exercise.muscle] || 0) + (exercise.sets?.length || 0);
    });
  });

  const total = Object.values(counts).reduce((t, n) => t + n, 0);
  if (!total) return [];

  return Object.entries(counts)
    .map(([name, sets]) => ({ name, share: Math.round((sets / total) * 100) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);
}

/** "+1.2kg since Mar 3" — the first reading against the last. */
function formatChange(readings) {
  const first = Number(readings[0].weight_kg);
  const last = Number(readings[readings.length - 1].weight_kg);
  const delta = last - first;

  if (Math.abs(delta) < 0.05) return 'unchanged';

  const [y, m, d] = readings[0].logged_on.split('-').map(Number);
  const since = new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}kg since ${since}`;
}

const formatHours = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`);

function formatVolume(kg) {
  const value = Number(kg) || 0;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${Math.round(value)}kg`;
}

const trim = (value) => {
  const n = Number(value) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'narrow' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 60 },

  toggle: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 16, padding: 4, marginBottom: spacing.md,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  toggleBtnOn: { backgroundColor: colors.surfaceHigh },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  toggleTextOn: { color: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  tile: {
    width: '48%', flexGrow: 1,
    backgroundColor: colors.card, borderRadius: 22,
    padding: spacing.md, gap: 6,
  },
  tileValue: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  tileLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },

  footnote: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginBottom: spacing.md, paddingHorizontal: 2 },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  cardTitle: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.7,
    textTransform: 'uppercase', marginBottom: spacing.md,
  },
  cardAside: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.md },

  chart: { flexDirection: 'row', height: 160, gap: 8 },
  barSlot: { flex: 1, alignItems: 'center', gap: 6 },
  barTop: { color: colors.textFaint, fontSize: 10, fontWeight: '600', height: 12 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, minHeight: 3 },
  barDay: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },

  weightChart: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3 },
  weightSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  weightBar: { width: '100%', borderRadius: 3, minHeight: 4 },

  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleName: { color: colors.text, fontSize: 13, fontWeight: '600', width: 78 },
  muscleTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  muscleFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  muscleShare: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muscleNote: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: 4 },

  macroRow: { flexDirection: 'row', gap: 8 },
  macro: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 12, gap: 1 },
  macroValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, paddingHorizontal: 4 },
  macroUnit: { color: colors.textFaint, fontSize: 10, fontWeight: '600' },
  macroLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 3 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: 20, padding: spacing.md, marginBottom: 8,
  },
  linkIcon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  linkSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
});
