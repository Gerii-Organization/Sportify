/**
 * Rules for exercises the user adds themselves.
 *
 * Seventy presets do not cover a gym. Every gym has a machine with a name
 * nobody else uses, and an exercise you cannot name is an exercise you cannot
 * log — so the set never gets recorded and the history has a hole in it.
 *
 * Pure. Where they are kept is customExercises.js.
 *
 * ONE THING TO KNOW: an exercise is identified by NAME everywhere it matters.
 * `get_last_sets`, the personal records and the muscle scoring for the split
 * all match on a lowercased name, because that is what a session snapshot
 * stores. A custom exercise therefore gets history, records and split matching
 * for free — and a name that collides with a preset would silently merge two
 * different movements, which is why one is refused.
 */

export const MAX_NAME = 40;
export const MAX_CUSTOM = 100;

export function normaliseName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

const key = (name) => normaliseName(name).toLowerCase();

/**
 * Checks a proposed exercise. Returns `{ ok, error, exercise }`.
 *
 * `existing` is everything already known — presets and the user's own — so the
 * same name cannot mean two things.
 */
export function validateCustom({ name, muscle }, existing = [], muscles = []) {
  const clean = normaliseName(name);

  if (!clean) return { ok: false, error: 'Give the exercise a name.' };
  if (clean.length > MAX_NAME) {
    return { ok: false, error: `Keep the name under ${MAX_NAME} characters.` };
  }
  if (!muscles.includes(muscle)) {
    return { ok: false, error: 'Pick which muscle group it trains.' };
  }
  if (existing.some((e) => key(e.name) === key(clean))) {
    return { ok: false, error: `"${clean}" already exists.` };
  }
  if (existing.filter((e) => e.custom).length >= MAX_CUSTOM) {
    return { ok: false, error: 'That is as many custom exercises as one list can hold.' };
  }

  return {
    ok: true,
    error: null,
    exercise: {
      id: `custom-${key(clean).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
      name: clean,
      muscle,
      // The generator reads these. Zero means bodyweight, which is the only
      // honest default for a movement the app knows nothing else about — it
      // suggests no load rather than a made-up one.
      ratio: 0,
      upper: false,
      isDb: false,
      cue: null,
      watch: null,
      custom: true,
    },
  };
}

/**
 * Presets plus the user's own, presets first.
 *
 * A custom entry never replaces a preset of the same name: the preset carries a
 * cue and a loading ratio, and losing those to a duplicate would be a downgrade
 * the user did not ask for.
 */
export function mergeCatalogue(presets, custom) {
  const known = new Set((presets || []).map((e) => key(e.name)));
  return [...(presets || []), ...(custom || []).filter((e) => !known.has(key(e.name)))];
}

export function removeById(custom, id) {
  return (custom || []).filter((e) => e.id !== id);
}
