/** Static copy and option lists shown to the user. */

/** Onboarding goals. The `id` is what gets written to `profiles.goal`. */
export const GOALS = [
  { id: 'lose_weight',   label: 'Fat Loss' },
  { id: 'build_muscle',  label: 'Muscle Gain' },
  { id: 'maintain',      label: 'Maintenance' },
  { id: 'gain_strength', label: 'Strength' },
];

export const SEX_OPTIONS = [
  { id: 'M', label: 'Male' },
  { id: 'F', label: 'Female' },
];

/** Shown on the workout summary screen, picked at random. */
export const MOTIVATIONAL_MESSAGES = [
  'You showed up today. That already puts you ahead.',
  'Consistency beats intensity. This session is one more brick.',
  'Strong habits are built one finished workout at a time.',
  "You're not chasing perfection, you're chasing progress.",
  "Future you is grateful you didn't skip this.",
  'The hard part is starting. You did that.',
  'Tiny improvements stacked over time become strength.',
  'You don`t have to feel motivated, you just have to show up.',
  "Discipline is doing what you said you'd do. You did it.",
  'Every rep was a vote for the person you want to become.',
];

export function randomMotivationalMessage() {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
}

/** Quick-add amounts on the water modal, in millilitres. */
export const WATER_AMOUNTS = [250, 500, 750, 1000];
