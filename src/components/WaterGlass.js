import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, ClipPath, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { colors } from '../theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * A glass that fills with what you drank today.
 *
 * A ring reads as a percentage; a glass reads as a glass. For a quantity people
 * already picture as a container, the container is the honest shape — and half
 * full at a glance needs no number underneath it.
 *
 * The water is one rectangle behind a glass-shaped clip path, animated by its
 * `y`. Clipping rather than drawing a wavy path means the surface stays level
 * and the shape of the glass does the work.
 */
const W = 120;
const H = 168;

// Slight taper, rounded base — a drinking glass rather than a beaker.
const GLASS = `M ${W * 0.17} 6
  L ${W * 0.83} 6
  L ${W * 0.75} ${H - 18}
  Q ${W * 0.73} ${H - 4} ${W * 0.60} ${H - 4}
  L ${W * 0.40} ${H - 4}
  Q ${W * 0.27} ${H - 4} ${W * 0.25} ${H - 18}
  Z`;

export default function WaterGlass({ ml = 0, goalMl = 2500, animate = true }) {
  const filled = Math.max(0, Math.min(1, goalMl > 0 ? ml / goalMl : 0));

  // `y` counts down from the bottom, so 0 fill sits the rectangle below the
  // glass entirely and full fill puts its top edge at the rim.
  const level = useSharedValue(H);

  useEffect(() => {
    const target = H - filled * H;
    level.value = animate
      ? withDelay(140, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }))
      : target;
  }, [filled, animate, level]);

  const waterProps = useAnimatedProps(() => ({ y: level.value }));

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H}>
        <Defs>
          <ClipPath id="glass">
            <Path d={GLASS} />
          </ClipPath>
          <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#7FD3F5" stopOpacity="0.95" />
            <Stop offset="100%" stopColor={colors.water} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* The empty glass, so the unfilled part still reads as glass rather
            than as nothing. */}
        <Path d={GLASS} fill="rgba(79, 184, 232, 0.07)" />

        <AnimatedRect
          x="0"
          width={W}
          height={H}
          fill="url(#water)"
          clipPath="url(#glass)"
          animatedProps={waterProps}
        />

        <Path d={GLASS} fill="none" stroke={colors.water} strokeWidth={2.5} strokeOpacity={0.75} />
      </Svg>

      <Text style={styles.percent}>{Math.round(filled * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  percent: {
    color: colors.textMuted, fontSize: 12, fontWeight: '700',
    marginTop: 10, letterSpacing: 0.4, fontVariant: ['tabular-nums'],
  },
});
