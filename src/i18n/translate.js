/**
 * Translation core (roadmap Q1). No React here, so it can be tested in Node.
 *
 * The English text is the key: `t('Workouts')` looks the sentence up in the
 * Romanian dictionary and falls back to the English itself. That makes the
 * change safe to roll out a screen at a time — a string nobody has translated
 * yet shows in English instead of as `workouts.title` — and a dictionary entry
 * reads as the sentence it translates.
 *
 * Placeholders are `{name}`. Plurals pass `count` and use `one` / `other`
 * forms; Romanian also has a "few" form (2–19, and anything ending 01–19
 * after 100) — "2 zile", "20 de zile" — which `plural()` handles.
 */

export const LANGUAGES = ['en', 'ro'];

/** 'ro' for a Romanian locale ("ro", "ro-RO", "ro_MD"), otherwise 'en'. */
export function languageForLocale(locale) {
  const code = String(locale || '').toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.includes(code) ? code : 'en';
}

export function detectLanguage() {
  // Tests pin the language so a machine set to Romanian still sees English.
  const pinned = typeof process !== 'undefined' ? process.env?.SPORTIFY_LANGUAGE : undefined;
  if (LANGUAGES.includes(pinned)) return pinned;
  try {
    return languageForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

/**
 * The plural category for a count.
 *   en: one (1), other
 *   ro: one (1), few (0, 2–19, and n % 100 in 1–19 when n > 100), other ("de" forms)
 */
export function pluralCategory(count, language) {
  const n = Math.abs(Math.round(Number(count) || 0));
  if (language === 'ro') {
    if (n === 1) return 'one';
    const rem = n % 100;
    if (n === 0 || (rem >= 1 && rem <= 19)) return 'few';
    return 'other';
  }
  return n === 1 ? 'one' : 'other';
}

function fill(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (params[key] === undefined ? match : String(params[key])));
}

/**
 * Translates `text` into `language` using `dictionaries[language]`.
 * An entry is a string, or `{ one, few, other }` for plurals keyed by `count`.
 */
export function translate(dictionaries, language, text, params) {
  // English only has entries for plurals; everything else is its own key.
  const entry = dictionaries?.[language]?.[text];
  if (entry === undefined || entry === null) return fill(text, params);
  if (typeof entry === 'string') return fill(entry, params);

  const category = pluralCategory(params?.count, language);
  const form = entry[category] ?? entry.other ?? entry.one ?? text;
  return fill(form, params);
}

/**
 * English plural by count, for the English side of `t` calls:
 *   plural(3, '{count} day', '{count} days') → "3 days"
 * Romanian forms live in the dictionary under the singular English key.
 */
export function englishPlural(count, one, other) {
  return Number(count) === 1 ? one : other;
}
