import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, gradients } from '../theme';
import { todayKey } from '../lib/date';
import BottomSheet from './BottomSheet';

/**
 * Body weight over time.
 *
 * profiles.weight is a single number captured at sign-up and never updated, so
 * the calorie target drifted further from reality every week. This keeps a
 * history AND writes the latest reading back to the profile, so the two agree.
 *
 * One reading per day: the table has a unique constraint on (user_id, logged_on)
 * and this upserts against it, so logging twice in a day corrects the entry
 * rather than creating a second one.
 */
const DAYS_SHOWN = 30;

export default function WeightSheet({ visible, onClose, profile, onSaved }) {
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('body_weight_log')
      .select('weight_kg, logged_on')
      .eq('user_id', profile.id)
      .order('logged_on', { ascending: false })
      .limit(DAYS_SHOWN);

    // Query is newest-first so the limit keeps the most recent readings;
    // reverse for display so the chart reads left to right in time order.
    setEntries((data || []).slice().reverse());
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleSave = async () => {
    const weight = parseFloat(input);
    if (Number.isNaN(weight) || weight < 20 || weight > 400) {
      return Alert.alert('Check the number', 'Enter a weight between 20 and 400 kg.');
    }

    setSaving(true);
    const { error } = await supabase
      .from('body_weight_log')
      .upsert(
        { user_id: profile.id, weight_kg: weight, logged_on: todayKey() },
        { onConflict: 'user_id,logged_on' }
      );

    if (error) {
      setSaving(false);
      return Alert.alert('Could not save', error.message);
    }

    // Keep the profile in step, so the calorie target and suggested loads use
    // today's weight rather than the sign-up value.
    await supabase.from('profiles').update({ weight }).eq('id', profile.id);

    setSaving(false);
    setInput('');
    load();
    onSaved?.(weight);
  };

  const weights = entries.map((e) => Number(e.weight_kg));
  const latest = weights.length ? weights[weights.length - 1] : null;
  const first = weights.length ? weights[0] : null;
  const change = latest !== null && first !== null ? latest - first : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Body weight">
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={(v) => setInput(v.replace(/[^0-9.]/g, ''))}
        keyboardType="numeric"
        placeholder={latest ? `Last: ${latest} kg` : 'e.g. 78.5'}
        placeholderTextColor={colors.textFaint}
      />

      <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveText}>Log today's weight</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No readings yet. Log one to start the chart.</Text>
      ) : (
        <>
          <View style={styles.summary}>
            <Stat label="Current" value={`${latest} kg`} />
            <Stat
              label="Change"
              value={`${change > 0 ? '+' : ''}${change.toFixed(1)} kg`}
              tint={change > 0 ? colors.streak : colors.accent}
            />
            <Stat label="Readings" value={String(entries.length)} />
          </View>

          <WeightChart weights={weights} />
        </>
      )}
    </BottomSheet>
  );
}

/**
 * Bars scaled between the lowest and highest reading rather than from zero.
 * Body weight varies by a few percent, so a zero-based axis would render every
 * bar at almost the same height and hide the trend entirely.
 */
function WeightChart({ weights }) {
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  return (
    <View style={styles.chart}>
      {weights.map((weight, index) => {
        const height = 12 + ((weight - min) / span) * 88;
        const isLatest = index === weights.length - 1;

        return (
          <View key={index} style={styles.barSlot}>
            <LinearGradient
              colors={isLatest ? gradients.accent : [colors.borderLight, colors.surface]}
              style={[styles.bar, { height: `${height}%` }]}
            />
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value, tint }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tint && { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  saveBtn: { backgroundColor: colors.accent, padding: 16, borderRadius: radius.lg, alignItems: 'center' },
  saveText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    marginTop: spacing.md,
    gap: 3,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, minHeight: 4 },
});
