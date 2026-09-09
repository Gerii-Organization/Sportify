import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { MUSCLES } from '../constants/exercises';
import { presetsFor, cycleNote, BLANK_SPLIT_DAY } from '../constants/splits';
import Press from './Press';

/**
 * Choosing or building a training split.
 *
 * Presets first, custom last. A blank canvas is the wrong opening move for
 * something most people already have a name for — anyone who trains has heard
 * of Push/Pull/Legs, and asking them to assemble it muscle by muscle is asking
 * them to do the app's work.
 *
 * Presets are ordered by how well they suit the weekly target rather than
 * filtered by it. Someone who said three days may still want Upper/Lower, and
 * hiding it would be the app overruling them on one number given in passing.
 *
 * Used in two places with the same props: the onboarding step and the editor
 * opened from the workouts card.
 */
export default function SplitPicker({ value, perWeek, onChange }) {
  // Custom mode is entered explicitly and stays until a preset is picked, so
  // editing a day does not silently throw away the rest of your work.
  const [custom, setCustom] = useState(false);

  const presets = presetsFor(perWeek);
  const matchedPreset = presets.find((p) => sameDays(p.days, value));

  const setDays = (days) => onChange(days);

  const editDay = (index, patch) => {
    const next = value.map((d, i) => (i === index ? { ...d, ...patch } : d));
    setDays(next);
  };

  const toggleMuscle = (index, muscle) => {
    const day = value[index];
    const has = day.muscles.includes(muscle);
    editDay(index, {
      muscles: has ? day.muscles.filter((m) => m !== muscle) : [...day.muscles, muscle],
    });
  };

  return (
    <View>
      {!custom && (
        <>
          {presets.map((preset) => {
            const active = matchedPreset?.id === preset.id;

            return (
              <Press
                key={preset.id}
                scale={0.99}
                style={[styles.preset, active && styles.presetOn]}
                onPress={() => setDays(preset.days.map((d) => ({ ...d, muscles: [...d.muscles] })))}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.presetHead}>
                    <Text style={styles.presetName}>{preset.name}</Text>
                    <Text style={styles.presetDays}>
                      {preset.days.length} day{preset.days.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.presetNote}>{preset.note}</Text>
                </View>
                {active && <Check color={colors.accent} size={18} strokeWidth={3} />}
              </Press>
            );
          })}

          <Press
            scale={0.99}
            style={styles.customBtn}
            onPress={() => {
              setCustom(true);
              if (!value?.length) setDays([{ ...BLANK_SPLIT_DAY, muscles: [] }]);
            }}
            accessibilityLabel="Build a custom split"
          >
            <Text style={styles.customText}>Build my own</Text>
          </Press>
        </>
      )}

      {custom && (
        <>
          {value.map((day, i) => (
            <View key={i} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <TextInput
                  style={styles.dayName}
                  value={day.label}
                  onChangeText={(label) => editDay(i, { label })}
                  placeholder={`Day ${i + 1}`}
                  placeholderTextColor={colors.textFaint}
                />
                {value.length > 1 && (
                  <Press
                    scale={0.9}
                    onPress={() => setDays(value.filter((_, j) => j !== i))}
                    accessibilityLabel={`Remove ${day.label || `day ${i + 1}`}`}
                    hitSlop={8}
                  >
                    <Trash2 color={colors.textFaint} size={16} />
                  </Press>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.muscleRow}>
                {MUSCLES.map((muscle) => {
                  const on = day.muscles.includes(muscle);
                  return (
                    <Press
                      key={muscle}
                      scale={0.95}
                      style={[styles.muscle, on && styles.muscleOn]}
                      onPress={() => toggleMuscle(i, muscle)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.muscleText, on && styles.muscleTextOn]}>{muscle}</Text>
                    </Press>
                  );
                })}
              </ScrollView>
            </View>
          ))}

          <Press
            scale={0.99}
            style={styles.addDay}
            onPress={() => setDays([...value, { label: `Day ${value.length + 1}`, muscles: [] }])}
            accessibilityLabel="Add a day to the split"
          >
            <Plus color={colors.accent} size={16} />
            <Text style={styles.addDayText}>Add a day</Text>
          </Press>

          <Press
            scale={0.99}
            style={styles.customBtn}
            onPress={() => setCustom(false)}
            accessibilityLabel="Back to the preset splits"
          >
            <Text style={styles.customText}>Use a preset instead</Text>
          </Press>
        </>
      )}

      {/* The consequence, once, where the choice is made. The advice card never
          repeats it — that would be nagging about a decision already taken. */}
      {value?.length > 0 && (
        <Text style={styles.note}>{cycleNote(value, perWeek)}</Text>
      )}
    </View>
  );
}

/** Two cycles are the same when the labels and muscle sets line up in order. */
function sameDays(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((day, i) =>
    day.label === b[i].label &&
    day.muscles.length === b[i].muscles.length &&
    day.muscles.every((m) => b[i].muscles.includes(m))
  );
}

const styles = StyleSheet.create({
  preset: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, marginBottom: 8,
  },
  presetOn: { backgroundColor: colors.accentSoft },
  presetHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  presetName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  presetDays: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  presetNote: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },

  customBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  customText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  dayCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  dayName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700', padding: 0 },
  muscleRow: { flexDirection: 'row', gap: 6, paddingRight: 8 },
  muscle: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  muscleOn: { backgroundColor: colors.accent },
  muscleText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  muscleTextOn: { color: colors.onAccent },

  addDay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: radius.lg, backgroundColor: colors.surface,
  },
  addDayText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  note: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
});
