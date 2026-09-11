import { sessionStorage, isPersistent } from './storage';
import { supabase } from './supabase';
import {
  makeEntry, dueEntries, abandonedEntries, withoutEntry, withAttempt,
  looksAlreadyLogged, isPermanent,
} from './pendingQueue';

/**
 * Workouts that were finished while the phone had no usable connection.
 *
 * Gyms are basements. Before this, a failed `complete_workout` left the sets on
 * screen with an alert and nothing else: close the app and an hour of logging
 * was gone. The RPC now falls through to here, and the session is replayed the
 * next time the app can reach the server.
 *
 * Two separate things are stored:
 *
 *   DRAFT — the workout you are in the middle of. Written on every set you tick
 *   so a crash or a force-quit mid-session does not cost you the sets already
 *   done.
 *
 *   QUEUE — sessions that are finished and unsent. Replayed in the order they
 *   happened, because the streak and the split cursor both read the sequence.
 *
 * Everything degrades to memory when AsyncStorage is not linked, which means it
 * survives a crash but not a kill. `isPersistent()` says which you have.
 */

const DRAFT_KEY = 'pending.draft';
const QUEUE_KEY = 'pending.queue';

async function readJson(key, fallback) {
  try {
    const raw = await sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    // A corrupt value is worse than none: returning the fallback means the next
    // write replaces it rather than the app failing to start every time.
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---- the session in progress -------------------------------------------

/** Stores the workout you are part-way through. Cheap; call it freely. */
export function saveDraft(draft) {
  return writeJson(DRAFT_KEY, { saved_at: Date.now(), draft });
}

/** The unfinished workout, or null. */
export async function loadDraft() {
  const stored = await readJson(DRAFT_KEY, null);
  return stored?.draft ?? null;
}

export function clearDraft() {
  return sessionStorage.removeItem(DRAFT_KEY).catch(() => {});
}

/**
 * The session that is still running, if there is one.
 *
 * Returns `{ id, name, startedAt, sets }` or null. Used by the bar that sits
 * over the tab bar: leaving a workout to check a message should not end it, so
 * something has to say it is still going and offer the way back.
 *
 * A draft with no ticked set is not "in progress" — it is a workout that was
 * opened and abandoned, and a bar counting up from it would be nagging about
 * something the user never started.
 */
export async function activeSession() {
  const draft = await loadDraft();
  if (!draft?.id) return null;

  const sets = (draft.exercises || []).reduce(
    (total, ex) => total + (ex.sets || []).filter((set) => set.completed).length,
    0
  );
  if (sets === 0) return null;

  return {
    id: draft.id,
    name: draft.name || null,
    startedAt: draft.startedAt || Date.now(),
    sets,
    // Carried so the way back needs no query. WorkoutDetailScreen takes a
    // workout object rather than an id, and a fetch here would add a way for
    // "resume" to fail at the one moment it must not.
    exercises: draft.exercises || [],
  };
}

// ---- finished, unsent ---------------------------------------------------

export async function readQueue() {
  const queue = await readJson(QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

/**
 * Takes a completion the server refused and keeps it.
 *
 * Returns the entry, so the caller can tell the user their session is safe
 * rather than lost.
 */
export async function queueCompletion(payload) {
  const entry = makeEntry(payload);
  const queue = await readQueue();
  await writeJson(QUEUE_KEY, [...queue, entry]);
  return entry;
}

/** How many sessions are waiting, for a badge or a line of copy. */
export async function pendingCount() {
  return dueEntries(await readQueue()).length;
}

/**
 * Sends everything waiting.
 *
 * Returns `{ sent, skipped, failed, abandoned }`. Safe to call often — it exits
 * immediately when the queue is empty, and a flush already running is not
 * started twice.
 */
let flushing = false;

export async function flushQueue() {
  if (flushing) return { sent: 0, skipped: 0, failed: 0, abandoned: 0, busy: true };

  let queue = await readQueue();
  const due = dueEntries(queue);
  if (due.length === 0) return { sent: 0, skipped: 0, failed: 0, abandoned: abandonedEntries(queue).length };

  flushing = true;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // One read for the whole flush. Every entry is checked against it, so a
    // session already on the server is not paid for twice.
    const recent = await recentCompletions(due[0].queued_at);

    for (const entry of due) {
      if (recent && looksAlreadyLogged(entry, recent)) {
        queue = withoutEntry(queue, entry.client_id);
        skipped += 1;
        continue;
      }

      const { data, error } = await supabase.rpc('complete_workout', {
        ...entry.payload,
        // Ignored by the current function; here so the server can start
        // enforcing exactly-once without a client release.
        p_client_id: entry.client_id,
      });

      if (!error && data?.ok) {
        queue = withoutEntry(queue, entry.client_id);
        sent += 1;
        continue;
      }

      const message = error?.message || data?.reason || 'unknown';

      if (isPermanent(message)) {
        // It will fail the same way forever. Keeping it would mean retrying on
        // every app open until the queue is manually cleared.
        queue = withoutEntry(queue, entry.client_id);
        failed += 1;
        console.warn(`[Sportify] Dropped an unsendable workout: ${message}`);
        continue;
      }

      queue = withAttempt(queue, entry.client_id, message);
      failed += 1;
      // Stop at the first retryable failure: the rest will almost certainly hit
      // the same wall, and replaying out of order would move the streak
      // backwards.
      break;
    }
  } finally {
    await writeJson(QUEUE_KEY, queue);
    flushing = false;
  }

  return { sent, skipped, failed, abandoned: abandonedEntries(queue).length };
}

/**
 * The user's completions since the oldest queued session.
 *
 * Returns null when the read itself fails — which must not be read as "nothing
 * is logged", or every queued session would be sent again.
 */
async function recentCompletions(since) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('workout_completions')
    .select('workout_id, duration_minutes, completed_at')
    .eq('user_id', user.id)
    .gte('completed_at', new Date(since - 60_000).toISOString());

  if (error) return null;
  return data || [];
}

/** Whether a queued session would survive the app being closed. */
export const queueSurvivesRestart = isPersistent;
