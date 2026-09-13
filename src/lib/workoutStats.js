/**
 * What a routine card says about a workout before you open it — which muscles,
 * how long, roughly what it burns — and how the list is ordered.
 *
 * Pure functions over the stored row, so they behave the same on your own
 * plans, saved ones and Browse results, and can be tested without a device.
 */

/**
 * MET per muscle group, from the Compendium of Physical Activities, rounded:
 * circuit/HIIT cardio about 8, calisthenic core work about 3.8, and resistance
 * training (moderate to vigorous) about 5 for everything else.
 */
const MET = { Cardio: 8, Core: 3.8 };
const STRENGTH_MET = 5;
const DEFAULT_KG = 70;

const exercisesOf = (workout) => (Array.isArray(workout?.exercises) ? workout.exercises : []);

/**
 * Muscle groups, most-trained first; ties keep the order they appear in.
 *
 * Read from the exercises because no table stores a `muscles` column — the
 * card that expected one had been showing none on every plan.
 */
export function musclesOf(workout) {
  const counts = new Map();
  for (const ex of exercisesOf(workout)) {
    if (ex?.muscle) counts.set(ex.muscle, (counts.get(ex.muscle) || 0) + 1);
  }
  // Map keeps insertion order and sort is stable, which is what breaks ties.
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([muscle]) => muscle);
}

/** Browse rows may carry a precomputed count; plans on the phone have the list. */
export function exerciseCount(workout) {
  const stored = Number(workout?.exercise_count);
  return stored > 0 ? stored : exercisesOf(workout).length;
}

export function setCount(workout) {
  return exercisesOf(workout).reduce((sum, ex) => {
    const sets = Array.isArray(ex?.sets) ? ex.sets.length : Number(ex?.sets) || 0;
    return sum + sets;
  }, 0);
}

/**
 * The plan's own duration when it has one ("40 min" on a suggested plan).
 *
 * Otherwise about 2.5 minutes a set — 45 seconds under load, 90 of rest, and the
 * walk to the next station — rounded to 5, because "37 min" claims a precision
 * that guessing from a set count does not have. Null for an empty plan.
 */
export function estimateMinutes(workout) {
  const stated = parseInt(workout?.duration, 10);
  if (stated > 0) return stated;

  const sets = setCount(workout);
  if (!sets) return null;
  return Math.max(5, Math.round((sets * 2.5) / 5) * 5);
}

/**
 * kcal = MET × body weight (kg) × hours.
 *
 * MET is averaged over the exercises, so a plan that is half cardio burns like
 * half a cardio session. Rounded to 10 for the same reason minutes round to 5.
 * Without a body weight on the profile it assumes 70 kg rather than showing
 * nothing: an estimate is still more useful than a gap.
 */
export function estimateKcal(workout, weightKg) {
  const minutes = estimateMinutes(workout);
  if (!minutes) return null;

  const kg = Number(weightKg) > 0 ? Number(weightKg) : DEFAULT_KG;
  const exercises = exercisesOf(workout);
  const met = exercises.length
    ? exercises.reduce((sum, ex) => sum + (MET[ex?.muscle] ?? STRENGTH_MET), 0) / exercises.length
    : STRENGTH_MET;

  return Math.round((met * kg * (minutes / 60)) / 10) * 10;
}

/**
 * `recent` keeps the order the rows arrived in, which is newest first.
 * `trained` puts what you actually do on top, ties staying newest first.
 * `name` is A–Z, ignoring case.
 *
 * Returns a new array: the input is React state and must not be sorted in place.
 */
export function sortWorkouts(list, key, timesTrained = {}) {
  const rows = [...(list || [])];

  if (key === 'name') {
    return rows.sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
    );
  }
  if (key === 'trained') {
    const times = (w) => timesTrained[String(w?.id)] || 0;
    return rows.sort((a, b) => times(b) - times(a));
  }
  return rows;
}

/**
 * The id of the one row that clearly leads on `score`, or null.
 *
 * A tie at the top has no winner. Two plans done three times each are both
 * your routine, and badging one of them would be a coin toss dressed up as a
 * fact. Below `minimum` nothing is popular yet either.
 */
export function popularId(list, score, minimum) {
  let best = null;
  let bestScore = -Infinity;
  let tied = false;

  for (const row of list || []) {
    const s = Number(score(row)) || 0;
    if (s > bestScore) {
      best = row;
      bestScore = s;
      tied = false;
    } else if (s === bestScore) {
      tied = true;
    }
  }

  return best && !tied && bestScore >= minimum ? best.id : null;
}
