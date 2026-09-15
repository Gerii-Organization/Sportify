import test from 'node:test';
import assert from 'node:assert/strict';
import { calorieTarget, macroTargets } from '../src/lib/nutrition.js';

const base = { weight: 80, height: 180, age: 30, sex: 'M', workouts_per_week: 4 };

test('calories match the formula both screens used', () => {
  // BMR 10·80 + 6.25·180 − 5·30 + 5 = 1780, × 1.55 = 2759
  assert.equal(calorieTarget({ ...base, goal: 'maintain' }), 2759);
  assert.equal(calorieTarget({ ...base, goal: 'lose_weight' }), 2259);
  assert.equal(calorieTarget({ ...base, goal: 'build_muscle' }), 3059);
  assert.equal(calorieTarget(null), 2000);
});

test('never below 1200 calories', () => {
  assert.equal(calorieTarget({ weight: 40, height: 140, age: 80, sex: 'F', workouts_per_week: 0, goal: 'lose_weight' }), 1200);
});

test('protein follows the goal', () => {
  assert.equal(macroTargets({ ...base, goal: 'lose_weight' }).protein, 176);
  assert.equal(macroTargets({ ...base, goal: 'build_muscle' }).protein, 160);
  assert.equal(macroTargets({ ...base, goal: 'maintain' }).protein, 128);
});

test('the macros add back up to the calorie target', () => {
  for (const goal of ['lose_weight', 'build_muscle', 'gain_strength', 'maintain']) {
    const profile = { ...base, goal };
    const kcal = calorieTarget(profile);
    const { protein, carbs, fats } = macroTargets(profile, kcal);
    assert.ok(Math.abs(protein * 4 + carbs * 4 + fats * 9 - kcal) <= 10, goal);
  }
});

test('fats keep a floor and carbs never go negative', () => {
  const { fats, carbs } = macroTargets({ weight: 120, goal: 'lose_weight' }, 1200);
  assert.equal(fats, 72); // 0.6 g/kg beats 25% of 1200 kcal
  assert.equal(carbs, 0);
});

test('an unknown goal falls back to maintenance', () => {
  assert.deepEqual(macroTargets({ ...base, goal: 'who-knows' }, 2500), macroTargets({ ...base, goal: 'maintain' }, 2500));
});
