/**
 * The popular training splits, as ordered cycles.
 *
 * A split is a sequence of session types, not a weekly calendar. `days` is the
 * cycle; how often you run it is `workouts_per_week`, which the profile already
 * holds. The two are deliberately independent — Push/Pull/Legs run twice a week
 * is a three-day cycle with a target of six, and forcing them equal would make
 * the most common serious split impossible to express.
 *
 * `suggested` is only used to order the list against what the user just said in
 * onboarding. It never restricts the choice: someone training three times a
 * week can still pick a five-day cycle, it just takes longer to come round.
 */

export const SPLIT_PRESETS = [
  {
    id: 'full_body',
    name: 'Full body',
    note: 'One session type, everything each time. Hard to fall behind on.',
    suggested: [2, 3],
    days: [
      { label: 'Full body', muscles: ['Chest', 'Back', 'Legs'] },
    ],
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower',
    note: 'Two alternating sessions. The usual step up from full body.',
    suggested: [4],
    days: [
      { label: 'Upper', muscles: ['Chest', 'Back', 'Shoulders', 'Arms'] },
      { label: 'Lower', muscles: ['Legs', 'Core'] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    note: 'Grouped by movement. Run once through for 3 days, twice for 6.',
    suggested: [3, 6],
    days: [
      { label: 'Push', muscles: ['Chest', 'Shoulders', 'Arms'] },
      { label: 'Pull', muscles: ['Back', 'Arms'] },
      { label: 'Legs', muscles: ['Legs', 'Core'] },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold split',
    note: 'Chest with back, shoulders with arms, legs on their own.',
    suggested: [3, 6],
    days: [
      { label: 'Chest & Back', muscles: ['Chest', 'Back'] },
      { label: 'Shoulders & Arms', muscles: ['Shoulders', 'Arms'] },
      { label: 'Legs', muscles: ['Legs', 'Core'] },
    ],
  },
  {
    id: 'bro',
    name: 'Bro split',
    note: 'One muscle group a day. Most volume per group, least often.',
    suggested: [5],
    days: [
      { label: 'Chest', muscles: ['Chest'] },
      { label: 'Back', muscles: ['Back'] },
      { label: 'Legs', muscles: ['Legs'] },
      { label: 'Shoulders', muscles: ['Shoulders'] },
      { label: 'Arms', muscles: ['Arms'] },
    ],
  },
];

/** Starting point for a custom split — one day, edited from there. */
export const BLANK_SPLIT_DAY = { label: 'Day 1', muscles: [] };

export const getPreset = (id) => SPLIT_PRESETS.find((p) => p.id === id) || null;

/**
 * Presets ordered by how well they fit a weekly target, best first.
 *
 * Ordering rather than filtering: someone who said three days may still want
 * Upper/Lower, and hiding it would be the app deciding on their behalf from one
 * number they gave in passing.
 */
export function presetsFor(perWeek) {
  const target = Number(perWeek) || 3;

  return [...SPLIT_PRESETS].sort((a, b) => {
    const fit = (p) => Math.min(...p.suggested.map((n) => Math.abs(n - target)));
    return fit(a) - fit(b);
  });
}

/**
 * "A 5-day cycle takes about 12 days at 3 sessions a week."
 *
 * Shown once, in the editor, where the choice is made. The advice card never
 * repeats it — that would be nagging about a decision already taken.
 */
export function cycleNote(days, perWeek) {
  const length = days?.length || 0;
  const target = Number(perWeek) || 0;
  if (!length || !target) return null;

  if (length <= target) {
    const times = Math.floor(target / length);
    return times > 1
      ? `You will run this cycle ${times} times a week.`
      : 'One full cycle a week.';
  }

  const days_to_finish = Math.round((length / target) * 7);
  return `At ${target} session${target === 1 ? '' : 's'} a week, one full cycle takes about ${days_to_finish} days.`;
}
