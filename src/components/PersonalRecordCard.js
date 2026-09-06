import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { colors, spacing } from '../theme';

/**
 * Shown on the workout summary when a set beat a previous best.
 *
 * The server decides what counts as a record — see the submit_sets function —
 * by comparing estimated one-rep max, so a heavy triple can beat a lighter set
 * of ten rather than the two being incomparable.
 */
export default function PersonalRecordCard({ records }) {
  if (!records?.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Trophy color={colors.energy} size={22} fill={colors.energy} />
        <Text style={styles.title}>
          {records.length === 1 ? 'New personal record' : `${records.length} new personal records`}
        </Text>
      </View>

      {records.map((record) => (
        <View key={record.exercise_name} style={styles.row}>
          <Text style={styles.exercise} numberOfLines={1}>{record.exercise_name}</Text>
          <Text style={styles.result}>
            {record.weight_kg}kg × {record.reps}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: colors.energy,
    borderRadius: 26,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { color: colors.energy, fontSize: 15, fontWeight: '900', marginLeft: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.15)',
  },
  exercise: { color: colors.text, fontSize: 15, flex: 1, marginRight: spacing.sm },
  result: { color: colors.energy, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
