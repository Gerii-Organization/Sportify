/**
 * Session storage for the Supabase client.
 *
 * AsyncStorage is a native module: it only exists once the app has been
 * compiled with it. Importing it from a JS bundle running on an older binary
 * gives you `NativeModule: AsyncStorage is null` and the app dies at startup,
 * before anything renders.
 *
 * That failure mode is worse than the problem it reports. Anyone who pulls the
 * repo and runs `expo start` without rebuilding gets a dead app and an error
 * that looks like a code bug. So the module is loaded defensively: if it is
 * missing we fall back to memory, which means the session lasts until the app
 * closes — degraded, but running.
 *
 * The warning is deliberately loud. A silent fallback here would look like the
 * "logged out on every launch" bug we set out to fix.
 */

let native = null;

try {
  // eslint-disable-next-line global-require
  const mod = require('@react-native-async-storage/async-storage');
  const candidate = mod?.default ?? mod;
  // Presence of the JS wrapper does not prove the native side is linked;
  // calling through it is what throws.
  if (candidate && typeof candidate.getItem === 'function') native = candidate;
} catch {
  native = null;
}

const memory = new Map();

const memoryStorage = {
  getItem: async (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: async (key, value) => { memory.set(key, value); },
  removeItem: async (key) => { memory.delete(key); },
};

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    '[Sportify] AsyncStorage is not linked into this build, so your session ' +
    'will not survive closing the app. Rebuild the dev client to fix it:\n' +
    '  npx expo run:ios'
  );
}

/**
 * Wraps the native module so a runtime failure degrades to memory instead of
 * taking down whatever called it.
 */
export const sessionStorage = {
  async getItem(key) {
    if (!native) { warnOnce(); return memoryStorage.getItem(key); }
    try { return await native.getItem(key); }
    catch { warnOnce(); return memoryStorage.getItem(key); }
  },
  async setItem(key, value) {
    if (!native) { warnOnce(); return memoryStorage.setItem(key, value); }
    try { return await native.setItem(key, value); }
    catch { warnOnce(); return memoryStorage.setItem(key, value); }
  },
  async removeItem(key) {
    if (!native) { warnOnce(); return memoryStorage.removeItem(key); }
    try { return await native.removeItem(key); }
    catch { warnOnce(); return memoryStorage.removeItem(key); }
  },
};

/** True when writes actually reach the disk. */
export const isPersistent = () => native !== null;
