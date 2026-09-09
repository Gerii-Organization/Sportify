import { MUSCLES } from '../constants/exercises';
import { nextInCycle, weekOutlook } from './split';

/**
 * What to do today, from what you actually did this week.
 *
 * Everything here already existed and nothing read it together: the session
 * snapshots know which muscles you trained, the profile knows how often you
 * meant to train, and the completions know when you last stopped. Separately
 * they are three numbers on three screens. Together they answer the question
 * you open the app to ask.
 *
 * Deliberately one sentence and one suggestion. A panel offering four
 * possibilities is a decision handed back to you, which is the thing it was
 * supposed to take away.
 *
 * Pure — no dates fetched, no queries. `today` is injected so the boundaries
 * can be tested.
 */

/** Muscle groups a plan can be built around. Cardio is not a recovery concern. */
const TRAINABLE = MUSCLES.filter((m) => m !== 'Cardio');

/** Consecutive days ending today (or yesterday) that carry a session. */
export function consecutiveDays(dayKeys, today) {
  const set = new Set(dayKeys);
  const cursor = new Date(`${today}T00:00:00`);

  // A run that ended yesterday still counts: at 9am, "three days straight" is
  // about the three behind you, not whether you have trained yet this morning.
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);

  let run = 0;
  for (;;) {
    const key = keyOf(cursor);
    if (!set.has(key)) break;
    run += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return run;
}

function keyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sets per muscle across the sessions given, so the suggestion is about volume
 * rather than about how many exercises happened to be in a plan.
 */
export function setsByMuscle(sessions) {
  const counts = Object.fromEntries(TRAINABLE.map((m) => [m, 0]));

  (sessions || []).forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      if (exercise.muscle in counts) {
        counts[exercise.muscle] += exercise.sets?.length || 0;
      }
    });
  });

  return counts;
}

/**
 * Returns `{ tone, headline, detail, muscle, splitDay }`.
 *
 * With a split configured the plan answers first: the headline becomes the name
 * of the session that is due — "Push day", "Leg day" — rather than a guess at
 * your weakest group. Without one, the old behaviour stands.
 *
 * `tone` is 'rest' | 'push' | 'steady' | 'done', which the card uses to pick a
 * colour. `muscle` is set only when the advice is to train something specific.
 */
export function trainingAdvice({ sessions, target, today, trainedDays, split, weekKeys }) {
  const days = trainedDays || [];
  const trainedToday = days.includes(today);
  const run = consecutiveDays(days, today);

  if (trainedToday) {
    return {
      tone: 'done',
      headline: 'Done for today',
      detail: run > 1
        ? `${run} days in a row. Tomorrow is optional.`
        : 'Logged. Rest counts as part of the plan.',
      muscle: null,
    };
  }

  // Four straight days is where recovery stops keeping up for most people
  // training hard. Not a rule, which is why it says "worth" rather than "must".
  if (run >= 4) {
    return {
      tone: 'rest',
      headline: 'A rest day is worth taking',
      detail: `You have trained ${run} days straight. Strength is built while you recover, not while you lift.`,
      muscle: null,
    };
  }

  // ---- With a split, the plan decides what comes next --------------------
  if (split?.length) {
    const { day, lastWasOffPlan } = nextInCycle(split, sessions);
    const week = weekOutlook({ doneDays: days, target, weekKeys, today });
    const groups = (day.muscles || []).join(', ').toLowerCase();

    // The target cannot be reached any more. Saying "3 to go" here would be a
    // statement about something that cannot happen, and an app that repeats an
    // impossible goal is one people stop opening.
    if (!week.reachable) {
      return {
        tone: 'steady',
        headline: `${day.label} day`,
        detail: `${week.daysLeft} day${week.daysLeft === 1 ? '' : 's'} left and ${week.left} short of ${week.target}. Getting some in still beats none.`,
        muscle: day.muscles?.[0] || null,
        splitDay: day,
      };
    }

    if (week.left === 0) {
      return {
        tone: 'done',
        headline: 'Target met',
        detail: `${week.done} of ${week.target} done. ${day.label} is next if you want it.`,
        muscle: day.muscles?.[0] || null,
        splitDay: day,
      };
    }

    // The cycle re-anchors to what you actually did, so this never scolds — it
    // says where the plan now stands.
    if (lastWasOffPlan) {
      return {
        tone: 'push',
        headline: `${day.label} day`,
        detail: `Your last session was off-plan. ${day.label} is still next — ${groups}.`,
        muscle: day.muscles?.[0] || null,
        splitDay: day,
      };
    }

    return {
      tone: 'steady',
      headline: `${day.label} day`,
      detail: groups ? `Today's block: ${groups}.` : 'Next in your split.',
      muscle: day.muscles?.[0] || null,
      splitDay: day,
    };
  }

  // ---- No split: fall back to whichever group has had the least -----------
  const counts = setsByMuscle(sessions);
  const total = Object.values(counts).reduce((t, n) => t + n, 0);

  // Nothing logged this week: no basis for picking a muscle, so say the honest
  // thing instead of inventing one.
  if (total === 0) {
    return {
      tone: 'push',
      headline: 'Nothing logged this week',
      detail: target
        ? `Your target is ${target} session${target === 1 ? '' : 's'}. One today puts you on it.`
        : 'One session is all it takes to start a streak.',
      muscle: null,
    };
  }

  const neglected = TRAINABLE
    .map((m) => ({ muscle: m, sets: counts[m] }))
    .sort((a, b) => a.sets - b.sets)[0];

  const behind = target && days.length < target;

  return {
    tone: behind ? 'push' : 'steady',
    headline: `Train ${neglected.muscle.toLowerCase()} today`,
    detail: neglected.sets === 0
      ? `No ${neglected.muscle.toLowerCase()} work this week at all.`
      : `Only ${neglected.sets} set${neglected.sets === 1 ? '' : 's'} this week — your lightest group.`,
    muscle: neglected.muscle,
  };
}
