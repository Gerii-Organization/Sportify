import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, withRepeat,
  cancelAnimation, Easing,
} from 'react-native-reanimated';
import {
  Check, Clock, Dumbbell, Layers, Flame, Zap, Star, Snowflake, CloudOff, Trophy, MessageSquare,
} from 'lucide-react-native';
import { colors, gradients } from '../theme';
import { formatStopwatch } from '../lib/date';
import { formatWeight } from '../lib/units';
import { AchievementIcon } from '../lib/achievements';
import { ENTER_SPRING } from '../lib/motion';
import AmbientGlow from './AmbientGlow';
import FadeIn from './FadeIn';
import Button from './Button';

/**
 * The screen at the end of a workout.
 *
 * It used to be a stack of identical cards under "WORKOUT COMPLETED!" in
 * capitals, every fact given the same weight. The order now follows what
 * someone who just finished wants to know, and how much each fact matters:
 *
 *   1. That it counted — a badge that lands, the workout's name under it.
 *   2. What they did — four numbers in a grid, read at a glance.
 *   3. What it earned — rewards counting up, because a number that arrives
 *      reads as given, where a number that is simply there reads as a label.
 *   4. Anything exceptional — streak, freeze, records, achievements — only
 *      when it happened, so an ordinary session is a short, clean screen.
 *   5. The optional note, last, where skipping it costs nothing.
 */
