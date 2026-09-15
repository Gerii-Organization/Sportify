import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScore, timeLeft, standings, winners } from '../src/lib/challenges.js';

const p = (first_name, status, score) => ({ user_id: first_name, first_name, status, score });

test('scores read in the metric unit', () => {
  assert.equal(formatScore(1, 'days'), '1 day');
  assert.equal(formatScore('4', 'days'), '4 days');
  assert.equal(formatScore(95.4, 'minutes'), '95 min');
});

test('time left', () => {
  const now = Date.UTC(2026, 8, 15, 12);
  assert.equal(timeLeft(new Date(now + 76 * 3_600_000).toISOString(), now), '3d 4h left');
  assert.equal(timeLeft(new Date(now + 5.5 * 3_600_000).toISOString(), now), '5h left');
  assert.equal(timeLeft(new Date(now + 20 * 60_000).toISOString(), now), 'Ends in a moment');
  assert.equal(timeLeft(new Date(now - 1000).toISOString(), now), 'Ended');
});

test('standings rank joined players with shared ranks, invited after, declined gone', () => {
  const { rows, top } = standings([
    p('Dan', 'joined', 3), p('Ana', 'joined', 5), p('Bo', 'invited', 0),
    p('Cy', 'joined', 3), p('Ed', 'declined', 0),
  ]);
  assert.deepEqual(rows.map((r) => [r.first_name, r.rank]), [['Ana', 1], ['Cy', 2], ['Dan', 2], ['Bo', null]]);
  assert.equal(top, 5);
});

test('winners share the top score, and nobody wins at zero', () => {
  assert.deepEqual(winners([p('A', 'joined', 4), p('B', 'joined', 4), p('C', 'joined', 1)]).map((w) => w.first_name), ['A', 'B']);
  assert.deepEqual(winners([p('A', 'joined', 0), p('B', 'joined', 0)]), []);
});
