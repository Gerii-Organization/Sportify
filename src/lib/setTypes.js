/**
 * What kind of set a row is.
 *
 * Only one of these changes what the app computes: a warm-up is not work, so
 * it is left out of the volume total and out of the comparison that awards a
 * personal record. Ramping to 40kg is not a 40kg set.
 *
 * The rest are labels. A drop set and a set taken to failure are both real
 * work and both count in full — the letter is there so that reading last
 * Tuesday back tells you why the last set was lighter, or why the reps stopped
 * where they did. Marking them does not change a number.
 */

export const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];

const LABELS = {
  warmup: 'W',
  drop: 'D',
  failure: 'F',
};

const NAMES = {
  working: 'working set',
  warmup: 'warm-up',
  drop: 'drop set',
  failure: 'taken to failure',
};

/**
 * Theme token names per type, resolved by the screen.
 *
 * Named rather than hex so the palette stays in theme.js — green for a warm-up
 * because it is the easy end, red for a drop set because it is the point where
 * the set stops being comfortable, and the currency gold for failure so it does
 * not read as a third traffic light.
 *
 * A plain working set gets nothing: colouring every row would make none of them
 * stand out, which is the whole reason to mark the other three.
 */
const TINTS = {
  warmup: 'success',
  drop: 'danger',
  failure: 'energy',
};

/**
 * The type of a set, tolerating the two older shapes.
 *
 * Sets written before this existed have no `type`; sets written after warm-ups
 * shipped but before the other kinds have `warmup: true` and no `type`. Both
 * are still sitting in `user_workouts.exercises` and in every stored session
 * snapshot, so both have to read correctly forever.
 */
export function typeOf(set) {
  if (set?.type && SET_TYPES.includes(set.type)) return set.type;
  if (set?.warmup) return 'warmup';
  return 'working';
}

/** Tapping the set number moves to the next kind and wraps. */
export function nextType(set) {
  const index = SET_TYPES.indexOf(typeOf(set));
  return SET_TYPES[(index + 1) % SET_TYPES.length];
}

/**
 * The patch that sets a type.
 *
 * `warmup` is written alongside `type` rather than replaced by it: older code
 * paths and every session already stored read that boolean, and a set that
 * says `type: 'warmup'` while `warmup` is false would count towards volume.
 */
export function patchForType(type) {
  return { type, warmup: type === 'warmup' };
}

/** The letter shown in place of the set number, or null for a plain set. */
export function markFor(set) {
  return LABELS[typeOf(set)] || null;
}

/** Whether the set counts as work — towards volume, and towards records. */
export function countsAsWork(set) {
  return typeOf(set) !== 'warmup';
}

export function describeType(set) {
  return NAMES[typeOf(set)] || NAMES.working;
}

/** Theme colour key for a set's mark, or null for an ordinary working set. */
export function tintFor(set) {
  return TINTS[typeOf(set)] || null;
}
