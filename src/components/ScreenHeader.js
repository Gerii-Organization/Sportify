import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { formatHeaderDate } from '../lib/date';

/**
 * The Sportify wordmark, today's date and a screen title.
 * Repeated verbatim in Dashboard, Training, Shop and Stats.
 *
 * `right` renders an optional control on the wordmark row — the avatar button
 * on Dashboard, the energy balance on Shop.
 */
export default function ScreenHeader({ title, right, subtitle }) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Flame size={18} color={colors.onAccent} fill={colors.onAccent} />
          </View>
          <Text style={styles.name}>Sportify</Text>
        </View>
        {right}
      </View>
      <Text style={styles.date}>{subtitle || formatHeaderDate()}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: spacing.sm },
  date: { color: colors.textMuted, marginTop: spacing.md, fontSize: 15 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: spacing.xs },
});
