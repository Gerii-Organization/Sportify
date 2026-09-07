import { useState, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing, TAB_BAR_CLEARANCE } from '../theme';
import { formatRelativeDate } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

/**
 * Personal records, and what led to them.
 *
 * A record used to appear once, on the summary card at the end of a workout,
 * and then never again. That is the wrong shape for the one number in a gym app
 * people actually want to look up. This is its permanent home.
 *
 * Two levels in one screen. The list is exercises; tapping one replaces it with
 * that exercise's progression. Pushing a route for the second level would put a
 * navigation animation between "what is my bench" and "how did it get there",
 * and those are the same question.
 */
/**
 * `embedded` drops the screen's own chrome — back button, gradient, glow — so it
 * can sit inside a tab that already paints them. A tab has nothing to go back
 * to, and two stacked gradients double the ambient glow.
 */
export default function RecordsScreen({ navigation, embedded = false }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!user) return { exercises: [], records: {} };

    // Two sources, because they answer different questions. personal_records
    // only gains a row when a set beats a previous best, so an exercise trained
    // steadily at the same weight has plenty of history and no record at all.
    const [logged, prs] = await Promise.all([
      unwrap(supabase.rpc('get_logged_exercises')),
      unwrap(
        supabase.from('personal_records')
          .select('exercise_name, weight_kg, reps, estimated_1rm, achieved_at')
          .eq('user_id', user.id)
      ),
    ]);

    return {
      exercises: logged || [],
      records: Object.fromEntries((prs || []).map((r) => [r.exercise_name.toLowerCase(), r])),
    };
  }, [user]);

  const { data, loading, error, reload, refreshControl } = useLoad(load, { exercises: [], records: {} });
  const { exercises, records } = data;

  if (selected) {
    return (
      <ExerciseDetail
        name={selected}
        record={records[selected.toLowerCase()]}
        onBack={() => setSelected(null)}
        embedded={embedded}
      />
    );
  }

  const content = (
    <>
        {loading ? (
          <ActivityIndicator color={colors.energy} style={{ marginTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <ScrollView
            contentContainerStyle={embedded ? styles.scrollEmbedded : styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {exercises.length === 0 ? (
              <EmptyState
                icon={<Trophy color={colors.textFaint} size={34} />}
                title="Nothing logged yet"
                message="Finish a workout with weights and reps filled in. Every exercise you train shows up here with its best set."
              />
            ) : (
              <>
                <FadeIn>
                  <Text style={styles.intro}>
                    Best set per exercise, ranked by estimated one-rep max. Tap any
                    of them for the full progression.
                  </Text>
                </FadeIn>

                {exercises.map((exercise, i) => {
                  const record = records[exercise.exercise_name.toLowerCase()];

                  return (
                    <FadeIn key={exercise.exercise_name} index={i + 1}>
                      <Press
                        scale={0.99}
                        onPress={() => setSelected(exercise.exercise_name)}
                        style={styles.row}
                        accessibilityLabel={`${exercise.exercise_name} history`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{exercise.exercise_name}</Text>
                          <Text style={styles.rowMeta}>
                            {exercise.sessions} session{exercise.sessions === 1 ? '' : 's'} · last {formatRelativeDate(exercise.last_done).toLowerCase()}
                          </Text>
                        </View>

                        <View style={styles.rowRight}>
                          {record ? (
                            <>
                              <Text style={styles.rowBest}>{trim(record.weight_kg)}kg × {record.reps}</Text>
                              <Text style={styles.rowRm}>{trim(record.estimated_1rm)}kg est. 1RM</Text>
                            </>
                          ) : (
                            <Text style={styles.rowRm}>{trim(exercise.best_1rm)}kg est. 1RM</Text>
                          )}
                        </View>

                        <ChevronRight color={colors.textFaint} size={16} />
                      </Press>
                    </FadeIn>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
    </>
  );

  if (embedded) return content;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="warm" height={280} intensity={0.2} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>Records</Text>
          <View style={{ width: 40 }} />
        </View>

        {content}
      </LinearGradient>
    </SafeAreaView>
  );
}

/** One exercise over time: every session it appeared in, best estimated single. */
function ExerciseDetail({ name, record, onBack, embedded = false }) {
  const load = useCallback(
    () => unwrap(supabase.rpc('get_exercise_history', { p_name: name })),
    [name]
  );

  const { data, loading, error, reload } = useLoad(load, []);
  const sessions = data || [];

  // The RPC returns newest first because that is what a list wants. A chart
  // reads left to right through time, so it gets the reverse.
  const chart = [...sessions].reverse().slice(-12);
  const peak = Math.max(...chart.map((s) => Number(s.best_1rm) || 0), 1);

  const trend = trendOf(chart);

  const body = (
    <>
        <View style={styles.nav}>
          <Press scale={0.92} onPress={onBack} style={styles.back} accessibilityLabel="Back to records">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle} numberOfLines={1}>{name}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.energy} style={{ marginTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <ScrollView contentContainerStyle={embedded ? styles.scrollEmbedded : styles.scroll} showsVerticalScrollIndicator={false}>
            <FadeIn style={styles.hero}>
              <Trophy color={colors.energy} size={26} />
              <Text style={styles.heroValue}>
                {record ? `${trim(record.weight_kg)}kg × ${record.reps}` : '—'}
              </Text>
              <Text style={styles.heroLabel}>
                {record
                  ? `Best set · ${formatRelativeDate(record.achieved_at).toLowerCase()}`
                  : 'No record set yet'}
              </Text>

              {trend && (
                <View style={styles.trendRow}>
                  {trend.icon}
                  <Text style={[styles.trendText, { color: trend.color }]}>{trend.label}</Text>
                </View>
              )}
            </FadeIn>

            {chart.length > 1 && (
              <FadeIn index={1} style={styles.card}>
                <Text style={styles.cardTitle}>Estimated 1RM per session</Text>
                <View style={styles.chart}>
                  {chart.map((session, i) => {
                    const value = Number(session.best_1rm) || 0;
                    const isLast = i === chart.length - 1;
                    // Scaled against the best, not against zero: at this range
                    // the differences between sessions are what matter, and a
                    // zero baseline flattens them into one block.
                    const height = Math.max((value / peak) * 100, 6);

                    return (
                      <View key={session.completed_at} style={styles.barSlot}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${height}%`,
                                backgroundColor: isLast ? colors.energy : `${colors.energy}3D`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barValue, isLast && { color: colors.energy }]} numberOfLines={1}>
                          {Math.round(value)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </FadeIn>
            )}

            <FadeIn index={2}>
              <Text style={styles.listLabel}>Every session</Text>

              {sessions.length === 0 ? (
                <EmptyState message="No recorded sets for this exercise yet." />
              ) : (
                sessions.map((session) => (
                  <View key={session.completed_at} style={styles.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{session.workout_name}</Text>
                      <Text style={styles.sessionMeta}>
                        {formatRelativeDate(session.completed_at)} · {session.total_reps} reps · {trim(session.volume_kg)}kg
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.sessionTop}>{trim(session.top_weight)}kg × {session.top_reps}</Text>
                      <Text style={styles.sessionRm}>{trim(session.best_1rm)} est.</Text>
                    </View>
                  </View>
                ))
              )}
            </FadeIn>
          </ScrollView>
        )}
    </>
  );

  // Inside the Progress tab the parent already paints the ground and the
  // glow. The nav row stays either way: its back arrow returns to the list,
  // which is a real destination here rather than a stack pop.
  if (embedded) return body;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="warm" height={280} intensity={0.2} />
        {body}
      </LinearGradient>
    </SafeAreaView>
  );
}

/**
 * First session against last, as a percentage.
 *
 * Deliberately blunt: two points, not a regression. Anything cleverer would be
 * fitting a line through six noisy numbers and presenting the result as fact.
 */
function trendOf(chart) {
  if (chart.length < 2) return null;

  const first = Number(chart[0].best_1rm) || 0;
  const last = Number(chart[chart.length - 1].best_1rm) || 0;
  if (!first) return null;

  const change = ((last - first) / first) * 100;

  if (Math.abs(change) < 2) {
    return { icon: <Minus color={colors.textMuted} size={14} />, color: colors.textMuted, label: 'Holding steady' };
  }
  if (change > 0) {
    return {
      icon: <TrendingUp color={colors.success} size={14} />,
      color: colors.success,
      label: `Up ${change.toFixed(0)}% over ${chart.length} sessions`,
    };
  }
  return {
    icon: <TrendingDown color={colors.textSecondary} size={14} />,
    color: colors.textSecondary,
    label: `Down ${Math.abs(change).toFixed(0)}% over ${chart.length} sessions`,
  };
}

/** Postgres numerics arrive as "60.00". Drop the noise, keep a real half. */
const trim = (value) => {
  const n = Number(value) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3, flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 60 },
  // Inside the Progress tab the list ends behind the floating bar instead of
  // above it, so the panel needs the taller clearance.
  scrollEmbedded: { paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE + 30 },

  intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: 20, padding: spacing.md, marginBottom: 8,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  rowBest: { color: colors.energy, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowRm: { color: colors.textFaint, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },

  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6 },
  heroValue: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  heroLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, marginTop: spacing.sm,
  },
  trendText: { fontSize: 12, fontWeight: '600' },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.7,
    textTransform: 'uppercase', marginBottom: spacing.md,
  },
  chart: { flexDirection: 'row', height: 130, gap: 6 },
  barSlot: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5, minHeight: 3 },
  barValue: { color: colors.textMuted, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },

  listLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: 4,
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: 18, padding: 14, marginBottom: 6,
  },
  sessionTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sessionMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  sessionTop: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sessionRm: { color: colors.textFaint, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
});
