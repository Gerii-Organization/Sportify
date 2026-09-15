import { scoreDay } from './split';
import { musclesOf } from './workoutStats';
import { t } from '../i18n/runtime';

/**
 * The week plan: which routine on which weekday (roadmap T5).
 *
 * The split says the ORDER of training days — Push, then Pull, then Legs — and
 * lib/split.js follows it from what you actually did. It never said WHEN. This
 * is the when: seven slots, Monday first, each a routine id or null for rest.
 *
 * Stored on the profile as a JSON array of exactly seven entries
 * (`profiles.training_schedule`). Routine ids, not names, so renaming a routine
 * keeps it on its days; a routine that was deleted simply reads as rest.
 */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday = 0 … Sunday = 6, from a Date in the phone's time zone. */
export function weekdayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

/** Always seven entries, each a non-empty string id or null. */
export function normaliseSchedule(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return WEEKDAYS.map((_, i) => {
    const id = list[i];
    return typeof id === 'string' && id.trim() ? id : (typeof id === 'number' ? String(id) : null);
  });
}

export const isEmptySchedule = (schedule) => normaliseSchedule(schedule).every((id) => id === null);

export const trainingDayCount = (schedule) => normaliseSchedule(schedule).filter(Boolean).length;

/**
 * Which weekdays to train on for a number of sessions a week, spread so that no
 * more than two land back to back where it can be avoided — recovery needs the
 * gap more than the calendar needs symmetry.
 */
const SPREADS = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function trainingDaysFor(count) {
  const n = Math.min(7, Math.max(0, Math.round(Number(count) || 0)));
  return n === 0 ? [] : SPREADS[n];
}

/**
 * The routine that best fits one split day: the highest share of its muscles
 * that belong to the day (scoreDay), ties to the routine listed first. Null when
 * nothing fits at all.
 */
export function bestRoutineFor(day, routines) {
  let best = null;
  let bestScore = 0;
  (routines || []).forEach((routine) => {
    const score = scoreDay(musclesOf(routine), day);
    if (score > bestScore) {
      best = routine;
      bestScore = score;
    }
  });
  return best;
}

/**
 * A first draft of the week from the split and the weekly target.
 *
 * Each training weekday takes the next split day in order, and each split day
 * the routine that trains it best. With no split, the routines themselves are
 * cycled. Always a draft: the sheet shows it and the lifter changes what does
 * not suit.
 */
export function draftSchedule({ split, routines, sessionsPerWeek }) {
  const list = (routines || []).filter((r) => r?.id != null);
  const days = trainingDaysFor(sessionsPerWeek);
  const schedule = WEEKDAYS.map(() => null);
  if (!list.length || !days.length) return schedule;

  days.forEach((weekday, i) => {
    let routine = null;
    if (split?.length) {
      routine = bestRoutineFor(split[i % split.length], list);
    }
    if (!routine) routine = list[i % list.length];
    schedule[weekday] = String(routine.id);
  });
  return schedule;
}

/**
 * What the plan says about a given day.
 *
 *   null                       no plan set — callers fall back to the advice
 *   { kind: 'rest' }           a rest day on the plan
 *   { kind: 'train', routine } a routine to do, looked up by id
 *   { kind: 'missing' }        a planned routine that no longer exists
 */
export function planFor(schedule, routines, date = new Date()) {
  const normal = normaliseSchedule(schedule);
  if (normal.every((id) => id === null)) return null;

  const id = normal[weekdayIndex(date)];
  if (!id) return { kind: 'rest' };

  const routine = (routines || []).find((r) => String(r.id) === id);
  return routine ? { kind: 'train', routine } : { kind: 'missing' };
}

/**
 * Today's advice with the plan taken into account.
 *
 * The plan wins over the generic advice when it has something to say, because
 * it is what the lifter decided in advance: "Today: Push A" beats "Chest is
 * due". Two exceptions keep it honest — a day already trained stays "done",
 * and a four-day run keeps its rest suggestion even on a planned day, since
 * the plan was written without knowing the week would go like that.
 */
export function applyPlan(advice, plan, { trainedToday = false } = {}) {
  if (!plan || trainedToday || !advice) return advice;

  if (plan.kind === 'train') {
    if (advice.tone === 'rest') return advice;
    const muscles = musclesOf(plan.routine).slice(0, 2).map((m) => t(m)).join(t(' and ')).toLowerCase();
    return {
      tone: 'push',
      headline: t('Today: {name}', { name: plan.routine.name || t('your routine') }),
      detail: muscles ? t('On your plan, {muscles}. Tap to start.', { muscles }) : t('On your plan. Tap to start.'),
      muscle: null,
      routine: plan.routine,
    };
  }

  if (plan.kind === 'rest') {
    return {
      tone: 'rest',
      headline: t('Rest day on your plan'),
      detail: t('Recovery is part of the programme. Anything you do today still counts.'),
      muscle: null,
    };
  }

  // A planned routine that was deleted: keep the advice, say what happened.
  return { ...advice, detail: t('The routine planned for today was deleted. Update your week plan.') };
}
