import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Droplets } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { deviceTimeZone } from '../lib/date';
import { WATER_AMOUNTS } from '../constants/content';
import BottomSheet from './BottomSheet';
import Press from './Press';

/**
 * Logging water, wherever water is shown.
 *
 * This was a modal built inline in DashboardScreen, which meant the only way to
 * record a glass was from the home screen — and the water metric screen, the
 * one place you go specifically to look at your water, could only show you the
 * number without letting you change it.
 *
 * `add_water` does the arithmetic and the goal XP in one transaction, and hands
 * back the resulting total; the caller is told through `onLogged` rather than
 * recomputing it. A client that adds the amount itself is the read-modify-write
 * shape that loses one of two quick taps.
 */
export default function WaterSheet({ visible, onClose, currentMl = 0, onLogged }) {
  const [busy, setBusy] = useState(false);

  const log = async (amount) => {
    if (busy) return;
    setBusy(true);

    const { data, error } = await supabase.rpc('add_water', {
      p_ml: amount,
      p_tz: deviceTimeZone(),
    });

    setBusy(false);

    if (error || !data?.ok) {
      console.warn(`[Sportify] Could not log water: ${error?.message || data?.reason}`);
      return;
    }

    onLogged?.(data);
    onClose?.();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add water">
      <View style={styles.head}>
        <Droplets color={colors.water} size={22} />
        <Text style={styles.current}>{(currentMl / 1000).toFixed(1)} L so far today</Text>
      </View>

      <View style={styles.grid}>
        {WATER_AMOUNTS.map((amount) => (
          <Press
            key={amount}
            scale={0.96}
            style={styles.amount}
            onPress={() => log(amount)}
            accessibilityLabel={`Add ${amount} millilitres`}
          >
            <Text style={styles.amountText}>+{amount}</Text>
            <Text style={styles.amountUnit}>ml</Text>
          </Press>
        ))}
      </View>

      {/* Only offered once there is something to take back. An undo on zero is
          a button that cannot do anything. */}
      {currentMl > 0 && (
        <Press
          scale={0.97}
          style={styles.undo}
          onPress={() => log(-250)}
          accessibilityLabel="Remove 250 millilitres"
        >
          <Text style={styles.undoText}>−250 ml · undo</Text>
        </Press>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: spacing.md },
  current: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amount: {
    width: '47%', flexGrow: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  amountText: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  amountUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  undo: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  undoText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
