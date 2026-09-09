import { View, Text, StyleSheet } from 'react-native';
import { Moon, Check, Flame, Target, ArrowRight } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { WeekStrip } from './WeeklyGoal';
import Press from './Press';

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

export default function TodayCard({ advice, onAct, week, onEditSplit }) {
  if (!advice) return null;

  const { color, Icon } = TONES[advice.tone] || TONES.steady;
  const actionable = !!advice.muscle && !!onAct;

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
          {week.doneDays.length} of {week.target} this week
        </Text>
        {onEditSplit ? (
          <Text style={styles.weekLink}>{week.splitName || 'Set a split'}</Text>
        ) : (
          <Text style={styles.weekNote}>
            {week.doneDays.length >= week.target
              ? 'Target met'
              : `${week.target - week.doneDays.length} to go`}
          </Text>
        )}
      </View>
      <WeekStrip doneDays={week.doneDays} weekKeys={week.weekKeys} />
    </View>
  ) : null;

  return (
    <View style={styles.wrap}>
      {/* Only the advice half is pressable. Wrapping the whole block would make
          the week strip look like it goes somewhere too, and it does not. */}
      {actionable ? (
        <Press
          scale={0.99}
          onPress={() => onAct(advice.muscle)}
          accessibilityLabel={`Find a ${advice.muscle.toLowerCase()} workout`}
        >
          {body}
        </Press>
      ) : (
        body
      )}

      {/* The bottom half opens the split. It had no action before and was
          documented as going nowhere; now the two halves read as a pair —
          what to do today, and the plan it comes from. */}
      {onEditSplit && strip ? (
        <Press
          scale={0.99}
          onPress={onEditSplit}
          accessibilityLabel="Edit your training split"
        >
          {strip}
        </Press>
      ) : (
        strip
      )}
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
