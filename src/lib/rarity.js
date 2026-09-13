import { rarityColors } from '../theme';

/**
 * How rare a shop item is: the word in the corner of a Flash Rotation card and
 * on an Elite Prestige halo, in that tier's colour.
 *
 * Tiers, highest first so the first match wins. The thresholds sit in the gaps
 * between the catalogue's real price clusters rather than on round numbers, so
 * every tier has something in it today:
 *
 *   common     50 · 100 · 250            Coin Boost, starter titles
 *   uncommon   400 · 500 · 600           Streak Freeze, XP Boost
 *   rare       800 · 1,000 · 1,200
 *   epic       1,500 · 2,000
 *   legendary  2,500 · 3,000 · 3,500
 *   mythic     5,000                     The Void, Overlord
 *
 * __tests__/rarity.test.mjs fails if a tier ends up empty — which is what
 * happens when prices move in cosmetics.js and nobody moves these.
 */
export const RARITIES = [
  { key: 'mythic', label: 'MYTHIC', min: 4000 },
  { key: 'legendary', label: 'LEGENDARY', min: 2500 },
  { key: 'epic', label: 'EPIC', min: 1500 },
  { key: 'rare', label: 'RARE', min: 800 },
  { key: 'uncommon', label: 'UNCOMMON', min: 400 },
  { key: 'common', label: 'COMMON', min: 1 },
].map((tier) => ({ ...tier, color: rarityColors[tier.key] }));

/**
 * The tier for an item's FULL catalogue price — never today's discounted one.
 * A mythic item does not turn legendary because it happens to be on sale.
 *
 * Returns `{ key, label, min, color }`, or null for free defaults and anything
 * that is not a price. `Number(null)` is 0, not NaN, so a missing price lands
 * on the free branch rather than slipping through as common.
 */
export function rarityFor(price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  return RARITIES.find((tier) => p >= tier.min) || null;
}
