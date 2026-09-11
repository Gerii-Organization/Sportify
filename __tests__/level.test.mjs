import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, xpIntoLevel, levelProgressPercent, levelInfo, XP_PER_LEVEL } from '../src/lib/level.js';

test('a brand new user is level 1, not level 0', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(null), 1);
  assert.equal(levelFromXp(undefined), 1);
});

test('the level turns over exactly on the boundary', () => {
  assert.equal(levelFromXp(XP_PER_LEVEL - 1), 1);
  assert.equal(levelFromXp(XP_PER_LEVEL), 2);
  assert.equal(levelFromXp(XP_PER_LEVEL * 2 - 1), 2);
  assert.equal(levelFromXp(XP_PER_LEVEL * 2), 3);
});

test('progress inside a level resets at the boundary', () => {
  assert.equal(xpIntoLevel(0), 0);
  assert.equal(xpIntoLevel(99), 99);
  assert.equal(xpIntoLevel(100), 0);
  assert.equal(xpIntoLevel(142), 42);
  assert.equal(levelProgressPercent(142), '42%');
  assert.equal(levelProgressPercent(0), '0%');
});

test('levelInfo agrees with the parts it is made of', () => {
  for (const xp of [0, 1, 99, 100, 550, 4321]) {
    assert.deepEqual(levelInfo(xp), {
      total: xp,
      level: levelFromXp(xp),
      intoLevel: xpIntoLevel(xp),
      percent: levelProgressPercent(xp),
    });
  }
  assert.equal(levelInfo(null).total, 0);
});
