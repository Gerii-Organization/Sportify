/**
 * Date of birth instead of a typed age.
 *
 * An age typed at sign-up is right for one year at most, and it quietly feeds
 * the calorie target and the heart-rate burn estimate for as long as the
 * account lives. A birth date stays right: the age is worked out from it on the
 * day it is needed, so it moves up on the birthday with nothing to update.
 *
 * Profiles made before birth dates existed have only `age`, which `ageOf` still
 * reads until the person adds a date.
 *
 * Plain functions of their inputs, `today` included, so they test without a
 * clock.
 */

/** Romania's GDPR age of consent; below it the app would need a parent's. */
export const MIN_AGE = 16;
export const MAX_AGE = 100;

/** 'YYYY-MM-DD' for the given parts, or null when they are not a real date. */
export function parseBirthDate({ day, month, year } = {}) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (String(year).length !== 4 || m < 1 || m > 12 || d < 1) return null;

  // Day 0 of the next month is the last day of this one: 31 April and 29
  // February outside a leap year fail here.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return null;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Whole years between a 'YYYY-MM-DD' birth date and `today`. */
export function ageOn(birthDate, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);

  let age = today.getFullYear() - y;
  // Not yet had this year's birthday. Someone born on 29 February counts as a
  // year older on 1 March in a common year.
  const month = today.getMonth() + 1;
  if (month < m || (month === m && today.getDate() < d)) age -= 1;
  return age;
}

/** The age to use for a profile: from its birth date when it has one. */
export function ageOf(profile, today = new Date()) {
  if (profile?.birth_date) {
    const age = ageOn(profile.birth_date, today);
    if (age !== null) return age;
  }
  const typed = parseInt(profile?.age, 10);
  return Number.isFinite(typed) ? typed : null;
}

/** An error message for the three typed parts, or null when they are fine. */
export function birthDateError(parts, today = new Date()) {
  const date = parseBirthDate(parts);
  if (!date) return 'Enter a real date of birth.';

  const age = ageOn(date, today);
  if (age < MIN_AGE) return 'You need to be 16 or older to use Sportify.';
  if (age > MAX_AGE) return 'Check the year you were born.';
  return null;
}

/** 'YYYY-MM-DD' back into the three boxes, for editing. */
export function splitBirthDate(birthDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ''));
  if (!match) return { day: '', month: '', year: '' };
  return { day: match[3], month: match[2], year: match[1] };
}
