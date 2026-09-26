import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { Check, Flame, Snowflake, CloudOff, Trophy, Share2, Medal, Gift } from 'lucide-react-native';
import { colors } from '../theme';
import { formatStopwatch } from '../lib/date';
import { formatWeight } from '../lib/units';
import { AchievementIcon } from '../lib/achievements';
import { describeReward } from '../lib/milestones';
import { BURN_NOTES } from '../lib/energy';
import { useT } from '../i18n';
import { ENTER_SPRING } from '../lib/motion';
import FadeIn from './FadeIn';
import Button from './Button';
import ShareWorkoutSheet from './ShareWorkoutSheet';

/**
 * The screen at the end of a workout.
 *
 * One surface, not a stack of cards. The previous version gave every fact its
 * own tinted card — stats, each reward, streak, milestone, records, the share
 * preview, the note — so an ordinary session ended on a wall of boxes, each
 * shouting as loudly as the next. Now:
 *
 *   1. That it counted — a check, the workout's name, one line about it.
 *   2. What they did — four numbers on the page, split by hairlines.
 *   3. What it earned — one line, counting up.
 *   4. Anything exceptional — streak, milestone, records, badges — as one
 *      list, only when something happened.
 *   5. An optional note.
 *
 * Sharing is a button. The story-card preview used to sit on this screen,
 * a second copy of the numbers above it; it now opens with the share sheet,
 * which also sends it to a friend's chat.
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
  const { t } = useT();
  const [sharingOpen, setSharingOpen] = useState(false);

  // The note saves on blur, and a tap on Continue does not always blur first.
  const finish = () => {
    if (canNote && note) onSaveNote?.();
    onContinue?.();
  };

  const burnLabel = s.kcalSource && s.kcalSource !== 'estimate' ? t('Burn') : t('Est. burn');
  const highlights = [
    s.isFirstWorkoutToday && s.newStreak > 0
      ? { key: 'streak', Icon: Flame, tint: colors.streak, fill: true, title: t('{count}-day streak', { count: s.newStreak }), body: t('Keep it going tomorrow.') }
      : null,
    ...(s.milestones || []).map((m) => ({
      key: `milestone-${m.days}`, Icon: Medal, tint: colors.gold,
      title: t('{days}-day milestone', { days: m.days }), body: describeReward(m) || t('Unlocked'),
    })),
    s.inviteBonus
      ? {
        key: 'invite', Icon: Gift, tint: colors.gold, title: t('Invite bonus'),
        body: s.inviteBonus.inviterName
          ? t('+{energy} energy for your first workout, and {name} gets the same.', { energy: s.inviteBonus.energy, name: s.inviteBonus.inviterName })
          : t('+{energy} energy for your first workout.', { energy: s.inviteBonus.energy }),
      }
      : null,
    s.freezeUsed
      ? { key: 'freeze', Icon: Snowflake, tint: colors.water, title: t('Streak Freeze used'), body: t('You missed a day, and a freeze kept your streak going.') }
      : null,
    // The server decides what counts as a record (submit_sets), by estimated
    // one-rep max, so a heavy triple can beat a lighter ten.
    ...(s.records || []).map((r) => ({
      key: `record-${r.exercise_name}`, Icon: Trophy, tint: colors.gold, fill: true,
      title: r.exercise_name,
      body: `${t('New personal record')} · ${formatWeight(r.weight_kg, units)} × ${r.reps}`,
    })),
    ...(s.achievements || []).map((a) => ({
      key: `achievement-${a.code}`,
      icon: <AchievementIcon name={a.icon} color={colors.accent} size={18} />,
      title: a.name, body: a.description,
    })),
  ].filter(Boolean);

  const showXp = !s.queued && Number(s.xpGained) > 0;
  const showEnergy = !s.queued && Number(s.energyGained) > 0;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish}>
      <View style={styles.root}>
        <LinearGradient
          colors={['rgba(155, 157, 214, 0.13)', 'rgba(17, 19, 27, 0)']}
          style={styles.wash}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.safe}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Hero name={workoutName} message={s.message} />

            {/* --- What they did ------------------------------------------- */}
            <FadeIn index={2}>
              <View style={styles.stats}>
                <View style={styles.statsRow}>
                  <Stat label={t('Duration')} value={formatStopwatch(s.time || 0)} />
                  <View style={styles.vrule} />
                  <Stat label={t('Volume')} value={formatWeight(s.volume || 0, units, { step: 1 })} />
                </View>
                <View style={styles.hrule} />
                <View style={styles.statsRow}>
                  <Stat
                    label={t('Sets')}
                    value={String(s.sets || 0)}
                    note={t('{count} exercise', { count: s.exercises || 0 })}
                  />
                  <View style={styles.vrule} />
                  <Stat
                    label={burnLabel}
                    value={s.kcal ? `${s.kcal} kcal` : '—'}
                    note={t(BURN_NOTES[s.kcalSource] || BURN_NOTES.estimate)}
                  />
                </View>
              </View>
            </FadeIn>

            {/* --- What it earned ------------------------------------------
                Queued sessions have not been priced by the server yet, so
                they say so instead of showing zeroes. */}
            <FadeIn index={3}>
              {s.queued ? (
                <View style={styles.earned}>
                  <CloudOff color={colors.textMuted} size={15} />
                  <Text style={styles.queued}>
                    {t('You are offline. This workout will sync automatically, and your rewards will show up then.')}
                  </Text>
                </View>
              ) : showXp || showEnergy ? (
                <View style={styles.earned}>
                  {showXp ? <CountUp to={s.xpGained} suffix={` ${t('XP')}`} style={[styles.earnedValue, { color: colors.xp }]} /> : null}
                  {showXp && showEnergy ? <Text style={styles.earnedDot}>·</Text> : null}
                  {showEnergy ? (
                    <CountUp to={s.energyGained} delay={140} suffix={` ${t('energy')}`} style={[styles.earnedValue, { color: colors.gold }]} />
                  ) : null}
                </View>
              ) : null}
            </FadeIn>

            {/* --- Anything exceptional --------------------------------------- */}
            {highlights.length ? (
              <FadeIn index={4}>
                <Text style={styles.sectionLabel}>{t('Highlights')}</Text>
                <View style={styles.group}>
                  {highlights.map((item, i) => (
                    <View key={item.key} style={[styles.highlight, i > 0 && styles.divider]}>
                      <View style={styles.highlightIcon}>
                        {item.icon || <item.Icon color={item.tint} fill={item.fill ? item.tint : 'transparent'} size={18} />}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.highlightTitle} numberOfLines={1}>{item.title}</Text>
                        {item.body ? <Text style={styles.highlightBody}>{item.body}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </FadeIn>
            ) : null}

            {canNote ? (
              <FadeIn index={5}>
                <View style={styles.noteHead}>
                  <Text style={styles.sectionLabel}>{t('How did it go?')}</Text>
                  <Text style={styles.optional}>{t('Optional')}</Text>
                </View>
                {/* Saved on blur rather than behind a button: a note nobody
                    remembered to save is the same as no note. */}
                <TextInput
                  style={styles.note}
                  value={note}
                  onChangeText={onChangeNote}
                  onBlur={onSaveNote}
                  placeholder={t('Add a note about this workout')}
                  placeholderTextColor={colors.textFaint}
                  selectionColor={colors.accent}
                  multiline
                  maxLength={280}
                />
              </FadeIn>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <LinearGradient
              colors={['rgba(17, 19, 27, 0)', colors.background]}
              style={styles.footerFade}
              pointerEvents="none"
            />
            <Button
              label={t('Share your workout')}
              variant="secondary"
              icon={<Share2 color={colors.text} size={18} />}
              onPress={() => setSharingOpen(true)}
            />
            <View style={styles.footerGap} />
            <Button label={t('Continue')} onPress={finish} />
          </View>
        </SafeAreaView>

        <ShareWorkoutSheet
          visible={sharingOpen}
          onClose={() => setSharingOpen(false)}
          stats={s}
          workoutName={workoutName}
          units={units}
        />
      </View>
    </Modal>
  );
}

/**
 * A check that lands once. The badge used to breathe, ringed by a halo and a
 * pulsing circle, for as long as the screen was open — motion that asks to be
 * looked at long after there is nothing new to see.
 */
function Hero({ name, message }) {
  const { t } = useT();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) pop.value = withSpring(1, { ...ENTER_SPRING, damping: 16 });
  }, [pop, reduceMotion]);

  const badge = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.6 + pop.value * 0.4 }],
  }));

  return (
    <View style={styles.hero}>
      <Animated.View style={[styles.badge, badge]}>
        <Check color={colors.accent} size={30} strokeWidth={2.5} />
      </Animated.View>

      <FadeIn index={1} style={styles.heroCopy}>
        <Text style={styles.eyebrow}>{t('Workout complete')}</Text>
        <Text style={styles.title} numberOfLines={2}>{name || t('Workout')}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </FadeIn>
    </View>
  );
}

