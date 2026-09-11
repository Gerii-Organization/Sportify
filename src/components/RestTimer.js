import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Timer, X, Plus, Minus } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { formatStopwatch } from '../lib/date';
import { REST_SECONDS_BY_GOAL, REST_CHOICES, restSecondsFor, labelForRestChoice } from '../lib/rest';

export { REST_SECONDS_BY_GOAL, REST_CHOICES, restSecondsFor, labelForRestChoice };

/**
 * Countdown between sets. Starts automatically when a set is ticked.
 *
 * Two details make this behave the way a gym app has to:
 *
 * 1. The end time is stored as a timestamp, not a decrementing counter. A
 *    setInterval stops firing when iOS suspends the app, so a counter would
 *    freeze while the phone is in your pocket — exactly when the timer matters.
 *    Deriving the remaining seconds from a fixed end time makes returning to the
 *    app show the correct value.
 *
 * 2. Rest length follows the training goal. Heavy strength work needs far longer
 *    recovery than a fat-loss circuit.
 */

export default function RestTimer({ endsAt, onExtend, onDismiss }) {
  const [remaining, setRemaining] = useState(() => secondsUntil(endsAt));
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    setRemaining(secondsUntil(endsAt));

    const tick = () => {
      const left = secondsUntil(endsAt);
      setRemaining(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
      }
    };

    const interval = setInterval(tick, 250);

    // Recompute immediately on returning from the background, rather than
    // waiting up to a quarter second for the next tick.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [endsAt]);

  const done = remaining <= 0;

  return (
    <View style={[styles.bar, done && styles.barDone]}>
      <View style={styles.left}>
        <Timer color={done ? colors.onAccent : colors.accent} size={20} />
        <Text style={[styles.time, done && styles.timeDone]}>
          {done ? "Rest over — next set" : formatStopwatch(remaining)}
        </Text>
      </View>

      {!done && (
        <View style={styles.controls}>
          <TouchableOpacity activeOpacity={0.7}
            style={styles.adjust}
            onPress={() => onExtend(-15)}
            accessibilityLabel="Take 15 seconds off the rest timer"
          >
            <Minus color={colors.text} size={16} />
            <Text style={styles.adjustText}>15</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7}
            style={styles.adjust}
            onPress={() => onExtend(15)}
            accessibilityLabel="Add 15 seconds to the rest timer"
          >
            <Plus color={colors.text} size={16} />
            <Text style={styles.adjustText}>15</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} style={styles.close} accessibilityLabel="Dismiss rest timer">
        <X color={done ? colors.onAccent : colors.textSecondary} size={20} />
      </TouchableOpacity>
    </View>
  );
}

function secondsUntil(endsAt) {
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  barDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  time: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  timeDone: { color: colors.onAccent, fontSize: 15 },
  controls: { flexDirection: 'row', gap: 10, marginRight: spacing.sm },
  adjust: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  adjustText: { color: colors.text, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  close: { padding: 6 },
});
