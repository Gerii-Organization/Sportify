import test from 'node:test';
import assert from 'node:assert/strict';
import { milestoneTrack, describeReward } from '../src/lib/milestones.js';

const REWARDS = [
  { days: 7, energy: 150, freezes: 1 },
  { days: 3, energy: 50, freezes: 0 },
  { days: 14, energy: 300, freezes: 0 },
];

test('the next milestone is the first one ahead of the streak', () => {
  const t = milestoneTrack(REWARDS, [{ days: 3 }], 5);
  assert.deepEqual(t.list.map((m) => m.days), [3, 7, 14]);
  assert.equal(t.next.days, 7);
  assert.equal(t.daysToNext, 2);
  assert.equal(t.ratio, 0.5); // 2 of the 4 days between 3 and 7
});

test('a claim stays claimed after the streak resets', () => {
  const t = milestoneTrack(REWARDS, [{ days: 3 }, { days: 7 }], 1);
  assert.equal(t.next.days, 3);
  assert.equal(t.claimedCount, 2);
  assert.equal(t.list.find((m) => m.days === 7).claimed, true);
});

test('past the last milestone the track is full', () => {
  const t = milestoneTrack(REWARDS, [], 20);
  assert.equal(t.next, null);
  assert.equal(t.ratio, 1);
  assert.equal(t.daysToNext, 0);
});

test('no rewards loaded means an empty track, not a crash', () => {
  const t = milestoneTrack(null, null, '4');
  assert.deepEqual([t.list.length, t.next, t.claimedCount], [0, null, 0]);
});

test('reward text skips what is zero', () => {
  assert.equal(describeReward({ energy: 150, freezes: 1 }), '+150 energy · +1 Streak Freeze');
  assert.equal(describeReward({ energy: 50, freezes: 0 }), '+50 energy');
  assert.equal(describeReward({ energy: 0, freezes: 2 }), '+2 Streak Freezes');
});
