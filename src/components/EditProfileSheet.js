import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { GOALS, SEX_OPTIONS } from '../constants/content';
import BottomSheet from './BottomSheet';

/**
 * Lets the user change the details they entered at sign-up.
 *
 * This matters more than it looks. `weight`, `height`, `age`, `sex` and `goal`
 * feed the daily calorie target and the suggested loads in generated workouts.
 * While the profile was read-only, both drifted further from reality every week
 * — silently, with nothing in the UI to explain why the numbers looked wrong.
 */

/** Each field declares its own bounds so validation lives next to the input. */
const NUMERIC_FIELDS = [
  { key: 'age',               label: 'Age',              min: 1,   max: 100, unit: 'years' },
  { key: 'weight',            label: 'Weight',           min: 30,  max: 300, unit: 'kg', decimal: true },
  { key: 'height',            label: 'Height',           min: 100, max: 210, unit: 'cm', decimal: true },
  { key: 'workouts_per_week', label: 'Workouts per week', min: 1,  max: 7,   unit: 'sessions' },
  { key: 'step_goal',         label: 'Daily step goal',  min: 1000, max: 50000, unit: 'steps' },
];

export default function EditProfileSheet({ visible, onClose, profile, onSaved }) {
  // Inputs are held as strings: a TextInput always gives you text, and parsing
  // on every keystroke makes it impossible to clear a field.
  const [form, setForm] = useState(() => ({
    first_name: profile?.first_name ?? '',
    sex: profile?.sex ?? 'M',
    goal: profile?.goal ?? 'maintain',
    age: String(profile?.age ?? ''),
    weight: String(profile?.weight ?? ''),
    height: String(profile?.height ?? ''),
    workouts_per_week: String(profile?.workouts_per_week ?? ''),
    step_goal: String(profile?.step_goal ?? 10000),
  }));
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /** Returns an error message, or null when everything is valid. */
  const validate = () => {
    if (!form.first_name.trim()) return 'Please enter your name.';

    for (const field of NUMERIC_FIELDS) {
      const raw = form[field.key];
      const value = field.decimal ? parseFloat(raw) : parseInt(raw, 10);
      if (Number.isNaN(value) || value < field.min || value > field.max) {
        return `${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) return Alert.alert('Check your details', problem);

    setSaving(true);
    const updates = {
      first_name: form.first_name.trim(),
      sex: form.sex,
      goal: form.goal,
      age: parseInt(form.age, 10),
      weight: parseFloat(form.weight),
      height: parseFloat(form.height),
      workouts_per_week: parseInt(form.workouts_per_week, 10),
      step_goal: parseInt(form.step_goal, 10),
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);

    if (error) return Alert.alert('Could not save', error.message);

    onSaved?.(updates);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edit profile">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={form.first_name}
            onChangeText={(v) => setField('first_name', v)}
            placeholder="Victor"
            placeholderTextColor={colors.textFaint}
          />
        </Field>

        <Field label="Sex">
          <ChipRow
            options={SEX_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            selected={form.sex}
            onSelect={(v) => setField('sex', v)}
          />
        </Field>

        <Field label="Goal" hint="Changes your calorie target and suggested workouts.">
          <ChipRow
            options={GOALS}
            selected={form.goal}
            onSelect={(v) => setField('goal', v)}
          />
        </Field>

        {NUMERIC_FIELDS.map((field) => (
          <Field key={field.key} label={`${field.label} (${field.unit})`}>
            <TextInput
              style={styles.input}
              value={form[field.key]}
              onChangeText={(v) =>
                // Strip anything that is not a digit, keeping one decimal point
                // for the fields that allow it.
                setField(field.key, field.decimal ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''))
              }
              keyboardType="numeric"
              placeholder={`${field.min}–${field.max}`}
              placeholderTextColor={colors.textFaint}
            />
          </Field>
        ))}

        <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.saveText}>Save changes</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ChipRow({ options, selected, onSelect }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected === option.id;
        return (
          <TouchableOpacity activeOpacity={0.7}
            key={option.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 6 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 6, marginLeft: 6 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.xl,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.onAccent },
  saveBtn: {
    backgroundColor: colors.accent,
    padding: 20,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
});
