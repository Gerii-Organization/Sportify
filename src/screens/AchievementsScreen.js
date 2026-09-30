import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Lock, Trophy } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { formatRelativeDate } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import { AchievementIcon } from '../lib/achievements';
import { groupByFamily, tierTotals, TIERS, TIER_LABELS, TIER_COLORS } from '../lib/achievementTiers';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { SkeletonAchievements } from '../components/Skeleton';

/**
 * Every achievement, as ladders of Bronze, Silver and Gold, with how close the
 * next step is (tiers: roadmap G4, lib/achievementTiers.js).
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
  const families = groupByFamily(achievements);
  const { unlocked, total } = tierTotals(achievements);

  const content = (
    <>
      {loading ? (
        <SkeletonAchievements />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !user ? (
        // "0 of 0 tiers unlocked" over an empty page, for a guest.
        <EmptyState
          icon={<Trophy color={colors.textFaint} size={34} />}
          title="Earn badges as you train"
          message="Sign in and every workout counts toward Bronze, Silver and Gold."
          actionLabel="Sign in"
          onAction={() => navigation.navigate('AuthScreen')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          <FadeIn style={styles.summary}>
            <Text style={styles.summaryValue}>{unlocked} of {total}</Text>
            <Text style={styles.summaryLabel}>tiers unlocked</Text>
            <View style={styles.summaryTrack}>
              <View style={[styles.summaryFill, { width: `${total ? (unlocked / total) * 100 : 0}%` }]} />
            </View>
          </FadeIn>

          {families.map((f, i) => {
            const { top, earned, next } = f;
            const tint = earned?.tier ? TIER_COLORS[earned.tier] : colors.energy;
            const tiered = f.tiers.some((t) => t.tier);

            return (
              <FadeIn key={f.family} index={Math.min(i + 1, 6)}>
                <View style={[styles.row, earned && styles.rowDone]}>
                  <View style={[styles.glyph, earned && { backgroundColor: `${tint}24` }]}>
                    {earned ? (
                      <AchievementIcon name={top.icon} size={22} color={tint} />
                    ) : (
                      <Lock color={colors.textFaint} size={18} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleLine}>
                      <Text style={[styles.name, earned && styles.nameDone]} numberOfLines={1}>{top.name}</Text>
                      {tiered ? (
                        <View style={styles.pips} accessibilityLabel={`${f.tiers.filter((t) => t.unlocked_at).length} of ${f.tiers.length} tiers`}>
                          {TIERS.filter((tier) => f.tiers.some((t) => t.tier === tier)).map((tier) => {
                            const got = f.tiers.some((t) => t.tier === tier && t.unlocked_at);
                            return (
                              <View
                                key={tier}
                                style={[styles.pip, got ? { backgroundColor: TIER_COLORS[tier] } : { borderColor: TIER_COLORS[tier] }]}
                              />
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.description}>{(earned || top).description}</Text>

                    {earned ? (
                      <Text style={[styles.earned, { color: tint }]}>
                        {earned.tier ? `${TIER_LABELS[earned.tier]} · ` : ''}earned {formatRelativeDate(earned.unlocked_at).toLowerCase()}
                      </Text>
                    ) : null}

                    {next ? (
                      <>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${f.progress * 100}%` }]} />
                        </View>
                        <Text style={styles.progress}>
                          {formatMetric(f.current, next.metric)} of {formatMetric(Number(next.threshold) || 0, next.metric)}
                          {next.tier ? ` for ${TIER_LABELS[next.tier]}` : ''}
                          {earned ? ` · ${next.name}` : ''}
                        </Text>
                      </>
                    ) : tiered ? (
                      <Text style={styles.progress}>Every tier earned</Text>
                    ) : null}
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
  glyphDone: { backgroundColor: 'rgba(222, 184, 102, 0.14)' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pips: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  pip: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: 'transparent' },
  name: { flexShrink: 1, color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  nameDone: { color: colors.text },
  description: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 8, lineHeight: 17 },
  earned: { color: colors.energy, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  progress: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 5, fontVariant: ['tabular-nums'] },
});
