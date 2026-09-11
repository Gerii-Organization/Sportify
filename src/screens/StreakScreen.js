import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Flame, Snowflake, Award, RotateCcw } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { deviceTimeZone } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import { unwrap } from '../lib/query';
import useLoad from '../lib/useLoad';
import AmbientGlow from '../components/AmbientGlow';
import ErrorState from '../components/ErrorState';
import FadeIn from '../components/FadeIn';
import Press from '../components/Press';

/**
 * The streak, as a screen rather than a sheet.
 *
 * A streak is the number people come back to check, so it earns the room: a
 * hero figure, a month you can walk backwards through, and the two numbers that
 * give the current one meaning — your record, and how many days you have logged
 * in total.
 *
 * The calendar draws consecutive days as one continuous track rather than
 * separate dots. That is the whole point of a streak: five days in a row should
 * look different from five days scattered across the month, and separate
 * circles make those two identical.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StreakScreen({ navigation }) {
  const { profile } = useAuth();
  const [offset, setOffset] = useState(0);

  const month = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d;
  }, [offset]);

  // Unwrapped, so a failed month throws instead of coming back as `null` — and
  // `null` here would draw an empty calendar, which for a streak screen is not
  // a blank state but a claim that you never trained.
  const load = useCallback(() => {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    return unwrap(supabase.rpc('get_streak_calendar', {
      p_month: key,
      p_tz: deviceTimeZone(),
    }));
  }, [month]);

  const { data, loading, error, reload, refreshControl } = useLoad(load);

  const trained = useMemo(() => new Set(data?.days || []), [data]);
  const cells = useMemo(() => buildGrid(month), [month]);
  const todayKey = toKey(new Date());

  const current = data?.current ?? profile?.current_streak ?? 0;
  const freezes = profile?.streak_freezes ?? 0;
  // The streak you lost, kept so Streak Restore has something to bring back.
  // It was stored and read only by that purchase, so the shop offered to
  // restore something you had no way of knowing existed.
  const lost = profile?.previous_streak ?? 0;
  const restorable = lost > current;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="warm" height={380} intensity={current > 0 ? 0.55 : 0.2} />

        <View style={styles.nav}>
          <Press
            scale={0.92}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ChevronLeft color={colors.text} size={24} />
          </Press>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {/* The hero. A dim flame at zero is the honest state — an app that
              celebrates a streak you do not have teaches you to ignore it. */}
          <FadeIn style={styles.hero}>
            <View style={styles.flameWrap}>
              <Flame
                color={current > 0 ? colors.streak : colors.textFaint}
                fill={current > 0 ? colors.streak : 'transparent'}
                size={72}
              />
            </View>
            <Text style={styles.heroNumber}>{current}</Text>
            <Text style={styles.heroLabel}>
              {current === 0
                ? 'No streak yet'
                : `day${current === 1 ? '' : 's'} in a row`}
            </Text>
            {freezes > 0 && (
              <View style={styles.freezeRow}>
                <Snowflake color={colors.water} size={14} />
                <Text style={styles.freezeText}>
                  {freezes} freeze{freezes === 1 ? '' : 's'} in reserve
                </Text>
              </View>
            )}
          </FadeIn>

          {restorable && (
            <FadeIn index={1} style={styles.restoreNote}>
              <RotateCcw color={colors.streak} size={15} />
              <Text style={styles.restoreText}>
                You had a {lost}-day streak. Streak Restore in the shop brings it back.
              </Text>
            </FadeIn>
          )}

          <FadeIn index={restorable ? 2 : 1} style={styles.statRow}>
            <Stat icon={<Award color={colors.energy} size={18} />} value={error ? '—' : data?.longest ?? 0} label="Best ever" />
            <View style={styles.statDivider} />
            <Stat icon={<Flame color={colors.accent} size={18} />} value={error ? '—' : data?.total ?? 0} label="Days trained" />
          </FadeIn>

          <FadeIn index={restorable ? 3 : 2} style={styles.calendarCard}>
            <View style={styles.monthBar}>
              <Press scale={0.9} onPress={() => setOffset((o) => o - 1)} style={styles.arrow} accessibilityLabel="Previous month">
                <ChevronLeft color={colors.textSecondary} size={18} />
              </Press>
              <Text style={styles.monthLabel}>
                {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <Press
                scale={0.9}
                onPress={() => setOffset((o) => Math.min(o + 1, 0))}
                disabled={offset >= 0}
                style={[styles.arrow, offset >= 0 && styles.arrowOff]}
                accessibilityLabel="Next month"
              >
                <ChevronRight color={colors.textSecondary} size={18} />
              </Press>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekday}>{d}</Text>)}
            </View>

            {error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 50 }} />
            ) : (
              <View style={styles.grid}>
                {cells.map((date, i) => {
                  if (!date) return <View key={`pad-${i}`} style={styles.cell} />;

                  const key = toKey(date);
                  const did = trained.has(key);

                  // A run is drawn as one bar. Checking the neighbours tells us
                  // which end caps to round, so Monday–Wednesday reads as a
                  // single three-day stretch instead of three separate marks.
                  const prevDone = did && trained.has(shiftKey(date, -1)) && date.getDay() !== 1;
                  const nextDone = did && trained.has(shiftKey(date, 1)) && date.getDay() !== 0;

                  return (
                    <View key={key} style={styles.cell}>
                      {did && (
                        <View
                          style={[
                            styles.runTrack,
                            prevDone && styles.runLeft,
                            nextDone && styles.runRight,
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.day,
                          did && styles.dayDone,
                          key === todayKey && !did && styles.dayToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            did && styles.dayTextDone,
                            date > new Date() && styles.dayTextFuture,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </FadeIn>

          <FadeIn index={restorable ? 4 : 3}>
            <Text style={styles.footnote}>
              A day counts once you finish any workout. Miss a day and a freeze covers
              it — buy them in the shop before you need one.
            </Text>
          </FadeIn>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function buildGrid(month) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const days = new Date(y, m + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1)),
  ];
}

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftKey(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  nav: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 60 },

  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xl },
  // No disc behind the flame. The glow above the screen already puts warmth
  // there, and a tinted circle on top of it reads as a second, competing shape.
  flameWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.sm },
  // Oversized and tight: the number is the reason the screen exists.
  heroNumber: { color: colors.text, fontSize: 68, fontWeight: '800', letterSpacing: -3, marginTop: spacing.sm },
  heroLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: -4 },
  freezeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(143, 160, 255, 0.12)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    marginTop: spacing.md,
  },
  freezeText: { color: colors.water, fontSize: 13, fontWeight: '600' },

  restoreNote: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(255, 138, 43, 0.11)',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: spacing.md,
  },
  restoreText: { color: colors.streak, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  statRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },

  calendarCard: { backgroundColor: colors.card, borderRadius: 26, padding: spacing.lg, marginBottom: spacing.md },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  arrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowOff: { opacity: 0.3 },
  monthLabel: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  weekRow: { flexDirection: 'row', marginBottom: 10 },
  weekday: {
    flex: 1, textAlign: 'center', color: colors.textFaint,
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The connecting bar sits behind the day, inset so isolated days stay round
  // and runs join edge to edge.
  runTrack: {
    position: 'absolute',
    left: '18%', right: '18%',
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.streak,
    opacity: 0.18,
  },
  // Square off the joined ends so consecutive days read as one continuous
  // stretch rather than as beads on a string.
  runLeft: { left: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  runRight: { right: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  day: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDone: {
    backgroundColor: colors.streak,
    shadowColor: colors.streak,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 3,
  },
  dayToday: { borderWidth: 2, borderColor: colors.accent },
  dayText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  dayTextDone: { color: '#2A1000', fontWeight: '800' },
  dayTextFuture: { color: colors.textDisabled },

  footnote: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: spacing.md },
});
