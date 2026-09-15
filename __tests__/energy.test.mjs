import test from 'node:test';
import assert from 'node:assert/strict';
import { keytelKcalPerMinute, averageHeartRate, totalActiveEnergy, pickBurn } from '../src/lib/energy.js';

const start = '2026-09-15T10:00:00Z';
const end = '2026-09-15T11:00:00Z';
const sample = (minute, value) => ({ value, startDate: new Date(Date.parse(start) + minute * 60_000).toISOString() });

test('Keytel gives plausible exercise burn and differs by sex', () => {
  const man = keytelKcalPerMinute({ heartRate: 140, weightKg: 80, age: 30, sex: 'M' });
  const woman = keytelKcalPerMinute({ heartRate: 140, weightKg: 65, age: 30, sex: 'F' });
  assert.ok(man > 10 && man < 15, `man ${man}`);
  assert.ok(woman > 7 && woman < 12, `woman ${woman}`);
  assert.equal(keytelKcalPerMinute({ heartRate: 'x' }), null);
});

test('average heart rate needs enough readings across the session', () => {
  const full = [0, 12, 24, 36, 48, 58].map((m, i) => sample(m, 120 + i * 4));
  assert.equal(averageHeartRate(full, { start, end }), 130);
  assert.equal(averageHeartRate(full.slice(0, 4), { start, end }), null); // too few
  const bunched = [0, 1, 2, 3, 4, 5].map((m) => sample(m, 130));
  assert.equal(averageHeartRate(bunched, { start, end }), null); // 5 minutes of a 60-minute session
  const resting = [0, 12, 24, 36, 48, 58].map((m) => sample(m, 70));
  assert.equal(averageHeartRate(resting, { start, end }), null);
});

test('active energy sums, and none is null', () => {
  assert.equal(totalActiveEnergy([{ value: 12.5 }, { value: '7.5' }, { value: -3 }]), 20);
  assert.equal(totalActiveEnergy([]), null);
});

test('the best available source wins', () => {
  const profile = { sex: 'M', weight: 80, age: 30 };
  assert.deepEqual(pickBurn({ activeKcal: 312.4, avgHeartRate: 140, minutes: 45, profile, estimateKcal: 280 }), { kcal: 312, source: 'health' });

  const hr = pickBurn({ activeKcal: null, avgHeartRate: 140, minutes: 45, profile, estimateKcal: 280 });
  assert.equal(hr.source, 'heart_rate');
  assert.equal(hr.kcal % 5, 0);

  assert.deepEqual(pickBurn({ activeKcal: 2, avgHeartRate: null, minutes: 45, profile, estimateKcal: 280 }), { kcal: 280, source: 'estimate' });
});
