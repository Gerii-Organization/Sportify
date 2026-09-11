import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  toDisplayWeight, fromInputWeight, weightLabel,
  toDisplayHeight, fromInputHeight, heightLabel,
} from '../lib/units';
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

/**
 * Each field declares its own bounds so validation lives next to the input.
 *
 * `metric` marks the two that are stored in kg and cm and shown in whatever the
 * user reads. Their bounds are metric too, and the message converts them —
 * "between 66 and 661 lb" is the same rule stated in the reader's units.
 */
const NUMERIC_FIELDS = [
  { key: 'age',               label: 'Age',              min: 1,   max: 100, unit: 'years' },
  { key: 'weight',            label: 'Weight',           min: 30,  max: 300, unit: 'kg', decimal: true, metric: 'weight' },
  { key: 'height',            label: 'Height',           min: 100, max: 210, unit: 'cm', decimal: true, metric: 'height' },
  { key: 'workouts_per_week', label: 'Workouts per week', min: 1,  max: 7,   unit: 'sessions' },
  { key: 'step_goal',         label: 'Daily step goal',  min: 1000, max: 50000, unit: 'steps' },
];

/**
 * `inline` renders the form without a Modal of its own.
 *
 * It used to always be a BottomSheet, which is a Modal — and it was opened from
 * inside the profile Modal. Two sibling Modals do not present at once on iOS:
 * the second waits for the first, which is why the edit form appeared to do
 * nothing for a beat and then arrive. Rendered inline inside the screen that
 * opened it, it is instant because nothing is being presented at all.
 */
export default function EditProfileSheet({ visible, onClose, profile, onSaved, inline = false }) {
  const { units } = useAuth();

  const fieldFor = (key) => NUMERIC_FIELDS.find((f) => f.key === key);

  /** A typed value back to what the database stores. */
  const store = (field, raw) => {
    if (field.metric === 'weight') return fromInputWeight(raw, units);
    if (field.metric === 'height') return fromInputHeight(raw, units);
    return field.decimal ? parseFloat(raw) : parseInt(raw, 10);
  };

  const unitOf = (field) => {
    if (field.metric === 'weight') return weightLabel(units);
    if (field.metric === 'height') return heightLabel(units);
    return field.unit;
  };

  const boundIn = (field, value) => {
    if (field.metric === 'weight') return toDisplayWeight(value, units, 1);
    if (field.metric === 'height') return toDisplayHeight(value, units);
    return value;
  };

  // Inputs are held as strings: a TextInput always gives you text, and parsing
  // on every keystroke makes it impossible to clear a field.
  const [form, setForm] = useState(() => ({
    first_name: profile?.first_name ?? '',
    sex: profile?.sex ?? 'M',
    goal: profile?.goal ?? 'maintain',
    age: String(profile?.age ?? ''),
    weight: profile?.weight == null ? '' : String(toDisplayWeight(profile.weight, units, 0.1)),
    height: profile?.height == null ? '' : String(toDisplayHeight(profile.height, units)),
    workouts_per_week: String(profile?.workouts_per_week ?? ''),
    step_goal: String(profile?.step_goal ?? 10000),
  }));
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /** Returns an error message, or null when everything is valid. */
  const validate = () => {
    if (!form.first_name.trim()) return 'Please enter your name.';

    for (const field of NUMERIC_FIELDS) {
      // Checked on the stored value, so the rule is the same whichever unit it
      // was typed in — but reported in the unit it was typed in.
      const value = store(field, form[field.key]);
      if (value === null || Number.isNaN(value) || value < field.min || value > field.max) {
        return `${field.label} must be between ${boundIn(field, field.min)} and ${boundIn(field, field.max)} ${unitOf(field)}.`;
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
      weight: store(fieldFor('weight'), form.weight),
      height: store(fieldFor('height'), form.height),
      workouts_per_week: parseInt(form.workouts_per_week, 10),
      step_goal: parseInt(form.step_goal, 10),
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);

    if (error) return Alert.alert('Could not save', error.message);

    onSaved?.(updates);
    onClose();
  };

  const body = (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Grouped rather than stacked. A flat list of eight labelled boxes is a
          form; three cards with a heading each is something you can scan and
          stop at the one part you came to change. */}
      <Section title="You">
        <Row label="Name">
          <TextInput
            style={styles.rowInput}
            value={form.first_name}
            onChangeText={(v) => setField('first_name', v)}
            placeholder="Victor"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
          />
        </Row>
        <Divider />
        <Row label="Sex" stacked>
          <ChipRow
            options={SEX_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            selected={form.sex}
            onSelect={(v) => setField('sex', v)}
          />
        </Row>
      </Section>

      <Section title="Measurements" note="Used for your calorie target. Nobody else sees these.">
        {NUMERIC_FIELDS.filter((f) => ['age', 'weight', 'height'].includes(f.key)).map((field, i) => (
          <View key={field.key}>
            {i > 0 && <Divider />}
            <Row label={field.label}>
              <TextInput
                style={styles.rowInput}
                value={form[field.key]}
                onChangeText={(v) =>
                  setField(field.key, field.decimal ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''))
                }
                keyboardType="numeric"
                placeholder={`${boundIn(field, field.min)}–${boundIn(field, field.max)}`}
                placeholderTextColor={colors.textFaint}
              />
              <Text style={styles.suffix}>{unitOf(field)}</Text>
            </Row>
          </View>
        ))}
      </Section>

      <Section title="Targets" note="Changes your calorie target and the workouts you are offered.">
        <Row label="Goal" stacked>
          <ChipRow options={GOALS} selected={form.goal} onSelect={(v) => setField('goal', v)} />
        </Row>
        {NUMERIC_FIELDS.filter((f) => ['workouts_per_week', 'step_goal'].includes(f.key)).map((field) => (
          <View key={field.key}>
            <Divider />
            <Row label={field.label}>
              <TextInput
                style={styles.rowInput}
                value={form[field.key]}
                onChangeText={(v) => setField(field.key, v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder={`${field.min}–${field.max}`}
                placeholderTextColor={colors.textFaint}
              />
              <Text style={styles.suffix}>{field.unit}</Text>
            </Row>
          </View>
        ))}
      </Section>

      <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveText}>Save changes</Text>
        )}
      </TouchableOpacity>

      {inline ? (
        <TouchableOpacity activeOpacity={0.7} style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );

  if (inline) return visible ? body : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edit profile">
      {body}
    </BottomSheet>
  );
}

function Section({ title, note, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

/** A label on the left, the control on the right — or under it when it is chips. */
function Row({ label, children, stacked = false }) {
  if (stacked) {
    return (
      <View style={styles.rowStacked}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={{ marginTop: 10 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

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
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10, marginLeft: 4,
  },
  sectionNote: { color: colors.textFaint, fontSize: 12, marginTop: 8, marginLeft: 4, lineHeight: 17 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  rowStacked: { paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '500' },
  rowControl: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  // Right-aligned so the values line up down the card and the eye can compare
  // them without reading the labels again.
  rowInput: {
    flex: 1, color: colors.text, fontSize: 16, fontWeight: '600',
    textAlign: 'right', padding: 0, minHeight: 52,
  },
  suffix: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },

  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 6 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 6, marginLeft: 6 },
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
