import { View, Text, StyleSheet, Linking } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme';
import { PRIVACY_URL, LINKS_CONFIGURED } from '../../constants/links';
import Press from '../Press';

/** Apple's standard licence, which applies unless the app ships its own. */
const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * The small print under the shop.
 *
 * Once real money is involved the stores expect three things here: a way to
 * restore purchases (Apple rejects non-consumables without one), the terms,
 * and the privacy policy. Until then it says plainly what can and cannot be
 * bought yet, instead of leaving "Soon" buttons unexplained.
 */
export default function ShopFooter({ purchasable, onRestore, restoring }) {
  const open = (url) => Linking.openURL(url).catch(() => {});

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ShieldCheck color={colors.textFaint} size={14} />
        <Text style={styles.note}>
          {purchasable
            ? 'Purchases are tied to your Sportify account and carry over to a new phone.'
            : 'Offers paid with real money open soon. Everything else in the shop is bought with energy you earn by training.'}
        </Text>
      </View>

      {purchasable || LINKS_CONFIGURED ? (
        <View style={styles.links}>
          {purchasable ? (
            <Press scale={0.96} onPress={onRestore} disabled={restoring} hitSlop={8} accessibilityLabel="Restore purchases">
              <Text style={styles.link}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
            </Press>
          ) : null}
          {purchasable ? (
            <Press scale={0.96} onPress={() => open(APPLE_EULA)} hitSlop={8} accessibilityLabel="Terms of use">
              <Text style={styles.link}>Terms of use</Text>
            </Press>
          ) : null}
          {LINKS_CONFIGURED ? (
            <Press scale={0.96} onPress={() => open(PRIVACY_URL)} hitSlop={8} accessibilityLabel="Privacy policy">
              <Text style={styles.link}>Privacy</Text>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 32, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  note: { flex: 1, color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, paddingLeft: 22 },
  link: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
