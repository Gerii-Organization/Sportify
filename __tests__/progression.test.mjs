import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestNext, incrementFor } from '../src/lib/progression.js';

const sets = (...pairs) => pairs.map(([weight, reps]) => ({ weight, reps }));
const KG_PER_LB = 0.45359237;

test('nothing logged last time means no suggestion', () => {
  assert.equal(suggestNext({ lastSets: [], targetReps: 8, unit: 'metric' }), null);
  assert.equal(suggestNext({ lastSets: null, targetReps: 8, unit: 'metric' }), null);
  assert.equal(suggestNext({ lastSets: sets([60, 0]), targetReps: 8, unit: 'metric' }), null);
});

test('every set at the target goes up by the smallest barbell jump', () => {
  const s = suggestNext({ lastSets: sets([60, 8], [60, 8], [60, 9]), targetReps: 8, unit: 'metric' });
  assert.deepEqual([s.kind, s.weight, s.reps], ['increase', 62.5, 8]);
  assert.match(s.reason, /All 3 sets hit 8/);
});

test('legs jump further, dumbbells less, pounds in pound plates', () => {
  assert.equal(suggestNext({ lastSets: sets([100, 5]), targetReps: 5, unit: 'metric', lowerBody: true }).weight, 105);
  assert.equal(suggestNext({ lastSets: sets([20, 10]), targetReps: 10, unit: 'metric', dumbbell: true }).weight, 22);
  // Stored in kg, read in lb: 135 lb goes to 140, not to 61.2 kg plus something.
  assert.equal(suggestNext({ lastSets: sets([135 * KG_PER_LB, 8]), targetReps: 8, unit: 'imperial' }).weight, 140);
  assert.equal(incrementFor({ unit: 'imperial', lowerBody: true }), 10);
});

test('close to the target keeps the weight', () => {
  const s = suggestNext({ lastSets: sets([60, 8], [60, 7]), targetReps: 8, unit: 'metric' });
  assert.deepEqual([s.kind, s.weight, s.reps], ['repeat', 60, 8]);
  assert.match(s.reason, /7 of 8/);
});

test('far short of the target comes back down to a loadable weight', () => {
  const s = suggestNext({ lastSets: sets([60, 4], [60, 3]), targetReps: 8, unit: 'metric' });
  assert.equal(s.kind, 'deload');
  assert.equal(s.weight, 52.5); // 54 rounded down to a 2.5 kg jump
});

test('only the heaviest sets count, not back-off sets', () => {
  const s = suggestNext({ lastSets: sets([60, 8], [60, 8], [50, 5]), targetReps: 8, unit: 'metric' });
  assert.equal(s.kind, 'increase');
});

test('without a planned target the best set becomes the target', () => {
  const s = suggestNext({ lastSets: sets([40, 10], [40, 10]), targetReps: null, unit: 'metric' });
  assert.deepEqual([s.kind, s.reps], ['increase', 10]);
});

test('bodyweight adds reps, holds add five seconds', () => {
  assert.deepEqual(
    (({ kind, reps }) => [kind, reps])(suggestNext({ lastSets: sets([0, 12], [0, 10]), targetReps: 12, unit: 'metric' })),
    ['reps', 13]
  );
  assert.equal(suggestNext({ lastSets: sets([0, 60]), targetReps: 60, unit: 'metric' }).reps, 65);
});

test('numbers stored as text still work', () => {
  const s = suggestNext({ lastSets: [{ weight: '60', reps: '8' }], targetReps: '8', unit: 'metric' });
  assert.equal(s.weight, 62.5);
});

test('hitting the target with nothing left stays at the weight', () => {
  const s = suggestNext({ lastSets: [{ weight: 60, reps: 8, rir: 1 }, { weight: 60, reps: 8, rir: 0 }], targetReps: 8, unit: 'metric' });
  assert.deepEqual([s.kind, s.weight], ['repeat', 60]);
  assert.match(s.reason, /nothing left/);
});

test('hitting the target with plenty to spare jumps twice', () => {
  const s = suggestNext({ lastSets: [{ weight: 60, reps: 8, rir: 3 }, { weight: 60, reps: 8, rir: '4' }], targetReps: 8, unit: 'metric' });
  assert.deepEqual([s.kind, s.weight], ['increase', 65]);
  assert.match(s.reason, /3 to spare/);
});

test('ratings in between, or none at all, change nothing', () => {
  const rated = suggestNext({ lastSets: [{ weight: 60, reps: 8, rir: 2 }], targetReps: 8, unit: 'metric' });
  const partial = suggestNext({ lastSets: [{ weight: 60, reps: 8, rir: 3 }, { weight: 60, reps: 8 }], targetReps: 8, unit: 'metric' });
  assert.equal(rated.weight, 62.5);
  // Only the rated set counts toward the reserve, and 3 of 3 rated says easy.
  assert.equal(partial.weight, 65);
  assert.equal(suggestNext({ lastSets: [{ weight: 60, reps: 8, rir: 'x' }], targetReps: 8, unit: 'metric' }).weight, 62.5);
});
