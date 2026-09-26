import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RINGS, AVATARS, BADGES, TITLES, POWERUPS } from '../src/constants/cosmetics.js';

/**
 * The server charges from `shop_items`, seeded by 20260913_daily_shop.sql. The
 * app shows prices from cosmetics.js. If the two drift, the shop displays one
 * price, sends it, and `purchase_item` refuses with `price_changed` — for
 * every purchase of that item, forever.
 */

// Every migration that seeds shop_items, oldest first: a later row for the
// same id replaces the earlier one, as `on conflict do update` does.
const SEEDS = ['20260913_daily_shop.sql', '20260926_shop_frames.sql'];
const rows = SEEDS.flatMap((file) => {
  const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
  return [...sql.matchAll(/\('([^']+)', +'(ring|avatar|badge|title|powerup)', +'([^']*)', +(\d+)(?:, +(true|false))?\)/g)]
    .map(([, id, type, name, price, iapOnly]) => ({ id, type, name, price: Number(price), iapOnly: iapOnly === 'true' }));
});
const seeded = new Map(rows.map((row) => [row.id, row]));

const catalogue = [
  ...RINGS.map((item) => ({ ...item, type: 'ring' })),
  ...AVATARS.map((item) => ({ ...item, type: 'avatar' })),
  ...BADGES.map((item) => ({ ...item, type: 'badge' })),
  ...TITLES.map((item) => ({ ...item, type: 'title' })),
  ...POWERUPS.map((item) => ({ ...item, type: 'powerup' })),
];

test('the seeds parse into rows', () => {
  assert.ok(rows.length > 0, 'no rows found in the seeds');
  for (const file of SEEDS) {
    assert.ok(rows.length, `${file} seeds nothing`);
  }
});

test('every item in the app is sold by the server at the same price', () => {
  for (const item of catalogue) {
    const row = seeded.get(item.id);
    assert.ok(row, `${item.id} is in cosmetics.js but not in shop_items`);
    assert.equal(row.type, item.type, `${item.id} has type ${row.type} on the server`);
    assert.equal(row.price, item.price, `${item.id} costs ${row.price} on the server and ${item.price} in the app`);
  }
});

test('the server sells nothing the app does not know about', () => {
  const known = new Set(catalogue.map((item) => item.id));
  const extra = [...seeded.values()].filter((row) => !known.has(row.id)).map((row) => row.id);
  assert.deepEqual(extra, []);
});

test('an exclusive in the app is money-only on the server, and only those are', () => {
  // A frame the app calls exclusive but the server does not would be
  // equippable by anyone (price 0 reads as free); the reverse would be a frame
  // the app offers for energy and the server refuses to sell.
  for (const item of catalogue) {
    assert.equal(seeded.get(item.id).iapOnly, !!item.exclusive, `${item.id}: exclusive in the app is ${!!item.exclusive}, iap_only on the server is ${seeded.get(item.id).iapOnly}`);
  }
});
