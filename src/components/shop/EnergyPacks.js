import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Lock } from 'lucide-react-native';
import { colors, gradients } from '../../theme';
import { bonusPercent } from '../../lib/offers';
import Press from '../Press';

/**
 * Energy for money, smallest to largest.
 *
 * Four packs in a two-by-two grid and the largest across the bottom, because
 * the largest is the one that sells on value and needs the room to say so.
 * Each card shows the energy first — it is what is being bought — then the
 * bonus over the smallest pack, worked out from the numbers rather than typed.
 *
 * The pile of bolts grows with the pack: size is read before any number is.
 */
export default function EnergyPacks({ packs, purchasable, priceFor, onBuy }) {
  const base = packs[0];
  const grid = packs.slice(0, -1);
  const last = packs[packs.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {grid.map((pack, i) => (
          <PackCard
            key={pack.id}
            pack={pack}
            tier={i + 1}
            bonus={bonusPercent(pack, base)}
            price={priceFor?.(pack)}
            purchasable={purchasable}
            onPress={() => onBuy(pack)}
          />
        ))}
      </View>
      {last ? (
        <PackCard
          wide
          pack={last}
          tier={packs.length}
          bonus={bonusPercent(last, base)}
          price={priceFor?.(last)}
          purchasable={purchasable}
          onPress={() => onBuy(last)}
        />
      ) : null}
    </View>
  );
}

/**
 * One bolt that grows with the pack, and a smaller one around it for each tier
 * above the first. Reads as "more" at a glance without a row of icons to count.
 */
const SATELLITES = [
  { left: 0.02, top: 0.06, rotate: -18 },
  { left: 0.66, top: 0.02, rotate: 16 },
  { left: 0.0, top: 0.6, rotate: -8 },
  { left: 0.7, top: 0.58, rotate: 22 },
];

function Bolts({ tier, size = 20 }) {
  const box = size * 2.3;
  const main = size * (0.95 + tier * 0.09);
  const small = size * 0.55;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {SATELLITES.slice(0, Math.max(0, tier - 1)).map((spot) => (
        <View key={`${spot.left}-${spot.top}`} style={[styles.bolt, { left: spot.left * box, top: spot.top * box, opacity: 0.8, transform: [{ rotate: `${spot.rotate}deg` }] }]}>
          <Zap color={colors.gold} fill={colors.gold} size={small} />
        </View>
      ))}
      <Zap color={colors.gold} fill={colors.gold} size={main} />
    </View>
  );
}

function PackCard({ pack, tier, bonus, price, purchasable, wide = false, onPress }) {
  const popular = pack.tag === 'Most popular';
  const best = pack.tag === 'Best value';
  const live = purchasable && price;

  const button = live ? (
    <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.buy, wide && styles.buyWide]}>
      <Text style={styles.buyTextGold}>{price}</Text>
    </LinearGradient>
  ) : (
    <View style={[styles.buy, styles.buyQuiet, wide && styles.buyWide]}>
      <Lock color={colors.textFaint} size={12} />
      <Text style={styles.buyText}>Soon</Text>
    </View>
  );

  const label = `${pack.name}, ${pack.energy.toLocaleString()} energy${bonus ? `, ${bonus} percent bonus` : ''}${live ? `, ${price}` : ', coming soon'}`;

  if (wide) {
    return (
      <Press scale={0.98} style={styles.wideWrap} onPress={onPress} accessibilityLabel={label}>
        <LinearGradient colors={gradients.goldCard} style={[styles.card, styles.wide, styles.cardGold]}>
          <View style={styles.wideOrb}>
            <Bolts tier={tier} size={22} />
          </View>
          <View style={styles.wideCopy}>
            <Text style={styles.name}>{pack.name.toUpperCase()}</Text>
            <View style={styles.amountRow}>
              <Text style={[styles.amount, styles.amountWide]}>{pack.energy.toLocaleString()}</Text>
              <Zap color={colors.gold} size={15} fill={colors.gold} />
            </View>
            {bonus ? <Text style={styles.bonus}>+{bonus}% bonus energy</Text> : null}
          </View>
          {button}
        </LinearGradient>
        {pack.tag ? <Ribbon text={pack.tag} gold wide /> : null}
      </Press>
    );
  }

  return (
    <Press scale={0.97} style={[styles.card, styles.half, popular && styles.cardGold]} onPress={onPress} accessibilityLabel={label}>
      {pack.tag ? <Ribbon text={pack.tag} gold={popular || best} /> : null}
      <Text style={styles.name}>{pack.name.toUpperCase()}</Text>
      <View style={[styles.orb, popular && styles.orbGold]}>
        <Bolts tier={tier} size={17} />
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>{pack.energy.toLocaleString()}</Text>
        <Zap color={colors.gold} size={13} fill={colors.gold} />
      </View>
      <Text style={[styles.bonus, !bonus && styles.bonusNone]}>{bonus ? `+${bonus}% bonus` : 'Starter size'}</Text>
      {button}
    </Press>
  );
}

function Ribbon({ text, gold, wide = false }) {
  return (
    <View style={[styles.ribbon, gold && styles.ribbonGold, wide && styles.ribbonWide]}>
      <Text style={[styles.ribbonText, gold && styles.ribbonTextGold]}>{text.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  card: {
    alignItems: 'center', paddingHorizontal: 12, paddingTop: 18, paddingBottom: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
  },
  half: { flexBasis: '47%', flexGrow: 1 },
  cardGold: { borderColor: colors.goldBorder },

  ribbon: {
    position: 'absolute', top: -10,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border,
  },
  ribbonGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  ribbonWide: { left: 16 },
  ribbonText: { color: colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  ribbonTextGold: { color: colors.onGold },

  name: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  orb: {
    width: 74, height: 56, borderRadius: 16, marginVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  orbGold: { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
  bolt: { position: 'absolute' },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  amountWide: { fontSize: 24 },
  bonus: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 3 },
  bonusNone: { color: colors.textFaint, fontWeight: '600' },

  buy: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', height: 38, borderRadius: 999, marginTop: 12,
  },
  buyWide: { alignSelf: 'center', marginTop: 0, paddingHorizontal: 16, minWidth: 92 },
  buyQuiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buyText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  buyTextGold: { color: colors.onGold, fontSize: 14, fontWeight: '800' },

  wideWrap: { marginTop: 4 },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 18, paddingBottom: 16, paddingHorizontal: 16 },
  wideOrb: {
    width: 84, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldBorder,
  },
  wideCopy: { flex: 1 },
});
