import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toDisplayWeight, fromInputWeight, formatWeight, weightLabel, heightLabel,
  toDisplayHeight, fromInputHeight, formatHeight, normaliseUnit, KG_PER_LB,
} from '../src/lib/units.js';

test('metric passes through untouched', () => {
  assert.equal(toDisplayWeight(82.5, 'metric'), 82.5);
  assert.equal(fromInputWeight('82.5', 'metric'), 82.5);
  assert.equal(formatWeight(100, 'metric'), '100 kg');
  assert.equal(weightLabel('metric'), 'kg');
  assert.equal(heightLabel('metric'), 'cm');
});

test('an unknown unit is metric, because metric is what is stored', () => {
  assert.equal(normaliseUnit(undefined), 'metric');
  assert.equal(normaliseUnit(null), 'metric');
  assert.equal(normaliseUnit('freedom'), 'metric');
  assert.equal(normaliseUnit('imperial'), 'imperial');
});

test('the familiar barbell numbers land where a lifter expects', () => {
  assert.equal(toDisplayWeight(100, 'imperial'), 220.5);
  assert.equal(toDisplayWeight(60, 'imperial'), 132.5);
  assert.equal(formatWeight(20, 'imperial'), '44 lb', 'the olympic bar');
});

test('typing in pounds stores kilograms', () => {
  assert.ok(Math.abs(fromInputWeight('185', 'imperial') - 83.9) < 0.05);
  assert.equal(fromInputWeight('100', 'imperial'), 100 * KG_PER_LB);
});

test('a weight survives being typed, stored and shown again', () => {
  // The drift bug this shape prevents: round on the way in, redisplay, round
  // again, retype — and the number walks away from what was lifted.
  for (const typed of [45, 95, 135, 185, 225, 315, 405]) {
    const stored = fromInputWeight(String(typed), 'imperial');
    assert.equal(toDisplayWeight(stored, 'imperial'), typed, `${typed}lb round trip`);
  }
});

test('repeated round trips do not walk', () => {
  let stored = fromInputWeight('185', 'imperial');
  for (let i = 0; i < 25; i += 1) {
    stored = fromInputWeight(String(toDisplayWeight(stored, 'imperial')), 'imperial');
  }
  assert.equal(toDisplayWeight(stored, 'imperial'), 185);
});

test('the step controls how fine the figure reads', () => {
  assert.equal(toDisplayWeight(83.91, 'imperial', 0.5), 185);
  assert.equal(toDisplayWeight(83.91, 'imperial', 0.1), 185);
  assert.equal(toDisplayWeight(83.91, 'imperial', 5), 185);
  assert.equal(toDisplayWeight(83.91, 'imperial', 1), 185);
});

test('trailing zeroes are trimmed so a weight does not look measured to a lab', () => {
  assert.equal(formatWeight(45.359237, 'imperial'), '100 lb');
  assert.equal(formatWeight(82.5, 'metric'), '82.5 kg');
  assert.equal(formatWeight(100, 'metric', { withUnit: false }), '100');
});

test('junk in gives something safe out', () => {
  assert.equal(toDisplayWeight(null, 'imperial'), 0);
  assert.equal(toDisplayWeight('abc', 'metric'), 0);
  assert.equal(fromInputWeight('', 'metric'), null);
  assert.equal(fromInputWeight(null, 'metric'), null);
  assert.equal(fromInputWeight('abc', 'imperial'), null);
  assert.equal(fromInputWeight('   ', 'metric'), null, 'whitespace is not zero');
  assert.equal(fromInputWeight(undefined, 'metric'), null);
  assert.equal(formatWeight(null, 'metric'), '0 kg', 'a zero total is still a number');
});

test('a comma decimal is accepted, because half of Europe types one', () => {
  assert.equal(fromInputWeight('82,5', 'metric'), 82.5);
});

test('height converts and reads as feet and inches', () => {
  assert.equal(formatHeight(180, 'metric'), '180 cm');
  assert.equal(formatHeight(180, 'imperial'), "5'11\"");
  assert.equal(formatHeight(182.88, 'imperial'), "6'0\"");
  assert.equal(formatHeight(null, 'imperial'), '—');

  assert.equal(toDisplayHeight(180, 'metric'), 180);
  assert.ok(Math.abs(fromInputHeight('71', 'imperial') - 180.34) < 0.01);
});

test('volume reads as tonnes in metric and pounds in imperial', async () => {
  const { formatVolume, formatDelta } = await import('../src/lib/units.js');

  assert.equal(formatVolume(420, 'metric'), '420 kg');
  assert.equal(formatVolume(12420, 'metric'), '12.4t');

  // 1,000lb is not a landmark anyone uses, so imperial stays in pounds.
  assert.equal(formatVolume(4536, 'imperial'), '10,000 lb');
  assert.equal(formatVolume(0, 'metric'), '0 kg');
});

test('a body weight change is converted once, not at both ends', async () => {
  const { formatDelta } = await import('../src/lib/units.js');

  assert.equal(formatDelta(1.2, 'metric'), '+1.2 kg');
  assert.equal(formatDelta(-1.2, 'metric'), '-1.2 kg');
  assert.equal(formatDelta(0, 'metric'), '0.0 kg');
  assert.equal(formatDelta(-1.2, 'imperial'), '-2.6 lb');
});

test('the unit is guessed from the region, and metric is the fallback', async () => {
  const { unitForLocale } = await import('../src/lib/units.js');

  assert.equal(unitForLocale('en-US'), 'imperial');
  assert.equal(unitForLocale('en_US'), 'imperial');
  assert.equal(unitForLocale('es-US'), 'imperial', 'the region decides, not the language');

  assert.equal(unitForLocale('en-GB'), 'metric', 'Britain buys petrol in litres');
  assert.equal(unitForLocale('ro-RO'), 'metric');
  assert.equal(unitForLocale('en'), 'metric', 'no region at all');
  assert.equal(unitForLocale(''), 'metric');
  assert.equal(unitForLocale(null), 'metric');
  assert.equal(unitForLocale('nonsense'), 'metric');
});
