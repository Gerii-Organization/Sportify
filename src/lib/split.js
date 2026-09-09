/**
 * Where you are in your training cycle, worked out from what you actually did.
 *
 * No cursor is stored. A stored position drifts out of step the first time
 * something unexpected happens — a session logged late, a plan edited, an
 * off-plan day — and nothing ever repairs it. The muscles in the last session
 * are the ground truth, and they are already saved with every workout.
 */

/** Muscle groups trained in a session, from its stored set snapshot. */
export function musclesOf(session) {
  const groups = new Set();
  (session?.exercises || []).forEach((ex) => {
    if (ex.muscle) groups.add(ex.muscle);
  });
  return [...groups];
}

/**
 * How well a session matches one day of the split.
 *
 * Scored from the SESSION's side: the fraction of what you trained that belongs
 * to this day. Scoring from the split day's side is the obvious version and it
 * is wrong — a short chest session against a Push day of
 * {Chest, Shoulders, Arms} scores 1/3 and gets called off-plan, when it plainly
 * was a push day.
 */
export function scoreDay(sessionMuscles, day) {
  if (!sessionMuscles.length) return 0;

  const inDay = new Set(day?.muscles || []);
  const hits = sessionMuscles.filter((m) => inDay.has(m)).length;

  return hits / sessionMuscles.length;
}

/** Most of what you did has to belong to the day for it to count as that day. */
const MATCH_THRESHOLD = 0.6;

/**
 * Which day of the split a session was, or null when it was off-plan.
 *
 * `expectedIndex` breaks ties toward the day that was coming up anyway. Arms
 * appear in both Push and Pull, so an arms-only session scores 1.0 against
 * both; counting it as whichever was next is forgiving in the one direction
 * that helps.
 */
export function matchSession(sessionMuscles, split, expectedIndex = null) {
  if (!split?.length || !sessionMuscles.length) return null;

  const scores = split.map((day, i) => ({ i, score: scoreDay(sessionMuscles, day) }));
  const best = Math.max(...scores.map((s) => s.score));

  if (best < MATCH_THRESHOLD) return null;

  const tied = scores.filter((s) => s.score === best);
  if (tied.length === 1) return tied[0].i;

  const expected = tied.find((s) => s.i === expectedIndex);
  if (expected) return expected.i;

  // Still tied and none of them was expected: the session genuinely does not
  // identify one day, so say so rather than picking arbitrarily.
  return null;
}

/**
 * The next day of the cycle, plus what the last session did to the plan.
 *
 * Returns `{ index, day, lastWasOffPlan }`.
 *
 * WHEN A SESSION IS OFF-PLAN the cycle does not advance, but it does not
 * rewind either — the plan re-anchors to whatever you actually did the last
 * time it could recognise one. Trained legs when Pull was next? The cycle moves
 * to legs and offers Push after it. The plan follows you rather than repeating
 * an instruction you have already declined.
 */
export function nextInCycle(split, recentSessions) {
  if (!split?.length) return null;

  // Newest first, so the first recognisable session is the anchor.
  const sessions = [...(recentSessions || [])].sort(
    (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
  );

  let lastWasOffPlan = false;

  for (let i = 0; i < sessions.length; i += 1) {
    const matched = matchSession(musclesOf(sessions[i]), split);

    if (matched !== null) {
      const index = (matched + 1) % split.length;
      return { index, day: split[index], lastWasOffPlan };
    }

    // Only the most recent session decides whether to mention going off-plan;
    // older unmatched ones are just history.
    if (i === 0) lastWasOffPlan = true;
  }

  // Nothing recognisable, or nothing logged: start at the top of the cycle.
  return { index: 0, day: split[0], lastWasOffPlan };
}

/**
 * Whether the weekly target can still be reached.
 *
 * `remainingDays` counts today. Returns `{ done, target, left, daysLeft,
 * reachable }`.
 *
 * The unreachable case is the one worth naming. On a Saturday with one session
 * of four done, "3 to go" is a statement about a thing that cannot happen, and
 * an app that keeps repeating an impossible goal is one people stop opening.
 */
export function weekOutlook({ doneDays, target, weekKeys, today }) {
  const done = doneDays?.length || 0;
  const goal = Number(target) || 0;
  const left = Math.max(goal - done, 0);

  const daysLeft = (weekKeys || []).filter((k) => k >= today).length;

  return {
    done,
    target: goal,
    left,
    daysLeft,
    reachable: left === 0 || left <= daysLeft,
  };
}
