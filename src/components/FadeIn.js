import { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, useReducedMotion,
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
  // With Reduce Motion on, content is simply there: no travel, no stagger.
  // Sliding in is decoration, and for people with vestibular sensitivity a
  // screen where every card moves on open is the thing the setting exists for.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const delay = stagger(index);
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION.normal, easing: EASE_OUT })
    );
  }, [index, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: withSpring(distance * (1 - progress.value), ENTER_SPRING) },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
