import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Play, Trash2, Bookmark, Copy } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import Avatar from './Avatar';
import Press from './Press';

/**
 * One workout, in every list that shows one.
 *
 * My workouts, Saved and Browse used to be three different cards built inline
 * in TrainingScreen. They drifted: only Browse showed which muscles a plan
 * trained, which is the single most useful thing to know before opening it.
 *
 * THE COVER
 *
 * `imageUrl` is the slot for a real photo per workout. Until those exist the
 * cover is generated from the muscles the plan actually trains — a stable
 * colour per group, so Leg Day looks the same every time you open the list and
 * becomes recognisable before you have read its name. When a photo is added
 * later, only the `imageUrl` prop has to start arriving; nothing else changes.
 *
 * `variant` decides the actions, not the layout:
 *   mine    open and start, or delete
 *   browse  save for later, or copy into your own list
 *   saved   open, or unsave
 */

/** A hue per muscle group, drawn from the palette rather than invented here. */
const MUSCLE_TINT = {
  Chest: colors.accent,
  Back: colors.water,
  Legs: colors.sleep,
  Shoulders: colors.energy,
  Arms: colors.streak,
  Core: colors.activity,
  Cardio: colors.danger,
};

const tintFor = (muscles) => MUSCLE_TINT[(muscles || [])[0]] || colors.accent;

export default function WorkoutCard({
  workout,
  variant = 'mine',
  imageUrl,
  onOpen,
  onDelete,
  onCopy,
  onToggleSave,
}) {
  const muscles = workout.muscles || [];
  const tint = tintFor(muscles);
  const saved = workout.is_saved;

  return (
    <View style={styles.card}>
      <Press scale={0.99} onPress={onOpen} accessibilityLabel={`Open ${workout.name}`}>
        <View style={styles.cover}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[`${tint}38`, `${tint}0D`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}

          <View style={[styles.glyph, { backgroundColor: `${tint}24` }]}>
            <Dumbbell color={tint} size={20} />
          </View>

          {/* Sits on the cover rather than under the title: it is how you pick
              a plan out of a list, so it belongs where the eye lands first. */}
          <View style={styles.muscleRow}>
            {muscles.slice(0, 3).map((m) => (
              <View key={m} style={[styles.muscleTag, { borderColor: `${MUSCLE_TINT[m] || tint}66` }]}>
                <Text style={[styles.muscleText, { color: MUSCLE_TINT[m] || tint }]}>{m}</Text>
              </View>
            ))}
            {muscles.length > 3 && (
              <View style={styles.muscleTag}>
                <Text style={[styles.muscleText, { color: colors.textMuted }]}>+{muscles.length - 3}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{workout.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{metaFor(workout, variant)}</Text>
          </View>

          {variant !== 'mine' && workout.author_name ? (
            <Avatar
              profile={{ equipped_avatar: workout.author_avatar, xp: workout.author_xp }}
              size={30}
            />
          ) : null}
        </View>
      </Press>

      <View style={styles.actions}>
        {variant === 'mine' ? (
          <>
            <Press
              scale={0.92}
              style={styles.ghostBtn}
              onPress={onDelete}
              accessibilityLabel={`Delete ${workout.name}`}
            >
              <Trash2 color={colors.danger} size={17} />
            </Press>
            <Press
              scale={0.97}
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={onOpen}
              accessibilityLabel={`Start ${workout.name}`}
            >
              <Play color={colors.onAccent} size={14} fill={colors.onAccent} />
              <Text style={styles.primaryText}>Start</Text>
            </Press>
          </>
        ) : (
          <>
            <Press
              scale={0.92}
              style={[styles.ghostBtn, saved && styles.ghostBtnOn]}
              onPress={onToggleSave}
              accessibilityLabel={saved ? `Remove ${workout.name} from saved` : `Save ${workout.name}`}
              accessibilityState={{ selected: !!saved }}
            >
              <Bookmark
                color={saved ? colors.accent : colors.textMuted}
                fill={saved ? colors.accent : 'transparent'}
                size={17}
              />
            </Press>

            {!workout.is_mine && (
              <Press
                scale={0.97}
                style={styles.secondaryBtn}
                onPress={onCopy}
                accessibilityLabel={`Copy ${workout.name} into my workouts`}
              >
                <Copy color={colors.accent} size={14} />
                <Text style={styles.secondaryText}>Add a copy</Text>
              </Press>
            )}
          </>
        )}
      </View>
    </View>
  );
}

/**
 * The line under the name.
 *
 * Your own plans get length and intensity, because you already know who wrote
 * them. Everyone else's lead with the author, then how many people found it
 * useful enough to copy — the two things that tell you whether to open it.
 */
function metaFor(workout, variant) {
  const count = workout.exercise_count ?? workout.exercises?.length;
  const exercises = count ? `${count} exercise${count === 1 ? '' : 's'}` : null;

  if (variant === 'mine') {
    return [workout.duration, workout.intensity, exercises].filter(Boolean).join('  ·  ');
  }

  return [
    workout.is_mine ? 'Yours' : `by ${workout.author_name}`,
    exercises,
    workout.copy_count > 0 ? `${workout.copy_count} copied` : null,
  ].filter(Boolean).join('  ·  ');
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cover: {
    height: 96,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  glyph: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  muscleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  muscleTag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  muscleText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  body: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 10,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  ghostBtn: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnOn: { backgroundColor: colors.accentSoft },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 38, borderRadius: 13,
  },
  primaryText: { color: colors.onAccent, fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 38, borderRadius: 13, backgroundColor: colors.surfaceHigh,
  },
  secondaryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
