
import { Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, gradients } from '../theme';
import Press from './Press';

/**
 * Primary action button.
 *
 * The press animation is the point. A flat opacity fade — TouchableOpacity's
 * default — reads as the screen dimming; a slight scale-down reads as the
 * button physically giving way. Springs, not timings, because a spring settles
 * the way a real object does.
 *
 * `variant`:
 *   primary   filled teal gradient — one per screen, the thing you came to do
 *   secondary raised surface — supporting actions
 *   ghost     text only — cancel, skip, dismiss
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}) {
  const inactive = disabled || loading;
  const textColor =
    variant === 'primary' ? colors.onAccent : variant === 'ghost' ? colors.textSecondary : colors.text;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: textColor }, icon && { marginLeft: 10 }]}>{label}</Text>
        </>
      )}
    </View>
  );

  return (
    <Press
      onPress={onPress}
      disabled={inactive}
      scale={0.975}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
        {variant === 'primary' ? (
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.base}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.base, variant === 'secondary' ? styles.secondary : styles.ghost]}>
            {content}
          </View>
        )}
    </Press>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: colors.surfaceHigh },
  ghost: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  inactive: { opacity: 0.45 },
});
