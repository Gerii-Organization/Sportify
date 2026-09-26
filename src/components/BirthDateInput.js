import { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { useT } from '../i18n';

/**
 * Day, month and year as three number boxes.
 *
 * Three boxes rather than a date picker: no native module (so no rebuild), a
 * birth year is quicker to type than to scroll back thirty years to, and each
 * box is labelled, so "05/03" cannot be read as the wrong order the way a
 * single field can. Focus moves on when a box is full.
 *
 * `value` is `{ day, month, year }` as strings; `onChange` gets the same shape.
 * `compact` drops the labels for use inside a row that already has one.
 */
export default function BirthDateInput({ value, onChange, compact = false }) {
  const { t } = useT();
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const parts = value || { day: '', month: '', year: '' };

  const set = (key, text, max, next) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, max);
    onChange({ ...parts, [key]: digits });
    if (digits.length === max) next?.current?.focus();
  };

  const box = (key, max, placeholder, label, ref, next, wide = false) => (
    <View style={[styles.cell, wide && styles.cellWide]}>
      {compact ? null : <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, compact && styles.inputCompact]}
        value={parts[key]}
        onChangeText={(text) => set(key, text, max, next)}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        maxLength={max}
        textAlign="center"
        accessibilityLabel={label}
        returnKeyType={next ? 'next' : 'done'}
      />
    </View>
  );

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {box('day', 2, t('DD'), t('Day'), null, monthRef)}
      {box('month', 2, t('MM'), t('Month'), monthRef, yearRef)}
      {box('year', 4, t('YYYY'), t('Year'), yearRef, null, true)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  rowCompact: { gap: 6 },
  cell: { flex: 1 },
  cellWide: { flex: 1.6 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 10, fontWeight: '600', marginLeft: 6 },
  input: {
    backgroundColor: colors.surface, color: colors.text, paddingVertical: 16, borderRadius: 14,
    fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'],
  },
  inputCompact: { paddingVertical: 8, borderRadius: 10, fontSize: 15, minWidth: 44 },
});
