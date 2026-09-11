import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOf, restsAfter, linkWithNext, unlink } from '../src/lib/superset.js';

const ex = (id) => ({ id, name: id, sets: [] });

test('an ungrouped exercise has no round and always rests after', () => {
  const list = [ex('a'), ex('b')];
  assert.equal(groupOf(list, 0), null);
  assert.equal(restsAfter(list, 'a'), true);
});

test('linking gives both exercises one id and orders them A, B', () => {
  const list = linkWithNext([ex('a'), ex('b'), ex('c')], 0);

  assert.equal(list[0].superset, list[1].superset);
  assert.ok(list[0].superset);
  assert.equal(list[2].superset, undefined, 'c is untouched');

  assert.equal(groupOf(list, 0).letter, 'A');
  assert.equal(groupOf(list, 1).letter, 'B');
  assert.equal(groupOf(list, 0).size, 2);
});

test('rest waits for the end of the round', () => {
  const list = linkWithNext([ex('a'), ex('b'), ex('c')], 0);

  assert.equal(restsAfter(list, 'a'), false, 'no rest between A and B');
  assert.equal(restsAfter(list, 'b'), true, 'rest after the last member');
  assert.equal(restsAfter(list, 'c'), true, 'standalone exercise still rests');
});

test('linking a third onto a pair extends it rather than starting a rival group', () => {
  let list = linkWithNext([ex('a'), ex('b'), ex('c')], 0);
  const id = list[0].superset;

  list = linkWithNext(list, 1);

  assert.equal(list[2].superset, id);
  assert.equal(groupOf(list, 0).size, 3);
  assert.equal(groupOf(list, 2).letter, 'C');
  assert.equal(restsAfter(list, 'b'), false, 'B is now mid-round');
  assert.equal(restsAfter(list, 'c'), true);
});

test('unlinking the middle leaves the other two as a valid pair', () => {
  let list = linkWithNext([ex('a'), ex('b'), ex('c')], 0);
  const id = list[0].superset;
  list = linkWithNext(list, 1);

  const after = unlink(list, 1);

  assert.equal(after[1].superset, null);
  assert.equal(after[0].superset, id);
  assert.equal(groupOf(after, 0).size, 2);
  assert.equal(restsAfter(after, 'b'), true);
});

test('unlinking down to one member releases the survivor too', () => {
  // Otherwise the id lingers on a lone exercise and the next link inherits a
  // group the user thought they had broken up.
  let list = linkWithNext([ex('x'), ex('y'), ex('z')], 0);
  list = unlink(list, 0);

  assert.equal(list[0].superset, null);
  assert.equal(list[1].superset, null);
  assert.equal(groupOf(list, 1), null);
});

test('a lingering id on a single exercise is not treated as a round', () => {
  assert.equal(groupOf([{ id: 'a', superset: 'ss_orphan' }], 0), null);
});

test('the edges do nothing rather than throwing', () => {
  assert.equal(linkWithNext([ex('q')], 0).length, 1, 'nothing below to link to');
  assert.equal(unlink([ex('q')], 0)[0].superset, undefined);
  assert.equal(restsAfter([ex('q')], 'missing'), true);
  assert.equal(groupOf([], 0), null);
});
