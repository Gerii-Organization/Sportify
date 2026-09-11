import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingAdvice, consecutiveDays, setsByMuscle } from '../src/lib/advice.js';
import { SPLIT_PRESETS } from '../src/constants/splits.js';

const PPL = SPLIT_PRESETS.find((p) => p.id === 'ppl').days;
const WEEK = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'];

const session = (muscles, sets = 3, completed_at = '2026-01-05T10:00:00Z') => ({
  completed_at,
  exercises: muscles.map((m, i) => ({ name: `ex${i}`, muscle: m, sets: Array(sets).fill({}) })),
});

test('a run that ended yesterday still counts this morning', () => {
  // At 9am "three days straight" is about the three behind you, not whether
  // you have trained yet today.
  assert.equal(consecutiveDays(['2026-01-05', '2026-01-06', '2026-01-07'], '2026-01-08'), 3);
  assert.equal(consecutiveDays(['2026-01-06', '2026-01-07', '2026-01-08'], '2026-01-08'), 3);
});

test('a gap ends the run', () => {
  assert.equal(consecutiveDays(['2026-01-05', '2026-01-07', '2026-01-08'], '2026-01-08'), 2);
  assert.equal(consecutiveDays([], '2026-01-08'), 0);
  assert.equal(consecutiveDays(['2026-01-01'], '2026-01-08'), 0, 'a week ago is not a run');
});

test('volume is counted in sets per muscle, not exercises', () => {
  const counts = setsByMuscle([session(['Chest'], 4), session(['Chest', 'Back'], 2)]);

  assert.equal(counts.Chest, 6);
  assert.equal(counts.Back, 2);
  assert.equal(counts.Legs, 0);
  assert.equal('Cardio' in counts, false, 'cardio is not a recovery concern');
});

test('trained today closes the question', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest'])], target: 4, today: '2026-01-07',
    trainedDays: ['2026-01-07'], weekKeys: WEEK,
  });

  assert.equal(a.tone, 'done');
  assert.equal(a.headline, 'Done for today');
});

test('four days straight suggests rest, and does not order it', () => {
  const a = trainingAdvice({
    sessions: [], target: 6, today: '2026-01-09', weekKeys: WEEK,
    trainedDays: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'],
  });

  assert.equal(a.tone, 'rest');
  assert.match(a.headline, /worth taking/, 'worth, not must');
});

test('rest outranks the split', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest', 'Shoulders'])], target: 6, today: '2026-01-09',
    trainedDays: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'],
    split: PPL, weekKeys: WEEK,
  });

  assert.equal(a.tone, 'rest');
});

test('with a split the headline is the session that is due', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest', 'Shoulders'])], target: 4, today: '2026-01-07',
    trainedDays: ['2026-01-05'], split: PPL, weekKeys: WEEK,
  });

  assert.equal(a.headline, 'Pull day');
  assert.equal(a.splitDay.label, 'Pull');
  assert.match(a.detail, /back, arms/);
});

test('an unreachable target never states the impossible number', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest', 'Shoulders'])], target: 4, today: '2026-01-10',
    trainedDays: ['2026-01-05'], split: PPL, weekKeys: WEEK,
  });

  assert.match(a.detail, /still beats none/);
  assert.doesNotMatch(a.detail, /3 to go/);
});

test('a met target offers the next day without demanding it', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest', 'Shoulders'])], target: 2, today: '2026-01-08',
    trainedDays: ['2026-01-05', '2026-01-06'], split: PPL, weekKeys: WEEK,
  });

  assert.equal(a.tone, 'done');
  assert.equal(a.headline, 'Target met');
  assert.match(a.detail, /if you want it/);
});

test('going off-plan is reported, never scolded', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest', 'Back', 'Legs'])], target: 4, today: '2026-01-07',
    trainedDays: ['2026-01-05'], split: PPL, weekKeys: WEEK,
  });

  assert.match(a.detail, /off-plan/);
  assert.match(a.detail, /is still next/);
});

test('without a split it falls back to the lightest muscle group', () => {
  const a = trainingAdvice({
    sessions: [session(['Chest'], 9), session(['Back'], 6)], target: 4,
    today: '2026-01-07', trainedDays: ['2026-01-05'], weekKeys: WEEK,
  });

  assert.match(a.headline, /^Train /);
  assert.equal(a.muscle && typeof a.muscle, 'string');
  assert.match(a.detail, /this week/);
});

test('nothing logged says so instead of inventing a muscle', () => {
  const a = trainingAdvice({
    sessions: [], target: 3, today: '2026-01-07', trainedDays: [], weekKeys: WEEK,
  });

  assert.equal(a.headline, 'Nothing logged this week');
  assert.equal(a.muscle, null);
  assert.match(a.detail, /target is 3 sessions/);
});

test('no target and nothing logged still says something true', () => {
  const a = trainingAdvice({ sessions: [], today: '2026-01-07', trainedDays: [], weekKeys: WEEK });
  assert.match(a.detail, /start a streak/);
});
