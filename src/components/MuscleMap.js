import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Ellipse, Path, Circle } from 'react-native-svg';
import { colors, spacing } from '../theme';
import { LEVELS, levelFor } from '../lib/muscleLoad';

/**
 * The week on a body: front and back, each muscle group shaded by hard sets
 * (roadmap T3).
 *
 * A bar per muscle says the same thing, but the body answers the question
 * people actually ask — "what have I skipped?" — at a glance: a pale pair of
 * legs under a dark chest needs no reading.
 *
 * Drawn from simple shapes rather than an anatomical illustration. Six groups
 * is what the app tracks (constants/exercises.js), so six regions is what the
 * figure can honestly show; a detailed body with forty muscles would claim a
 * precision the data does not have.
 */

// Cool accent ramp: more work reads as more colour. Nothing warm here — warm
// is reserved for rewards in this palette.
const SHADES = [
  colors.surfaceHigh,
  'rgba(155, 157, 214, 0.32)',
  'rgba(155, 157, 214, 0.55)',
  'rgba(155, 157, 214, 0.8)',
  colors.accent,
];

const NEUTRAL = 'rgba(155, 157, 214, 0.10)';

function Figure({ side, fillFor }) {
  const front = side === 'front';
  const shoulders = fillFor('Shoulders');
  const arms = fillFor('Arms');
  const legs = fillFor('Legs');

  return (
    <Svg width={120} height={220} viewBox="0 0 120 220">
      {/* head and neck, never shaded */}
      <Circle cx="60" cy="16" r="12" fill={NEUTRAL} />
      <Rect x="54" y="27" width="12" height="8" rx="3" fill={NEUTRAL} />

      {/* shoulders */}
      <Ellipse cx="33" cy="44" rx="11" ry="9" fill={shoulders} />
      <Ellipse cx="87" cy="44" rx="11" ry="9" fill={shoulders} />

      {front ? (
        <>
          {/* chest: two plates */}
          <Rect x="40" y="37" width="19" height="24" rx="7" fill={fillFor('Chest')} />
          <Rect x="61" y="37" width="19" height="24" rx="7" fill={fillFor('Chest')} />
          {/* core */}
          <Rect x="44" y="64" width="32" height="42" rx="9" fill={fillFor('Core')} />
        </>
      ) : (
        <>
          {/* back: upper back and lats as one tapering shape */}
          <Path d="M40 37 H80 L77 84 Q60 94 43 84 Z" fill={fillFor('Back')} />
          {/* lower back reads as core work (planks, deadlift bracing) */}
          <Rect x="46" y="88" width="28" height="18" rx="7" fill={fillFor('Core')} />
        </>
      )}

      {/* arms: upper arm and forearm each side */}
      <Rect x="18" y="53" width="13" height="32" rx="6" fill={arms} />
      <Rect x="89" y="53" width="13" height="32" rx="6" fill={arms} />
      <Rect x="15" y="88" width="12" height="30" rx="6" fill={arms} />
      <Rect x="93" y="88" width="12" height="30" rx="6" fill={arms} />

      {/* hips */}
      <Rect x="42" y="108" width="36" height="16" rx="7" fill={front ? NEUTRAL : legs} />

      {/* legs: thigh and calf each side */}
      <Rect x="42" y="126" width="17" height="44" rx="8" fill={legs} />
      <Rect x="61" y="126" width="17" height="44" rx="8" fill={legs} />
      <Rect x="44" y="173" width="14" height="38" rx="7" fill={legs} />
      <Rect x="62" y="173" width="14" height="38" rx="7" fill={legs} />
    </Svg>
  );
}

export default function MuscleMap({ counts }) {
  const fillFor = (muscle) => SHADES[levelFor(counts?.[muscle])];

  return (
    <View>
      <View style={styles.figures}>
        <View style={styles.figure}>
          <Figure side="front" fillFor={fillFor} />
          <Text style={styles.caption}>Front</Text>
        </View>
        <View style={styles.figure}>
          <Figure side="back" fillFor={fillFor} />
          <Text style={styles.caption}>Back</Text>
        </View>
      </View>

      <View style={styles.legend} accessibilityLabel="Shading shows hard sets per muscle group">
        {LEVELS.map((level, i) => (
          <View key={level.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: SHADES[i] }]} />
            <Text style={styles.legendText}>{level.label}</Text>
          </View>
        ))}
        <Text style={styles.legendUnit}>sets</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  figure: { alignItems: 'center' },
  caption: { color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legendUnit: { color: colors.textFaint, fontSize: 11 },
});
