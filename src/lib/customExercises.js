import { sessionStorage } from './storage';
import { validateCustom, mergeCatalogue, removeById } from './customExerciseRules';
import { EXERCISES, MUSCLES } from '../constants/exercises';

/**
 * Exercises the user added, kept on this device.
 *
 * ON THIS DEVICE is the limitation and it is deliberate for now: syncing them
 * needs a `user_exercises` table, and that migration is not something this
 * build can apply. The SETS still sync — a session snapshot stores the exercise
 * by name, so what you lifted on a custom movement reaches the server, appears
 * in your history, and counts towards records and the split like anything else.
 * Only the name in the picker is local, so a second phone shows the sets but
 * would need the name adding again.
 */

const KEY = 'exercises.custom';

export async function listCustom() {
  try {
    const raw = await sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Presets plus this device's additions. */
export async function listAllExercises() {
  return mergeCatalogue(EXERCISES, await listCustom());
}

/** Returns `{ ok, error, exercise }`. Nothing is written when it is not ok. */
export async function addCustom({ name, muscle }) {
  const custom = await listCustom();
  const result = validateCustom({ name, muscle }, mergeCatalogue(EXERCISES, custom), MUSCLES);
  if (!result.ok) return result;

  try {
    await sessionStorage.setItem(KEY, JSON.stringify([...custom, result.exercise]));
  } catch {
    return { ok: false, error: 'Could not save it on this device.', exercise: null };
  }

  return result;
}

export async function deleteCustom(id) {
  const custom = await listCustom();
  try {
    await sessionStorage.setItem(KEY, JSON.stringify(removeById(custom, id)));
  } catch {
    // Nothing to tell the user: the entry is still there and still usable.
  }
}
