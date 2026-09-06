import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, spacing } from '../theme';

/**
 * Protein / carbs / fats against the day's targets.
 *
 * The scanner has always asked the model for these numbers and stored them, but
 * nothing ever read them back — the dashboard only showed calories. This makes
 * the data visible without adding any new source of truth.
 *
 * Three concentric arcs rather than three separate rings: it keeps the widget
 * the same height as the cards beside it, and the nesting reads as one figure.
 */

const MACROS = [
  { key: 'protein', label: 'Protein', color: colors.calories, dim: 'rgba(255,107,107,0.15)', r: 40 },
  { key: 'carbs',   label: 'Carbs',   color: colors.activity, dim: 'rgba(77,121,255,0.15)',  r: 30 },
  { key: 'fats',    label: 'Fats',    color: colors.energy, dim: 'rgba(255,215,0,0.15)',   r: 20 },
];

export default function MacroRings({ totals, targets }) {
  return (
    <View style={styles.card}>
      <View style={styles.ringBox}>
        <Svg width={110} height={110} viewBox="0 0 100 100">
          {/* -90° so each arc starts at the top rather than at 3 o'clock. */}
          <G transform="rotate(-90 50 50)">
            {MACROS.map(({ key, color, dim, r }) => {
              const circumference = 2 * Math.PI * r;
              const eaten = totals?.[key] || 0;
              const target = targets?.[key] || 1;
              // Cap at 1 so going over target does not wrap the arc around again.
              const progress = Math.min(eaten / target, 1);

              return (
                <G key={key}>
                  <Circle cx="50" cy="50" r={r} stroke={dim} strokeWidth="7" fill="none" />
                  <Circle
                    cx="50"
                    cy="50"
                    r={r}
                    stroke={color}
                    strokeWidth="7"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - circumference * progress}
                  />
                </G>
              );
            })}
          </G>
        </Svg>
      </View>

      <View style={styles.legend}>
        {MACROS.map(({ key, label, color }) => {
          const eaten = Math.round(totals?.[key] || 0);
          const target = Math.round(targets?.[key] || 0);
          const over = target > 0 && eaten > target;

          return (
            <View key={key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.value, over && { color }]}>
                {eaten}
                <Text style={styles.target}> / {target}g</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Targets derived from the same profile that drives the calorie goal, so the
 * two can never disagree.
 *
 *   protein  2 g per kg of bodyweight — the common strength-training figure
 *   fats     25% of calories, at 9 kcal per gram
 *   carbs    whatever calories are left, at 4 kcal per gram
 */
export function macroTargets(profile, calorieTarget) {
  const weight = parseFloat(profile?.weight) || 70;

  const protein = Math.round(weight * 2);
  const fats = Math.round((calorieTarget * 0.25) / 9);
  const remaining = calorieTarget - protein * 4 - fats * 9;
  const carbs = Math.max(0, Math.round(remaining / 4));

  return { protein, carbs, fats };
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: spacing.md,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  ringBox: { width: 110, height: 110, justifyContent: 'center', alignItems: 'center' },
  legend: { flex: 1, marginLeft: spacing.md, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  target: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
