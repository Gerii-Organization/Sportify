import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';
import { colors } from '../theme';

/**
 * Energy flying from where you claimed it to where it is counted.
 *
 * A number that changes while you are looking somewhere else has not been
 * given to you — it has just changed. Watching it travel is what makes the
 * claim feel paid, and it is the reason the balance is worth glancing at.
 *
 * Rendered in an absolutely-positioned overlay that ignores touches, so it can
 * never sit between the user and a button underneath it.
 *
 * `from` and `to` are screen coordinates measured by the caller. The burst is
 * mounted only while it runs — `onDone` is what unmounts it.
 */
const COUNT = 9;
const FLIGHT = 620;
const STAGGER = 55;

export default function EnergyBurst({ from, to, onArrive, onDone }) {
  if (!from || !to) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => (
        <Bolt
          key={i}
          index={i}
          from={from}
          to={to}
          // The shake belongs to the first arrival, not the last: the balance
          // should react the moment it is hit, then settle as the rest land.
          onArrive={i === 0 ? onArrive : undefined}
          onDone={i === COUNT - 1 ? onDone : undefined}
        />
      ))}
    </View>
  );
}

function Bolt({ index, from, to, onArrive, onDone }) {
  const progress = useSharedValue(0);
  const fade = useSharedValue(0);

  // Each bolt leaves on its own arc, so nine of them read as a handful thrown
  // rather than as one object drawn nine times.
  const spreadX = (Math.random() - 0.5) * 120;
  const lift = 70 + Math.random() * 80;
  const spin = (Math.random() - 0.5) * 90;

  useEffect(() => {
    const delay = index * STAGGER;

    fade.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 110 }),
      withDelay(FLIGHT - 260, withTiming(0, { duration: 150 }))
    ));

    progress.value = withDelay(
      delay,
      withTiming(1, { duration: FLIGHT, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (!finished) return;
        if (onArrive) runOnJS(onArrive)();
        if (onDone) runOnJS(onDone)();
      })
    );
  }, [index, progress, fade, onArrive, onDone]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;

    // A quadratic bezier through a control point above the midpoint: a
    // straight line reads as a slide, an arc reads as a throw.
    const cx = (from.x + to.x) / 2 + spreadX;
    const cy = Math.min(from.y, to.y) - lift;

    const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
    const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 0.7 + (1 - t) * 0.5 },
        { rotate: `${spin * t}deg` },
      ],
      opacity: fade.value,
    };
  });

  return (
    <Animated.View style={[styles.bolt, style]}>
      <Zap color={colors.energy} size={22} fill={colors.energy} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  // Positioned entirely by transform, so the layout never reflows mid-flight.
  bolt: { position: 'absolute', left: -11, top: -11 },
});
