import { useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { formatRelativeDate } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import { AchievementIcon } from '../lib/achievements';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import ErrorState from '../components/ErrorState';

/**
 * All twelve achievements, with how close the locked ones are.
 *
 * They previously appeared only as a horizontal strip inside the profile modal,
 * showing locked or unlocked and nothing else. A grey circle is not a goal; the
 * distance to it is. "7 of 10 workouts" is the whole difference.
 *
 * Opening this runs check_achievements first. The function only ever ran after
 * finishing a workout, so anyone whose training predates the feature had earned
 * badges the app had never looked for — eleven sessions and no "First Steps".
 */
export default function AchievementsScreen({ navigation, embedded = false }) {
  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user) return [];

    // Catch up on anything already earned, then read the board. Awaited rather
    // than fired off, so the list below reflects the result instead of showing
    // a badge as locked one render before it flips.
    await supabase.rpc('check_achievements');
    return unwrap(supabase.rpc('get_achievement_progress'));
  }, [user]);

  const { data, loading, error, reload, refreshControl } = useLoad(load, []);
  const achievements = data || [];

  const unlocked = achievements.filter((a) => a.unlocked_at).length;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={colors.energy} style={{ marginTop: 60 }} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          <FadeIn style={styles.summary}>
            <Text style={styles.summaryValue}>{unlocked} of {achievements.length}</Text>
            <Text style={styles.summaryLabel}>unlocked</Text>
            <View style={styles.summaryTrack}>
              <View
                style={[
                  styles.summaryFill,
                  { width: `${achievements.length ? (unlocked / achievements.length) * 100 : 0}%` },
                ]}
              />
            </View>
          </FadeIn>

          {achievements.map((a, i) => {
            const done = !!a.unlocked_at;
            const current = Number(a.current) || 0;
            const target = Number(a.threshold) || 1;
            const pct = Math.min(current / target, 1);

            return (
              <FadeIn key={a.code} index={Math.min(i + 1, 6)}>
                <View style={[styles.row, done && styles.rowDone]}>
                  <View style={[styles.glyph, done && styles.glyphDone]}>
                    {done ? (
                      <AchievementIcon name={a.icon} size={22} color={colors.energy} />
                    ) : (
                      <Lock color={colors.textFaint} size={18} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, done && styles.nameDone]}>{a.name}</Text>
                    <Text style={styles.description}>{a.description}</Text>

                    {done ? (
                      <Text style={styles.earned}>
                        Earned {formatRelativeDate(a.unlocked_at).toLowerCase()}
                      </Text>
                    ) : (
                      <>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                        </View>
                        <Text style={styles.progress}>
                          {formatMetric(current, a.metric)} of {formatMetric(target, a.metric)}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </FadeIn>
            );
          })}
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
          <Text style={styles.navTitle}>Achievements</Text>
          <View style={{ width: 40 }} />
        </View>

        {content}
      </LinearGradient>
    </SafeAreaView>
  );
}

/** Thousands get a k so "100000 steps" does not wrap the row. */
function formatMetric(value, metric) {
  if (metric === 'steps' || metric === 'volume') {
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(Math.round(value));
  }
  return String(Math.round(value));
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

  summary: { backgroundColor: colors.card, borderRadius: 24, padding: spacing.md, marginBottom: spacing.md },
  summaryValue: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  summaryLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 12 },
  summaryTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  summaryFill: { height: '100%', borderRadius: 4, backgroundColor: colors.energy },

  row: { flexDirection: 'row', gap: 14, backgroundColor: colors.card, borderRadius: 20, padding: spacing.md, marginBottom: 8 },
  rowDone: { backgroundColor: colors.surfaceRaised },
  glyph: {
    width: 46, height: 46, borderRadius: 16,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  glyphDone: { backgroundColor: 'rgba(255, 216, 74, 0.14)' },
  name: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  nameDone: { color: colors.text },
  description: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 8, lineHeight: 17 },
  earned: { color: colors.energy, fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  progress: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 5, fontVariant: ['tabular-nums'] },
});
