import test from 'node:test';
import assert from 'node:assert/strict';
import { restSecondsFor, labelForRestChoice, REST_CHOICES, REST_SECONDS_BY_GOAL } from "../src/lib/rest.js";

test('without a choice the goal decides', () => {
  assert.equal(restSecondsFor('gain_strength'), 180);
  assert.equal(restSecondsFor('lose_weight'), 45);
  assert.equal(restSecondsFor('build_muscle'), 90);
});

test('an unknown or missing goal still gives a usable rest', () => {
  assert.equal(restSecondsFor(undefined), 90);
  assert.equal(restSecondsFor('powerlifting_but_different'), 90);
});

test("the user's own choice wins over the goal", () => {
  assert.equal(restSecondsFor('lose_weight', 300), 300);
  assert.equal(restSecondsFor('gain_strength', 45), 45);
});

test('an empty choice falls back rather than resting for zero seconds', () => {
  for (const nothing of [null, undefined, 0, '', 'abc', -30, NaN]) {
    assert.equal(restSecondsFor('build_muscle', nothing), 90, String(nothing));
  }
});

test('every offered choice resolves and reads properly', () => {
  assert.equal(labelForRestChoice(null), 'Automatic');
  assert.equal(labelForRestChoice(45), '45s');
  assert.equal(labelForRestChoice(60), '1 min');
  assert.equal(labelForRestChoice(90), '1m 30s');
  assert.equal(labelForRestChoice(180), '3 min');

  for (const choice of REST_CHOICES) {
    assert.ok(labelForRestChoice(choice).length > 0);
    assert.ok(restSecondsFor('maintain', choice) > 0);
  }
});

test('the goal table covers every goal the onboarding offers', () => {
  for (const goal of ['gain_strength', 'build_muscle', 'maintain', 'lose_weight']) {
    assert.ok(REST_SECONDS_BY_GOAL[goal] > 0, goal);
  }
});
