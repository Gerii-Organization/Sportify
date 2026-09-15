import { useEffect } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Circle, Path, Polygon, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay,
  cancelAnimation, Easing, useReducedMotion,
} from 'react-native-reanimated';

/**
 * The Golden Apex avatar frame: a gilded ring under a crown, with wings.
 *
 * Animated (roadmap G5), in three slow layers so it reads as precious rather
 * than busy:
 *   · a warm halo behind it that breathes over a few seconds
 *   · a glint that travels once around the ring, then rests
 *   · the crown's gem catching the light as the glint passes the top
 * All three run on the UI thread, and all three stop for Reduce Motion — the
 * frame is then drawn exactly as it was before it moved.
 *
 * Drawn in SVG so the shop has it without a binary asset in the repo. The
 * painted version from the mockup is better, and swapping to it is one line:
 * save it as assets/shop/golden-apex-frame.png and replace `null` below with
 *
 *   require('../../../assets/shop/golden-apex-frame.png')
 *
 * A `require` of a file that does not exist fails the whole bundle, not just
 * this component — which is why the line is not already there.
 */
const PAINTED = null;

const RIM = '#6D5A2D';
const RING_R = 56;
const RING_LENGTH = 2 * Math.PI * RING_R;
const GLINT = 34;
const LOOP_MS = 5200;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

export default function GoldenApexFrame({ size = 110, style, animated = true }) {
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;

  const halo = useSharedValue(0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (!moving) {
      cancelAnimation(halo);
      cancelAnimation(glint);
      halo.value = 0;
      glint.value = 0;
      return undefined;
    }
    halo.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    // Travel for 1.8 s, then rest: a glint that never stops reads as a loader.
    glint.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
        withDelay(LOOP_MS - 1800, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(halo);
      cancelAnimation(glint);
    };
  }, [moving, halo, glint]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + halo.value * 0.3,
    transform: [{ scale: 0.92 + halo.value * 0.08 }],
  }));

  // Starts at the top of the ring (the circle is rotated -90°) and goes round.
  const glintProps = useAnimatedProps(() => ({
    strokeDashoffset: -glint.value * RING_LENGTH,
    strokeOpacity: glint.value > 0 && glint.value < 1 ? 0.85 : 0,
  }));

  // The gem flares as the glint leaves the top and again as it returns.
  const gemProps = useAnimatedProps(() => {
    const nearTop = Math.min(glint.value, 1 - glint.value);
    return { fillOpacity: 0.75 + Math.max(0, 0.12 - nearTop) * 2 };
  });

  if (PAINTED) {
    return <Image source={PAINTED} style={[{ width: size, height: size }, style]} resizeMode="cover" />;
  }

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      {moving ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, haloStyle]}>
          <View style={[styles.halo, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35, top: size * 0.21 }]} />
        </Animated.View>
      ) : null}

      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="gilt" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F5E6BE" />
            <Stop offset="0.35" stopColor="#E2C07A" />
            <Stop offset="0.7" stopColor="#B8913F" />
            <Stop offset="1" stopColor="#7A5E2A" />
          </LinearGradient>
          <LinearGradient id="feather" x1="1" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#A8843C" />
            <Stop offset="1" stopColor="#F1DDA6" />
          </LinearGradient>
          <RadialGradient id="ruby" cx="0.4" cy="0.35" r="0.7">
            <Stop offset="0" stopColor="#E88AA4" />
            <Stop offset="1" stopColor="#6E1F3A" />
          </RadialGradient>
          <RadialGradient id="sapphire" cx="0.4" cy="0.35" r="0.7">
            <Stop offset="0" stopColor="#8F9CE8" />
            <Stop offset="1" stopColor="#1E2350" />
          </RadialGradient>
        </Defs>

        {/* Back to front: wings, spikes, ring, glint, lower wings, clasp, crown.
            The crown is last because it sits on the ring and hides its top. */}
        <Wing />
        <G transform="translate(200, 0) scale(-1, 1)">
          <Wing />
        </G>

        <Polygon points="20,112 44,103 44,121" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="180,112 156,103 156,121" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="36,182 50,152 64,164" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="164,182 150,152 136,164" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />

        <Circle cx={100} cy={112} r={RING_R} fill="none" stroke="url(#gilt)" strokeWidth={16} />
        <Circle cx={100} cy={112} r={64} fill="none" stroke={RIM} strokeWidth={1.2} />
        <Circle cx={100} cy={112} r={48} fill="none" stroke={RIM} strokeWidth={1.2} />
        {/* Rivets, as a dashed stroke rather than thirty circles. */}
        <Circle cx={100} cy={112} r={RING_R} fill="none" stroke="#F5E6BE" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="1.5 12" />

        {moving ? (
          <G transform="rotate(-90 100 112)">
            <AnimatedCircle
              cx={100}
              cy={112}
              r={RING_R}
              fill="none"
              stroke="#FFF6DC"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${GLINT} ${RING_LENGTH}`}
              animatedProps={glintProps}
            />
          </G>
        ) : null}

        <LowerWing />
        <G transform="translate(200, 0) scale(-1, 1)">
          <LowerWing />
        </G>

        <Polygon points="78,160 100,172 122,160 116,182 100,198 84,182" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="100,166 108,174 108,185 100,193 92,185 92,174" fill="url(#sapphire)" stroke="#C59D4C" strokeWidth={1.2} />

        <Polygon
          points="68,66 60,30 80,50 86,22 94,40 100,4 106,40 114,22 120,50 140,30 132,66"
          fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} strokeLinejoin="round"
        />
        <Path d="M66 62 L134 62 L130 76 L70 76 Z" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        {moving ? (
          <AnimatedPolygon points="100,28 106,40 100,52 94,40" fill="url(#ruby)" animatedProps={gemProps} />
        ) : (
          <Polygon points="100,28 106,40 100,52 94,40" fill="url(#ruby)" />
        )}
        <Polygon points="100,62 104,69 100,76 96,69" fill="url(#ruby)" />
        <Circle cx={82} cy={69} r={2.4} fill="url(#ruby)" />
        <Circle cx={118} cy={69} r={2.4} fill="url(#ruby)" />
      </Svg>
    </View>
  );
}

/** Four feathers fanning up and out from the ring's shoulder, plus its eye. */
function Wing() {
  return (
    <G>
      <Path d="M74 62 C60 40 40 22 18 10 C28 28 46 50 66 70 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
      <Path d="M70 70 C52 56 32 44 10 34 C24 50 44 64 64 78 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
      <Path d="M68 80 C50 72 32 64 12 58 C26 72 46 82 64 88 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
      <Path d="M68 90 C54 86 38 82 20 80 C32 92 50 98 66 98 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
      <Polygon points="68,70 75,63 82,70 75,77" fill="url(#ruby)" stroke={RIM} strokeWidth={0.8} />
    </G>
  );
}

/** The smaller pair either side of the clasp. */
function LowerWing() {
  return (
    <G>
      <Path d="M92 170 C80 162 68 160 52 162 C62 172 78 178 92 180 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
      <Path d="M92 178 C82 176 70 178 58 186 C70 192 84 192 94 186 Z" fill="url(#feather)" stroke={RIM} strokeWidth={1} />
    </G>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(222, 184, 102, 0.35)',
    shadowColor: '#DEB866',
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
});
