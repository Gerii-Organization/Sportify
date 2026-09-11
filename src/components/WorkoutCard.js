import { View, Text, Image, StyleSheet } from 'react-native';
import { Play, Trash2, Bookmark, Copy, ChevronRight, Pencil, Globe, Lock, Type } from 'lucide-react-native';
import { colors } from '../theme';
import Press from './Press';

/**
 * One workout, in every list that shows one.
 *
 * My workouts, Saved and Browse used to be three different cards built inline
 * in TrainingScreen. They drifted: only Browse showed which muscles a plan
 * trained, which is the single most useful thing to know before opening it.
 *
 * A row rather than a cover card. The card version fitted about two per screen,
 * so choosing between five plans meant scrolling — and the thing you scroll to
 * compare is the name and the muscles, both of which fit on one line.
 *
 * THE LEADING MARK
 *
 * A 4pt bar tinted by the plan's first muscle group, which becomes a thumbnail
 * once the workout has a cover photo. Same footprint either way, so the list
 * keeps its rhythm whether or not photos exist — and a plan you gave a photo is
 * recognisable before you read anything.
 *
 * `variant` decides the actions, not the layout:
 *   mine    start it — and delete it, but only while `editing`
 *   browse  save for later, or copy into your own list
 *   saved   open, or unsave
 *
 * The delete button is hidden until the screen is in edit mode. A trash can on
 * every row of a list you scroll through daily is a mis-tap waiting to happen,
 * and it was competing with Start for the same corner.
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
  editing = false,
  onOpen,
  onDelete,
  onRename,
  onToggleVisibility,
  onCopy,
  onToggleSave,
}) {
  const muscles = workout.muscles || [];
  const tint = tintFor(muscles);
  const saved = workout.is_saved;

  return (
    <View style={styles.row}>
      <Press
        scale={0.995}
        onPress={onOpen}
        style={styles.main}
        accessibilityLabel={`Open ${workout.name}`}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.bar, { backgroundColor: tint }]} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{workout.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{metaFor(workout, variant, muscles)}</Text>
        </View>
      </Press>

      <View style={styles.actions}>
        {variant === 'mine' ? (
          editing ? (
            <>
              {/* Visibility belongs with the list, not inside the workout: it is
                  a decision about which of your plans other people can see, and
                  that is a question you ask while looking at all of them. */}
              <Press
                scale={0.9}
                style={styles.iconBtn}
                onPress={onToggleVisibility}
                accessibilityLabel={workout.is_public ? `Make ${workout.name} private` : `Share ${workout.name} publicly`}
                hitSlop={6}
              >
                {workout.is_public
                  ? <Globe color={colors.accent} size={17} />
                  : <Lock color={colors.textFaint} size={17} />}
              </Press>
              <Press
                scale={0.9}
                style={styles.iconBtn}
                onPress={onRename}
                accessibilityLabel={`Rename ${workout.name}`}
                hitSlop={6}
              >
                <Type color={colors.textSecondary} size={17} />
              </Press>
              <Press
                scale={0.9}
                style={styles.iconBtn}
                onPress={onDelete}
                accessibilityLabel={`Delete ${workout.name}`}
                hitSlop={6}
              >
                <Trash2 color={colors.danger} size={17} />
              </Press>
              <Press
                scale={0.92}
                style={styles.editBtn}
                onPress={onOpen}
                accessibilityLabel={`Edit ${workout.name}`}
              >
                <Pencil color={colors.onAccent} size={14} />
              </Press>
            </>
          ) : (
            <Press
              scale={0.92}
              style={styles.playBtn}
              onPress={onOpen}
              accessibilityLabel={`Start ${workout.name}`}
            >
              <Play color={colors.onAccent} size={14} fill={colors.onAccent} />
            </Press>
          )
        ) : (
          <>
            <Press
              scale={0.9}
              style={styles.iconBtn}
              onPress={onToggleSave}
              accessibilityLabel={saved ? `Remove ${workout.name} from saved` : `Save ${workout.name}`}
              accessibilityState={{ selected: !!saved }}
              hitSlop={6}
            >
              <Bookmark
                color={saved ? colors.accent : colors.textFaint}
                fill={saved ? colors.accent : 'transparent'}
                size={16}
              />
            </Press>

            {!workout.is_mine ? (
              <Press
                scale={0.9}
                style={styles.iconBtn}
                onPress={onCopy}
                accessibilityLabel={`Copy ${workout.name} into my workouts`}
                hitSlop={6}
              >
                <Copy color={colors.accent} size={16} />
              </Press>
            ) : (
              <ChevronRight color={colors.textFaint} size={16} />
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
 * Muscles lead now that the cover no longer carries them — they are how you
 * pick a plan out of a list. Your own plans then get length and intensity;
 * everyone else's get the author, because that is what decides whether to open
 * someone else's.
 */
function metaFor(workout, variant, muscles) {
  const count = workout.exercise_count ?? workout.exercises?.length;
  const exercises = count ? `${count} exercise${count === 1 ? '' : 's'}` : null;
  const groups = muscles.slice(0, 2).join(' · ');

  if (variant === 'mine') {
    return [groups, exercises, workout.duration].filter(Boolean).join('  —  ');
  }

  // Who wrote it leads: in Browse the author is the thing that makes one plan
  // worth opening over another, and the muscle groups repeat across all of them.
  const saves = Number(workout.save_count) || 0;

  return [
    workout.is_mine ? 'Yours' : `by ${workout.author_name}`,
    groups,
    exercises,
    saves > 0 ? `${saves} saved` : null,
  ].filter(Boolean).join('  —  ');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 11,
    marginBottom: 8,
    gap: 10,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Same width as the thumbnail's visual weight, so rows with and without a
  // photo still line their text up.
  bar: { width: 4, height: 38, borderRadius: 2 },
  thumb: { width: 40, height: 40, borderRadius: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
