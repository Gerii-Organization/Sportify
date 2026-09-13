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

const sql = readFileSync(new URL('../supabase/migrations/20260913_daily_shop.sql', import.meta.url), 'utf8');
const rows = [...sql.matchAll(/\('([^']+)', '(ring|avatar|badge|title|powerup)', '([^']*)', (\d+)\)/g)]
  .map(([, id, type, name, price]) => ({ id, type, name, price: Number(price) }));
const seeded = new Map(rows.map((row) => [row.id, row]));

const catalogue = [
  ...RINGS.map((item) => ({ ...item, type: 'ring' })),
  ...AVATARS.map((item) => ({ ...item, type: 'avatar' })),
  ...BADGES.map((item) => ({ ...item, type: 'badge' })),
  ...TITLES.map((item) => ({ ...item, type: 'title' })),
  ...POWERUPS.map((item) => ({ ...item, type: 'powerup' })),
];

test('the seed parses into one row per item', () => {
  assert.ok(rows.length > 0, 'no rows found in the seed');
  assert.equal(seeded.size, rows.length, 'duplicate ids in the seed');
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
  const extra = rows.filter((row) => !known.has(row.id)).map((row) => row.id);
  assert.deepEqual(extra, []);
});
