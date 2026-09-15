import { countsAsWork } from './setTypes';

/**
 * How much each muscle group was trained, in hard sets, for the body map.
 *
 * Sets, not exercises or sessions: ten sets of chest in one workout and ten
 * spread over three are the same weekly dose, and the strength-training
 * literature talks about weekly volume in sets per muscle for that reason.
 *
 * Levels are coarse on purpose — a map with fifteen shades reads as noise:
 *
 *   0  nothing
 *   1  1–4 sets     a touch
 *   2  5–9 sets     maintenance
 *   3  10–15 sets   a solid week (the range most programmes aim for)
 *   4  16+ sets     a lot — fine for a focus, worth noticing if it is every week
 *
 * Cardio is counted but has no place on a body, so the map ignores it and the
 * list shows it.
 */

export const LEVELS = [
  { min: 0, label: 'None' },
  { min: 1, label: '1–4' },
  { min: 5, label: '5–9' },
  { min: 10, label: '10–15' },
  { min: 16, label: '16+' },
];

export const MAPPED_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'];

/** Working sets per muscle group from stored session snapshots. */
export function setsByMuscle(sessions) {
  const counts = {};
  (sessions || []).forEach((session) => {
    (session?.exercises || []).forEach((exercise) => {
      if (!exercise?.muscle) return;
      // Snapshots store working sets only, but older ones may carry warm-ups.
      const sets = (exercise.sets || []).filter((set) => countsAsWork(set)).length;
      if (sets > 0) counts[exercise.muscle] = (counts[exercise.muscle] || 0) + sets;
    });
  });
  return counts;
}

/** 0–4 for a set count. */
export function levelFor(sets) {
  const n = Number(sets) || 0;
  let level = 0;
  LEVELS.forEach((entry, i) => {
    if (n >= entry.min) level = i;
  });
  return level;
}

/**
 * The mapped muscles that got little or nothing, least first — what the card
 * suggests next. Only meaningful once something was trained at all; an empty
 * week suggests nothing rather than listing all six.
 */
export function neglected(counts, { below = 5 } = {}) {
  const total = MAPPED_MUSCLES.reduce((sum, m) => sum + (counts?.[m] || 0), 0);
  if (total === 0) return [];
  return MAPPED_MUSCLES
    .filter((m) => (counts?.[m] || 0) < below)
    .sort((a, b) => (counts?.[a] || 0) - (counts?.[b] || 0));
}
