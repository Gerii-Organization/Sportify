import test from 'node:test';
import assert from 'node:assert/strict';
import { bonusPercent, offerContents, offerForFrame } from '../src/lib/offers.js';
import { OFFERS, ENERGY_PACKS, IAP_ENABLED } from '../src/constants/storeOffers.js';
import { AVATARS } from '../src/constants/cosmetics.js';

const base = ENERGY_PACKS[0];

test('the smallest pack has no bonus', () => {
  assert.equal(bonusPercent(base, base), 0);
});

test('every bonus is true of its pack, rounded down', () => {
  for (const pack of ENERGY_PACKS.slice(1)) {
    const claimed = bonusPercent(pack, base);
    const actual = ((pack.energy / pack.listPrice) / (base.energy / base.listPrice) - 1) * 100;
    assert.ok(claimed <= actual, `${pack.id} claims ${claimed}% but gives ${actual.toFixed(2)}%`);
    assert.ok(actual - claimed < 1, `${pack.id} undersells: ${claimed}% of ${actual.toFixed(2)}%`);
  }
});

test('bigger packs are always better value', () => {
  const bonuses = ENERGY_PACKS.map((pack) => bonusPercent(pack, base));
  for (let i = 1; i < bonuses.length; i += 1) {
    assert.ok(bonuses[i] > bonuses[i - 1], `pack ${i} (${bonuses[i]}%) is not better than pack ${i - 1} (${bonuses[i - 1]}%)`);
  }
});

test('the bonus follows the store price, not the list price, when given one', () => {
  const storePrice = { pouch: 1, sack: 10 };
  const price = (p) => storePrice[p.id];
  // 2800 for 10 against 500 for 1 is worse value, so no bonus at all.
  assert.equal(bonusPercent(ENERGY_PACKS[1], base, price), 0);
});

test('missing or nonsense prices give no bonus rather than a wrong one', () => {
  assert.equal(bonusPercent({ energy: 100 }, base), 0);
  assert.equal(bonusPercent({ energy: 100, listPrice: 0 }, base), 0);
  assert.equal(bonusPercent(null, base), 0);
});

test('"Most popular" and "Best value" each appear once', () => {
  const tags = ENERGY_PACKS.map((p) => p.tag).filter(Boolean);
  assert.deepEqual(tags.sort(), ['Best value', 'Most popular']);
  assert.equal(ENERGY_PACKS.at(-1).tag, 'Best value');
});

test('product ids are unique and store-safe', () => {
  const ids = [...OFFERS, ...ENERGY_PACKS].map((p) => p.productId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^sportify\.[a-z]+\.[a-z0-9]+$/);
});

test('each bundle frame exists, is exclusive to that bundle, and costs no energy', () => {
  for (const offer of OFFERS) {
    const frame = AVATARS.find((a) => a.id === offer.frameId);
    assert.ok(frame, `${offer.id} includes ${offer.frameId}, which is not in AVATARS`);
    assert.equal(frame.exclusive, offer.id);
    assert.equal(frame.price, 0);
    assert.equal(offerForFrame(OFFERS, frame.id), offer);
  }
});

test('an offer lists the exclusive frame first', () => {
  const lines = offerContents(OFFERS[0]);
  assert.equal(lines[0].kind, 'frame');
  assert.deepEqual(lines.map((l) => l.kind), ['frame', 'energy', 'freezes']);
});

test('real-money purchases stay off until a store is wired in', () => {
  // Flipping this is a release decision: it needs StoreKit / Play Billing, the
  // products in both consoles, and server-side receipt checks.
  assert.equal(IAP_ENABLED, false);
});
