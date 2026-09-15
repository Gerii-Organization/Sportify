import { translate, detectLanguage } from './translate';
import ro from './ro';
import en from './en';

/**
 * The current language and a `t()` for code outside React — advice text,
 * validation messages, alerts built in plain functions.
 *
 * Kept free of React and JSX so the libraries that use it still load under
 * `node --test`. The provider in ./index.js sets the language here whenever it
 * changes; components use `useT()` from there instead, which also re-renders.
 */

const DICTIONARIES = { en, ro };

let current = detectLanguage();

export function currentLanguage() {
  return current;
}

export function setCurrentLanguage(language) {
  current = language;
}

export function t(text, params) {
  return translate(DICTIONARIES, current, text, params);
}

/** t() for an explicit language, for the provider's per-render function. */
export function tIn(language, text, params) {
  return translate(DICTIONARIES, language, text, params);
}
