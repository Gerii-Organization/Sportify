import test from 'node:test';
import assert from 'node:assert/strict';
import { setsByMuscle, levelFor, neglected } from '../src/lib/muscleLoad.js';

const session = (...exercises) => ({ exercises });
const ex = (muscle, sets, warmups = 0) => ({
  muscle,
  sets: [
    ...Array.from({ length: warmups }, () => ({ weight: 20, reps: 10, type: 'warmup', warmup: true })),
    ...Array.from({ length: sets }, () => ({ weight: 60, reps: 8 })),
  ],
});

test('sets add up per muscle across sessions, warm-ups left out', () => {
  const counts = setsByMuscle([
    session(ex('Chest', 4, 2), ex('Arms', 3)),
    session(ex('Chest', 3), ex('Legs', 5)),
  ]);
  assert.deepEqual(counts, { Chest: 7, Arms: 3, Legs: 5 });
  assert.deepEqual(setsByMuscle(null), {});
});

test('levels are coarse bands', () => {
  assert.deepEqual([0, 1, 4, 5, 9, 10, 15, 16, 40].map(levelFor), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('neglected lists what got little, least first, and nothing for an empty week', () => {
  assert.deepEqual(neglected({ Chest: 12, Back: 3, Legs: 0, Shoulders: 6, Arms: 9, Core: 1 }), ['Legs', 'Core', 'Back']);
  assert.deepEqual(neglected({}), []);
  assert.deepEqual(neglected({ Cardio: 10 }), []);
});
