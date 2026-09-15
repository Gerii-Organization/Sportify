import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRir, rirLabel, describeRir, RIR_CHOICES } from '../src/lib/effort.js';

test('ratings normalise to a whole count from 0 to 4', () => {
  assert.equal(normaliseRir(2), 2);
  assert.equal(normaliseRir('3'), 3);
  assert.equal(normaliseRir(7), 4);
  assert.equal(normaliseRir(1.6), 2);
});

test('anything that is not a count reads as unrated', () => {
  for (const value of [null, undefined, '', 'hard', -1, NaN]) assert.equal(normaliseRir(value), null);
});

test('labels and descriptions', () => {
  assert.equal(rirLabel(4), '4+');
  assert.equal(rirLabel(0), '0');
  assert.equal(rirLabel(undefined), null);
  assert.equal(describeRir(0), 'no reps in reserve');
  assert.equal(describeRir(1), '1 rep in reserve');
  assert.equal(describeRir(9), '4+ reps in reserve');
  assert.deepEqual(RIR_CHOICES.map((c) => c.label), ['0', '1', '2', '3', '4+']);
});
