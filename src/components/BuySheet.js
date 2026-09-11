import { View, Text, StyleSheet } from 'react-native';
import { Zap, Lock } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import BottomSheet from './BottomSheet';
import ItemPreview from './ItemPreview';
import Press from './Press';

/**
 * Confirming a purchase.
 *
 * Replaces a centred dialog that showed a shopping-bag icon and the price. The
 * price alone is the wrong number: what you weigh before spending is what you
 * are left with, and the old modal never said. So the sheet is a two-line
 * ledger — what you have, what this costs, what remains.
 *
 * It also takes over the "you cannot afford this" case. That used to be an
 * Alert fired on tap, which meant the only way to learn an item was out of
 * reach was to try to buy it. Here the same sheet opens with the shortfall in
 * place of the remainder and the button switched off, so the answer is in the
 * same place either way.
 */
export default function BuySheet({ visible, onClose, item, type, balance = 0, busy, onConfirm }) {
  if (!item) return null;

  const price = Number(item.price) || 0;
  const remaining = balance - price;
  const short = remaining < 0;
  const name = item.name || item.id;

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard={false}>
      <View style={styles.preview}>
        <ItemPreview item={item} type={type} scale={1.5} />
      </View>

      <Text style={styles.name}>{name}</Text>
      {item.desc ? <Text style={styles.desc}>{item.desc}</Text> : null}

      <View style={styles.ledger}>
        <Row label="Energy you have" value={balance.toLocaleString()} />
        <Row label={name} value={`−${price.toLocaleString()}`} tint={colors.energy} />

        <View style={styles.rule} />

        {short ? (
          <Row label="Short by" value={(-remaining).toLocaleString()} strong tint={colors.textMuted} />
        ) : (
          <Row label="Left after this" value={remaining.toLocaleString()} strong />
        )}
      </View>

      <Press
        scale={0.98}
        style={[styles.buy, short && styles.buyOff, busy && { opacity: 0.6 }]}
        onPress={short ? onClose : onConfirm}
        disabled={busy}
        accessibilityLabel={short ? `You need ${-remaining} more energy` : `Buy ${name} for ${price} energy`}
      >
        {short ? (
          <>
            <Lock color={colors.textMuted} size={17} />
            <Text style={styles.buyOffText}>{(-remaining).toLocaleString()} more energy needed</Text>
          </>
        ) : (
          <>
            <Zap color={colors.onAccent} size={18} fill={colors.onAccent} />
            <Text style={styles.buyText}>{busy ? 'Buying…' : `Buy for ${price.toLocaleString()}`}</Text>
          </>
        )}
      </Press>

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
  name: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center', marginTop: spacing.md },
  desc: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  ledger: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 13, flexShrink: 1, marginRight: spacing.sm },
  rowLabelStrong: { color: colors.text, fontWeight: '600' },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowValueStrong: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 11 },

  buy: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: radius.md, backgroundColor: colors.accent, marginTop: spacing.md,
  },
  buyOff: { backgroundColor: colors.surfaceHigh },
  buyText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  buyOffText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  cancel: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
