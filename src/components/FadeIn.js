import { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring,
} from 'react-native-reanimated';
import { EASE_OUT, DURATION, ENTER_SPRING, stagger } from '../lib/motion';

/**
 * Content arriving on screen.
 *
 * Two channels, deliberately different: opacity rides a decelerating curve
 * because it has nothing to overshoot into, while the vertical travel gets a
 * spring so it settles rather than stopping dead. Running both as timings is
 * what makes an entrance look like a slideshow transition.
 *
 * `index` staggers a list so the eye follows it downward instead of taking the
 * whole block at once.
 */
export default function FadeIn({ children, index = 0, distance = 12, style }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = stagger(index);
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION.normal, easing: EASE_OUT })
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: withSpring(distance * (1 - progress.value), ENTER_SPRING) },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
