import { useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Flame, Clock, Droplets, Moon } from 'lucide-react-native';
import { colors, gradients, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { METRICS } from '../constants/metrics';
import { formatClockTime } from '../lib/date';
import useLoad from '../lib/useLoad';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ProgressArc from '../components/ProgressArc';

/**
 * Detail for one daily metric.
 *
 * Four screens, one file. The layout is identical for all of them — hero arc,
 * seven-day chart, list of entries — and only the data source and the wording
 * change, which live in constants/metrics.js. Writing this out four times would
 * be the same duplication that had four divergent copies of the avatar map
 * hiding people's purchases.
 */
const ICONS = { Flame, Clock, Droplets, Moon };

export default function MetricScreen({ route, navigation }) {
  const { metric } = route.params;
  const config = METRICS[metric];
  const { user, profile } = useAuth();

  const calorieTarget = calorieGoal(profile);

  const load = useCallback(async () => {
    if (!user || !config) return null;
    return config.load(user.id, profile, calorieTarget);
  }, [user, config, profile, calorieTarget]);

  const { data, loading, error, reload, refreshControl } = useLoad(load);

  if (!config) return null;

  const Icon = ICONS[config.icon] || Flame;

  // Two different things can fill the ring: a goal you are trying to reach, or
  // a dial that simply shows where the night sits on a 0–12 hour range. Only
  // the first is worth expressing as a percentage.
  const dial = data?.goal ?? data?.scaleMax ?? null;
  const pct = dial ? Math.min(data.raw / dial, 1) : null;
  const shown = data?.goal ? Math.round((data.raw / data.goal) * 100) : null;

  // The chart scales to the week's own peak, not to the goal. A week where you
  // never hit target would otherwise render as seven identical stubs.
  const peak = Math.max(...(data?.series || []).map((p) => p.value), data?.goal || 0, 1);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={300} intensity={0.24} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>{config.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={config.color} style={{ marginTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <FadeIn style={styles.hero}>
              <View style={styles.heroArc}>
                <ProgressArc
                  progress={pct ?? 0}
                  color={config.color}
                  size={148}
                  strokeWidth={9}
                  delay={120}
                />
                <View style={styles.heroCentre}>
                  <Icon color={config.color} size={20} />
                  <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                    {data?.value ?? '0'}
                  </Text>
                  {config.unit ? <Text style={styles.heroUnit}>{config.unit}</Text> : null}
                </View>
              </View>

              <Text style={styles.heroCaption}>
                {shown !== null
                  ? `${shown}% of your ${formatGoal(data.goal, config.unit)} goal`
                  : data?.scaleMax
                  ? `On a ${data.scaleMax}-hour dial`
                  : 'No daily target'}
              </Text>
              <Text style={styles.heroNote}>{config.goalNote}</Text>
            </FadeIn>

            {data?.stats?.length > 0 && (
              <FadeIn index={1} style={styles.statStrip}>
                {data.stats.map((stat, i) => (
                  <View key={stat.label} style={styles.statCell}>
                    {i > 0 && <View style={styles.statRule} />}
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {stat.value}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
                  </View>
                ))}
              </FadeIn>
            )}

            <FadeIn index={2} style={styles.card}>
              <Text style={styles.cardTitle}>{config.chartLabel}</Text>
              <View style={styles.chart}>
                {(data?.series || []).map((point, i) => {
                  const isToday = i === (data.series.length - 1);
                  const h = Math.max((point.value / peak) * 100, point.value > 0 ? 6 : 2);
                  return (
                    <View key={point.key} style={styles.barSlot}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${h}%`,
                              backgroundColor: isToday ? config.color : `${config.color}40`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barDay, isToday && { color: config.color }]}>
                        {weekdayOf(point.key)}
                      </Text>
                      <Text style={styles.barValue} numberOfLines={1}>
                        {point.value > 0 ? formatBar(point.value, metric) : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </FadeIn>

            <FadeIn index={3}>
              <Text style={styles.listLabel}>{config.listLabel}</Text>
              {(data?.entries || []).length === 0 ? (
                <EmptyState message={config.emptyText} />
              ) : (
                <View style={styles.list}>
                  {data.entries.map((entry) => (
                    <View key={entry.id} style={styles.row}>
                      <Text style={styles.rowBadge}>{entry.badge}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{entry.title}</Text>
                        {entry.sub ? <Text style={styles.rowSub}>{entry.sub}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.rowRight, { color: config.color }]}>{entry.right}</Text>
                        {entry.at ? <Text style={styles.rowTime}>{formatClockTime(entry.at)}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </FadeIn>
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

/** Same Mifflin-St Jeor calculation the dashboard uses for its calorie target. */
function calorieGoal(profile) {
  const weight = parseFloat(profile?.weight) || 70;
  const height = parseFloat(profile?.height) || 170;
  const age = parseInt(profile?.age, 10) || 25;
  const workouts = parseInt(profile?.workouts_per_week, 10) || 3;

  let bmr = 10 * weight + 6.25 * height - 5 * age;
  bmr += profile?.sex === 'F' ? -161 : 5;

  const multiplier = workouts >= 6 ? 1.725 : workouts >= 3 ? 1.55 : workouts >= 1 ? 1.375 : 1.2;
  let tdee = bmr * multiplier;

  if (profile?.goal === 'lose_weight') tdee -= 500;
  else if (profile?.goal === 'build_muscle' || profile?.goal === 'gain_strength') tdee += 300;

  return Math.max(1200, Math.round(tdee));
}

const formatGoal = (goal, unit) => `${goal}${unit ? ` ${unit}` : ''}`;

/**
 * Bar captions have about 34pt of width, so they are abbreviated rather than
 * exact: "1.8k" instead of "1840". The precise figure is one tap away in the
 * list underneath.
 */
function formatBar(value, metric) {
  if (metric === 'calories') return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
  if (metric === 'sleep') return `${value.toFixed(1)}h`;
  if (metric === 'water') return value.toFixed(1);
  return String(Math.round(value));
}

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

  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroArc: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  heroCentre: { position: 'absolute', alignItems: 'center', gap: 2 },
  heroValue: { color: colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -1.2 },
  heroUnit: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: -4 },
  heroCaption: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: spacing.md },
  heroNote: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 5, paddingHorizontal: spacing.lg, lineHeight: 18 },

  statStrip: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  // A hairline between cells rather than around them: four boxes would compete
  // with the cards above and below.
  statRule: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 4 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500', paddingHorizontal: 2 },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: spacing.md },
  chart: { flexDirection: 'row', height: 150, gap: 8 },
  barSlot: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, minHeight: 3 },
  barDay: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  barValue: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },

  listLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: 4 },
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, padding: 14, marginBottom: 6 },
  rowBadge: { fontSize: 20 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  rowRight: { fontSize: 15, fontWeight: '700' },
  rowTime: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
});
