import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Circle, Ellipse, Path, Polygon, Rect, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { frameArt, ART_SCALE, COMPACT_BELOW } from '../../lib/frames';
import GoldenApexFrame from './GoldenApexFrame';

/**
 * Draws an avatar frame around an avatar of diameter `size`.
 *
 * The geometry lives in src/lib/frames.js as plain data; this only turns it
 * into react-native-svg elements and places it. It is positioned absolutely and
 * centred on the avatar, reaching out past its edge, so the parent has to let
 * it overflow — Avatar.js already does, for crowns.
 *
 * Golden Apex at full size is its own animated component with its own
 * proportions (the ring sits below a crown), so it is placed differently.
 */

const TAGS = { LinearGradient, RadialGradient, Stop, Circle, Ellipse, Path, Polygon, Rect, Line, G };

function draw(node, key) {
  const Element = TAGS[node.tag];
  if (!Element) return null;
  return (
    <Element key={key} {...node.props}>
      {node.children ? node.children.map(draw) : null}
    </Element>
  );
}

/** One slow turn every 24 seconds; still for Reduce Motion. */
function Spin({ children, style }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    turn.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);

  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export default function FrameArt({ type, size, animated = true }) {
  const compact = size < COMPACT_BELOW;

  if (type === 'apex' && !compact) {
    // GoldenApexFrame's ring is centred at (100, 112) on its 200 box with an
    // inner edge of 48: the avatar has to be 96/200 of the box, sitting on that
    // centre rather than the box's.
    const box = (size * 200) / 96;
    return (
      <View pointerEvents="none" style={[styles.layer, { left: (size - box) / 2, top: size / 2 - (box * 112) / 200 }]}>
        <GoldenApexFrame size={box} animated={animated} />
      </View>
    );
  }

  const art = frameArt(type, { compact });
  if (!art) return null;

  const box = size * ART_SCALE;
  const offset = (size - box) / 2;
  const placed = [styles.layer, { left: offset, top: offset, width: box, height: box }];
  const svg = (
    <Svg width={box} height={box} viewBox="0 0 200 200">
      <Defs>{art.defs.map(draw)}</Defs>
      {art.shapes.map(draw)}
    </Svg>
  );

  if (art.spin && animated) {
    return (
      <View pointerEvents="none" style={placed}>
        <Spin style={StyleSheet.absoluteFill}>{svg}</Spin>
      </View>
    );
  }
  return <View pointerEvents="none" style={placed}>{svg}</View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
