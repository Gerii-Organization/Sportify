/**
 * Arithmetic behind the real-money offers, kept apart from the screen so it
 * can be tested: a bonus claim on a price card is a promise, and a wrong one is
 * a consumer-protection problem, not a typo.
 */

/**
 * How much more energy per unit of money a pack gives than `base`, as a whole
 * percentage rounded DOWN — a claim of "+20%" is never more than the pack
 * delivers. 0 for the base pack itself or anything missing a price.
 *
 * `price` reads `listPrice` by default. Once live, pass the store's numeric
 * prices instead: packs are priced per country, and the bonus has to be true
 * in the buyer's currency.
 */
export function bonusPercent(pack, base, price = (p) => p?.listPrice) {
  const packPrice = Number(price(pack));
  const basePrice = Number(price(base));
  if (!pack || !base || pack === base) return 0;
  if (!(packPrice > 0) || !(basePrice > 0) || !(base.energy > 0)) return 0;

  const ratio = (pack.energy / packPrice) / (base.energy / basePrice);
  // A hair of tolerance for float error, so 1.2 does not become 19%.
  return Math.max(0, Math.floor((ratio - 1) * 100 + 1e-9));
}

/**
 * What an offer contains, in the order its card lists it: the exclusive frame
 * first, because it is the only thing in the bundle money cannot buy elsewhere.
 */
export function offerContents(offer) {
  if (!offer) return [];
  const lines = [];
  if (offer.frameId) lines.push({ kind: 'frame', id: offer.frameId });
  if (offer.energy) lines.push({ kind: 'energy', amount: offer.energy });
  if (offer.freezes) lines.push({ kind: 'freezes', count: offer.freezes });
  if (offer.xpBoosts) lines.push({ kind: 'xpBoost', count: offer.xpBoosts });
  return lines;
}

/** The offer that includes a given exclusive frame, or null. */
export function offerForFrame(offers, frameId) {
  return (offers || []).find((offer) => offer.frameId === frameId) || null;
}
