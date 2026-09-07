import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';

/**
 * A load that failed, with a way to try again.
 *
 * Deliberately not the empty state. "Nothing here yet" is a statement about
 * your data; this is a statement about the connection, and the difference
 * matters to anyone deciding whether they have lost their history.
 *
 * The underlying message is shown small rather than hidden — "JWT expired" or
 * "Network request failed" tells you which of the two problems you have, and
 * one generic sentence tells you nothing.
 */
export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.wrap}>
      <CloudOff color={colors.textFaint} size={34} />
      <Text style={styles.title}>Could not load</Text>
      <Text style={styles.body}>
        Check your connection and try again. Nothing has been lost.
      </Text>
      {message ? <Text style={styles.detail} numberOfLines={2}>{message}</Text> : null}
      {onRetry ? (
        <TouchableOpacity activeOpacity={0.7} style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  body: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  detail: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  button: {
    backgroundColor: colors.accent, marginTop: spacing.xl,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sheet, borderRadius: radius.lg,
  },
  buttonText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
});
