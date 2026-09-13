import { Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Circle, Path, Polygon, G } from 'react-native-svg';

/**
 * The Golden Apex avatar frame: a gilded ring under a crown, with wings.
 *
 * Drawn in SVG so the shop has it without a binary asset in the repo. The
 * painted version from the mockup is better, and swapping to it is one line:
 * save it as assets/shop/golden-apex-frame.png and replace `null` below with
 *
 *   require('../../../assets/shop/golden-apex-frame.png')
 *
 * A `require` of a file that does not exist fails the whole bundle, not just
 * this component — which is why the line is not already there.
 *
 * The mockup's PNG is wide with the frame centred, so `cover` in a square box
 * crops the empty sides and keeps the frame whole.
 */
const PAINTED = null;

const RIM = '#6D5A2D';

export default function GoldenApexFrame({ size = 110, style }) {
  if (PAINTED) {
    return <Image source={PAINTED} style={[{ width: size, height: size }, style]} resizeMode="cover" />;
  }

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
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

        {/* Back to front: wings, spikes, ring, lower wings, clasp, crown. The
            crown is last because it sits on the ring and hides its top edge. */}
        <Wing />
        <G transform="translate(200, 0) scale(-1, 1)">
          <Wing />
        </G>

        <Polygon points="20,112 44,103 44,121" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="180,112 156,103 156,121" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="36,182 50,152 64,164" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />
        <Polygon points="164,182 150,152 136,164" fill="url(#gilt)" stroke={RIM} strokeWidth={1.2} />

        <Circle cx={100} cy={112} r={56} fill="none" stroke="url(#gilt)" strokeWidth={16} />
        <Circle cx={100} cy={112} r={64} fill="none" stroke={RIM} strokeWidth={1.2} />
        <Circle cx={100} cy={112} r={48} fill="none" stroke={RIM} strokeWidth={1.2} />
        {/* Rivets, as a dashed stroke rather than thirty circles. */}
        <Circle cx={100} cy={112} r={56} fill="none" stroke="#F5E6BE" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="1.5 12" />

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
        <Polygon points="100,28 106,40 100,52 94,40" fill="url(#ruby)" />
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
