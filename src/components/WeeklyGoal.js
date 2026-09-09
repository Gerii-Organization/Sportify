import { View, Text, StyleSheet } from 'react-native';
import { Target, Check } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { todayKey } from '../lib/date';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Sessions done this week against the target you set.
 *
 * `workouts_per_week` is asked for at sign-up, shown on your profile and used
 * to size the calorie target — and until now nothing ever measured against it.
 * Committing to four sessions and never being told you are on two is a loop the
 * app left open.
 *
 * A calendar week, not a rolling seven days: on Tuesday you have spent two days
 * of the allowance, and a rolling window would hide that.
 *
 * Deliberately not scored. Missing the target is ordinary, and a card that
 * turns red on a Thursday teaches people to stop opening the screen. It states
 * the count and gets out of the way.
 */
export default function WeeklyGoal({ target, doneDays, weekKeys }) {
  if (!target) return null;

  const done = doneDays.length;
  const hit = done >= target;
  const remaining = Math.max(target - done, 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, hit && styles.iconHit]}>
          {hit
            ? <Check color={colors.onAccent} size={16} strokeWidth={3} />
            : <Target color={colors.accent} size={16} />}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {done} of {target} this week
          </Text>
          <Text style={styles.sub}>
            {hit
              ? 'Target met. Anything more is a bonus.'
              : `${remaining} more session${remaining === 1 ? '' : 's'} to go.`}
          </Text>
        </View>
      </View>

      <WeekStrip doneDays={doneDays} weekKeys={weekKeys} />
    </View>
  );
}

/**
 * The seven days as dots, Monday first.
 *
 * Exported because two screens draw it: the full card here on the Progress
 * overview, and the merged advice card on the workouts screen. One copy means
 * the "future days are fainter" rule cannot drift between them.
 */
export function WeekStrip({ doneDays, weekKeys }) {
  const today = todayKey();

  return (
    <View style={styles.week}>
      {weekKeys.map((key, i) => {
        const trained = doneDays.includes(key);
        // Days that have not happened yet are drawn fainter, so an empty
        // Saturday on a Tuesday does not read as a day you missed. YYYY-MM-DD
        // sorts lexicographically, so a string compare is the whole test.
        const future = key > today;

        return (
          <View key={key} style={styles.day}>
            <View style={[styles.dot, trained && styles.dotOn, !trained && future && styles.dotFuture]} />
            <Text style={[styles.letter, trained && styles.letterOn]}>{LETTERS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.md, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  iconHit: { backgroundColor: colors.accent },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  week: { flexDirection: 'row', marginTop: spacing.md },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceHigh },
  dotOn: { backgroundColor: colors.accent },
  dotFuture: { backgroundColor: colors.surface },
  letter: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  letterOn: { color: colors.accent },
});
