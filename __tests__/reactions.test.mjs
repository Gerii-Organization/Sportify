import test from 'node:test';
import assert from 'node:assert/strict';
import { summarise, toggleLocally, totalReactions, REACTIONS } from '../src/lib/reactions.js';

const ME = 'me-id';

test('nothing in means nothing out, whatever the shape', () => {
  for (const empty of [null, undefined, {}, 'nonsense', 42]) {
    assert.deepEqual(summarise(empty, ME), [], String(empty));
    assert.equal(totalReactions(empty), 0);
  }
});

test('a reaction reports its count and whether it is yours', () => {
  const map = { '❤️': ['a', ME], '🔥': ['b'] };
  const rows = summarise(map, ME);

  assert.deepEqual(rows, [
    { emoji: '❤️', count: 2, mine: true },
    { emoji: '🔥', count: 1, mine: false },
  ]);
  assert.equal(totalReactions(map), 3);
});

test('the busiest reaction leads, and ties are stable', () => {
  const rows = summarise({ '👏': ['a'], '💪': ['a', 'b', 'c'], '😂': ['a'] }, ME);
  assert.equal(rows[0].emoji, '💪');
  assert.equal(rows.length, 3);
});

test('an emoji nobody holds is not rendered', () => {
  assert.deepEqual(summarise({ '❤️': [] }, ME), []);
  assert.deepEqual(summarise({ '❤️': 'not-a-list' }, ME), []);
});

test('tapping adds, tapping again removes, and the key goes with the last one', () => {
  let map = {};
  map = toggleLocally(map, '🔥', ME);
  assert.deepEqual(map, { '🔥': [ME] });

  map = toggleLocally(map, '🔥', ME);
  assert.deepEqual(map, {}, 'the empty key is dropped, not left as []');
});

test('your tap does not disturb anyone else', () => {
  const before = { '❤️': ['a', 'b'] };
  const after = toggleLocally(before, '❤️', ME);

  assert.deepEqual(after['❤️'], ['a', 'b', ME]);
  assert.deepEqual(before['❤️'], ['a', 'b'], 'the original is untouched');

  const removed = toggleLocally(after, '❤️', ME);
  assert.deepEqual(removed['❤️'], ['a', 'b']);
});

test('a double tap cannot count twice', () => {
  let map = toggleLocally({}, '💪', ME);
  map = toggleLocally(map, '💪', ME);
  map = toggleLocally(map, '💪', ME);

  assert.deepEqual(summarise(map, ME), [{ emoji: '💪', count: 1, mine: true }]);
});

test('the offered set is small and free of duplicates', () => {
  assert.ok(REACTIONS.length <= 8, 'a grid of emoji is a decision, not a reaction');
  assert.equal(new Set(REACTIONS).size, REACTIONS.length);
});
