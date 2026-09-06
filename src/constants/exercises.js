/**
 * One exercise catalogue for the whole app.
 *
 * Previously there were two disconnected lists: a 12-item picker inside
 * WorkoutDetailScreen (which had muscle groups) and a ~40-item table inside
 * TrainingScreen's workout generator (which had loading ratios but no muscle).
 * Neither knew about the other, so the generator produced exercises the picker
 * could not offer, and every generated exercise was missing its muscle group.
 *
 * Field reference:
 *   ratio   Fraction of bodyweight used to suggest a starting load.
 *           0 means bodyweight-only — no weight is suggested.
 *   upper   Upper-body lift. Used to pick the right strength modifier.
 *   isDb    Dumbbell exercise; the suggested load is per-hand, so it is halved.
 */

export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

export const EXERCISES = [
  // Chest
  { id: 'bench-press',        name: 'Barbell Bench Press',   muscle: 'Chest',     ratio: 1.2,  upper: true,  isDb: false },
  { id: 'incline-db-press',   name: 'Incline Dumbbell Press', muscle: 'Chest',    ratio: 0.9,  upper: true,  isDb: true },
  { id: 'chest-fly',          name: 'Machine Chest Fly',     muscle: 'Chest',     ratio: 0.7,  upper: true,  isDb: false },
  { id: 'push-ups',           name: 'Push-ups',              muscle: 'Chest',     ratio: 0,    upper: true,  isDb: false },

  // Back
  { id: 'barbell-row',        name: 'Barbell Row',           muscle: 'Back',      ratio: 1.0,  upper: true,  isDb: false },
  { id: 'deadlift',           name: 'Deadlift',              muscle: 'Back',      ratio: 1.5,  upper: false, isDb: false },
  { id: 'lat-pulldown',       name: 'Lat Pulldown',          muscle: 'Back',      ratio: 0.9,  upper: true,  isDb: false },
  { id: 'pull-ups',           name: 'Pull-ups',              muscle: 'Back',      ratio: 0,    upper: true,  isDb: false },
  { id: 'dumbbell-row',       name: 'Dumbbell Row',          muscle: 'Back',      ratio: 0.8,  upper: true,  isDb: true },
  { id: 'face-pulls',         name: 'Face Pulls',            muscle: 'Back',      ratio: 0.3,  upper: true,  isDb: false },

  // Legs
  { id: 'squat',              name: 'Barbell Squat',         muscle: 'Legs',      ratio: 1.4,  upper: false, isDb: false },
  { id: 'leg-press',          name: 'Leg Press',             muscle: 'Legs',      ratio: 2.0,  upper: false, isDb: false },
  { id: 'romanian-deadlift',  name: 'Romanian Deadlift',     muscle: 'Legs',      ratio: 1.2,  upper: false, isDb: false },
  { id: 'split-squat',        name: 'Bulgarian Split Squat', muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: true },
  { id: 'leg-extension',      name: 'Leg Extensions',        muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: false },
  { id: 'leg-curl',           name: 'Leg Curls',             muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: false },
  { id: 'calf-raise',         name: 'Calf Raises',           muscle: 'Legs',      ratio: 1.0,  upper: false, isDb: false },
  { id: 'bodyweight-squat',   name: 'Bodyweight Squats',     muscle: 'Legs',      ratio: 0,    upper: false, isDb: false },
  { id: 'walking-lunges',     name: 'Walking Lunges',        muscle: 'Legs',      ratio: 0,    upper: false, isDb: false },

  // Shoulders
  { id: 'overhead-press',     name: 'Overhead Press',        muscle: 'Shoulders', ratio: 0.7,  upper: true,  isDb: false },
  { id: 'db-shoulder-press',  name: 'DB Shoulder Press',     muscle: 'Shoulders', ratio: 0.6,  upper: true,  isDb: true },
  { id: 'lateral-raise',      name: 'Lateral Raises',        muscle: 'Shoulders', ratio: 0.2,  upper: true,  isDb: true },
  { id: 'db-thrusters',       name: 'Light DB Thrusters',    muscle: 'Shoulders', ratio: 0.3,  upper: true,  isDb: true },

  // Arms
  { id: 'bicep-curl',         name: 'Barbell Bicep Curl',    muscle: 'Arms',      ratio: 0.4,  upper: true,  isDb: false },
  { id: 'hammer-curl',        name: 'Hammer Curl',           muscle: 'Arms',      ratio: 0.35, upper: true,  isDb: true },
  { id: 'tricep-pushdown',    name: 'Cable Tricep Pushdown', muscle: 'Arms',      ratio: 0.5,  upper: true,  isDb: false },

  // Core
  { id: 'crunches',           name: 'Crunches',              muscle: 'Core',      ratio: 0,    upper: false, isDb: false },
  { id: 'plank',              name: 'Plank',                 muscle: 'Core',      ratio: 0,    upper: false, isDb: false },
  { id: 'russian-twists',     name: 'Russian Twists',        muscle: 'Core',      ratio: 0,    upper: false, isDb: false },
  { id: 'leg-raises',         name: 'Leg Raises',            muscle: 'Core',      ratio: 0,    upper: false, isDb: false },

  // Cardio
  { id: 'jumping-jacks',      name: 'Jumping Jacks',         muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false },
  { id: 'burpees',            name: 'Burpees',               muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false },
  { id: 'high-knees',         name: 'High Knees',            muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false },
  { id: 'mountain-climbers',  name: 'Mountain Climbers',     muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false },
  { id: 'squat-jumps',        name: 'Squat Jumps',           muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false },
];

const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id) {
  return BY_ID[id];
}

export function findExerciseByName(name) {
  return EXERCISES.find((e) => e.name === name);
}

/**
 * Training-style groups the workout generator draws from.
 * Values are exercise ids; order matters, the generator takes from the front.
 */
export const EXERCISE_GROUPS = {
  heavy_push:     ['bench-press', 'overhead-press', 'incline-db-press'],
  hyper_push:     ['chest-fly', 'tricep-pushdown', 'lateral-raise', 'db-shoulder-press'],
  heavy_pull:     ['barbell-row', 'deadlift', 'lat-pulldown', 'pull-ups'],
  hyper_pull:     ['dumbbell-row', 'face-pulls', 'bicep-curl', 'hammer-curl'],
  heavy_legs:     ['squat', 'leg-press', 'romanian-deadlift'],
  hyper_legs:     ['split-squat', 'leg-extension', 'leg-curl', 'calf-raise'],
  cardio:         ['jumping-jacks', 'burpees', 'high-knees', 'mountain-climbers', 'squat-jumps'],
  core:           ['crunches', 'plank', 'russian-twists', 'leg-raises'],
  light_fullbody: ['push-ups', 'bodyweight-squat', 'db-thrusters', 'walking-lunges'],
};

/** Resolve a group name to full exercise objects. */
export function exercisesInGroup(groupName) {
  return (EXERCISE_GROUPS[groupName] || []).map((id) => BY_ID[id]).filter(Boolean);
}
