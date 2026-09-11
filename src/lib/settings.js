import { sessionStorage } from './storage';

/**
 * Small per-device preferences.
 *
 * These belong on the device rather than the profile: whether this phone should
 * buzz when a rest period ends is a property of the phone, not the account.
 *
 * Reads can legitimately come back empty — a fresh install, cleared data, or a
 * build without the native storage module — so every one falls back to the
 * default rather than propagating an error.
 */
const KEYS = {
  restAlerts: 'settings.restAlerts',
  waterReminders: 'settings.waterReminders',
  streakReminders: 'settings.streakReminders',
  units: 'settings.units',
  restSeconds: 'settings.restSeconds',
};

const DEFAULTS = {
  restAlerts: true,
  waterReminders: false,
  streakReminders: true,
  // Metric is what the database stores, so it is also the safe default: a
  // fresh install shows exactly the numbers that are written down.
  units: 'metric',
  // null means "follow the training goal" — the behaviour before this was
  // adjustable, and still the right default for someone who has not thought
  // about it. A number overrides it everywhere.
  restSeconds: null,
};

export async function getSetting(name) {
  try {
    const raw = await sessionStorage.getItem(KEYS[name]);
    if (raw === null || raw === undefined) return DEFAULTS[name];
    return JSON.parse(raw);
  } catch {
    return DEFAULTS[name];
  }
}

export async function setSetting(name, value) {
  try {
    await sessionStorage.setItem(KEYS[name], JSON.stringify(value));
  } catch {
    // A failed write only means the preference does not survive a restart.
  }
}
