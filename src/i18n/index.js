import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../lib/settings';
import { detectLanguage, LANGUAGES } from './translate';
import { t, tIn, currentLanguage, setCurrentLanguage } from './runtime';

export { t };

/**
 * Language for the whole app (roadmap Q1).
 *
 * `useT()` inside components re-renders them when the language changes. The
 * plain `t()` (from ./runtime) is for code that runs outside React and reads
 * the same current language.
 *
 * The preference is 'auto' (follow the phone), 'en' or 'ro', stored on the
 * device like the other display settings.
 */

export const PREFERENCES = ['auto', ...LANGUAGES];

const LanguageContext = createContext({
  language: currentLanguage(),
  preference: 'auto',
  setPreference: () => {},
  t,
});

export function LanguageProvider({ children }) {
  const [preference, setPreferenceState] = useState('auto');
  const [language, setLanguage] = useState(currentLanguage());

  const apply = useCallback((pref) => {
    const next = PREFERENCES.includes(pref) ? pref : 'auto';
    const lang = next === 'auto' ? detectLanguage() : next;
    setCurrentLanguage(lang);
    setPreferenceState(next);
    setLanguage(lang);
    return next;
  }, []);

  useEffect(() => {
    getSetting('language').then((saved) => apply(saved));
  }, [apply]);

  const setPreference = useCallback((pref) => {
    setSetting('language', apply(pref));
  }, [apply]);

  const value = useMemo(() => ({
    language,
    preference,
    setPreference,
    // A new function per language, so memoised children see the change.
    t: (text, params) => tIn(language, text, params),
  }), [language, preference, setPreference]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  return useContext(LanguageContext);
}
