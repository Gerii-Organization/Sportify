import test from 'node:test';
import assert from 'node:assert/strict';
import { typeOf, nextType, patchForType, markFor, countsAsWork, describeType, SET_TYPES } from '../src/lib/setTypes.js';

test('a set written before any of this existed is a working set', () => {
  assert.equal(typeOf({ weight: '80', reps: '5' }), 'working');
  assert.equal(typeOf({}), 'working');
  assert.equal(typeOf(null), 'working');
  assert.equal(typeOf(undefined), 'working');
});

test('the old warmup boolean still reads correctly', () => {
  // Sets stored between warm-ups shipping and types shipping have the boolean
  // and no `type`. They live in user_workouts JSON and in every session
  // snapshot, so they have to keep working forever.
  assert.equal(typeOf({ warmup: true }), 'warmup');
  assert.equal(countsAsWork({ warmup: true }), false);
  assert.equal(markFor({ warmup: true }), 'W');
});

test('an unrecognised type falls back rather than showing nothing', () => {
  assert.equal(typeOf({ type: 'myofibrillar-nonsense' }), 'working');
  assert.equal(markFor({ type: 'myofibrillar-nonsense' }), null);
});

test('tapping cycles through every kind and comes back', () => {
  let set = {};
  const seen = [];

  for (let i = 0; i < SET_TYPES.length; i += 1) {
    set = { ...set, ...patchForType(nextType(set)) };
    seen.push(typeOf(set));
  }

  assert.deepEqual(seen, ['warmup', 'drop', 'failure', 'working']);
  assert.equal(typeOf(set), 'working', 'four taps returns to where it started');
});

test('the patch keeps the boolean in step with the type', () => {
  // A set claiming type 'warmup' while `warmup` is false would be counted in
  // the volume total by the filter that still reads the boolean.
  assert.deepEqual(patchForType('warmup'), { type: 'warmup', warmup: true });
  assert.deepEqual(patchForType('drop'), { type: 'drop', warmup: false });
  assert.deepEqual(patchForType('working'), { type: 'working', warmup: false });
});

test('only the warm-up is excluded from work', () => {
  assert.equal(countsAsWork({ type: 'working' }), true);
  assert.equal(countsAsWork({ type: 'drop' }), true, 'a drop set is real work');
  assert.equal(countsAsWork({ type: 'failure' }), true);
  assert.equal(countsAsWork({ type: 'warmup' }), false);
});

test('the mark replaces the number only when there is something to say', () => {
  assert.equal(markFor({ type: 'working' }), null);
  assert.equal(markFor({ type: 'drop' }), 'D');
  assert.equal(markFor({ type: 'failure' }), 'F');
});

test('every type has a name for the screen reader', () => {
  for (const type of SET_TYPES) {
    assert.equal(typeof describeType({ type }), 'string');
    assert.ok(describeType({ type }).length > 0);
  }
});

test('each marked type gets its own colour, and a plain set gets none', async () => {
  const { tintFor } = await import('../src/lib/setTypes.js');

  assert.equal(tintFor({ type: 'warmup' }), 'success');
  assert.equal(tintFor({ type: 'drop' }), 'danger');
  assert.equal(tintFor({ type: 'failure' }), 'energy');

  // Colouring every row would make none of them stand out.
  assert.equal(tintFor({ type: 'working' }), null);
  assert.equal(tintFor({}), null);
  assert.equal(tintFor(null), null);

  // The pre-types boolean has to keep resolving to the warm-up colour.
  assert.equal(tintFor({ warmup: true }), 'success');
});
