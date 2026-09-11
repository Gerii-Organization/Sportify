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
  // ---- Added later. Same fields, same rules; grouped here so the original
  // ---- catalogue stays readable as the set someone first reviewed.

  // Chest
  { id: 'db-bench-press',     name: 'Dumbbell Bench Press',  muscle: 'Chest',     ratio: 1.0,  upper: true,  isDb: true,
    cue: 'Press from the lower chest, wrists stacked over the elbows, and stop just short of the bells touching.',
    watch: 'Letting the elbows flare straight out to the sides.' },
  { id: 'incline-bench-press', name: 'Incline Barbell Press', muscle: 'Chest',    ratio: 1.0,  upper: true,  isDb: false,
    cue: 'Bench at about 30 degrees. Lower to the top of the chest, press back over the collarbone.',
    watch: 'Setting the bench so steep it becomes a shoulder press.' },
  { id: 'dips',               name: 'Dips',                  muscle: 'Chest',     ratio: 0,    upper: true,  isDb: false,
    cue: 'Lean the torso forward a little and lower until the upper arms are parallel to the floor.',
    watch: 'Dropping deeper than the shoulders are comfortable with.' },
  { id: 'cable-crossover',    name: 'Cable Crossover',       muscle: 'Chest',     ratio: 0.4,  upper: true,  isDb: false,
    cue: 'Slight bend in the elbows held throughout; bring the hands together in front of the chest.',
    watch: 'Turning it into a press by bending the arms.' },

  // Back
  { id: 'seated-cable-row',   name: 'Seated Cable Row',      muscle: 'Back',      ratio: 0.8,  upper: true,  isDb: false,
    cue: 'Chest tall, pull the handle to the navel and let the shoulder blades come together.',
    watch: 'Rowing with the lower back instead of the arms.' },
  { id: 'chin-ups',           name: 'Chin-ups',              muscle: 'Back',      ratio: 0,    upper: true,  isDb: false,
    cue: 'Underhand grip, shoulder width. Pull until the chin clears the bar, lower under control.',
    watch: 'Kipping the hips to get the last rep.' },
  { id: 't-bar-row',          name: 'T-Bar Row',             muscle: 'Back',      ratio: 0.9,  upper: true,  isDb: false,
    cue: 'Hinge to about 45 degrees, back flat, and row to the bottom of the ribcage.',
    watch: 'Standing more upright as the set gets hard.' },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', muscle: 'Back',   ratio: 0.4,  upper: true,  isDb: false,
    cue: 'Arms almost straight, sweep the bar down to the thighs using the lats.',
    watch: 'Bending the elbows into a triceps pushdown.' },
  { id: 'shrugs',             name: 'Barbell Shrugs',        muscle: 'Back',      ratio: 1.0,  upper: true,  isDb: false,
    cue: 'Lift the shoulders straight up towards the ears and pause at the top.',
    watch: 'Rolling the shoulders backwards.' },

  // Legs
  { id: 'front-squat',        name: 'Front Squat',           muscle: 'Legs',      ratio: 0.9,  upper: false, isDb: false,
    cue: 'Elbows high, bar resting on the front delts. Sit straight down, chest up.',
    watch: 'The elbows dropping, which pulls you forward.' },
  { id: 'hip-thrust',         name: 'Hip Thrust',            muscle: 'Legs',      ratio: 1.4,  upper: false, isDb: false,
    cue: 'Upper back on the bench, chin tucked, drive through the heels to full lockout.',
    watch: 'Arching the lower back instead of finishing with the glutes.' },
  { id: 'goblet-squat',       name: 'Goblet Squat',          muscle: 'Legs',      ratio: 0.4,  upper: false, isDb: true,
    cue: 'Hold one bell at the chest and squat between the knees, elbows inside.',
    watch: 'Letting the weight pull the chest down.' },
  { id: 'hack-squat',         name: 'Hack Squat',            muscle: 'Legs',      ratio: 1.3,  upper: false, isDb: false,
    cue: 'Feet mid-platform, lower under control until the thighs pass parallel.',
    watch: 'Bouncing out of the bottom.' },
  { id: 'hip-adduction',      name: 'Hip Abduction',         muscle: 'Legs',      ratio: 0.5,  upper: false, isDb: false,
    cue: 'Sit tall and push the knees apart slowly, pausing at the widest point.',
    watch: 'Using momentum to slam the pads open.' },
  { id: 'step-ups',           name: 'Step-ups',              muscle: 'Legs',      ratio: 0.3,  upper: false, isDb: true,
    cue: 'Box around knee height. Drive through the top foot without pushing off the floor.',
    watch: 'Hopping off the trailing leg.' },

  // Shoulders
  { id: 'arnold-press',       name: 'Arnold Press',          muscle: 'Shoulders', ratio: 0.5,  upper: true,  isDb: true,
    cue: 'Start with palms facing you, rotate out as you press overhead.',
    watch: 'Rotating after the press instead of during it.' },
  { id: 'upright-row',        name: 'Upright Row',           muscle: 'Shoulders', ratio: 0.5,  upper: true,  isDb: false,
    cue: 'Wider than shoulder-width grip, pull to the lower chest with the elbows leading.',
    watch: 'Pulling to the chin with a narrow grip.' },
  { id: 'rear-delt-fly',      name: 'Rear Delt Fly',         muscle: 'Shoulders', ratio: 0.2,  upper: true,  isDb: true,
    cue: 'Hinge forward, small bend in the elbows, sweep the bells out to the sides.',
    watch: 'Squeezing the shoulder blades instead of moving the arms.' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise',  muscle: 'Shoulders', ratio: 0.2,  upper: true,  isDb: false,
    cue: 'Cable behind you, raise to shoulder height with the elbow slightly bent.',
    watch: 'Shrugging as the weight gets heavy.' },

  // Arms
  { id: 'skull-crushers',     name: 'Skull Crushers',        muscle: 'Arms',      ratio: 0.4,  upper: true,  isDb: false,
    cue: 'Elbows pointed at the ceiling and still; lower the bar to the forehead.',
    watch: 'Letting the elbows drift back towards the shoulders.' },
  { id: 'overhead-tricep-ext', name: 'Overhead Triceps Extension', muscle: 'Arms', ratio: 0.3, upper: true,  isDb: true,
    cue: 'One bell in both hands, elbows beside the ears, lower behind the head.',
    watch: 'Flaring the elbows out to cheat the weight up.' },
  { id: 'preacher-curl',      name: 'Preacher Curl',         muscle: 'Arms',      ratio: 0.3,  upper: true,  isDb: false,
    cue: 'Upper arms flat on the pad, curl without lifting the shoulders.',
    watch: 'Cutting the bottom half of the rep.' },
  { id: 'incline-db-curl',    name: 'Incline Dumbbell Curl', muscle: 'Arms',      ratio: 0.2,  upper: true,  isDb: true,
    cue: 'Lie back on an incline, arms hanging straight down, curl without moving the elbow forward.',
    watch: 'Swinging the arms up from the shoulder.' },
  { id: 'close-grip-bench',   name: 'Close-Grip Bench Press', muscle: 'Arms',     ratio: 0.9,  upper: true,  isDb: false,
    cue: 'Hands about shoulder-width, elbows tucked, lower to the lower chest.',
    watch: 'Gripping so narrow the wrists take the load.' },
  { id: 'wrist-curl',         name: 'Wrist Curl',            muscle: 'Arms',      ratio: 0.15, upper: true,  isDb: true,
    cue: 'Forearms supported, let the bells roll to the fingers and curl them back.',
    watch: 'Moving the elbows.' },

  // Core
  { id: 'hanging-leg-raise',  name: 'Hanging Leg Raise',     muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Hang still, tilt the pelvis under and lift the legs without swinging.',
    watch: 'Using a swing from the shoulders.' },
  { id: 'cable-crunch',       name: 'Cable Crunch',          muscle: 'Core',      ratio: 0.5,  upper: false, isDb: false,
    cue: 'Kneel under the rope, hips fixed, curl the ribcage towards the pelvis.',
    watch: 'Hinging at the hips instead of flexing the spine.' },
  { id: 'ab-wheel',           name: 'Ab Wheel Rollout',      muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Ribs down and hips tucked; roll only as far as you can hold that position.',
    watch: 'Letting the lower back sag at full stretch.' },
  { id: 'side-plank',         name: 'Side Plank',            muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Elbow under the shoulder, body in one line, hips lifted and level.',
    watch: 'Letting the top hip roll forward.' },
  { id: 'dead-bug',           name: 'Dead Bug',              muscle: 'Core',      ratio: 0,    upper: false, isDb: false,
    cue: 'Lower back pressed to the floor; extend the opposite arm and leg slowly.',
    watch: 'The lower back lifting off the floor.' },

  // Cardio
  { id: 'rowing-machine',     name: 'Rowing Machine',        muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Legs, then back, then arms — and the reverse order coming back.',
    watch: 'Pulling with the arms before the legs have finished.' },
  { id: 'treadmill-run',      name: 'Treadmill Run',         muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Land under the hips with a quick turnover rather than long strides.',
    watch: 'Holding the rails.' },
  { id: 'stationary-bike',    name: 'Stationary Bike',       muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Saddle height so the knee is just short of straight at the bottom.',
    watch: 'A saddle so low the knees take the work.' },
  { id: 'jump-rope',          name: 'Jump Rope',             muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Small jumps off the balls of the feet, turning the rope from the wrists.',
    watch: 'Swinging from the shoulders.' },
  { id: 'stair-climber',      name: 'Stair Climber',         muscle: 'Cardio',    ratio: 0,    upper: false, isDb: false,
    cue: 'Stand tall, whole foot on the step, let the legs do the work.',
    watch: 'Leaning your bodyweight onto the handles.' },
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
