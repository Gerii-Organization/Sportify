import { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { platesFor, groupPlates, BARS_KG } from '../lib/plates';
import BottomSheet from './BottomSheet';
import Press from './Press';

/**
 * What goes on each side of the bar.
 *
 * The one calculation every session demands, done standing at the rack. The app
 * already knows the target weight for the set, so it may as well answer it.
 *
 * Shows the achievable weight rather than rounding silently: 47kg on a 20kg bar
 * is 45kg once the plates run out, and that is the number that gets logged.
 */
export default function PlateSheet({ visible, onClose, initialWeight }) {
  const [weight, setWeight] = useState(String(initialWeight || ''));
  const [bar, setBar] = useState(20);

  const result = useMemo(() => platesFor(parseFloat(weight), bar), [weight, bar]);
  const grouped = useMemo(() => groupPlates(result.perSide), [result]);

  const target = parseFloat(weight) || 0;
  const short = result.achievable < target;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Plate calculator">
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={colors.textFaint}
          selectTextOnFocus
        />
        <Text style={styles.unit}>kg total</Text>
      </View>

      <View style={styles.bars}>
        {BARS_KG.map((b) => (
          <Press
            key={b}
            scale={0.96}
            style={[styles.barChip, bar === b && styles.barChipOn]}
            onPress={() => setBar(b)}
            accessibilityRole="button"
            accessibilityState={{ selected: bar === b }}
          >
            <Text style={[styles.barText, bar === b && styles.barTextOn]}>
              {b === 0 ? 'No bar' : `${b}kg bar`}
            </Text>
          </Press>
        ))}
      </View>

      {target > 0 && (
        <View style={styles.result}>
          {result.tooLight ? (
            <Text style={styles.note}>
              The bar alone is {bar}kg — heavier than your target.
            </Text>
          ) : grouped.length === 0 ? (
            <Text style={styles.note}>Just the bar.</Text>
          ) : (
            <>
              <Text style={styles.perSideLabel}>Per side</Text>
              <View style={styles.stack}>
                {grouped.map(([plate, count]) => (
                  <View key={plate} style={styles.plate}>
                    <Text style={styles.plateWeight}>{plate}</Text>
                    <Text style={styles.plateCount}>× {count}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={[styles.total, short && { color: colors.streak }]}>
            {result.achievable}kg loaded
            {short ? `  ·  ${result.remainder}kg short of ${target}` : ''}
          </Text>

          {short && (
            <Text style={styles.note}>
              No plate small enough for the rest. Log what is actually on the bar.
            </Text>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: spacing.md },
  input: {
    color: colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -1,
    minWidth: 110, paddingVertical: 4,
    borderBottomWidth: 2, borderBottomColor: colors.accentBorder,
  },
  unit: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  bars: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  barChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  barChipOn: { backgroundColor: colors.accent },
  barText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  barTextOn: { color: colors.onAccent },

  result: { gap: 10 },
  perSideLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  stack: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plate: {
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 10,
  },
  plateWeight: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  plateCount: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  total: { color: colors.accent, fontSize: 15, fontWeight: '700', marginTop: 2 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
