/**
 * The rules for a queue of workouts that were finished but never reached the
 * server. Pure — the storage and the network live in pendingWorkouts.js.
 *
 * WHY AT-LEAST-ONCE, NOT EXACTLY-ONCE.
 *
 * `complete_workout` awards XP, energy and the streak. Replaying it twice pays
 * twice. The clean fix is a client-generated id on the row with a unique index,
 * so the second call is a no-op decided by the database — every entry here
 * already carries `client_id` for the day that lands, and the flush sends it.
 *
 * Until then there is one window that cannot be closed from the client: the
 * write succeeds and the response is lost. `looksAlreadyLogged` narrows it by
 * checking the user's recent completions before replaying, but a heuristic is
 * what it is.
 *
 * That trade is deliberate. Losing an hour of logged sets is the worst thing a
 * training app can do; a rare duplicate is an annoyance. Never lose the
 * session.
 */

/** Entries older than this are abandoned rather than replayed forever. */
export const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Give up on an entry after this many failed sends. */
export const MAX_ATTEMPTS = 8;

export function newClientId() {
  return `wc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Wraps a completion payload for the queue. */
export function makeEntry(payload, now = Date.now()) {
  return {
    client_id: newClientId(),
    queued_at: now,
    attempts: 0,
    payload,
  };
}

/**
 * Whether a queued session appears to be on the server already.
 *
 * Matched on the workout it came from plus its duration, among completions
 * recorded at or after the moment it was queued. Volume is not compared: the
 * server recomputes it from the sets, so a rounding difference would make a
 * genuine duplicate look like a new session.
 */
export function looksAlreadyLogged(entry, completions) {
  const workoutId = String(entry?.payload?.p_workout_id ?? '');
  const minutes = Number(entry?.payload?.p_minutes) || 0;

  // A minute of slack: the client rounds elapsed time, and a replay computed at
  // a different moment can land one either side.
  return (completions || []).some((row) => {
    const at = new Date(row.completed_at).getTime();
    if (!Number.isFinite(at) || at < entry.queued_at - 60_000) return false;
    if (String(row.workout_id ?? '') !== workoutId) return false;
    return Math.abs((Number(row.duration_minutes) || 0) - minutes) <= 1;
  });
}

/** Entries worth trying again, oldest first so sessions replay in order. */
export function dueEntries(queue, now = Date.now()) {
  return (queue || [])
    .filter((e) => e && e.payload)
    .filter((e) => now - e.queued_at < MAX_AGE_MS)
    .filter((e) => (e.attempts || 0) < MAX_ATTEMPTS)
    .sort((a, b) => a.queued_at - b.queued_at);
}

/** Entries that will never be sent, so the UI can say so rather than hiding them. */
export function abandonedEntries(queue, now = Date.now()) {
  return (queue || [])
    .filter((e) => e && e.payload)
    .filter((e) => now - e.queued_at >= MAX_AGE_MS || (e.attempts || 0) >= MAX_ATTEMPTS);
}

export function withoutEntry(queue, clientId) {
  return (queue || []).filter((e) => e?.client_id !== clientId);
}

export function withAttempt(queue, clientId, error) {
  return (queue || []).map((e) =>
    e?.client_id === clientId
      ? { ...e, attempts: (e.attempts || 0) + 1, last_error: error || null }
      : e
  );
}

/**
 * A failure that will never succeed on retry, so the entry should be dropped
 * rather than kept forever.
 *
 * Anything else — no network, a 5xx, a timeout — is worth another go.
 */
export function isPermanent(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('violates row-level security') ||
    text.includes('permission denied') ||
    text.includes('does not exist') ||
    text.includes('invalid input syntax')
  );
}
