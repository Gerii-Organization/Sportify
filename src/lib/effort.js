/**
 * How hard a set was, as reps in reserve (RIR): how many more clean reps were
 * left when the set ended.
 *
 * RIR rather than RPE because it is a count, not a scale. "Could you have done
 * two more?" has an answer mid-workout; "was that an 8 or an 8.5?" needs the
 * lifter to know the chart. They are the same information — RPE = 10 − RIR —
 * so nothing is lost by asking the plainer question.
 *
 * Four is the top of the scale, shown as "4+". Past that the estimate stops
 * being reliable, and for progression the only thing that matters is that the
 * set was easy.
 */

export const MAX_RIR = 4;

export const RIR_CHOICES = [0, 1, 2, 3, 4].map((value) => ({
  value,
  label: value === MAX_RIR ? `${MAX_RIR}+` : String(value),
}));

/**
 * An integer 0–4, or null for "not rated".
 *
 * Sets logged before this existed have no `rir`, and a stored snapshot is JSON,
 * so a number can come back as text. Anything that is not a sensible count is
 * treated as unrated rather than guessed at.
 */
export function normaliseRir(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, MAX_RIR);
}

/** "0" … "4+", or null for a set nobody rated. */
export function rirLabel(value) {
  const n = normaliseRir(value);
  if (n === null) return null;
  return n === MAX_RIR ? `${MAX_RIR}+` : String(n);
}

/** For screen readers: "2 reps in reserve". */
export function describeRir(value) {
  const n = normaliseRir(value);
  if (n === null) return 'effort not rated';
  if (n === 0) return 'no reps in reserve';
  return `${rirLabel(n)} rep${n === 1 ? '' : 's'} in reserve`;
}
