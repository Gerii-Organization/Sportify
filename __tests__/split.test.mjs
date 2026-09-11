import test from 'node:test';
import assert from 'node:assert/strict';
import { musclesOf, scoreDay, matchSession, nextInCycle, weekOutlook } from '../src/lib/split.js';
import { SPLIT_PRESETS, presetsFor, cycleNote } from '../src/constants/splits.js';

const PPL = SPLIT_PRESETS.find((p) => p.id === 'ppl').days;

const session = (muscles, completed_at = '2026-01-05T10:00:00Z') => ({
  completed_at,
  exercises: muscles.map((m, i) => ({ name: `ex${i}`, muscle: m, sets: [{}] })),
});

test('a session reports the distinct muscles it contained', () => {
  assert.deepEqual(musclesOf(session(['Chest', 'Chest', 'Shoulders'])), ['Chest', 'Shoulders']);
  assert.deepEqual(musclesOf({ exercises: [] }), []);
  assert.deepEqual(musclesOf(null), []);
});

test('a day is scored from the session side, not the plan side', () => {
  // The obvious version scores from the split day and is wrong: a short chest
  // session against Push {Chest, Shoulders, Arms} would score 1/3 and be
  // called off-plan, when it plainly was a push day.
  const push = PPL[0];
  assert.equal(scoreDay(['Chest'], push), 1, 'everything you did belongs to Push');
  assert.equal(scoreDay(['Chest', 'Back'], push), 0.5);
  assert.equal(scoreDay([], push), 0);
});

test('a short chest session still counts as push day', () => {
  assert.equal(matchSession(['Chest'], PPL), 0);
});

test('a genuinely mixed session is off-plan', () => {
  // 1 of 3 belongs to any one day — below the 0.6 threshold.
  assert.equal(matchSession(['Chest', 'Back', 'Legs'], PPL), null);
});

test('a tie is broken toward the day that was coming up anyway', () => {
  // Arms appear in both Push and Pull, so arms-only scores 1.0 against both.
  assert.equal(matchSession(['Arms'], PPL), null, 'no expectation: refuses to guess');
  assert.equal(matchSession(['Arms'], PPL, 0), 0, 'Push was next');
  assert.equal(matchSession(['Arms'], PPL, 1), 1, 'Pull was next');
});

test('the cycle advances past the last recognisable session', () => {
  const { index, day, lastWasOffPlan } = nextInCycle(PPL, [session(['Chest', 'Shoulders'])]);

  assert.equal(index, 1);
  assert.equal(day.label, 'Pull');
  assert.equal(lastWasOffPlan, false);
});

test('the cycle wraps', () => {
  assert.equal(nextInCycle(PPL, [session(['Legs', 'Core'])]).day.label, 'Push');
});

test('an off-plan session re-anchors the cycle instead of repeating the instruction', () => {
  // Trained legs when Pull was next: the plan follows you, and offers Push
  // after legs rather than insisting on the Pull you already declined.
  const sessions = [
    session(['Legs'], '2026-01-06T10:00:00Z'),
    session(['Chest', 'Shoulders'], '2026-01-05T10:00:00Z'),
  ];

  const { day, lastWasOffPlan } = nextInCycle(PPL, sessions);
  assert.equal(day.label, 'Push', 'legs matched Legs, so Push is next');
  assert.equal(lastWasOffPlan, false);
});

test('a truly unrecognisable last session is reported as off-plan', () => {
  const sessions = [
    session(['Chest', 'Back', 'Legs'], '2026-01-06T10:00:00Z'),
    session(['Chest', 'Shoulders'], '2026-01-05T10:00:00Z'),
  ];

  const { day, lastWasOffPlan } = nextInCycle(PPL, sessions);
  assert.equal(day.label, 'Pull', 'anchored to the older recognisable session');
  assert.equal(lastWasOffPlan, true);
});

test('nothing logged starts at the top of the cycle', () => {
  assert.equal(nextInCycle(PPL, []).index, 0);
  assert.equal(nextInCycle(PPL, null).day.label, 'Push');
  assert.equal(nextInCycle([], []), null);
});

test('sessions are read newest first regardless of the order given', () => {
  const older = session(['Chest'], '2026-01-01T10:00:00Z');
  const newer = session(['Legs', 'Core'], '2026-01-07T10:00:00Z');

  assert.equal(nextInCycle(PPL, [older, newer]).day.label, 'Push');
  assert.equal(nextInCycle(PPL, [newer, older]).day.label, 'Push');
});

test('the week is reachable while enough days remain', () => {
  const week = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'];

  const wed = weekOutlook({ doneDays: ['2026-01-05'], target: 4, weekKeys: week, today: '2026-01-07' });
  assert.deepEqual(
    { done: wed.done, left: wed.left, daysLeft: wed.daysLeft, reachable: wed.reachable },
    { done: 1, left: 3, daysLeft: 5, reachable: true }
  );
});

test('an impossible target says so rather than repeating itself', () => {
  const week = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'];

  const sat = weekOutlook({ doneDays: ['2026-01-05'], target: 4, weekKeys: week, today: '2026-01-10' });
  assert.equal(sat.left, 3);
  assert.equal(sat.daysLeft, 2);
  assert.equal(sat.reachable, false);
});

test('a met target stays reachable on the last day', () => {
  const week = ['2026-01-05', '2026-01-11'];
  const met = weekOutlook({ doneDays: ['a', 'b', 'c', 'd'], target: 4, weekKeys: week, today: '2026-01-11' });

  assert.equal(met.left, 0);
  assert.equal(met.reachable, true);
});

test('presets are ordered by fit and never filtered away', () => {
  const three = presetsFor(3);
  const five = presetsFor(5);

  assert.equal(three.length, SPLIT_PRESETS.length, 'nothing is hidden');
  assert.equal(five.length, SPLIT_PRESETS.length);

  // Three days fits full body, PPL and Arnold equally well. The sort is stable,
  // so a tie keeps the order they are declared in — full body leads, which is
  // the right thing to put in front of someone training three times a week.
  assert.deepEqual(three.slice(0, 3).map((p) => p.id), ['full_body', 'ppl', 'arnold']);
  assert.equal(three[three.length - 1].id, 'bro', 'furthest from three days, last');

  assert.equal(five[0].id, 'bro', 'a five-day cycle for five days');
});

test('someone training three times a week can still choose a five-day cycle', () => {
  // Ordering, not filtering: hiding it would be the app overruling a number
  // given in passing during onboarding.
  assert.ok(presetsFor(3).some((p) => p.id === 'bro'));
  assert.ok(presetsFor(2).some((p) => p.id === 'ppl'));
  assert.ok(presetsFor(7).some((p) => p.id === 'full_body'));
});

test('the cycle note states the real consequence', () => {
  assert.match(cycleNote(PPL, 6), /twice a week|2 times a week/i);
  assert.equal(cycleNote(PPL, 3), 'One full cycle a week.');
  assert.match(cycleNote(SPLIT_PRESETS.find((p) => p.id === 'bro').days, 3), /about 12 days/);
  assert.equal(cycleNote([], 3), null);
  assert.equal(cycleNote(PPL, 0), null);
});
