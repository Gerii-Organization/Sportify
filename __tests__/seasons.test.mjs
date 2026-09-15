import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonName, seasonTimeLeft, rankLine } from '../src/lib/seasons.js';

test('season names come from the first day of the month, in UTC', () => {
  assert.equal(seasonName('2026-09-01'), 'September 2026');
  assert.equal(seasonName('2026-12-01T00:00:00Z'), 'December 2026');
  assert.equal(seasonName('nope'), '');
});

test('time left counts whole days', () => {
  const now = Date.UTC(2026, 8, 15, 10);
  assert.equal(seasonTimeLeft('2026-10-01T00:00:00Z', now), '15 days left');
  assert.equal(seasonTimeLeft('2026-09-16T09:00:00Z', now), 'Ends today');
  assert.equal(seasonTimeLeft('2026-09-17T11:00:00Z', now), '2 days left');
  assert.equal(seasonTimeLeft('2026-09-01T00:00:00Z', now), 'Ended');
});

test('rank line', () => {
  assert.equal(rankLine(3), '#3 this season');
  assert.equal(rankLine(null), 'Not ranked yet');
});
