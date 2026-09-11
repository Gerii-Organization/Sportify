/**
 * How long to rest between sets.
 *
 * Split out of RestTimer.js so it can be tested: that file contains JSX, and a
 * test runner with no React Native resolver cannot import it at all. The same
 * reason sleep.js exists.
 *
 * RestTimer re-exports everything here, so no call site changed.
 */

export const REST_SECONDS_BY_GOAL = {
  gain_strength: 180,
  build_muscle: 90,
  maintain: 60,
  lose_weight: 45,
};

/**
 * The lengths offered in settings, plus the automatic option.
 *
 * Kept short and round: nobody rests for 73 seconds, and a free-text field for
 * a number you set once is more work than the choice deserves.
 */
export const REST_CHOICES = [null, 45, 60, 90, 120, 180, 300];

export function labelForRestChoice(seconds) {
  if (!seconds) return 'Automatic';
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * How long to rest.
 *
 * `override` is the user's own choice from settings and wins outright. Without
 * one it follows the training goal — heavy strength work needs far longer
 * recovery than a fat-loss circuit, and someone who never opens settings should
 * still get the right answer.
 */
export function restSecondsFor(goal, override) {
  const chosen = Number(override);
  if (Number.isFinite(chosen) && chosen > 0) return chosen;
  return REST_SECONDS_BY_GOAL[goal] ?? 90;
}