export default function WorkoutSummary({
  visible,
  stats,
  workoutName,
  units,
  canNote,
  note,
  onChangeNote,
  onSaveNote,
  onContinue,
}) {
  const s = stats || {};

  // The note saves on blur, and a tap on Continue does not always blur first.
  const finish = () => {
    if (canNote && note) onSaveNote?.();
    onContinue?.();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish}>
      <View style={styles.root}>
        <LinearGradient colors={['#1C1E33', colors.background]} style={styles.wash} pointerEvents="none" />
        <AmbientGlow tone="accent" height={460} intensity={0.55} />

        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Hero name={workoutName} message={s.message} />

            <FadeIn index={2}>
              <View style={styles.grid}>
                <StatTile icon={Clock} label="Duration" value={formatStopwatch(s.time || 0)} />
                <StatTile icon={Dumbbell} label="Volume" value={formatWeight(s.volume || 0, units, { step: 1 })} />
                <StatTile
                  icon={Layers}
                  label="Sets"
                  value={String(s.sets || 0)}
                  note={`${s.exercises || 0} exercise${s.exercises === 1 ? '' : 's'}`}
                />
                <StatTile
                  icon={Flame}
                  label="Est. burn"
                  value={s.kcal ? `${s.kcal} kcal` : '—'}
                  note="Estimated"
                />
              </View>
            </FadeIn>

            {/* Queued, not lost, and not rewarded yet either. The rewards are
                hidden rather than shown as zeroes: the server decides XP and
                energy and has not seen this session. "+0 XP" would read as
                the app punishing a workout done without signal. */}
            <FadeIn index={3}>
              {s.queued ? (
                <View style={[styles.card, styles.row]}>
                  <View style={[styles.disc, { backgroundColor: colors.surfaceHigh }]}>
                    <CloudOff color={colors.textMuted} size={19} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>Saved on this phone</Text>
                    <Text style={styles.cardBody}>
                      You are offline. This workout will sync automatically, and your rewards will show up then.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.rewards}>
                  <RewardTile icon={Star} tone={colors.xp} value={s.xpGained} label="XP earned" />
                  <RewardTile icon={Zap} tone={colors.gold} value={s.energyGained} label="Energy earned" delay={140} />
                </View>
              )}
            </FadeIn>

            {s.isFirstWorkoutToday ? (
              <FadeIn index={4}>
                <LinearGradient
                  colors={['rgba(224, 161, 122, 0.22)', 'rgba(224, 161, 122, 0.04)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.streak]}
                >
                  <View style={styles.streakDisc}>
                    <Flame color={colors.streak} fill={colors.streak} size={28} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.streakLine}>
                      <Text style={styles.streakNumber}>{s.newStreak}</Text>
                      <Text style={styles.streakUnit}>day streak</Text>
                    </View>
                    <Text style={styles.cardBody}>Keep it going tomorrow.</Text>
                  </View>
                </LinearGradient>
              </FadeIn>
            ) : null}

            {s.freezeUsed ? (
              <FadeIn index={4}>
                <View style={[styles.card, styles.row, styles.waterCard]}>
                  <View style={[styles.disc, { backgroundColor: 'rgba(143, 184, 217, 0.14)' }]}>
                    <Snowflake color={colors.water} size={19} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>Streak Freeze used</Text>
                    <Text style={styles.cardBody}>You missed a day, and a freeze kept your streak going.</Text>
                  </View>
                </View>
              </FadeIn>
            ) : null}

            {/* The server decides what counts as a record (submit_sets), by
                estimated one-rep max, so a heavy triple can beat a lighter ten. */}
            {s.records?.length ? (
              <FadeIn index={5}>
                <View style={[styles.card, styles.goldCard]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.disc, { backgroundColor: colors.goldSoft }]}>
                      <Trophy color={colors.gold} fill={colors.gold} size={17} />
                    </View>
                    <Text style={[styles.cardTitle, styles.flex]}>
                      {s.records.length === 1 ? 'New personal record' : 'New personal records'}
                    </Text>
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{s.records.length}</Text>
                    </View>
                  </View>
                  {s.records.map((record) => (
                    <View key={record.exercise_name} style={styles.listRow}>
                      <Text style={[styles.listName, styles.flex]} numberOfLines={1}>{record.exercise_name}</Text>
                      <Text style={styles.recordValue}>
                        {formatWeight(record.weight_kg, units)} × {record.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              </FadeIn>
            ) : null}

            {s.achievements?.length ? (
              <FadeIn index={6}>
                <View style={[styles.card, styles.accentCard]}>
                  <Text style={[styles.cardTitle, styles.cardTitleSpaced]}>
                    {s.achievements.length === 1 ? 'Achievement unlocked' : 'Achievements unlocked'}
                  </Text>
                  {s.achievements.map((achievement) => (
                    <View key={achievement.code} style={styles.listRow}>
                      <View style={[styles.disc, { backgroundColor: colors.accentSoft }]}>
                        <AchievementIcon name={achievement.icon} color={colors.accent} size={18} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.listName}>{achievement.name}</Text>
                        <Text style={styles.cardBody}>{achievement.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </FadeIn>
            ) : null}

            {canNote ? (
              <FadeIn index={7}>
                <View style={styles.card}>
                  <View style={styles.sectionHead}>
                    <MessageSquare color={colors.textMuted} size={16} />
                    <Text style={[styles.cardTitle, styles.flex]}>How did it go?</Text>
                    <Text style={styles.optional}>Optional</Text>
                  </View>
                  {/* Saved on blur rather than behind a button: a note nobody
                      remembered to save is the same as no note. */}
                  <TextInput
                    style={styles.note}
                    value={note}
                    onChangeText={onChangeNote}
                    onBlur={onSaveNote}
                    placeholder="Add a note about this workout"
                    placeholderTextColor={colors.textFaint}
                    selectionColor={colors.accent}
                    multiline
                    maxLength={280}
                  />
                </View>
              </FadeIn>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <LinearGradient
              colors={['rgba(17, 19, 27, 0)', colors.background]}
              style={styles.footerFade}
              pointerEvents="none"
            />
            <Button label="Continue" onPress={finish} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * The badge. The one spring in the app allowed a little overshoot: everywhere
 * else a bounce reads as toy-like, but this is the moment that is meant to feel
 * like something landed.
 */
function Hero({ name, message }) {
  const pop = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    pop.value = withSpring(1, { ...ENTER_SPRING, damping: 17 });
    breathe.value = withDelay(
      400,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true)
    );
    return () => {
      cancelAnimation(pop);
      cancelAnimation(breathe);
    };
  }, [pop, breathe]);

  const badge = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.5 + pop.value * 0.5 }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: pop.value * (0.35 + breathe.value * 0.3),
    transform: [{ scale: 1 + breathe.value * 0.07 }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: pop.value * (0.1 + breathe.value * 0.1),
    transform: [{ scale: 1.08 + breathe.value * 0.14 }],
  }));

  return (
    <View style={styles.hero}>
      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={[styles.ring, ring]} />
        <Animated.View style={badge}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
            <Check color={colors.onAccent} size={44} strokeWidth={3} />
          </LinearGradient>
        </Animated.View>
      </View>

      <FadeIn index={1} style={styles.heroCopy}>
        <Text style={styles.eyebrow}>WORKOUT COMPLETE</Text>
        <Text style={styles.title} numberOfLines={2}>{name || 'Workout'}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </FadeIn>
    </View>
  );
}

function StatTile({ icon: Icon, label, value, note }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Icon color={colors.accent} size={14} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {note ? <Text style={styles.tileNote} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

function RewardTile({ icon: Icon, tone, value, label, delay = 0 }) {
  return (
    <LinearGradient
      colors={[`${tone}29`, `${tone}08`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.reward, { borderColor: `${tone}45` }]}
    >
      <View style={[styles.disc, { backgroundColor: `${tone}24` }]}>
        <Icon color={tone} fill={tone} size={17} />
      </View>
      <CountUp to={value} delay={delay} style={[styles.rewardValue, { color: tone }]} />
      <Text style={styles.rewardLabel}>{label}</Text>
    </LinearGradient>
  );
}

/**
 * Counts from zero to `to` over 900ms on an ease-out curve: fast at first, then
 * settling on the final figure, which is the one that has to be read.
 */
function CountUp({ to, delay = 0, style }) {
  const target = Math.max(0, Math.round(Number(to) || 0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!target) {
      setShown(0);
      return undefined;
    }

    // Roughly a frame per step. The count is text, not layout, so a missed
    // frame costs a digit that is on screen for 16ms — not worth a native loop.
    const start = Date.now() + delay;
    const id = setInterval(() => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / 900));
      setShown(Math.round(target * (1 - (1 - t) ** 3)));
      if (t >= 1) clearInterval(id);
    }, 16);

    return () => clearInterval(id);
  }, [target, delay]);

  return <Text style={style}>+{shown.toLocaleString()}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 460 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  flex: { flex: 1 },

  // --- Hero ---
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 26 },
  badgeWrap: { width: 156, height: 156, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  halo: { position: 'absolute', width: 156, height: 156, borderRadius: 78, backgroundColor: colors.accent },
  ring: {
    position: 'absolute', width: 126, height: 126, borderRadius: 63,
    borderWidth: 1.5, borderColor: colors.accent,
  },
  badge: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  heroCopy: { alignItems: 'center' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2.4 },
  title: {
    color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8,
    lineHeight: 36, textAlign: 'center', marginTop: 8,
  },
  message: {
    color: colors.textMuted, fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginTop: 10, paddingHorizontal: 16,
  },

  // --- Stats ---
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  tile: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 16,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  tileValue: {
    color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6,
    marginTop: 10, fontVariant: ['tabular-nums'],
  },
  tileNote: { color: colors.textFaint, fontSize: 11, marginTop: 3 },

  // --- Rewards ---
  rewards: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  reward: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 16 },
  rewardValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 12, fontVariant: ['tabular-nums'] },
  rewardLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },

  // --- Cards ---
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 16, marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardTitleSpaced: { marginBottom: 4 },
  cardBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  listName: { color: colors.text, fontSize: 14, fontWeight: '600' },

  streak: { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: 'rgba(224, 161, 122, 0.35)' },
  streakDisc: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(224, 161, 122, 0.16)',
  },
  streakLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  streakNumber: { color: colors.streak, fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  streakUnit: { color: colors.streak, fontSize: 15, fontWeight: '700' },

  waterCard: { borderColor: 'rgba(143, 184, 217, 0.35)' },
  goldCard: { borderColor: 'rgba(222, 184, 102, 0.35)' },
  accentCard: { borderColor: colors.accentBorder },
  countPill: { backgroundColor: colors.goldSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  countText: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  recordValue: { color: colors.gold, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  optional: { color: colors.textFaint, fontSize: 12 },
  note: {
    backgroundColor: colors.surface, color: colors.text,
    borderRadius: 14, padding: 14, fontSize: 15, minHeight: 84,
    textAlignVertical: 'top', marginTop: 8,
  },

  // --- Footer ---
  footer: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  footerFade: { position: 'absolute', left: 0, right: 0, top: -36, height: 36 },
});
