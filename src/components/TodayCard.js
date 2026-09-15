import { View, Text, StyleSheet } from 'react-native';
import { Moon, Check, Flame, Target, ArrowRight } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { WeekStrip } from './WeeklyGoal';
import Press from './Press';
import { useT } from '../i18n';

/**
 * One answer to "what should I do today".
 *
 * The inputs were all present and never combined: session snapshots know which
 * muscles you trained, the profile knows how often you meant to, and the
 * completions know when you last stopped. On three separate screens they are
 * three numbers; together they are a decision.
 *
 * The tone picks the colour, and the colours follow the theme's one rule — cool
 * is action, warm is reward. Recovery borrows the sleep hue because that is
 * literally what it is about. Nothing here is warm: none of it is something you
 * have earned, it is something you have yet to do.
 *
 * The week strip lives here too. It was a second card directly beneath, and the
 * two answer halves of one question — what to do today, and how today sits in
 * the week. Stacked, they cost twice the height and pushed the list of workouts
 * half a screen down.
 */
const TONES = {
  done:   { color: colors.activity, Icon: Check },
  rest:   { color: colors.sleep,    Icon: Moon },
  push:   { color: colors.water,    Icon: Flame },
  steady: { color: colors.accent,   Icon: Target },
};

export default function TodayCard({ advice, onAct, week, onEditSplit, onPlanWeek }) {
  const { t } = useT();
  if (!advice) return null;

  const { color, Icon } = TONES[advice.tone] || TONES.steady;
  // A planned routine starts on tap; otherwise the muscle opens Browse.
  const actionable = (!!advice.routine || !!advice.muscle) && !!onAct;

  const body = (
    // One flat surface, top and bottom. The gradient wash made the advice look
    // like a separate card sitting on the week strip; the two are halves of one
    // block and read better sharing a ground. Colour still carries the tone —
    // through the glyph and the arrow, where it means something.
    <View style={styles.card}>
      <View style={[styles.glyph, { backgroundColor: `${color}24` }]}>
        <Icon color={color} size={18} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.headline} numberOfLines={1}>{advice.headline}</Text>
        <Text style={styles.detail} numberOfLines={2}>{advice.detail}</Text>
      </View>

      {/* An arrow rather than a labelled row. Above the segments the height is
          the list's, and "Find a chest workout" repeats what the headline
          already said. */}
      {actionable && <ArrowRight color={color} size={17} />}
    </View>
  );

  const strip = week?.target ? (
    <View style={styles.weekBlock}>
      <View style={styles.weekHead}>
        <Text style={styles.weekCount}>
          {t('{done} of {target} this week', { done: week.doneDays.length, target: week.target })}
        </Text>
        {onEditSplit || onPlanWeek ? (
          <View style={styles.weekLinks}>
            {onEditSplit ? (
              <Press scale={0.96} onPress={onEditSplit} hitSlop={8} accessibilityLabel={t('Edit your training split')}>
                <Text style={styles.weekLink}>{week.splitName || t('Set a split')}</Text>
              </Press>
            ) : null}
            {onPlanWeek ? (
              <Press scale={0.96} onPress={onPlanWeek} hitSlop={8} accessibilityLabel={t('Plan your week')}>
                <Text style={styles.weekLink}>{week.planned ? t('Edit plan') : t('Plan week')}</Text>
              </Press>
            ) : null}
          </View>
        ) : (
          <Text style={styles.weekNote}>
            {week.doneDays.length >= week.target
              ? t('Target met')
              : t('{count} to go', { count: week.target - week.doneDays.length })}
          </Text>
        )}
      </View>
      <WeekStrip doneDays={week.doneDays} weekKeys={week.weekKeys} plannedDays={week.plannedDays} />
    </View>
  ) : null;

  return (
    <View style={styles.wrap}>
      {/* Only the advice half is pressable. Wrapping the whole block would make
          the week strip look like it goes somewhere too, and it does not. */}
      {actionable ? (
        <Press
          scale={0.99}
          onPress={() => onAct(advice)}
          accessibilityLabel={advice.routine
            ? t('Start {name}', { name: advice.routine.name || t('your routine') })
            : t('Find a {muscle} workout', { muscle: t(advice.muscle).toLowerCase() })}
        >
          {body}
        </Press>
      ) : (
        body
      )}

      {/* The bottom half carries two links now — the split (the order of
          days) and the week plan (which weekday gets which routine) — so the
          strip itself is no longer one big button. */}
      {strip}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginHorizontal: spacing.lg,
    marginBottom: 12,
    overflow: 'hidden',
  },
  weekBlock: { paddingHorizontal: 14, paddingBottom: 12 },
  weekHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 8,
  },
  weekCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  weekNote: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  weekLink: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  weekLinks: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  glyph: {
    width: 36, height: 36, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  detail: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
