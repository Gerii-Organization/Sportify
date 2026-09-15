import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByFamily, tierTotals } from '../src/lib/achievementTiers.js';

const row = (code, family, tier, threshold, current, unlocked, sort) => ({
  code, family, tier, threshold, current, unlocked_at: unlocked ? '2026-09-01T10:00:00Z' : null, sort_order: sort, name: code,
});

const ROWS = [
  row('workouts_50', 'workouts', 'gold', 50, 12, false, 30),
  row('first_workout', 'workouts', 'bronze', 1, 12, true, 10),
  row('workouts_10', 'workouts', 'silver', 10, 12, true, 20),
  row('streak_3', 'streak', 'bronze', 3, 1, false, 40),
  row('streak_7', 'streak', 'silver', 7, 1, false, 50),
  row('oneoff', null, null, 1, 1, true, 5),
];

test('rows fold into families in catalogue order', () => {
  const families = groupByFamily(ROWS);
  assert.deepEqual(families.map((f) => f.family), ['oneoff', 'workouts', 'streak']);
  assert.deepEqual(families[1].tiers.map((t) => t.tier), ['bronze', 'silver', 'gold']);
});

test('earned is the highest unlocked tier, next the first locked one', () => {
  const workouts = groupByFamily(ROWS).find((f) => f.family === 'workouts');
  assert.equal(workouts.earned.code, 'workouts_10');
  assert.equal(workouts.next.code, 'workouts_50');
  // 12 of the 10→50 step: 2/40
  assert.equal(workouts.progress, 0.05);
  assert.equal(workouts.top.code, 'workouts_10');
});

test('a family with nothing earned measures from zero, and a finished one is full', () => {
  const streak = groupByFamily(ROWS).find((f) => f.family === 'streak');
  assert.equal(streak.earned, null);
  assert.equal(Math.round(streak.progress * 100), 33);
  assert.equal(streak.top.code, 'streak_3');

  const oneoff = groupByFamily(ROWS).find((f) => f.family === 'oneoff');
  assert.deepEqual([oneoff.next, oneoff.progress], [null, 1]);
});

test('totals count tiers', () => {
  assert.deepEqual(tierTotals(ROWS), { unlocked: 3, total: 6 });
  assert.deepEqual(groupByFamily(null), []);
});
