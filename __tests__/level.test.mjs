import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, xpIntoLevel, levelProgressPercent, levelInfo, XP_PER_LEVEL, tierFor } from '../src/lib/level.js';

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

test('a new account is a Rookie with Bronze next', () => {
  const tier = tierFor(1);
  assert.equal(tier.name, 'Rookie');
  assert.deepEqual(tier.next, { name: 'Bronze', minLevel: 5 });
});

test('each tier starts exactly on its level', () => {
  assert.equal(tierFor(4).name, 'Rookie');
  assert.equal(tierFor(5).name, 'Bronze');
  assert.equal(tierFor(9).name, 'Bronze');
  assert.equal(tierFor(10).name, 'Silver');
  assert.equal(tierFor(20).name, 'Gold');
  assert.equal(tierFor(30).name, 'Elite');
  assert.equal(tierFor(40).name, 'Legend');
});

test('the top tier has nothing after it', () => {
  assert.equal(tierFor(120).next, null);
});

test('a missing or broken level counts as level 1', () => {
  for (const bad of [0, -3, null, undefined, 'abc']) {
    assert.equal(tierFor(bad).name, 'Rookie', String(bad));
  }
});

test('every tier has a colour usable with an alpha suffix', () => {
  for (const level of [1, 5, 10, 20, 30, 40]) {
    assert.match(tierFor(level).color, /^#[0-9A-F]{6}$/i, String(level));
  }
});
