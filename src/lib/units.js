/**
 * Kilograms and pounds, centimetres and feet.
 *
 * ONE RULE: every stored number is metric. The database, the RPCs, the session
 * snapshots, the personal records and the volume totals are all kg and cm, and
 * none of them change. This module converts at the two edges only — what is
 * drawn on screen, and what someone types into a box.
 *
 * Storing the user's unit instead would mean every comparison between two rows
 * has to know which unit each was written in: a record set in lb against a set
 * logged in kg, a leaderboard mixing both. That bug is unfixable once the data
 * exists, so it is designed out rather than guarded against.
 */

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const UNITS = ['metric', 'imperial'];

/**
 * `Number(null)` and `Number('')` are both 0, not NaN.
 *
 * Left to the default coercion an empty weight box stores 0kg and a profile
 * with no height renders 0'0". Absent has to stay absent all the way through.
 */
function toNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'string' && value.trim() === '') return NaN;
  return Number(String(value).replace(',', '.'));
}

/** Anything unrecognised is metric — the app's stored form, and its default. */
export function normaliseUnit(unit) {
  return unit === 'imperial' ? 'imperial' : 'metric';
}

export function weightLabel(unit) {
  return normaliseUnit(unit) === 'imperial' ? 'lb' : 'kg';
}

export function heightLabel(unit) {
  return normaliseUnit(unit) === 'imperial' ? 'in' : 'cm';
}

/**
 * Stored kg to what the user should see.
 *
 * `step` is the smallest increment worth showing. Barbell weight moves in
 * 2.5kg or 5lb jumps, so a plate load resolves to 0.5; body weight is watched
 * in tenths.
 */
export function toDisplayWeight(kg, unit, step = 0.5) {
  const value = toNumber(kg);
  if (!Number.isFinite(value)) return 0;

  const converted = normaliseUnit(unit) === 'imperial' ? value / KG_PER_LB : value;
  return roundTo(converted, step);
}

/**
 * What the user typed, back to kg for storage.
 *
 * Deliberately NOT rounded. Rounding here is what makes a weight drift: type
 * 185lb, store a rounded 83.9, redisplay 184.97, round that to 185.0, type it
 * again and it walks. Full precision in, rounded only on the way out.
 */
export function fromInputWeight(value, unit) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return null;

  return normaliseUnit(unit) === 'imperial' ? number * KG_PER_LB : number;
}

/** "80 kg" / "176.5 lb". `withUnit` off gives the bare number for a big figure. */
export function formatWeight(kg, unit, { step = 0.5, withUnit = true } = {}) {
  const shown = toDisplayWeight(kg, unit, step);
  return withUnit ? `${trimZero(shown)} ${weightLabel(unit)}` : trimZero(shown);
}

export function toDisplayHeight(cm, unit) {
  const value = toNumber(cm);
  if (!Number.isFinite(value)) return 0;

  return normaliseUnit(unit) === 'imperial' ? roundTo(value / CM_PER_IN, 0.5) : Math.round(value);
}

export function fromInputHeight(value, unit) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return null;

  return normaliseUnit(unit) === 'imperial' ? number * CM_PER_IN : number;
}

/** `5'11"` reads better than `71 in` for a person's height. */
export function formatHeight(cm, unit) {
  const value = toNumber(cm);
  if (!Number.isFinite(value)) return '—';

  if (normaliseUnit(unit) !== 'imperial') return `${Math.round(value)} cm`;

  const totalInches = Math.round(value / CM_PER_IN);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function roundTo(value, step) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

/** 80.0 -> "80", 82.5 -> "82.5". Trailing zeroes make a weight look measured. */
function trimZero(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/**
 * A session or a week's total tonnage.
 *
 * "12.4t" is readable where "12420 kg" is not, and a pound gym counts the same
 * way at a different threshold — 1,000lb is not a landmark, so imperial stays
 * in pounds with a thousands separator rather than inventing a short ton.
 */
export function formatVolume(kg, unit) {
  const value = toDisplayWeight(kg, unit, 1);

  if (normaliseUnit(unit) === 'imperial') {
    return `${value.toLocaleString()} lb`;
  }

  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${Math.round(value)} kg`;
}

/**
 * A change in body weight, signed. "+1.2 kg", "-2.6 lb".
 *
 * The delta is converted, not the endpoints: converting each and subtracting
 * rounds twice and can show a change of 0.0 for a real one.
 */
export function formatDelta(kgDelta, unit) {
  const value = toDisplayWeight(kgDelta, unit, 0.1);
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} ${weightLabel(unit)}`;
}

/**
 * A sensible starting unit for someone who has not chosen one.
 *
 * Only three countries use pounds day to day, so the default is metric and the
 * exception is detected rather than asked about. Getting it wrong costs one tap
 * in settings; asking everyone costs a screen in onboarding.
 *
 * `locales` is injected so this can be tested — in the app it comes from
 * `Intl.DateTimeFormat().resolvedOptions().locale` or the device region.
 */
const IMPERIAL_REGIONS = ['US', 'LR', 'MM'];

export function unitForLocale(locale) {
  const text = String(locale || '');
  const region = (text.split(/[-_]/)[1] || '').toUpperCase();
  return IMPERIAL_REGIONS.includes(region) ? 'imperial' : 'metric';
}

/** The device's guess, with every failure falling back to metric. */
export function detectUnit() {
  try {
    return unitForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'metric';
  }
}
