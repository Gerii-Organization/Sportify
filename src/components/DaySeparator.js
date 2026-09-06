import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * "Today" / "Yesterday" / a date, between runs of messages from different days.
 *
 * Without it a conversation reads as one unbroken stream: a message from last
 * week sits directly above one from this morning with only a clock time to tell
 * them apart, and 14:32 looks the same on any day.
 */
export default function DaySeparator({ label }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

/**
 * Whether a separator belongs above this message.
 *
 * Compares calendar days in local time — not elapsed hours, because 23:50 and
 * 00:10 are ten minutes apart but belong on different days, which is exactly
 * the boundary a reader cares about.
 */
export function needsSeparator(current, previous) {
  if (!current) return false;
  if (!previous) return true;
  const a = new Date(current);
  const b = new Date(previous);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

/** "Today", "Yesterday", "Mon 3 Mar", or a dated form once past this year. */
export function dayLabel(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  const options =
    date.getFullYear() === today.getFullYear()
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };

  return date.toLocaleDateString('en-GB', options);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
