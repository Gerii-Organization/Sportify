import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Zap, Lock, CircleCheck, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme';
import { rarityFor } from '../../lib/rarity';
import Avatar from '../Avatar';
import Press from '../Press';

/**
 * The avatar frames drawn as art, each tried on the viewer's own avatar.
 *
 * Frames sell on how they look on you, so every card is a fitting room rather
 * than an icon. The corner tag says the one thing worth knowing at a glance —
 * yours, new, exclusive, or how rare — and the button says what a tap does:
 * equip it, buy it (with the price, and a lock when you are short), or find the
 * bundle it comes in.
 */
export default function FrameShowcase({ frames, profile, balance, offerNameFor, onSelect }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - 12) / 2;

  return (
    <View style={styles.grid}>
      {frames.map((item) => (
        <FrameCard
          key={item.id}
          item={item}
          width={cardWidth}
          profile={profile}
          balance={balance}
          offerName={item.exclusive ? offerNameFor?.(item.exclusive) : null}
          onPress={() => onSelect(item)}
        />
      ))}
    </View>
  );
}

function FrameCard({ item, width, profile, balance, offerName, onPress }) {
  const rarity = rarityFor(item.price);
  const short = !item.owned && !item.exclusive && balance < item.price;

  const tag = item.equipped ? { text: 'EQUIPPED', gold: true }
    : item.owned ? { text: 'OWNED' }
      : item.exclusive ? { text: 'EXCLUSIVE', gold: true }
        : item.isNew ? { text: 'NEW', accent: true }
          : rarity ? { text: rarity.label, color: rarity.color }
            : null;

  const label = item.equipped ? `${item.name}, equipped`
    : item.owned ? `${item.name}, owned. Equip`
      : item.exclusive ? `${item.name}, exclusive to the ${offerName}`
        : `${item.name}, ${item.price} energy`;

  return (
    <Press scale={0.97} style={[styles.card, { width }, item.equipped && styles.cardEquipped]} onPress={onPress} accessibilityLabel={label}>
      {tag ? (
        <View style={[styles.tag, tag.gold && styles.tagGold, tag.accent && styles.tagAccent, tag.color && { borderColor: `${tag.color}66` }]}>
          <Text style={[styles.tagText, tag.gold && styles.tagTextGold, tag.accent && styles.tagTextAccent, tag.color && { color: tag.color }]}>
            {tag.text}
          </Text>
        </View>
      ) : null}

      {/* Tall enough for Golden Apex's crown above and clasp below. Its wings
          reach twice as wide as any other frame, so it is shown a little
          smaller to keep them off the tag. */}
      <View style={styles.fitting}>
        <View style={[styles.fittingAvatar, item.type === 'apex' && styles.fittingWide]}>
          <Avatar profile={{ ...(profile || {}), equipped_avatar: item.id }} size={64} />
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.desc} numberOfLines={1}>{item.desc || 'Avatar frame'}</Text>

      {item.equipped ? (
        <View style={[styles.button, styles.buttonGold]}>
          <CircleCheck color={colors.gold} size={14} />
          <Text style={[styles.buttonText, styles.gold]}>Equipped</Text>
        </View>
      ) : item.owned ? (
        <View style={styles.button}>
          <Text style={styles.buttonText}>Equip</Text>
        </View>
      ) : item.exclusive ? (
        <View style={styles.button}>
          <Sparkles color={colors.gold} size={13} />
          <Text style={[styles.buttonText, styles.buttonSmall]} numberOfLines={1}>In {offerName || 'a bundle'}</Text>
        </View>
      ) : (
        <View style={[styles.button, short && styles.buttonShort]}>
          {short ? <Lock color={colors.textFaint} size={13} /> : <Zap color={colors.gold} size={13} fill={colors.gold} />}
          <Text style={[styles.buttonText, short && styles.faint]}>{item.price.toLocaleString()}</Text>
        </View>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  card: {
    alignItems: 'center', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
  },
  cardEquipped: { borderColor: colors.goldBorder },

  tag: {
    position: 'absolute', top: 10, left: 10, zIndex: 2,
    borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border,
  },
  tagGold: { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
  tagAccent: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  tagText: { color: colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  tagTextGold: { color: colors.gold },
  tagTextAccent: { color: colors.accent },

  fitting: { width: '100%', height: 136, alignItems: 'center' },
  fittingAvatar: { position: 'absolute', top: 44 },
  fittingWide: { transform: [{ scale: 0.82 }] },

  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  desc: { color: colors.textMuted, fontSize: 11, marginTop: 2, alignSelf: 'stretch', textAlign: 'center' },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', marginTop: 12, height: 38, borderRadius: 999, paddingHorizontal: 8,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  buttonGold: { borderColor: colors.goldBorder, backgroundColor: colors.goldSoft },
  buttonShort: { backgroundColor: colors.surface },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  buttonSmall: { fontSize: 12, flexShrink: 1 },
  gold: { color: colors.gold },
  faint: { color: colors.textFaint },
});
