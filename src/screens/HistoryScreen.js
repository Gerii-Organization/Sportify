import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, Dumbbell, Clock, Weight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { formatRelativeDate, formatClockTime } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { formatVolume } from '../lib/units';

/**
 * Every session you have finished.
 *
 * Until now a workout left almost no trace: the app knew you trained for 45
 * minutes on Tuesday but not what you did, and the "total weight lifted" figure
 * on the analytics screen was recomputed from the current template — so editing
 * a plan rewrote the past. Sessions now carry a snapshot of their own sets, and
 * this is where you read them back.
 *
 * Rows open in place rather than pushing another screen. Checking what you
 * benched last Thursday is a glance, and a glance should not cost a navigation.
 */
/**
 * `embedded` drops the screen's own chrome — back button, gradient, glow — so it
 * can render as a panel inside ProgressScreen, which already paints them.
 * ProgressScreen owns the single back button, and two stacked gradients would
 * double the ambient glow.
 */
export default function HistoryScreen({ navigation, embedded = false }) {
  const { user, units } = useAuth();
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return [];

    return unwrap(
      supabase
        .from('workout_completions')
        .select('id, workout_name, duration_minutes, total_volume_kg, exercises, notes, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(150)
    );
  }, [user]);

  const { data, loading, error, reload, refreshControl } = useLoad(load, []);
  const sessions = data || [];

  const totals = useMemo(() => ({
    count: sessions.length,
    minutes: sessions.reduce((t, s) => t + (s.duration_minutes || 0), 0),
    volume: sessions.reduce((t, s) => t + Number(s.total_volume_kg || 0), 0),
  }), [sessions]);

  // Grouped by month so a long list stays navigable, and so the gaps show. A
  // flat list of forty rows hides the fact that March had two sessions.
  const months = useMemo(() => groupByMonth(sessions), [sessions]);

  const content = (
    <>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <FadeIn style={styles.summary}>
              <Total icon={<Dumbbell color={colors.accent} size={18} />} value={totals.count} label="Sessions" />
              <View style={styles.rule} />
              <Total icon={<Clock color={colors.activity} size={18} />} value={formatHours(totals.minutes)} label="Trained" />
              <View style={styles.rule} />
              <Total icon={<Weight color={colors.energy} size={18} />} value={formatVolume(totals.volume, units)} label="Lifted" />
            </FadeIn>

            {sessions.length === 0 ? (
              <EmptyState message="No finished workouts yet. Your sessions will collect here." />
            ) : (
              months.map(([label, rows], monthIndex) => (
                <FadeIn key={label} index={monthIndex + 1}>
                  <Text style={styles.monthLabel}>{label}</Text>

                  {rows.map((session) => {
                    const open = openId === session.id;
                    // Sessions finished before the snapshot existed have a name
                    // and a duration and nothing to expand. They stay at full
                    // strength and simply lose their arrow — dimming them would
                    // read as "unavailable" rather than "nothing more to see".
                    const detail = session.exercises || [];
                    const expandable = detail.length > 0 || !!session.notes;

                    return (
                      <Press
                        key={session.id}
                        scale={expandable ? 0.99 : 1}
                        onPress={expandable ? () => setOpenId(open ? null : session.id) : undefined}
                        style={[styles.row, open && styles.rowOpen]}
                        accessibilityLabel={`${session.workout_name}, ${formatRelativeDate(session.completed_at)}`}
                      >
                        <View style={styles.rowHead}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle} numberOfLines={1}>{session.workout_name}</Text>
                            <Text style={styles.rowMeta}>
                              {formatRelativeDate(session.completed_at)} · {formatClockTime(session.completed_at)} · {session.duration_minutes} min
                            </Text>
                          </View>

                          <View style={styles.rowRight}>
                            {Number(session.total_volume_kg) > 0 && (
                              <Text style={styles.rowVolume}>{formatVolume(session.total_volume_kg, units)}</Text>
                            )}
                            {expandable && (
                              <ChevronDown
                                color={colors.textFaint}
                                size={16}
                                style={open ? styles.chevronOpen : undefined}
                              />
                            )}
                          </View>
                        </View>

                        {open && (
                          <View style={styles.detail}>
                            {session.notes ? (
                              <Text style={styles.note}>{session.notes}</Text>
                            ) : null}

                            {detail.map((exercise, i) => (
                              <View key={`${exercise.name}-${i}`} style={styles.exercise}>
                                <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
                                <Text style={styles.exerciseSets}>
                                  {(exercise.sets || []).map((s) => `${s.weight}×${s.reps}`).join('   ')}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </Press>
                    );
                  })}
                </FadeIn>
              ))
            )}
          </ScrollView>
        )}
    </>
  );

  if (embedded) return content;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={280} intensity={0.22} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>History</Text>
          <View style={{ width: 40 }} />
        </View>

        {content}
      </LinearGradient>
    </SafeAreaView>
  );
}

function Total({ icon, value, label }) {
  return (
    <View style={styles.total}>
      {icon}
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

/** `[["March 2026", [...]], ...]`, newest month first, rows already sorted. */
function groupByMonth(sessions) {
  const buckets = new Map();

  sessions.forEach((session) => {
    const label = new Date(session.completed_at)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(session);
  });

  return [...buckets.entries()];
}

const formatHours = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`);


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

  summary: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  total: { flex: 1, alignItems: 'center', gap: 4 },
  rule: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  totalValue: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: 4 },
  totalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },

  monthLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  row: { backgroundColor: colors.card, borderRadius: 20, padding: spacing.md, marginBottom: 8 },
  rowOpen: { backgroundColor: colors.surfaceRaised },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowVolume: { color: colors.energy, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  detail: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  // Italic and quieter than the sets: it is what you thought, not what you did.
  note: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginBottom: 4 },
  exercise: { gap: 3 },
  exerciseName: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  exerciseSets: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
