import { View, Text, StyleSheet } from 'react-native';
import { Zap, Lock, Dumbbell } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import BottomSheet from './BottomSheet';
import ItemPreview from './ItemPreview';
import Avatar from './Avatar';
import Press from './Press';

/**
 * Confirming a purchase.
 *
 * Replaces a centred dialog that showed a shopping-bag icon and the price. The
 * price alone is the wrong number: what you weigh before spending is what you
 * are left with, and the old modal never said. So the sheet is a two-line
 * ledger — what you have, what this costs, what remains.
 *
 * An avatar frame is shown on your own avatar, large: the sheet is the last
 * look before spending, and "how will this look on me" is the question.
 *
 * When you cannot afford it, the sheet says by how much and offers the way to
 * close the gap — training, which is what earns energy — rather than a
 * disabled button that only closes the sheet.
 */
export default function BuySheet({ visible, onClose, item, type, balance = 0, busy, onConfirm, profile, onEarnEnergy }) {
  if (!item) return null;

  const price = Number(item.price) || 0;
  const remaining = balance - price;
  const short = remaining < 0;
  const name = item.name || item.id;
  const frame = type === 'avatar';

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard={false}>
      {frame ? (
        <View style={styles.fitting} accessibilityLabel={`${name}, shown on your avatar`}>
          <View style={styles.fittingAvatar}>
            <Avatar profile={{ ...(profile || {}), equipped_avatar: item.id }} size={84} />
          </View>
        </View>
      ) : (
        <View style={styles.preview}>
          <ItemPreview item={item} type={type} scale={1.5} />
        </View>
      )}

      <Text style={styles.name}>{name}</Text>
      {item.desc ? <Text style={styles.desc}>{item.desc}</Text> : null}

      <View style={styles.ledger}>
        <Row label="Your balance" value={balance.toLocaleString()} />
        <Row label={name} value={`−${price.toLocaleString()}`} tint={colors.energy} />

        <View style={styles.rule} />

        {short ? (
          <Row label="Short by" value={(-remaining).toLocaleString()} strong tint={colors.textMuted} />
        ) : (
          <Row label="After purchase" value={remaining.toLocaleString()} strong />
        )}
      </View>

      {short ? (
        <>
          <View style={styles.shortNote}>
            <Lock color={colors.textFaint} size={14} />
            <Text style={styles.shortText}>
              {(-remaining).toLocaleString()} more energy needed. Every minute you train earns 5.
            </Text>
          </View>
          {onEarnEnergy ? (
            <Press scale={0.98} style={styles.buy} onPress={onEarnEnergy} accessibilityLabel="Go to training to earn energy">
              <Dumbbell color={colors.onAccent} size={18} />
              <Text style={styles.buyText}>Earn it by training</Text>
            </Press>
          ) : null}
        </>
      ) : (
        <Press
          scale={0.98}
          style={[styles.buy, busy && { opacity: 0.6 }]}
          onPress={onConfirm}
          disabled={busy}
          accessibilityLabel={`Buy ${name} for ${price} energy`}
        >
          <Zap color={colors.onAccent} size={18} fill={colors.onAccent} />
          <Text style={styles.buyText}>{busy ? 'Buying…' : `Buy for ${price.toLocaleString()}`}</Text>
        </Press>
      )}

      <Press scale={0.98} style={styles.cancel} onPress={onClose} accessibilityLabel="Close without buying">
        <Text style={styles.cancelText}>Not now</Text>
      </Press>
    </BottomSheet>
  );
}

function Row({ label, value, tint, strong }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong, tint && { color: tint }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', justifyContent: 'center', height: 100, marginTop: spacing.xs },
  // Room for Golden Apex's crown above the avatar and its clasp below.
  fitting: { height: 176, alignItems: 'center' },
  fittingAvatar: { position: 'absolute', top: 58 },
  name: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center', marginTop: spacing.md },
  desc: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  ledger: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 13, flexShrink: 1, marginRight: spacing.sm },
  rowLabelStrong: { color: colors.text, fontWeight: '600' },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowValueStrong: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 11 },

  shortNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: spacing.md, paddingHorizontal: 4 },
  shortText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },

  buy: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: radius.md, backgroundColor: colors.accent, marginTop: spacing.md,
  },
  buyText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  cancel: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
