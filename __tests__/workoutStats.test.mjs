import test from 'node:test';
import assert from 'node:assert/strict';
import {
  musclesOf, exerciseCount, setCount, estimateMinutes, estimateKcal, sortWorkouts, popularId,
} from '../src/lib/workoutStats.js';

const sets = (n) => Array.from({ length: n }, () => ({ reps: '10' }));
const ex = (muscle, n = 4) => ({ name: muscle, muscle, sets: sets(n) });

test('muscles come from the exercises, most-trained first, ties in order of appearance', () => {
  const workout = { exercises: [ex('Back'), ex('Chest'), ex('Chest'), ex('Arms'), { name: 'Mystery', sets: [] }] };
  assert.deepEqual(musclesOf(workout), ['Chest', 'Back', 'Arms']);
  assert.deepEqual(musclesOf({}), []);
  assert.deepEqual(musclesOf({ exercises: 'not a list' }), []);
});

test('counts read a stored count first, then the exercise list', () => {
  assert.equal(exerciseCount({ exercise_count: 6, exercises: [] }), 6);
  assert.equal(exerciseCount({ exercises: [ex('Legs'), ex('Legs')] }), 2);
  assert.equal(setCount({ exercises: [ex('Legs', 3), { sets: 2 }, {}] }), 5);
});

test('a stated duration wins over an estimate', () => {
  assert.equal(estimateMinutes({ duration: '40 min', exercises: [ex('Chest', 20)] }), 40);
});

test('without a duration, about 2.5 minutes a set, rounded to 5', () => {
  // 5 exercises × 4 sets = 20 sets → 50 min
  assert.equal(estimateMinutes({ exercises: Array.from({ length: 5 }, () => ex('Chest')) }), 50);
  assert.equal(estimateMinutes({ exercises: [ex('Chest', 1)] }), 5);
  assert.equal(estimateMinutes({ exercises: [] }), null);
});

test('kcal is MET × kg × hours, rounded to 10', () => {
  const hour = { duration: '60 min' };
  assert.equal(estimateKcal({ ...hour, exercises: [ex('Chest')] }, 70), 350);            // 5 × 70
  assert.equal(estimateKcal({ duration: '30 min', exercises: [ex('Cardio')] }, 80), 320); // 8 × 80 × 0.5
  // Half cardio, half strength: MET 6.5 → 455 → 460
  assert.equal(estimateKcal({ ...hour, exercises: [ex('Cardio'), ex('Chest')] }, 70), 460);
});

test('a weight stored as text still counts, and a missing one assumes 70 kg', () => {
  const plan = { duration: '60 min', exercises: [ex('Back')] };
  assert.equal(estimateKcal(plan, '72.5'), 360);
  for (const missing of [null, undefined, '', 0, 'abc']) {
    assert.equal(estimateKcal(plan, missing), 350, String(missing));
  }
});

test('an empty plan has no calorie estimate', () => {
  assert.equal(estimateKcal({ exercises: [] }, 70), null);
});

test('sorting never touches the array it was given', () => {
  const list = [{ id: 1, name: 'b' }, { id: 2, name: 'A' }];
  const copy = structuredClone(list);
  sortWorkouts(list, 'name');
  assert.deepEqual(list, copy);
});

test('name sorts A to Z ignoring case; recent keeps arrival order', () => {
  const list = [{ id: 1, name: 'leg day' }, { id: 2, name: 'Arms' }, { id: 3, name: 'Chest' }];
  assert.deepEqual(sortWorkouts(list, 'name').map((w) => w.id), [2, 3, 1]);
  assert.deepEqual(sortWorkouts(list, 'recent').map((w) => w.id), [1, 2, 3]);
});

test('most trained first, and equal counts stay newest first', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const times = { b: 2, c: 5, d: 2 };
  assert.deepEqual(sortWorkouts(list, 'trained', times).map((w) => w.id), ['c', 'b', 'd', 'a']);
});

test('popular is the one clear leader at or above the minimum', () => {
  const list = [{ id: 'a', n: 1 }, { id: 'b', n: 4 }, { id: 'c', n: 2 }];
  assert.equal(popularId(list, (w) => w.n, 2), 'b');
  assert.equal(popularId(list, (w) => w.n, 5), null);
});

test('a tie at the top means nothing is popular', () => {
  const list = [{ id: 'a', n: 3 }, { id: 'b', n: 3 }, { id: 'c', n: 1 }];
  assert.equal(popularId(list, (w) => w.n, 2), null);
  // A tie lower down does not block a clear leader found later.
  assert.equal(popularId([{ id: 'x', n: 1 }, { id: 'y', n: 1 }, { id: 'z', n: 4 }], (w) => w.n, 2), 'z');
  assert.equal(popularId([], (w) => w.n, 0), null);
});
