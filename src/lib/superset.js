/**
 * Supersets: two or more exercises performed back to back, resting only once
 * at the end of the round.
 *
 * Stored as a `superset` id on the exercise itself rather than as a nested
 * structure. The workout is a flat array everywhere — the completion snapshot,
 * the volume sum, the last-sets lookup, the muscle scoring for the split — and
 * nesting it would mean touching all of them for a field only the workout
 * screen and the rest timer care about. A grouping id changes nothing for code
 * that does not look for it, and it rides along in the exercises JSON that
 * `user_workouts` already stores whole.
 *
 * Members are always ADJACENT in the array. Order is how you perform the round,
 * so a superset split across the list would be a lie about what you are doing.
 */

/** Where an exercise sits in its round: null when it is on its own. */
export function groupOf(exercises, index) {
  const ex = exercises?.[index];
  if (!ex?.superset) return null;

  const members = [];
  for (let i = 0; i < exercises.length; i += 1) {
    if (exercises[i].superset === ex.superset) members.push(i);
  }
  if (members.length < 2) return null;

  const position = members.indexOf(index);

  return {
    id: ex.superset,
    members,
    position,
    size: members.length,
    isFirst: position === 0,
    isLast: position === members.length - 1,
    // A, B, C — the notation every programme already uses for a round.
    letter: String.fromCharCode(65 + position),
  };
}

/**
 * Whether finishing a set here means it is time to rest.
 *
 * The whole point of a superset is that you do not rest in the middle of one.
 * Starting the timer after the A movement would be the app telling you to do
 * the opposite of what you set up.
 */
export function restsAfter(exercises, exerciseId) {
  const index = (exercises || []).findIndex((ex) => ex.id === exerciseId);
  if (index === -1) return true;

  const group = groupOf(exercises, index);
  return !group || group.isLast;
}

/**
 * Joins an exercise to the one below it.
 *
 * Adopts an existing id when either side already belongs to a round, so linking
 * a third movement onto an A/B pair extends it rather than starting a rival
 * group that happens to sit in the middle of it.
 */
export function linkWithNext(exercises, index) {
  const list = exercises || [];
  if (index < 0 || index >= list.length - 1) return list;

  const id = list[index].superset || list[index + 1].superset || newGroupId();

  return list.map((ex, i) =>
    (i === index || i === index + 1) ? { ...ex, superset: id } : ex
  );
}

/**
 * Takes an exercise out of its round.
 *
 * A group of one is not a superset, so whoever is left alone is released too —
 * otherwise the id lingers and the next link inherits a group the user thought
 * they had broken up.
 */
export function unlink(exercises, index) {
  const list = exercises || [];
  const id = list[index]?.superset;
  if (!id) return list;

  const stripped = list.map((ex, i) => (i === index ? { ...ex, superset: null } : ex));
  const left = stripped.filter((ex) => ex.superset === id);

  if (left.length > 1) return stripped;
  return stripped.map((ex) => (ex.superset === id ? { ...ex, superset: null } : ex));
}

/** Ids only have to be unique inside one workout. */
function newGroupId() {
  return `ss_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