function Stat({ label, value, note }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {note ? <Text style={styles.statNote} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

/**
 * Counts from zero to `to` over 900ms on an ease-out curve: fast at first, then
 * settling on the final figure, which is the one that has to be read.
 */
function CountUp({ to, delay = 0, suffix = '', style }) {
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
      const p = Math.min(1, Math.max(0, (Date.now() - start) / 900));
      setShown(Math.round(target * (1 - (1 - p) ** 3)));
      if (p >= 1) clearInterval(id);
    }, 16);

    return () => clearInterval(id);
  }, [target, delay]);

  return <Text style={style}>+{shown.toLocaleString()}{suffix}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  flex: { flex: 1 },

  // --- Hero ---
  hero: { alignItems: 'center', marginBottom: 34 },
  badge: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: colors.accentBorder,
    marginBottom: 20,
  },
  heroCopy: { alignItems: 'center' },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  title: {
    color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8,
    lineHeight: 36, textAlign: 'center', marginTop: 6,
  },
  message: {
    color: colors.textMuted, fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginTop: 10, paddingHorizontal: 12,
  },

  // --- Stats: on the page, split by hairlines ---
  stats: { marginBottom: 26 },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  statNote: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  vrule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 12 },
  hrule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginHorizontal: 12 },

  // --- Earned ---
  earned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 30, paddingHorizontal: 8 },
  earnedValue: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  earnedDot: { color: colors.textFaint, fontSize: 17 },
  queued: { flexShrink: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },

  // --- Highlights ---
  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  group: {
    backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 28,
  },
  highlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  highlightIcon: { width: 20, alignItems: 'center', paddingTop: 1 },
  highlightTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  highlightBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },

  // --- Note ---
  noteHead: { flexDirection: 'row', justifyContent: 'space-between' },
  optional: { color: colors.textFaint, fontSize: 12 },
  note: {
    backgroundColor: colors.card, color: colors.text,
    borderRadius: 14, padding: 14, fontSize: 15, minHeight: 76,
    textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border,
  },

  // --- Footer ---
  footer: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  footerFade: { position: 'absolute', left: 0, right: 0, top: -36, height: 36 },
  footerGap: { height: 10 },
});
