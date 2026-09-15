import { normaliseUnit, CM_PER_IN } from './units';

/**
 * Tape-measure numbers: which ones, in which unit, and how they have moved
 * (roadmap T6). Stored in centimetres; shown in the unit the profile uses.
 *
 * Changes are reported neutrally — "−2 cm", never green or red. A smaller
 * waist is the goal for one person and a bigger arm for the next, and the app
 * does not know which of them is reading.
 */

export const MEASUREMENTS = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'arm_cm', label: 'Arm' },
  { key: 'thigh_cm', label: 'Thigh' },
];

export const lengthLabel = (unit) => (normaliseUnit(unit) === 'imperial' ? 'in' : 'cm');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(String(value).replace(',', '.'));
};

/** Centimetres to the displayed unit, to the nearest half. */
export function toDisplayLength(cm, unit) {
  const value = toNumber(cm);
  if (!Number.isFinite(value)) return null;
  const shown = normaliseUnit(unit) === 'imperial' ? value / CM_PER_IN : value;
  return Math.round(shown * 2) / 2;
}

/** A typed value (either decimal separator) to centimetres, or null. */
export function fromInputLength(value, unit) {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = normaliseUnit(unit) === 'imperial' ? n * CM_PER_IN : n;
  return Math.round(cm * 10) / 10;
}

/** "+1.5 cm", "−0.5 in", or "no change". */
export function formatChange(cmDelta, unit) {
  const shown = toDisplayLength(Math.abs(Number(cmDelta) || 0), unit);
  if (!shown) return 'no change';
  const sign = Number(cmDelta) > 0 ? '+' : '−';
  return `${sign}${shown} ${lengthLabel(unit)}`;
}

/**
 * Per measurement: the latest value, the first ever, and the change between
 * them, from rows in any order. A row may leave fields blank, so each field
 * finds its own latest and first rather than trusting the latest row.
 */
export function summarise(rows) {
  const sorted = [...(rows || [])].sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)));

  return MEASUREMENTS.map(({ key, label }) => {
    const present = sorted.filter((row) => Number.isFinite(toNumber(row[key])));
    if (!present.length) return { key, label, latest: null, first: null, change: null, since: null, date: null };

    const first = present[0];
    const last = present[present.length - 1];
    return {
      key,
      label,
      latest: Number(last[key]),
      first: Number(first[key]),
      change: present.length > 1 ? Math.round((Number(last[key]) - Number(first[key])) * 10) / 10 : null,
      since: present.length > 1 ? first.measured_on : null,
      date: last.measured_on,
    };
  });
}
