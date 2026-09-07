import { supabase } from './supabase';

/**
 * Signs in automatically during development. Never in a release build.
 *
 * Session persistence already works on its own — see lib/storage.js — so this is
 * not what keeps you logged in day to day. It covers the cases a stored session
 * cannot: a fresh install on the simulator, wiped app data, `--clear`, or
 * testing the sign-out flow half a dozen times in a row.
 *
 * Credentials come from `.env`, which is gitignored, so no password is ever
 * written into a tracked file:
 *
 *   EXPO_PUBLIC_DEV_EMAIL=you@example.com
 *   EXPO_PUBLIC_DEV_PASSWORD=...
 *
 * Note that `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time.
 * `__DEV__` is false in a release build, so this branch is dead code and gets
 * stripped — but do not rely on that. Keep these two keys out of whatever
 * environment a production build reads, and there is nothing to inline.
 *
 * THIS FILE IS TEMPORARY. Delete it, and its call in context/AuthContext.js,
 * before shipping.
 */
export async function attemptDevSignIn() {
  if (!__DEV__) return null;

  const email = process.env.EXPO_PUBLIC_DEV_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_PASSWORD;

  if (!email || !password) return null;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // A bad password in .env must not take the app down with it. Warning and
  // carrying on as a guest is the same failure mode as having no .env at all.
  if (error) {
    console.warn(`[Sportify] Dev auto-login failed: ${error.message}`);
    return null;
  }

  console.log(`[Sportify] Dev auto-login as ${email}`);
  return data.session ?? null;
}
