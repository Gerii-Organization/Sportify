import test from 'node:test';
import assert from 'node:assert/strict';
import { rarityFor, RARITIES } from '../src/lib/rarity.js';
import { RINGS, AVATARS, BADGES, TITLES, POWERUPS } from '../src/constants/cosmetics.js';

const priced = [...RINGS, ...AVATARS, ...BADGES, ...TITLES, ...POWERUPS]
  .map((item) => item.price)
  .filter((price) => price > 0);

test('free, missing or nonsense prices have no rarity', () => {
  for (const bad of [0, -5, null, undefined, '', NaN, 'abc', Infinity]) {
    assert.equal(rarityFor(bad), null, String(bad));
  }
});

test('each threshold belongs to the tier it opens', () => {
  const at = (price) => rarityFor(price)?.key;
  assert.equal(at(1), 'common');
  assert.equal(at(399), 'common');
  assert.equal(at(400), 'uncommon');
  assert.equal(at(799), 'uncommon');
  assert.equal(at(800), 'rare');
  assert.equal(at(1499), 'rare');
  assert.equal(at(1500), 'epic');
  assert.equal(at(2499), 'epic');
  assert.equal(at(2500), 'legendary');
  assert.equal(at(3999), 'legendary');
  assert.equal(at(4000), 'mythic');
});

test('a price that arrives as a string is still ranked', () => {
  assert.equal(rarityFor('2500')?.key, 'legendary');
});

test('every tier has something in today\'s catalogue', () => {
  for (const tier of RARITIES) {
    assert.ok(
      priced.some((price) => rarityFor(price)?.key === tier.key),
      `${tier.key} is empty — the thresholds no longer match cosmetics.js`
    );
  }
});

test('mythic stays rare: at most one priced item in ten', () => {
  const mythic = priced.filter((price) => rarityFor(price)?.key === 'mythic').length;
  assert.ok(mythic / priced.length <= 0.1, `${mythic} of ${priced.length} items are mythic`);
});

test('every tier has its own colour', () => {
  const tones = RARITIES.map((tier) => tier.color);
  assert.ok(tones.every(Boolean), 'a tier has no colour');
  assert.equal(new Set(tones).size, RARITIES.length);
});
