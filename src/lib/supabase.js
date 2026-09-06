import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from './storage';

const supabaseUrl = 'https://qamkfjdhpxvuqjcqfklm.supabase.co';
const supabaseAnonKey = 'sb_publishable_IIXfXvgUCiDd4_d-CxKx9w_DHMBjU32';

/**
 * React Native has no localStorage, so supabase-js falls back to an in-memory
 * store unless one is supplied. That is why the app signed everyone out on
 * every cold start: the session was never written to disk.
 *
 * The store comes from ./storage rather than importing AsyncStorage directly,
 * so a bundle running on a binary that predates the native module degrades to
 * memory instead of crashing at startup.
 *
 * `detectSessionInUrl` is a browser-only concern and must be off here.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
