import { normaliseUnit, toDisplayWeight } from './units';
import { normaliseRir, MAX_RIR } from './effort';

/**
 * What to try this session, from what you lifted last time.
 *
 * Double progression — the rule most strength programmes use because it needs
 * no percentages and no 1RM test: keep the weight until every working set
 * reaches the target reps, then take the smallest sensible jump and let the
 * reps climb back up.
 *
 * The app already had both halves. `get_last_sets` returns last session's
 * working sets (warm-ups are dropped when a session is saved), and the plan
 * carries the reps you are aiming for. The "Prev" column showed the first and
 * left the arithmetic to you, mid-set, with a bar in your hands.
 *
 * Returns `{ kind, weight, reps, reason }` in the units the lifter reads, or
 * null when there is nothing to go on:
 *   increase  every set hit the target — go up
 *   repeat    close — same weight, finish the reps
 *   deload    well short — the jump was too big, come back down
 *   reps      bodyweight — nothing to add but repetitions
 *
 * When the sets were rated (reps in reserve, lib/effort.js) the rating adjusts
 * the one decision reps alone get wrong — whether hitting the target means
 * ready. Eight reps with nothing left is the ceiling, not a springboard: stay.
 * Eight with three or more to spare means the weight was light: jump twice.
 * Unrated sets behave exactly as before.
 */

/** Smallest jump worth taking, in the lifter's units. */
export function incrementFor({ unit, lowerBody = false, dumbbell = false }) {
  const imperial = normaliseUnit(unit) === 'imperial';
  // Per hand for dumbbells, which is why it is smaller than a barbell jump.
  if (dumbbell) return imperial ? 5 : 2;
  if (lowerBody) return imperial ? 10 : 5;
  return imperial ? 5 : 2.5;
}

const roundTo = (value, step) => Math.round(value / step) * step;
const floorTo = (value, step) => Math.floor(value / step) * step;

/**
 * Below this share of the target, the weight was not "nearly there" but too
 * heavy: 4 reps of a planned 8 is a load problem, not a rep problem.
 */
const TOO_HEAVY = 0.6;

export function suggestNext({ lastSets, targetReps, unit, lowerBody = false, dumbbell = false }) {
  const sets = (Array.isArray(lastSets) ? lastSets : [])
    .map((set) => ({
      weight: Math.max(0, Number(set?.weight) || 0),
      reps: Math.round(Number(set?.reps) || 0),
      rir: normaliseRir(set?.rir),
    }))
    .filter((set) => set.reps > 0);

  if (!sets.length) return null;

  const top = Math.max(...sets.map((set) => set.weight));
  // Judged on the sets at the heaviest weight only. A back-off set at 50 kg
  // after three at 60 says nothing about whether 60 is ready to go up.
  const atTop = sets.filter((set) => set.weight === top);
  const best = Math.max(...atTop.map((set) => set.reps));
  const worst = Math.min(...atTop.map((set) => set.reps));
  const planned = Math.round(Number(targetReps));
  const target = planned > 0 ? planned : best;

  if (top === 0) {
    // Holds are logged in seconds (a 60 on a plank); one more second is not
    // progress anyone notices, five is.
    const step = best >= 30 ? 5 : 1;
    return { kind: 'reps', weight: 0, reps: best + step, reason: `Best set last time: ${best}` };
  }

  const imperial = normaliseUnit(unit) === 'imperial';
  const precision = imperial ? 1 : 0.5;
  const increment = incrementFor({ unit, lowerBody, dumbbell });
  const shown = toDisplayWeight(top, unit, precision);

  // The hardest of the rated top sets; null when none were rated.
  const rated = atTop.map((set) => set.rir).filter((rir) => rir !== null);
  const reserve = rated.length ? Math.min(...rated) : null;

  if (worst >= target && reserve === 0) {
    return { kind: 'repeat', weight: shown, reps: target, reason: `Hit ${target} reps, but with nothing left` };
  }

  if (worst >= target && reserve !== null && reserve >= 3) {
    return {
      kind: 'increase',
      weight: roundTo(shown + increment * 2, precision),
      reps: target,
      reason: `Hit ${target} reps with ${reserve >= MAX_RIR ? `${MAX_RIR}+` : reserve} to spare`,
    };
  }

  if (worst >= target) {
    return {
      kind: 'increase',
      weight: roundTo(shown + increment, precision),
      reps: target,
      reason: atTop.length > 1 ? `All ${atTop.length} sets hit ${target} reps last time` : `You hit ${target} reps last time`,
    };
  }

  if (worst <= Math.floor(target * TOO_HEAVY)) {
    // Rounded down to a whole jump so the suggestion is a weight you can
    // actually load, not 54 kg.
    const lighter = floorTo(shown * 0.9, increment);
    if (lighter > 0 && lighter < shown) {
      return { kind: 'deload', weight: lighter, reps: target, reason: `Only ${worst} of ${target} reps last time` };
    }
  }

  return {
    kind: 'repeat',
    weight: shown,
    reps: target,
    reason: atTop.length > 1 ? `Lowest set last time: ${worst} of ${target} reps` : `${worst} of ${target} reps last time`,
  };
}
