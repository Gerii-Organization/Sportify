import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { formatHeaderDate } from '../lib/date';

/**
 * Screen title, date, and an optional control row.
 *
 * The wordmark used to sit here on every screen. An app does not need to tell
 * you its own name five times a session — the icon on the home screen already
 * did that, and the space is better spent on the title you are actually
 * reading. Removing it also lets the title move up into the position the eye
 * lands on first.
 */
export default function ScreenHeader({ title, right, subtitle, compact = false }) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.date}>{subtitle || formatHeaderDate()}</Text>
          {title ? (
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  headerCompact: { paddingBottom: spacing.sm },
  // Title and controls share a baseline-ish row rather than stacking, so the
  // header takes about half the height it used to.
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  titleBlock: { flex: 1 },
  actions: { flexShrink: 0 },
  date: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
});
