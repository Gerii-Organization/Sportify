import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * The sunrise halo behind a screen's hero area.
 *
 * Deliberately NOT a full-screen background. A saturated gradient behind a
 * table of sets or a chat list destroys legibility — the reference this came
 * from is an onboarding screen with eight words on it. Here the glow sits at
 * the top, fades out well before the content starts, and the ground underneath
 * stays flat where numbers have to be read.
 *
 * Built with SVG radial stops rather than expo-linear-gradient because a linear
 * ramp cannot produce a soft circular falloff, and React Native has no
 * equivalent of a CSS blur filter on an arbitrary layer.
 *
 * Props:
 *   tone       'ember' (cool aurora, default), 'accent' (teal) or 'warm' (fire)
 *   height     how far down the screen it reaches
 *   intensity  0–1 opacity of the whole layer
 */
const TONES = {
  ember: { inner: '#7FD9FF', mid: '#1E7FC4' },
  accent: { inner: '#4FE8D8', mid: '#149C93' },
  warm: { inner: '#FFB84D', mid: '#E8631A' },
};

export default function AmbientGlow({ tone = 'ember', height = 340, intensity = 0.5 }) {
  const { inner, mid } = TONES[tone] || TONES.ember;

  return (
    <View style={[styles.layer, { height }]} pointerEvents="none">
      <Svg width={SCREEN_W} height={height}>
        <Defs>
          {/* Anchored above the top edge so only the lower half of the falloff
              is visible — that is what reads as light spilling in. */}
          <RadialGradient id="halo" cx="50%" cy="4%" rx="78%" ry="86%">
            <Stop offset="0%" stopColor={inner} stopOpacity="0.95" />
            <Stop offset="38%" stopColor={mid} stopOpacity="0.55" />
            <Stop offset="72%" stopColor={mid} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={height} fill="url(#halo)" opacity={intensity} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
