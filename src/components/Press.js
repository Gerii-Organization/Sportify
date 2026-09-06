import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { PRESS_SPRING } from '../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A tappable surface that responds like a physical control.
 *
 * TouchableOpacity fades the whole element toward transparent, which reads as
 * the screen dimming rather than the button moving. Scaling down slightly reads
 * as pressure. The spring runs on the UI thread, so it holds its timing even
 * while a fetch is blocking JavaScript.
 *
 * `scale` is tuned per surface: a small icon button needs a deeper press to be
 * noticeable, a full-width card needs almost none or it looks rubbery.
 */
export default function Press({
  children,
  onPress,
  onLongPress,
  scale = 0.97,
  dimOnPress = false,
  disabled,
  style,
  ...rest
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - pressed.value * (1 - scale), PRESS_SPRING) }],
    opacity: dimOnPress ? withSpring(1 - pressed.value * 0.25, PRESS_SPRING) : 1,
  }));

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      onPressIn={() => { pressed.value = 1; }}
      onPressOut={() => { pressed.value = 0; }}
      disabled={disabled}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
