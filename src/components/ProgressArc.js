import { useEffect } from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { DURATION } from '../lib/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A ring that fills from empty to its value.
 *
 * The fill is the point. A static arc tells you where you are; watching it
 * travel tells you how far that is — the distance registers as motion before
 * you read the number. It is also the cheapest way to make a screen feel like
 * it responded to being opened rather than being drawn already finished.
 *
 * `strokeDashoffset` is animated through `useAnimatedProps`, so the value is
 * driven on the UI thread. Animating it from JavaScript would drop frames on
 * exactly the screens that are also fetching data.
 *
 * Props:
 *   progress     0–1. Values above 1 are clamped; the ring cannot lap itself.
 *   size         outer diameter in points
 *   strokeWidth  ring thickness
 *   delay        ms before starting, for staggering a row of them
 *   animate      set false to render the final state immediately
 */
export default function ProgressArc({
  progress = 0,
  color,
  trackColor,
  size = 52,
  strokeWidth = 4,
  delay = 0,
  animate = true,
  children,
}) {
  const target = Math.min(Math.max(progress || 0, 0), 1);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const filled = useSharedValue(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      filled.value = target;
      return;
    }
    // Decelerating: leaves immediately, eases into place. A ring that starts
    // slowly reads as the screen struggling rather than as the value arriving.
    filled.value = withDelay(
      delay,
      withTiming(target, { duration: DURATION.normal + 320, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, animate, filled]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - filled.value),
  }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor || `${color}2B`}
        strokeWidth={strokeWidth}
      />
      {/* Rotated so the fill starts at twelve o'clock rather than at three. */}
      <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </G>
      {children}
    </Svg>
  );
}
