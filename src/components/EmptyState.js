import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * Consistent empty / signed-out state for lists.
 * Replaces a mix of bare `<Text>No workouts yet.</Text>` lines and one
 * hand-built block in FriendsScreen.
 */
export default function EmptyState({ icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      {icon}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity activeOpacity={0.7} style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  message: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  button: { backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.sheet, borderRadius: radius.lg },
  buttonText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
});
