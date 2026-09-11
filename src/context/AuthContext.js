import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { flushQueue, pendingCount } from '../lib/pendingWorkouts';
import { getSetting, setSetting } from '../lib/settings';
import { normaliseUnit, detectUnit } from '../lib/units';
import { identify } from '../lib/analytics';

/**
 * Session and profile, resolved once and shared.
 *
 * Before this, every screen called `supabase.auth.getUser()` on focus — 25 call
 * sites in total. That method validates the JWT against the server, so opening
 * the Dashboard fired eight separate network round-trips before any data
 * loaded. Three screens also returned early on the signed-out branch without
 * clearing their loading flag, leaving guests on a spinner forever.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  /** True until the stored session has been read from disk. */
  const [initializing, setInitializing] = useState(true);
  const user = session?.user ?? null;
  const isLoggedIn = !!user;

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session ?? null);
      setInitializing(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadProfile(user?.id);
    identify(user?.id);
  }, [user?.id, loadProfile]);

  /** Re-read the profile after XP, energy or equipped items change. */
  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  /**
   * Which units the user reads in.
   *
   * Held here rather than read per screen because `getSetting` is async and a
   * screen cannot await in render — every weight would flash metric and then
   * correct itself. Read once at startup, shared from above.
   */
  const [units, setUnitsState] = useState('metric');

  useEffect(() => {
    let active = true;
    getSetting('units').then((value) => {
      if (!active) return;
      // Nothing stored yet — a fresh install. Guess from the device region
      // rather than showing everyone a units question in onboarding.
      setUnitsState(value ? normaliseUnit(value) : detectUnit());
    });
    return () => { active = false; };
  }, []);

  const setUnits = useCallback(async (next) => {
    const value = normaliseUnit(next);
    setUnitsState(value);
    await setSetting('units', value);
  }, []);

  /** Sessions finished offline and still waiting to be sent. */
  const [pending, setPending] = useState(0);

  /**
   * Sends anything the gym's dead signal stopped from landing.
   *
   * Here rather than on a screen because it must happen whether or not anyone
   * opens Training, and it needs a user. Runs when a session appears and every
   * time the app comes back to the foreground — the moment a phone is most
   * likely to have found a connection again.
   */
  const syncPending = useCallback(async () => {
    if (!user) return;

    const result = await flushQueue();
    if (setPending) setPending(await pendingCount());

    // XP, energy and the streak all moved on the server during the flush.
    if (result.sent > 0) loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    if (!user) {
      setPending(0);
      return undefined;
    }

    syncPending();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPending();
    });

    return () => subscription.remove();
  }, [user, syncPending]);

  /** Apply a local patch immediately, without waiting for a round-trip. */
  const patchProfile = useCallback((changes) => {
    setProfile((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoggedIn, initializing, refreshProfile, patchProfile, signOut, pendingWorkouts: pending, syncPending, units, setUnits }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
