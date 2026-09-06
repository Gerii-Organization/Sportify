import { Easing } from 'react-native-reanimated';

/**
 * Motion vocabulary.
 *
 * The app felt mechanical for two reasons, and neither was the simulator:
 *
 * 1. Everything used the legacy `Animated` API on the JS thread. When JavaScript
 *    is busy — and it is, during a fetch or a list render — frames are dropped
 *    mid-animation. Reanimated runs the same animation on the UI thread, so it
 *    keeps its timing regardless of what JavaScript is doing. It was already
 *    installed and configured, and used nowhere.
 *
 * 2. `Animated.spring(..., { friction: 6 })` is an underdamped spring. It
 *    overshoots and wobbles back, which reads as toy-like. Real system UI uses
 *    springs that are nearly critically damped: they arrive fast and stop.
 *
 * The numbers below are damping ratios close to 1. Anything under about 0.7
 * visibly bounces, which is what "forced" looks like.
 */

/**
 * Press response. Very stiff, heavily damped — settles in about 120ms with no
 * visible overshoot, matching the way a real control gives under a finger.
 */
export const PRESS_SPRING = { stiffness: 420, damping: 32, mass: 0.7 };

/** Elements arriving on screen: fast, with a trace of settle. */
export const ENTER_SPRING = { stiffness: 240, damping: 26, mass: 1 };

/** Sheets and larger surfaces: slower, because they travel further. */
export const SHEET_SPRING = { stiffness: 180, damping: 24, mass: 1 };

/**
 * Anything that only fades or slides a short distance is better on a curve
 * than a spring — a spring on opacity has nothing to overshoot into.
 *
 * This is the standard "decelerate" curve: leaves immediately, eases into
 * place. Motion that starts slowly is what makes an interface feel sluggish.
 */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const DURATION = {
  /** State changes the eye should barely register. */
  instant: 120,
  /** The default for fades and small moves. */
  quick: 220,
  /** Entrances, sheet contents. */
  normal: 320,
};

/**
 * Stagger for lists.
 *
 * Cards appearing together read as one block dropping in. Offsetting each by a
 * few frames makes the eye follow the list downward instead. Capped, because
 * past roughly the eighth item the delay is longer than the user's patience and
 * the rest should simply be there.
 */
export function stagger(index, step = 45, max = 8) {
  return Math.min(index, max) * step;
}
