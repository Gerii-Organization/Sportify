import test from 'node:test';
import assert from 'node:assert/strict';
import { toDisplayLength, fromInputLength, formatChange, summarise, lengthLabel } from '../src/lib/measurements.js';

test('lengths convert to the shown unit to the nearest half', () => {
  assert.equal(toDisplayLength(81.3, 'metric'), 81.5);
  assert.equal(toDisplayLength(81.28, 'imperial'), 32);
  assert.equal(toDisplayLength(null, 'metric'), null);
  assert.equal(lengthLabel('imperial'), 'in');
});

test('typed values accept a comma and come back in centimetres', () => {
  assert.equal(fromInputLength('82,5', 'metric'), 82.5);
  assert.equal(fromInputLength('32', 'imperial'), 81.3);
  assert.equal(fromInputLength('', 'metric'), null);
  assert.equal(fromInputLength('-3', 'metric'), null);
});

test('changes read neutrally', () => {
  assert.equal(formatChange(-2, 'metric'), '−2 cm');
  assert.equal(formatChange(1.5, 'metric'), '+1.5 cm');
  assert.equal(formatChange(0, 'metric'), 'no change');
});

test('each field finds its own first and latest value', () => {
  const rows = [
    { measured_on: '2026-09-10', waist_cm: 84, arm_cm: null },
    { measured_on: '2026-08-01', waist_cm: 88, arm_cm: 36 },
    { measured_on: '2026-09-01', waist_cm: null, arm_cm: '37.5' },
  ];
  const byKey = Object.fromEntries(summarise(rows).map((s) => [s.key, s]));
  assert.deepEqual([byKey.waist_cm.latest, byKey.waist_cm.change, byKey.waist_cm.since], [84, -4, '2026-08-01']);
  assert.deepEqual([byKey.arm_cm.latest, byKey.arm_cm.change, byKey.arm_cm.date], [37.5, 1.5, '2026-09-01']);
  assert.deepEqual([byKey.hips_cm.latest, byKey.hips_cm.change], [null, null]);
});

test('a single reading has no change yet', () => {
  const [waist] = summarise([{ measured_on: '2026-09-10', waist_cm: 84 }]);
  assert.deepEqual([waist.latest, waist.change], [84, null]);
});
