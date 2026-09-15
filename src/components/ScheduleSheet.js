import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { ChevronDown, ChevronUp, Wand2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '../theme';
import { WEEKDAYS, normaliseSchedule, draftSchedule, trainingDayCount, isEmptySchedule } from '../lib/schedule';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Press from './Press';

/**
 * Planning the week: a routine or a rest day for each weekday (roadmap T5).
 *
 * One day open at a time, its choices as chips — Rest first, then the routines.
 * A picker per row would be seven dropdowns; cycling through with taps is fine
 * for two routines and hopeless for eight.
 *
 * "Fill from my split" drafts the whole week (lib/schedule.js draftSchedule)
 * and leaves it editable, so the common case is one tap and a Save, and nobody
 * is locked into what the draft guessed.
 */
export default function ScheduleSheet({ visible, onClose, profile, routines, split, sessionsPerWeek, schedule, onSaved }) {
  const [draft, setDraft] = useState(() => normaliseSchedule(schedule));
  const [openDay, setOpenDay] = useState(null);
  const [saving, setSaving] = useState(false);

  // Re-seeded on open, so closing without saving leaves nothing behind.
  useEffect(() => {
    if (visible) {
      setDraft(normaliseSchedule(schedule));
      setOpenDay(null);
    }
  }, [visible, schedule]);

  const list = (routines || []).filter((r) => r?.id != null);
  const nameOf = (id) => list.find((r) => String(r.id) === id)?.name || null;

  const pick = (dayIndex, id) => {
    setDraft((current) => current.map((value, i) => (i === dayIndex ? id : value)));
    setOpenDay(null);
  };

  const fill = () => {
    setDraft(draftSchedule({ split, routines: list, sessionsPerWeek }));
    setOpenDay(null);
  };

  const save = async () => {
    if (saving || !profile?.id) return;
    setSaving(true);
    const value = isEmptySchedule(draft) ? null : draft;
    const { error } = await supabase.from('profiles').update({ training_schedule: value }).eq('id', profile.id);
    setSaving(false);

    if (error) {
      Alert.alert('Could not save your plan', 'Check your connection and try again.');
      return;
    }
    onSaved?.(value);
    onClose?.();
  };

  const days = trainingDayCount(draft);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Your week" avoidKeyboard={false}>
      {list.length === 0 ? (
        <Text style={styles.empty}>Create a routine first, then place it on the days you train.</Text>
      ) : (
        <>
          <Press scale={0.98} onPress={fill} style={styles.fill} accessibilityLabel="Fill the week from my split">
            <Wand2 color={colors.accent} size={16} />
            <Text style={styles.fillText}>{split?.length ? 'Fill from my split' : 'Fill with my routines'}</Text>
          </Press>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {WEEKDAYS.map((label, i) => {
              const id = draft[i];
              const name = id ? nameOf(id) : null;
              const open = openDay === i;

              return (
                <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Press
                    scale={0.99}
                    onPress={() => setOpenDay(open ? null : i)}
                    style={styles.rowHead}
                    accessibilityLabel={`${label}: ${name || 'rest day'}. Tap to change.`}
                    accessibilityState={{ expanded: open }}
                  >
                    <Text style={styles.day}>{label}</Text>
                    <Text style={[styles.value, !name && styles.valueRest]} numberOfLines={1}>
                      {name || (id ? 'Deleted routine' : 'Rest')}
                    </Text>
                    {open ? <ChevronUp color={colors.textMuted} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
                  </Press>

                  {open ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      <Press
                        scale={0.95}
                        onPress={() => pick(i, null)}
                        style={[styles.chip, !id && styles.chipOn]}
                        accessibilityState={{ selected: !id }}
                      >
                        <Text style={[styles.chipText, !id && styles.chipTextOn]}>Rest</Text>
                      </Press>
                      {list.map((routine) => {
                        const selected = id === String(routine.id);
                        return (
                          <Press
                            key={routine.id}
                            scale={0.95}
                            onPress={() => pick(i, String(routine.id))}
                            style={[styles.chip, selected && styles.chipOn]}
                            accessibilityState={{ selected }}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>
                              {routine.name || 'Routine'}
                            </Text>
                          </Press>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <Text style={styles.summary}>
            {days === 0 ? 'No training days planned' : `${days} training day${days === 1 ? '' : 's'} a week`}
          </Text>
          <Button label="Save plan" onPress={save} loading={saving} />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, paddingVertical: spacing.lg, textAlign: 'center' },
  fill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: 14, backgroundColor: colors.accentSoft, marginBottom: spacing.sm,
  },
  fillText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  list: { maxHeight: 420 },
  row: { paddingVertical: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  day: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', width: 38 },
  value: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  valueRest: { color: colors.textMuted, fontWeight: '500' },
  chips: { gap: 8, paddingBottom: 10, paddingLeft: 50 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceHigh, maxWidth: 200 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.onAccent },
  summary: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: spacing.md },
});
