import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKDAYS, weekdayIndex, normaliseSchedule, trainingDaysFor, draftSchedule, planFor, bestRoutineFor, trainingDayCount,
} from '../src/lib/schedule.js';

const routine = (id, ...muscles) => ({ id, name: id, exercises: muscles.map((muscle) => ({ muscle })) });
const PUSH = routine('push', 'Chest', 'Shoulders');
const PULL = routine('pull', 'Back', 'Arms');
const LEGS = routine('legs', 'Legs');
const SPLIT = [
  { label: 'Push', muscles: ['Chest', 'Shoulders', 'Arms'] },
  { label: 'Pull', muscles: ['Back', 'Arms'] },
  { label: 'Legs', muscles: ['Legs', 'Core'] },
];

test('weekdays start on Monday', () => {
  assert.equal(weekdayIndex(new Date(2026, 8, 14)), 0); // Monday 14 Sep 2026
  assert.equal(weekdayIndex(new Date(2026, 8, 20)), 6); // Sunday
  assert.equal(WEEKDAYS.length, 7);
});

test('a schedule is always seven ids or nulls', () => {
  assert.deepEqual(normaliseSchedule(null), [null, null, null, null, null, null, null]);
  assert.deepEqual(normaliseSchedule(['a', '', 7, undefined]), ['a', null, '7', null, null, null, null]);
  assert.equal(trainingDayCount(['a', null, 'b']), 2);
});

test('sessions are spread with rest between where possible', () => {
  assert.deepEqual(trainingDaysFor(3), [0, 2, 4]);
  assert.deepEqual(trainingDaysFor(0), []);
  assert.deepEqual(trainingDaysFor(12), [0, 1, 2, 3, 4, 5, 6]);
});

test('each split day gets the routine that trains it', () => {
  assert.equal(bestRoutineFor(SPLIT[1], [PUSH, LEGS, PULL]).id, 'pull');
  assert.equal(bestRoutineFor({ muscles: ['Cardio'] }, [PUSH, PULL]), null);
});

test('the draft follows the split order across the week', () => {
  const draft = draftSchedule({ split: SPLIT, routines: [LEGS, PULL, PUSH], sessionsPerWeek: 3 });
  assert.deepEqual(draft, ['push', null, 'pull', null, 'legs', null, null]);
});

test('without a split the routines take turns', () => {
  const draft = draftSchedule({ split: null, routines: [PUSH, PULL], sessionsPerWeek: 4 });
  assert.deepEqual(draft, ['push', 'pull', null, 'push', 'pull', null, null]);
  assert.deepEqual(draftSchedule({ split: SPLIT, routines: [], sessionsPerWeek: 3 }), Array(7).fill(null));
});

test('the plan for a day', () => {
  const schedule = ['push', null, 'gone', null, null, null, null];
  const monday = new Date(2026, 8, 14);
  assert.equal(planFor(null, [PUSH], monday), null);
  assert.equal(planFor(schedule, [PUSH], monday).routine.id, 'push');
  assert.deepEqual(planFor(schedule, [PUSH], new Date(2026, 8, 15)), { kind: 'rest' });
  assert.deepEqual(planFor(schedule, [PUSH], new Date(2026, 8, 16)), { kind: 'missing' });
});

test('the plan overrides generic advice, except when the day is done or rest is due', async () => {
  const { applyPlan } = await import('../src/lib/schedule.js');
  const generic = { tone: 'steady', headline: 'Chest is due', detail: '…', muscle: 'Chest' };

  const train = applyPlan(generic, { kind: 'train', routine: PUSH });
  assert.equal(train.headline, 'Today: push');
  assert.equal(train.routine, PUSH);
  assert.match(train.detail, /chest and shoulders/);

  assert.equal(applyPlan(generic, { kind: 'train', routine: PUSH }, { trainedToday: true }), generic);
  const resting = { tone: 'rest', headline: 'A rest day is worth taking', muscle: null };
  assert.equal(applyPlan(resting, { kind: 'train', routine: PUSH }), resting);

  assert.equal(applyPlan(generic, { kind: 'rest' }).tone, 'rest');
  assert.match(applyPlan(generic, { kind: 'missing' }).detail, /deleted/);
  assert.equal(applyPlan(generic, null), generic);
});
