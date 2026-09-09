import { View, Text, StyleSheet } from 'react-native';
import { Shield, Swords, Ghost, Crown } from 'lucide-react-native';
import { getBadge, DEFAULT_BADGE_ID } from '../constants/cosmetics';
import { colors } from '../theme';

/**
 * The badge beside someone's name.
 *
 * Badges were the one cosmetic with nowhere to appear. Everything else existed
 * — the catalogue, the shop's preview, the equip handler, the profiles column —
 * but there was no shelf to buy one from and no place a bought one showed up.
 * Selling something invisible is worse than not selling it.
 *
 * The free default (Rookie) is not drawn. Everyone has it, so rendering it puts
 * an identical grey shield next to all nineteen names and the badge stops
 * meaning anything.
 */
const ICONS = { Shield, Swords, Ghost, Crown };

export default function NameBadge({ badgeId, size = 14, showLabel = false }) {
  if (!badgeId || badgeId === DEFAULT_BADGE_ID) return null;

  const badge = getBadge(badgeId);
  if (!badge) return null;

  const Icon = ICONS[badge.icon] || Shield;

  if (!showLabel) return <Icon color={badge.color} size={size} />;

  return (
    <View style={[styles.pill, { backgroundColor: `${badge.color}1F` }]}>
      <Icon color={badge.color} size={size} />
      <Text style={[styles.label, { color: badge.color }]}>{badge.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, color: colors.text },
});
