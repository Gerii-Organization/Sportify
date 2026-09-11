import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustom, mergeCatalogue, normaliseName, removeById, MAX_NAME } from '../src/lib/customExerciseRules.js';
import { EXERCISES, MUSCLES } from '../src/constants/exercises.js';

const ok = (name, muscle = 'Chest', existing = EXERCISES) =>
  validateCustom({ name, muscle }, existing, MUSCLES);

test('a reasonable exercise is accepted and comes back shaped like a preset', () => {
  const { ok: passed, exercise } = ok('Hammer Strength Iso Row', 'Back');

  assert.equal(passed, true);
  for (const field of ['id', 'name', 'muscle', 'ratio', 'upper', 'isDb']) {
    assert.ok(field in exercise, `missing ${field}`);
  }
  assert.equal(exercise.custom, true);
  assert.equal(exercise.ratio, 0, 'no invented starting load for a movement we know nothing about');
});

test('the name is tidied rather than rejected for spacing', () => {
  assert.equal(normaliseName('  Pendlay   Row  '), 'Pendlay Row');
  assert.equal(ok('  Pendlay   Row  ', 'Back').exercise.name, 'Pendlay Row');
});

test('a name that already exists is refused, case and spacing aside', () => {
  // Everything downstream matches on a lowercased name — history, records,
  // muscle scoring. Two movements sharing one would silently merge.
  assert.equal(ok('Deadlift', 'Back').ok, false);
  assert.equal(ok('deadlift', 'Back').ok, false);
  assert.equal(ok('  DEADLIFT  ', 'Back').ok, false);
  assert.match(ok('Deadlift', 'Back').error, /already exists/);
});

test('a blank name, or one that is too long, is refused', () => {
  assert.equal(ok('').ok, false);
  assert.equal(ok('    ').ok, false);
  assert.equal(ok('x'.repeat(MAX_NAME + 1)).ok, false);
  assert.equal(ok('x'.repeat(MAX_NAME)).ok, true);
});

test('the muscle group has to be one the app knows', () => {
  assert.equal(ok('Wrist Roller', 'Forearms').ok, false);
  assert.match(ok('Wrist Roller', 'Forearms').error, /muscle group/);
  for (const muscle of MUSCLES) {
    assert.equal(ok(`Test ${muscle}`, muscle).ok, true);
  }
});

test('ids are safe to use as keys', () => {
  assert.equal(ok("Bob's 45° Machine!!", 'Legs').exercise.id, 'custom-bob-s-45-machine');
  assert.equal(ok('!!! Row !!!', 'Back').exercise.id, 'custom-row', 'no leading or trailing separators');
});

test('merging keeps presets ahead and never lets one be shadowed', () => {
  // A preset carries a cue and a loading ratio; a same-named custom entry
  // replacing it would be a downgrade nobody asked for.
  const custom = [
    { id: 'custom-deadlift', name: 'deadlift', muscle: 'Back', custom: true },
    { id: 'custom-x', name: 'Reverse Hyper', muscle: 'Legs', custom: true },
  ];

  const merged = mergeCatalogue(EXERCISES, custom);

  assert.equal(merged.length, EXERCISES.length + 1);
  assert.equal(merged.filter((e) => e.name.toLowerCase() === 'deadlift').length, 1);
  assert.ok(merged.find((e) => e.name === 'Deadlift').cue, 'the preset survived, with its cue');
  assert.ok(merged.some((e) => e.name === 'Reverse Hyper'));
});

test('merging copes with nothing on either side', () => {
  assert.deepEqual(mergeCatalogue([], []), []);
  assert.deepEqual(mergeCatalogue(null, null), []);
  assert.equal(mergeCatalogue(EXERCISES, null).length, EXERCISES.length);
});

test('removing one leaves the others', () => {
  const custom = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  assert.deepEqual(removeById(custom, 'a').map((e) => e.id), ['b']);
  assert.deepEqual(removeById(custom, 'zzz').length, 2);
  assert.deepEqual(removeById(null, 'a'), []);
});

test('the shipped catalogue has no duplicate names to begin with', () => {
  const names = EXERCISES.map((e) => e.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);

  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
