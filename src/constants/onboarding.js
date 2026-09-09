/**
 * The sign-up flow, one question at a time.
 *
 * Registration used to be a single form with seven fields plus a goal picker,
 * validated only when you pressed Create Account — so a mistyped age was found
 * after filling everything in, and the whole thing arrived as a wall before you
 * had any reason to trust it.
 *
 * Splitting it changes two things. Each answer is checked as you give it, and
 * each step can say why it is being asked: the app uses your weight and height
 * for the calorie target, and saying so is the difference between a form and an
 * interrogation.
 *
 * `validate` returns an error string, or null when the step is good. Keeping it
 * here rather than in the screen means the rules sit next to the fields they
 * belong to.
 */

const numberIn = (value, min, max) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= min && n <= max;
};

export const SIGNUP_STEPS = [
  {
    id: 'account',
    title: 'Create your account',
    note: 'Your email is only used to sign you in.',
    fields: ['email', 'password', 'confirmPassword'],
    validate: ({ email, password, confirmPassword }) => {
      if (!email.trim()) return 'Enter your email.';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'That does not look like an email address.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      if (password !== confirmPassword) return 'The two passwords do not match.';
      return null;
    },
  },
  {
    id: 'goal',
    title: 'What are you training for?',
    note: 'This sets your calorie target and how your workouts are built.',
    fields: ['goal'],
    validate: ({ goal }) => (goal ? null : 'Pick one to continue.'),
  },
  {
    id: 'about',
    title: 'About you',
    note: 'Age and sex change how your daily calories are worked out.',
    fields: ['firstName', 'age', 'sex'],
    validate: ({ firstName, age, sex }) => {
      if (!firstName.trim()) return 'What should we call you?';
      // 16 rather than 13: Romania's GDPR age of consent. Below it the app
      // would need parental consent and a Families declaration on Play.
      if (!numberIn(age, 16, 100)) return 'You need to be 16 or older to use Sportify.';
      if (sex !== 'M' && sex !== 'F') return 'Pick one.';
      return null;
    },
  },
  {
    id: 'body',
    title: 'Your measurements',
    note: 'Used for the calorie target and the starting weights we suggest. You can change them any time.',
    fields: ['weight', 'height'],
    validate: ({ weight, height }) => {
      if (!numberIn(weight, 30, 300)) return 'Enter a weight between 30 and 300 kg.';
      if (!numberIn(height, 100, 250)) return 'Enter a height between 100 and 250 cm.';
      return null;
    },
  },
  {
    id: 'commitment',
    title: 'How often will you train?',
    note: 'Be honest rather than ambitious — this is what your weekly target is measured against.',
    fields: ['workouts'],
    validate: ({ workouts }) => (numberIn(workouts, 1, 7) ? null : 'Pick between 1 and 7.'),
  },
  {
    id: 'split',
    title: 'How do you split your training?',
    note: 'Sportify uses this to tell you which session is due. You can change it any time, and skipping a day never breaks it.',
    fields: ['split'],
    // Optional on purpose. Someone who does not think in splits should not be
    // blocked at the last step of signing up — without one the app falls back
    // to suggesting whichever muscle group has had the least work.
    validate: () => null,
  },
];

/** Shown on the commitment step instead of a free-text number field. */
export const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
