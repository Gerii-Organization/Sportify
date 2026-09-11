import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';

/**
 * What the user sees instead of a white screen.
 *
 * Deliberately plain: this renders when something in the app has already
 * failed, so it uses no context, no navigation, no data fetching and no
 * component that could fail the same way twice.
 */
export default function CrashScreen({ onReset, detail }) {
  return (
    <View style={styles.wrap}>
      <CloudOff color={colors.textFaint} size={40} />
      <Text style={styles.title}>Something broke</Text>
      <Text style={styles.body}>
        Not your fault, and nothing you logged has been lost — it is saved on the server.
        Try again, and if it keeps happening, closing and reopening the app clears it.
      </Text>

      {detail ? <Text style={styles.detail} numberOfLines={3}>{detail}</Text> : null}

      <TouchableOpacity activeOpacity={0.8} style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, paddingHorizontal: spacing.xl,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: spacing.md, letterSpacing: -0.4 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm },
  detail: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
  button: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 15, paddingHorizontal: spacing.xxl, marginTop: spacing.xl,
  },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
});
