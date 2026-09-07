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
 *   cue     How to perform it, in one sentence. Setup then execution.
 *   watch   The single most common mistake. Naming one thing is the point —
 *           a list of five is read as none of them.
 *
 * The cues are general coaching points, not medical advice, and they assume a
 * healthy adult. Someone training around an injury should ask a professional
 * rather than an app.
 */

export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

export const EXERCISES = [
  // Chest
  { id: 'bench-press',        name: 'Barbell Bench Press',   muscle: 'Chest',     ratio: 1.2,  upper: true,  isDb: false,
    cue: 'Shoulder blades pulled back and down, feet flat. Lower the bar to mid-chest, press back over the shoulders.',
    watch: 'Bouncing the bar off your chest.' },
  { id: 'incline-db-press',   name: 'Incline Dumbbell Press', muscle: 'Chest',    ratio: 0.9,  upper: true,  isDb: true,
    cue: 'Bench at about 30 degrees. Press up and slightly together, elbows around 45 degrees from your body.',
    watch: 'Flaring the elbows straight out to the sides.' },
  { id: 'chest-fly',          name: 'Machine Chest Fly',     muscle: 'Chest',     ratio: 0.7,  upper: true,  isDb: false,
    cue: 'Keep a slight bend in the elbows and hold it. Bring the handles together in an arc, not a press.',
    watch: 'Straightening the arms at the stretch.' },
  { id: 'push-ups',           name: 'Push-ups',              muscle: 'Chest',     ratio: 0,    upper: true,  isDb: false,
    cue: 'One line from head to heels, hands under the shoulders.',
    watch: 'Hips sagging or riding high.' },

  // Back
  { id: 'barbell-row',        name: 'Barbell Row',           muscle: 'Back',      ratio: 1.0,  upper: true,  isDb: false,
    cue: 'Hinge to about 45 degrees, back flat. Pull to the belly button, elbows past the ribs.',
    watch: 'Standing up as you pull.' },
  { id: 'deadlift',           name: 'Deadlift',              muscle: 'Back',      ratio: 1.5,  upper: false, isDb: false,
    cue: 'Bar over mid-foot, back flat, chest up. Push the floor away; hips and shoulders rise together.',
    watch: 'Hips shooting up first, leaving the bar behind.' },
  { id: 'lat-pulldown',       name: 'Lat Pulldown',          muscle: 'Back',      ratio: 0.9,  upper: true,  isDb: false,
    cue: 'Chest up, slight lean back. Pull to the collarbone by driving the elbows down.',
    watch: 'Leaning back to swing the weight.' },
  { id: 'pull-ups',           name: 'Pull-ups',              muscle: 'Back',      ratio: 0,    upper: true,  isDb: false,
    cue: 'Full hang at the bottom. Pull until the chin clears the bar.',
    watch: 'Kipping when you meant to go strict.' },
  { id: 'dumbbell-row',       name: 'Dumbbell Row',          muscle: 'Back',      ratio: 0.8,  upper: true,  isDb: true,
    cue: 'Supported on a bench, back flat. Pull the dumbbell to the hip, not the shoulder.',
    watch: 'Rotating the torso to help the last reps.' },
  { id: 'face-pulls',         name: 'Face Pulls',            muscle: 'Back',      ratio: 0.3,  upper: true,  isDb: false,
    cue: 'Rope at face height. Pull to the forehead, hands finishing wide, elbows high.',
    watch: 'Going heavy and turning it into a row.' },

  // Legs
  { id: 'squat',              name: 'Barbell Squat',         muscle: 'Legs',      ratio: 1.4,  upper: false, isDb: false,
    cue: 'Bar on the upper back, brace, sit between your hips. Knees track over the toes.',
    watch: 'Knees caving inward as you stand up.' },
  { id: 'leg-press',          name: 'Leg Press',             muscle: 'Legs',      ratio: 2.0,  upper: false, isDb: false,
    cue: 'Feet mid-platform, shoulder width. Lower until the knees reach about 90 degrees.',
    watch: 'Letting the lower back round off the pad.' },
  { id: 'romanian-deadlift',  name: 'Romanian Deadlift',     muscle: 'Legs',      ratio: 1.2,  upper: false, isDb: false,
    cue: 'Soft knees, push the hips back, bar close to the legs. Stop where the hamstrings stop you.',
    watch: 'Bending the knees until it becomes a squat.' },
  { id: 'split-squat',        name: 'Bulgarian Split Squat', muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: true,
    cue: 'Rear foot elevated, front shin close to vertical. Drop straight down.',
    watch: 'Front foot too close to the bench.' },
  { id: 'leg-extension',      name: 'Leg Extensions',        muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: false,
    cue: 'Pad on the lower shin. Extend to straight, pause, lower under control.',
    watch: 'Swinging the weight up with momentum.' },
  { id: 'leg-curl',           name: 'Leg Curls',             muscle: 'Legs',      ratio: 0.6,  upper: false, isDb: false,
    cue: 'Hips flat on the pad. Curl the heels toward the glutes.',
    watch: 'Lifting the hips to steal range.' },
  { id: 'calf-raise',         name: 'Calf Raises',           muscle: 'Legs',      ratio: 1.0,  upper: false, isDb: false,
    cue: 'Full stretch at the bottom, all the way up onto the toes.',
    watch: 'Bouncing through a short range.' },
  { id: 'bodyweight-squat',   name: 'Bodyweight Squats',     muscle: 'Legs',      ratio: 0,    upper: false, isDb: false,
    cue: 'Feet shoulder width, weight through mid-foot. Sit down and back.',
    watch: 'Heels lifting off the floor.' },
  { id: 'walking-lunges',     name: 'Walking Lunges',        muscle: 'Legs',      ratio: 0,    upper: false, isDb: false,
    cue: 'Long step, drop the back knee toward the floor, torso upright.',
    watch: 'Steps so short the front knee travels far past the toes.' },

  // Shoulders
  { id: 'overhead-press',     name: 'Overhead Press',        muscle: 'Shoulders', ratio: 0.7,  upper: true,  isDb: false,
    cue: 'Brace, bar at the collarbone. Press up and slightly back, head through at the top.',
    watch: 'Leaning back and pressing off the chest.' },
  { id: 'db-shoulder-press',  name: 'DB Shoulder Press',     muscle: 'Shoulders', ratio: 0.6,  upper: true,  isDb: true,
    cue: 'Elbows slightly forward rather than flared. Press until the dumbbells nearly touch.',
    watch: 'Arching the lower back to finish the rep.' },
  { id: 'lateral-raise',      name: 'Lateral Raises',        muscle: 'Shoulders', ratio: 0.2,  upper: true,  isDb: true,
    cue: 'Slight bend in the elbow, lead with the elbow to shoulder height.',
    watch: 'Shrugging or swinging the weight up.' },
  { id: 'db-thrusters',       name: 'Light DB Thrusters',    muscle: 'Shoulders', ratio: 0.3,  upper: true,  isDb: true,
    cue: 'A front squat into an overhead press as one movement, using the leg drive.',
    watch: 'Pausing between the squat and the press.' },

  // Arms
  { id: 'bicep-curl',         name: 'Barbell Bicep Curl',    muscle: 'Arms',      ratio: 0.4,  upper: true,  isDb: false,
    cue: 'Elbows pinned at your sides. Curl without moving the upper arm.',
    watch: 'Swinging the bar with the lower back.' },
  { id: 'hammer-curl',        name: 'Hammer Curl',           muscle: 'Arms',      ratio: 0.35, upper: true,  isDb: true,
    cue: 'Neutral grip, thumbs up the whole way.',
    watch: 'Rotating the wrist at the top.' },
  { id: 'tricep-pushdown',    name: 'Cable Tricep Pushdown', muscle: 'Arms',      ratio: 0.5,  upper: true,  isDb: false,
    cue: 'Elbows locked to the ribs. Extend to straight, control the return.',
    watch: 'Letting the elbows drift forward.' },

  // Core
  { id: 'crunches',           name: 'Crunches',              muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Lift the shoulder blades off the floor, ribs toward the hips. Short range.',
    watch: 'Pulling on your neck with your hands.' },
  { id: 'plank',              name: 'Plank',                 muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Straight line from head to heels, glutes squeezed, keep breathing.',
    watch: 'Hips sagging as you tire.' },
  { id: 'russian-twists',     name: 'Russian Twists',        muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Lean back with the chest up. Rotate from the ribs, not the arms.',
    watch: 'Rounding the lower back.' },
  { id: 'leg-raises',         name: 'Leg Raises',            muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Lower back pressed into the floor. Lower the legs only as far as you can hold that.',
    watch: 'The back arching off the floor.' },

  // Cardio
  { id: 'jumping-jacks',      name: 'Jumping Jacks',         muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Land soft with the knees slightly bent, arms all the way overhead.',
    watch: 'Landing stiff-legged.' },
  { id: 'burpees',            name: 'Burpees',               muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Chest to the floor, jump the feet in, stand and jump.',
    watch: 'Letting the hips sag at the bottom.' },
  { id: 'high-knees',         name: 'High Knees',            muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Knees to hip height, stay on the balls of your feet.',
    watch: 'Leaning back to lift the knees higher.' },
  { id: 'mountain-climbers',  name: 'Mountain Climbers',     muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Hold a strong plank and drive the knees in one at a time.',
    watch: 'Hips bouncing up and down.' },
  { id: 'squat-jumps',        name: 'Squat Jumps',           muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Squat, jump, land soft straight back into the squat.',
    watch: 'Landing with straight legs.' },
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
