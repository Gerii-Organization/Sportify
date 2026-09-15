import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { colors } from '../theme';
import { RIR_CHOICES, normaliseRir } from '../lib/effort';

/**
 * Asks how many reps were left, right under the set that was just ticked.
 *
 * Inline rather than a sheet: a sheet would cover the rest timer and demand an
 * answer. Here it is one tap while the effort is still fresh, or it is ignored —
 * ticking the next set moves the question along, and the × puts it away. An
 * unrated set is still a logged set; the rating only sharpens next session's
 * suggestion.
 */
export default function EffortPicker({ value, onPick, onDismiss }) {
  const current = normaliseRir(value);

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.wrap}>
      <Text style={styles.question}>Reps left?</Text>
      <View style={styles.chips}>
        {RIR_CHOICES.map((choice) => {
          const selected = current === choice.value;
          return (
            <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              key={choice.value}
              activeOpacity={0.7}
              onPress={() => onPick(choice.value)}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.value === 0 ? 'No reps left' : `${choice.label} reps left`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{choice.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={10}
        style={styles.close}
        accessibilityLabel="Skip rating this set"
      >
        <X color={colors.textMuted} size={16} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  question: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chips: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  chip: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  close: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
