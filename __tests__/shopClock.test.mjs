import test from 'node:test';
import assert from 'node:assert/strict';
import {
  msUntilUtcMidnight, msUntilUtcMonday,
  formatClock, formatHoursMinutes, formatDaysHours,
} from '../src/lib/shopClock.js';

const H = 60 * 60 * 1000;
const DAY = 24 * H;
const at = (iso) => Date.parse(iso);

test('restock counts to UTC midnight, not local midnight', () => {
  const ms = msUntilUtcMidnight(at('2026-09-13T21:37:55Z'));
  assert.equal(formatClock(ms), '02:22:05');
});

test('at midnight exactly the next restock is a full day away', () => {
  assert.equal(msUntilUtcMidnight(at('2026-09-14T00:00:00Z')), DAY);
});

test('the weekly offer always ends on a Monday at 00:00 UTC', () => {
  // Every hour across two weeks, so each weekday and both edges are covered.
  const start = at('2026-09-10T00:00:00Z');
  for (let now = start; now < start + 14 * DAY; now += H) {
    const ms = msUntilUtcMonday(now);
    const end = new Date(now + ms);

    assert.equal(end.getUTCDay(), 1, new Date(now).toISOString());
    assert.equal(end.getUTCHours(), 0);
    assert.ok(ms > 0 && ms <= 7 * DAY, `${ms} out of range at ${new Date(now).toISOString()}`);
  }
});

test('on a Monday the offer that just started has the whole week', () => {
  assert.equal(msUntilUtcMonday(at('2026-09-14T00:00:00Z')), 7 * DAY);
  assert.equal(msUntilUtcMonday(at('2026-09-13T12:00:00Z')), 12 * H); // a Sunday
});

test('badges show the two largest units still moving', () => {
  assert.equal(formatDaysHours(2 * DAY + 8 * H + 5 * 60 * 1000), '2d 08h');
  assert.equal(formatDaysHours(8 * H + 12 * 60 * 1000), '08h 12m');
  assert.equal(formatHoursMinutes(14 * H + 22 * 60 * 1000), '14h 22m');
});

test('an expired or missing timer reads as zeros, never negative', () => {
  for (const bad of [-5000, NaN, null, undefined]) {
    assert.equal(formatClock(bad), '00:00:00', String(bad));
    assert.equal(formatDaysHours(bad), '00h 00m', String(bad));
  }
});
