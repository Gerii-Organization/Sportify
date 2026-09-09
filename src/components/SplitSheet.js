import { useState, useEffect } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import BottomSheet from './BottomSheet';
import SplitPicker from './SplitPicker';
import Press from './Press';

/**
 * Editing the training split after sign-up.
 *
 * Same picker as the onboarding step, so there is one place the presets and the
 * custom builder live. Only the saving differs.
 *
 * Reached from the week strip at the bottom of the workouts card. That half had
 * no action before and was documented as going nowhere; the split gives it one
 * that reads on sight — the top half is what to do today, the bottom half is
 * the plan behind it.
 */
export default function SplitSheet({ visible, onClose, profile, onSaved }) {
  const [days, setDays] = useState(profile?.split || []);
  const [saving, setSaving] = useState(false);

  // Re-seed when the sheet opens rather than on every render: editing then
  // closing without saving should not leave the draft behind for next time.
  useEffect(() => {
    if (visible) setDays(profile?.split || []);
  }, [visible, profile?.split]);

  const save = async () => {
    if (saving) return;
    setSaving(true);

    // Empty means "no split" — the advice falls back to the least-trained
    // muscle group, which is a valid way to train and not an error state.
    const value = days.length ? days.filter((d) => d.muscles.length > 0) : null;

    const { error } = await supabase
      .from('profiles')
      .update({ split: value?.length ? value : null })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      console.warn(`[Sportify] Could not save the split: ${error.message}`);
      return;
    }

    onSaved?.(value?.length ? value : null);
    onClose?.();
  };

  const usable = days.filter((d) => d.muscles.length > 0).length;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Your training split">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <SplitPicker
          value={days}
          perWeek={profile?.workouts_per_week}
          onChange={setDays}
        />
      </ScrollView>

      <Press
        scale={0.98}
        style={[styles.save, saving && { opacity: 0.6 }]}
        onPress={save}
        accessibilityLabel="Save your split"
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : usable ? 'Save split' : 'Continue without a split'}
        </Text>
      </Press>

      {/* A day with no muscles selected cannot be matched against a session, so
          it would sit in the cycle doing nothing. Dropping it silently is worse
          than saying it went. */}
      {days.length > usable && (
        <Text style={styles.warn}>
          {days.length - usable} day{days.length - usable === 1 ? '' : 's'} with no
          muscles picked will not be saved.
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  warn: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
});
