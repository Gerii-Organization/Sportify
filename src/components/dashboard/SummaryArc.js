import { View, Text, StyleSheet } from 'react-native';
import { Flame, Clock, Droplets, Moon } from 'lucide-react-native';
import { colors } from '../../theme';
import ProgressArc from '../ProgressArc';
import Press from '../Press';

/**
 * One gauge in the dashboard's daily summary row. Lifted out of
 * DashboardScreen unchanged (roadmap Q4).
 *
 * With a goal, the centre shows the percentage. Without one — sleep, which
 * runs on a 0–12 hour dial — the ring still travels but the centre shows the
 * icon: calling 62% of twelve hours a score would tell someone their sleep was
 * 62% correct.
 */
const ARC_ICONS = { flame: Flame, clock: Clock, drop: Droplets, moon: Moon };

export default function SummaryArc({ color, icon, value, unit, label, progress, scaleMax, raw, index = 0, onPress }) {
  const Icon = ARC_ICONS[icon] || Flame;

  const hasGoal = typeof progress === 'number';
  const fill = hasGoal
    ? Math.min(Math.max(progress, 0), 1)
    : typeof scaleMax === 'number' && typeof raw === 'number'
    ? Math.min(Math.max(raw / scaleMax, 0), 1)
    : 0;

  const shown = hasGoal ? Math.round(progress * 100) : null;

  return (
    <Press
      scale={0.94}
      onPress={onPress}
      style={styles.col}
      accessibilityLabel={
        shown !== null
          ? `${label}: ${value} ${unit}, ${shown} percent of goal. Open details.`
          : `${label}: ${value}. Open details.`
      }
    >
      <View style={styles.gauge}>
        <ProgressArc progress={fill} color={color} size={52} strokeWidth={4} delay={140 + index * 90} />
        <View style={styles.centre}>
          {shown !== null ? (
            <Text style={[styles.pct, shown > 100 && { color }]}>{shown}%</Text>
          ) : (
            <Icon color={color} size={17} />
          )}
        </View>
      </View>

      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit ? ` ${unit}` : ''}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, alignItems: 'center', gap: 2 },
  gauge: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pct: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  value: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
