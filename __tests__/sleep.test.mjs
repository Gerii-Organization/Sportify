import test from 'node:test';
import assert from 'node:assert/strict';
import { asleepMinutes, lastNightWindow } from '../src/lib/sleep.js';

const at = (h, m = 0, day = 2) => new Date(Date.UTC(2026, 0, day, h, m)).toISOString();
const s = (value, startDate, endDate) => ({ value, startDate, endDate });

test('a single night is its own length', () => {
  assert.equal(asleepMinutes([s('ASLEEP', at(23, 0, 1), at(7, 0, 2))]), 480);
});

test('overlapping samples are merged, not summed', () => {
  // The bug this module exists for. HealthKit's own docs say INBED and ASLEEP
  // samples overlap by design, and a watch plus a phone doubles it again — the
  // old code added them all and reported 24 hours for a 7h45 night.
  const night = [
    s('CORE', at(23, 15, 1), at(2, 0, 2)),
    s('DEEP', at(0, 30, 2), at(3, 0, 2)),   // inside and past the CORE block
    s('REM',  at(3, 0, 2),  at(5, 30, 2)),  // touches the previous end exactly
    s('CORE', at(5, 30, 2), at(7, 0, 2)),
  ];

  assert.equal(asleepMinutes(night), 465, '23:15 to 07:00 is 7h45');
});

test('two devices reporting the same night count it once', () => {
  const watch = s('ASLEEP', at(23, 0, 1), at(7, 0, 2));
  const phone = s('CORE', at(23, 10, 1), at(6, 50, 2));

  assert.equal(asleepMinutes([watch, phone]), 480);
  assert.equal(asleepMinutes([phone, watch]), 480, 'order does not matter');
});

test('INBED and AWAKE are not sleep', () => {
  // INBED spans the whole night as presence, not sleep. Counting it is how the
  // total doubled.
  const samples = [
    s('INBED', at(22, 30, 1), at(7, 30, 2)),
    s('ASLEEP', at(23, 0, 1), at(7, 0, 2)),
    s('AWAKE', at(3, 0, 2), at(3, 20, 2)),
  ];

  assert.equal(asleepMinutes(samples), 480, 'only the ASLEEP range counts');
  assert.equal(asleepMinutes([s('INBED', at(22, 0, 1), at(8, 0, 2))]), 0);
});

test('a gap between blocks is not slept through', () => {
  const broken = [
    s('ASLEEP', at(23, 0, 1), at(2, 0, 2)),
    s('ASLEEP', at(4, 0, 2), at(7, 0, 2)),   // two hours awake in between
  ];

  assert.equal(asleepMinutes(broken), 360, '3h + 3h, not 8h');
});

test('nothing, and nonsense, come back as zero rather than throwing', () => {
  assert.equal(asleepMinutes([]), 0);
  assert.equal(asleepMinutes(null), 0);
  assert.equal(asleepMinutes(undefined), 0);
  assert.equal(asleepMinutes([s('ASLEEP', 'not-a-date', 'also-not')]), 0);
  assert.equal(asleepMinutes([s('ASLEEP', at(7, 0, 2), at(23, 0, 1))]), 0, 'ends before it starts');
  assert.equal(asleepMinutes([{}]), 0);
});

test('state matching ignores case', () => {
  assert.equal(asleepMinutes([s('asleep', at(23, 0, 1), at(1, 0, 2))]), 120);
});

test('the window opens at 18:00 the day before and closes now', () => {
  // Starting at midnight was the other half of the bug: go to bed at 23:00 and
  // everything before midnight falls outside the query.
  const now = new Date(2026, 0, 2, 9, 30);
  const { startDate, endDate } = lastNightWindow(now);

  const start = new Date(startDate);
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 18);
  assert.equal(start.getMinutes(), 0);
  assert.equal(endDate, now.toISOString(), 'ends at the present, so naps count too');
});
