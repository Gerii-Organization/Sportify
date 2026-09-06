/**
 * Barcode lookup against Open Food Facts.
 *
 * Why this exists alongside the photo scanner: asking a vision model what is on
 * a plate is impressive but imprecise, and it costs a request every time. A
 * barcode is an exact identifier — the packet already knows its own macros. For
 * anything that comes in a wrapper this is both more accurate and free.
 *
 * Open Food Facts is a public database with no API key and no rate limit worth
 * worrying about at this scale. Coverage is good in Europe and patchy
 * elsewhere, so a miss is a normal outcome, not an error.
 */

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

/** Fields worth asking for — the full record is large and mostly irrelevant. */
const FIELDS = [
  'product_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
].join(',');

/**
 * Looks up a barcode.
 *
 * Returns `{ found: false, reason }` rather than throwing: a product that is
 * not in the database is an ordinary result the UI has to handle, and treating
 * it as an exception would mean wrapping every call site in try/catch.
 */
export async function lookupBarcode(code, { signal } = {}) {
  if (!code || !/^\d{6,14}$/.test(code)) {
    return { found: false, reason: 'invalid_code' };
  }

  let payload;
  try {
    const response = await fetch(`${ENDPOINT}/${code}.json?fields=${FIELDS}`, {
      signal,
      headers: { 'User-Agent': 'Sportify/1.0 (fitness app)' },
    });
    if (!response.ok) return { found: false, reason: 'network' };
    payload = await response.json();
  } catch {
    return { found: false, reason: 'network' };
  }

  if (payload?.status !== 1 || !payload.product) {
    return { found: false, reason: 'not_in_database' };
  }

  return { found: true, product: normalise(payload.product, code) };
}

/**
 * Open Food Facts reports per 100g, and sometimes per serving as well.
 * The app logs whole items, so a serving size is far more useful when the
 * packet declares one; otherwise 100g is the honest default and the UI says so.
 */
function normalise(raw, code) {
  const n = raw.nutriments || {};

  const servingGrams = Number(raw.serving_quantity) || null;
  const basis = servingGrams ? servingGrams / 100 : 1;

  const per100 = {
    calories: pickEnergy(n),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fats: num(n.fat_100g),
  };

  return {
    barcode: code,
    name: [raw.brands?.split(',')[0]?.trim(), raw.product_name].filter(Boolean).join(' ') || 'Unknown product',
    imageUrl: raw.image_front_small_url || null,
    servingLabel: raw.serving_size || (servingGrams ? `${servingGrams} g` : '100 g'),
    /** Scaled to one serving where the packet declares one. */
    calories: Math.round(per100.calories * basis),
    protein: round1(per100.protein * basis),
    carbs: round1(per100.carbs * basis),
    fats: round1(per100.fats * basis),
    per100,
    /** True when the numbers describe 100g because no serving was declared. */
    isPer100g: !servingGrams,
  };
}

/**
 * Energy comes back as kcal on most records and only as kJ on some.
 * 1 kcal = 4.184 kJ.
 */
function pickEnergy(n) {
  const kcal = num(n['energy-kcal_100g']);
  if (kcal) return kcal;
  const kj = num(n.energy_100g);
  return kj ? kj / 4.184 : 0;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round1 = (v) => Math.round(v * 10) / 10;
