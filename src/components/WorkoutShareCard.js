import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Flame, Trophy, Star } from 'lucide-react-native';
import { formatVolume } from '../lib/units';

/**
 * The finished workout as a story-sized image.
 *
 * Drawn at 9:16 — the shape Instagram and TikTok stories are — and captured by
 * WorkoutSummary with react-native-view-shot, so the same view is both the
 * preview on screen and the picture that gets shared: what you see is exactly
 * what goes out.
 *
 * Colours are literal rather than theme tokens on purpose. The image leaves the
 * app, so it has to look the same whatever theme the phone that made it was in.
 *
 * Only facts the session actually produced are drawn. No rewards on a session
 * saved offline (the server has not priced it yet), no streak chip on a day
 * that did not extend one, no records row without a record.
 */

export const SHARE_CARD_SIZE = { width: 270, height: 480 };

const INK = '#F0F1F8';
const MUTED = '#A9ABC6';
const FAINT = '#6F7390';
const PERIWINKLE = '#9B9DD6';
const GOLD = '#DEB866';
const TERRACOTTA = '#E0A17A';

const WorkoutShareCard = forwardRef(function WorkoutShareCard(
  { stats, workoutName, units, firstName },
  ref
) {
  const s = stats || {};
  const minutes = Math.max(1, Math.round((Number(s.time) || 0) / 60));
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const records = s.records?.length || 0;

  const tiles = [
    { label: 'Time', value: `${minutes} min` },
    { label: 'Volume', value: Number(s.volume) > 0 ? formatVolume(s.volume, units) : '—' },
    { label: 'Sets', value: String(s.sets || 0) },
    { label: 'Burn', value: s.kcal ? `${s.kcal} kcal` : '—' },
  ];

  const chips = [
    s.isFirstWorkoutToday && s.newStreak > 0
      ? { key: 'streak', Icon: Flame, tint: TERRACOTTA, text: `${s.newStreak}-day streak`, fill: true }
      : null,
    records > 0
      ? { key: 'records', Icon: Trophy, tint: GOLD, text: records === 1 ? 'New record' : `${records} new records`, fill: true }
      : null,
    !s.queued && s.xpGained > 0
      ? { key: 'xp', Icon: Star, tint: PERIWINKLE, text: `+${s.xpGained} XP`, fill: true }
      : null,
  ].filter(Boolean);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={['#2A2C52', '#171930', '#0E1017']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Two soft rings behind the badge: the atmosphere of the summary screen,
          without AmbientGlow, which sizes itself to the device window rather
          than to this card. */}
      <View style={[styles.ring, styles.ringOuter]} />
      <View style={[styles.ring, styles.ringInner]} />

      <View style={styles.top}>
        <Text style={styles.brand}>SPORTIFY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={['#B0B2EA', '#8486C4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Check color="#0D0F17" size={26} strokeWidth={3} />
        </LinearGradient>
        <Text style={styles.eyebrow}>WORKOUT COMPLETE</Text>
        <Text style={styles.name} numberOfLines={2}>{workoutName || 'Workout'}</Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {chips.length ? (
        <View style={styles.chips}>
          {chips.map(({ key, Icon, tint, text, fill }) => (
            <View key={key} style={[styles.chip, { borderColor: `${tint}55`, backgroundColor: `${tint}1F` }]}>
              <Icon color={tint} fill={fill ? tint : 'transparent'} size={11} />
              <Text style={[styles.chipText, { color: tint }]}>{text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.rule} />
        <Text style={styles.footerText} numberOfLines={1}>
          {firstName ? `${firstName} trained with Sportify` : 'Trained with Sportify'}
        </Text>
      </View>
    </View>
  );
});

export default WorkoutShareCard;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_SIZE.width,
    height: SHARE_CARD_SIZE.height,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: '#0E1017',
  },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(155, 157, 214, 0.16)', borderRadius: 999 },
  ringOuter: { width: 300, height: 300, top: -40, left: -15 },
  ringInner: { width: 190, height: 190, top: 15, left: 40, borderColor: 'rgba(155, 157, 214, 0.22)' },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: INK, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  date: { color: MUTED, fontSize: 10, fontWeight: '600' },

  hero: { alignItems: 'center', marginTop: 34 },
  badge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: PERIWINKLE, fontSize: 9, fontWeight: '800', letterSpacing: 2, marginTop: 16 },
  name: {
    color: INK, fontSize: 23, fontWeight: '800', letterSpacing: -0.6,
    lineHeight: 28, textAlign: 'center', marginTop: 6,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 26 },
  tile: {
    flexBasis: '47%', flexGrow: 1, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1, borderColor: 'rgba(155, 157, 214, 0.14)',
  },
  tileValue: { color: INK, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  tileLabel: { color: FAINT, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 3 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  chipText: { fontSize: 10, fontWeight: '700' },

  footer: { marginTop: 'auto', alignItems: 'center' },
  rule: { width: 36, height: 2, borderRadius: 1, backgroundColor: 'rgba(155, 157, 214, 0.35)', marginBottom: 10 },
  footerText: { color: MUTED, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});
