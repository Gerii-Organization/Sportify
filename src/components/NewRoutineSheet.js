import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PenLine, Compass, Plus, Check, ArrowLeft } from 'lucide-react-native';
import { colors, gradients } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Press from './Press';
import { exerciseCount, estimateMinutes, estimateKcal, musclesOf } from '../lib/workoutStats';

const NAME_MAX = 40;
const QUICK_NAMES = ['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Full Body'];

/**
 * What the + on the workouts screen opens: start a routine, and naming one.
 *
 * Both steps live in one sheet. They used to be two Modals, closed and opened
 * in the same tick — and iOS will not present a Modal while another is still
 * dismissing, so the name box could silently fail to appear. A step inside one
 * sheet cannot race itself.
 *
 * The suggested plans are no longer folded behind an accordion. They are the
 * most useful thing here for anyone who does not already know what they want,
 * and each shows the same numbers as the routine cards, so adding one is a
 * decision made with the facts in front of you.
 *
 * `renaming` (a workout) opens straight at the name step, prefilled.
 * `onAddPreset` resolves true when the row was written; the sheet stays open
 * and ticks the plan, so picking three of five is three taps, not three menus.
 */
export default function NewRoutineSheet({
  visible,
  onClose,
  renaming,
  suggestions = [],
  weightKg,
  onCreate,
  onRename,
  onAddPreset,
  onBrowse,
}) {
  const [step, setStep] = useState('choose');
  const [name, setName] = useState('');
  const [added, setAdded] = useState({});
  const [adding, setAdding] = useState(null);

  // Fresh each time it opens: a name typed and abandoned last time is not a
  // draft anyone expects to find again.
  useEffect(() => {
    if (!visible) return;
    setStep(renaming ? 'name' : 'choose');
    setName(renaming?.name || '');
    setAdded({});
  }, [visible, renaming]);

  const add = async (item) => {
    if (adding || added[item.name]) return;
    setAdding(item.name);
    const ok = await onAddPreset?.(item);
    setAdding(null);
    if (ok) setAdded((prev) => ({ ...prev, [item.name]: true }));
  };

  const submit = () => (renaming ? onRename?.(name) : onCreate?.(name));

  const title = renaming ? 'Rename routine' : step === 'name' ? 'Name your routine' : 'New routine';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {step === 'choose' ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.options}>
            <Option
              icon={PenLine}
              title="Start from scratch"
              note="Name it, then pick the exercises"
              primary
              onPress={() => setStep('name')}
            />
            <Option
              icon={Compass}
              title="Explore community"
              note="Copy a routine someone shared"
              onPress={onBrowse}
            />
          </View>

          {suggestions.length > 0 ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.eyebrow}>MATCHED TO YOUR GOAL</Text>
                <Text style={styles.sectionCount}>{suggestions.length} plans</Text>
              </View>

              {suggestions.map((item) => {
                const count = exerciseCount(item);
                const minutes = estimateMinutes(item);
                const kcal = estimateKcal(item, weightKg);
                const tags = [...musclesOf(item).slice(0, 2), item.intensity].filter(Boolean);
                const done = !!added[item.name];

                return (
                  <View key={item.name} style={styles.suggestion}>
                    <View style={[styles.edge, done && styles.edgeDone]} />

                    <View style={styles.flex}>
                      <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.suggestionMeta} numberOfLines={1}>
                        {[
                          `${count} exercise${count === 1 ? '' : 's'}`,
                          minutes ? `${minutes} min` : null,
                          kcal ? `${kcal} kcal` : null,
                        ].filter(Boolean).join('   •   ')}
                      </Text>
                      {tags.length > 0 ? (
                        <View style={styles.tags}>
                          {tags.map((tag) => (
                            <View key={tag} style={styles.tag}>
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    <Press
                      scale={0.9}
                      style={[styles.addBtn, done && styles.addBtnDone]}
                      onPress={() => add(item)}
                      disabled={done || adding === item.name}
                      accessibilityLabel={done ? `${item.name} added` : `Add ${item.name} to my routines`}
                    >
                      {done
                        ? <Check color={colors.onAccent} size={18} strokeWidth={3} />
                        : <Plus color={colors.accent} size={18} />}
                    </Press>
                  </View>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      ) : (
        <View>
          <View style={styles.nameField}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder={renaming ? 'Routine name' : 'e.g. Leg Day'}
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              autoFocus
              maxLength={NAME_MAX}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Routine name"
            />
            <Text style={styles.counter}>{name.length}/{NAME_MAX}</Text>
          </View>

          {/* One tap for the names most routines end up with anyway. Not
              offered when renaming: you already chose a name once. */}
          {!renaming ? (
            <View style={styles.quick}>
              {QUICK_NAMES.map((quick) => {
                const on = name === quick;
                return (
                  <Press
                    key={quick}
                    scale={0.95}
                    style={[styles.quickChip, on && styles.quickChipOn]}
                    onPress={() => setName(quick)}
                    accessibilityLabel={`Name it ${quick}`}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.quickText, on && styles.quickTextOn]}>{quick}</Text>
                  </Press>
                );
              })}
            </View>
          ) : null}

          <Button
            label={renaming ? 'Save name' : 'Create routine'}
            onPress={submit}
            disabled={!!renaming && !name.trim()}
            style={styles.cta}
          />

          {!renaming ? (
            <Press scale={0.97} style={styles.back} onPress={() => setStep('choose')} accessibilityLabel="Back to options">
              <ArrowLeft color={colors.textMuted} size={16} />
              <Text style={styles.backText}>Back</Text>
            </Press>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

function Option({ icon: Icon, title, note, primary = false, onPress }) {
  return (
    <Press
      scale={0.97}
      style={[styles.option, primary && styles.optionPrimary]}
      onPress={onPress}
      accessibilityLabel={`${title}. ${note}`}
    >
      {primary ? (
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optionIcon}>
          <Icon color={colors.onAccent} size={20} />
        </LinearGradient>
      ) : (
        <View style={[styles.optionIcon, styles.optionIconQuiet]}>
          <Icon color={colors.accent} size={20} />
        </View>
      )}
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionNote}>{note}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 560 },
  flex: { flex: 1 },

  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1, minHeight: 136, padding: 16, borderRadius: 20,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  optionPrimary: { backgroundColor: 'rgba(155, 157, 214, 0.08)', borderColor: colors.accentBorder },
  optionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionIconQuiet: { backgroundColor: colors.accentSoft },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 14 },
  optionNote: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 4 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 24, marginBottom: 10,
  },
  eyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  sectionCount: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },

  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18,
    paddingVertical: 14, paddingLeft: 18, paddingRight: 12, marginBottom: 8, overflow: 'hidden',
  },
  edge: {
    position: 'absolute', left: 0, top: '22%', bottom: '22%', width: 4,
    borderTopRightRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: 'rgba(155, 157, 214, 0.55)',
  },
  edgeDone: { backgroundColor: colors.accent },
  suggestionName: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  suggestionMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { color: colors.textSecondary, fontSize: 11, fontWeight: '500' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: 'rgba(155, 157, 214, 0.35)',
  },
  addBtnDone: { backgroundColor: colors.accent, borderColor: colors.accent },

  nameField: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  nameInput: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, padding: 0 },
  counter: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-end', marginTop: 6, fontVariant: ['tabular-nums'] },

  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  quickChip: {
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7,
  },
  quickChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  quickText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  quickTextOn: { color: colors.accent },

  cta: { marginTop: 18 },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, marginTop: 4 },
  backText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
