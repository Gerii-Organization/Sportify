import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlan, stateAt, totalSeconds, roundsIn, elapsedOf, formatClock, normaliseSettings, PREP_SECONDS,
} from '../src/lib/intervals.js';

test('tabata is work/rest pairs with no rest after the last round', () => {
  const plan = buildPlan('tabata', { rounds: 3, work: 20, rest: 10 });
  assert.deepEqual(plan.map((s) => s.kind), ['prep', 'work', 'rest', 'work', 'rest', 'work']);
  assert.equal(totalSeconds(plan), PREP_SECONDS + 3 * 20 + 2 * 10);
  assert.equal(roundsIn(plan), 3);
});

test('emom is one segment per interval, amrap one long one', () => {
  assert.equal(buildPlan('emom', { rounds: 5, interval: 60 }).filter((s) => s.kind === 'work').length, 5);
  const amrap = buildPlan('amrap', { minutes: 12 });
  assert.deepEqual(amrap.map((s) => [s.kind, s.seconds]), [['prep', PREP_SECONDS], ['work', 720]]);
});

test('state follows elapsed time across segments', () => {
  const plan = buildPlan('tabata', { rounds: 2, work: 20, rest: 10 });
  assert.equal(stateAt(plan, 0).segment.kind, 'prep');
  assert.equal(stateAt(plan, 0).remaining, PREP_SECONDS);

  const firstWork = stateAt(plan, PREP_SECONDS + 0.4);
  assert.deepEqual([firstWork.segment.kind, firstWork.round, firstWork.remaining], ['work', 1, 20]);

  const rest = stateAt(plan, PREP_SECONDS + 25);
  assert.deepEqual([rest.segment.kind, rest.remaining], ['rest', 5]);

  const second = stateAt(plan, PREP_SECONDS + 30);
  assert.deepEqual([second.segment.kind, second.round], ['work', 2]);
});

test('past the end it is done, never negative', () => {
  const plan = buildPlan('emom', { rounds: 2, interval: 30 });
  const end = stateAt(plan, 999);
  assert.deepEqual([end.done, end.remaining, end.totalRemaining, end.progress], [true, 0, 0, 1]);
});

test('pauses are subtracted from elapsed time', () => {
  const clock = { startedAt: 1_000, pausedAt: null, pausedMs: 5_000 };
  assert.equal(elapsedOf(clock, 31_000), 25);
  assert.equal(elapsedOf({ ...clock, pausedAt: 21_000 }, 99_000), 15); // frozen while paused
  assert.equal(elapsedOf(null), 0);
});

test('settings are clamped to sensible whole numbers', () => {
  assert.deepEqual(normaliseSettings('tabata', { rounds: 0, work: 2.6, rest: -4 }), { rounds: 1, work: 5, rest: 0 });
  assert.deepEqual(normaliseSettings('emom', { rounds: 'x' }), { rounds: 10, interval: 60 });
  assert.deepEqual(normaliseSettings('amrap', { minutes: 500 }), { minutes: 90 });
});

test('clock formatting', () => {
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(9.2), '0:10');
  assert.equal(formatClock(-3), '0:00');
});
