import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setInitializing(false);
    });

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
  }, [user?.id, loadProfile]);

  /** Re-read the profile after XP, energy or equipped items change. */
  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  /** Apply a local patch immediately, without waiting for a round-trip. */
  const patchProfile = useCallback((changes) => {
    setProfile((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoggedIn, initializing, refreshProfile, patchProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
