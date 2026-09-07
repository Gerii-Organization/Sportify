import { getSetting } from './settings';
import { schedule, cancel } from './notify';
import { sessionStorage } from './storage';

/**
 * The two daily reminders.
 *
 * `streakReminders` and `waterReminders` were declared in lib/settings.js with
 * defaults — streak reminders even defaulted to on — and nothing anywhere read
 * them. The app was claiming a feature it did not have, which is the same
 * problem the dead "Rest timer alerts" toggle had before it was wired up.
 *
 * WHY ONE-SHOTS AND NOT A REPEATING TRIGGER
 *
 * `trigger: { hour, minute, repeats: true }` is less code and would fire every
 * evening whether or not you had already trained. A reminder that nags you
 * about a streak you already extended is worse than no reminder: it proves the
 * app is not paying attention, and people turn the whole category off.
 *
 * A local notification cannot re-check your data at fire time, so instead this
 * reschedules on every app open: cancel what was pending, look at today, and
 * schedule only what still makes sense. The cost is that reminders stop being
 * refreshed if you never open the app — which is exactly when the pending
 * one-shot is still sitting there waiting to fire, so the behaviour holds.
 */

const IDS_KEY = 'reminders.scheduledIds';

/** Water nudges land mid-morning, mid-afternoon and early evening. */
const WATER_HOURS = [11, 15, 19];
const STREAK_HOUR = 19;

async function readIds() {
  try {
    const raw = await sessionStorage.getItem(IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeIds(ids) {
  try {
    await sessionStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {
    // Losing the ids means the next sync cannot cancel these, so they may fire
    // once more than intended. Not worth failing the sync over.
  }
}

/** A Date at the given hour today, local time. */
function todayAt(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Rebuilds both reminders from the current state of the day.
 *
 * Call it after the dashboard has its stats — it needs to know whether you have
 * already trained and how much water you have logged.
 *
 *   trainedToday  boolean
 *   streak        current streak, for the wording
 *   waterMl       today's total
 *   waterGoalMl   the target
 */
export async function syncReminders({ trainedToday, streak, waterMl, waterGoalMl }) {
  // Cancel first, unconditionally. If a setting was just turned off, this is
  // what actually removes the pending notification.
  const previous = await readIds();
  await Promise.all(previous.map(cancel));

  const scheduled = [];
  const now = new Date();

  if (await getSetting('streakReminders')) {
    const at = todayAt(STREAK_HOUR);

    // Nothing to say if you already trained, and no point scheduling a time
    // that has passed — the next app open will handle tomorrow.
    if (!trainedToday && at > now) {
      const id = await schedule({
        title: streak > 0 ? `Keep your ${streak}-day streak` : 'Train today?',
        body: streak > 0
          ? 'You have not trained yet today. A short session keeps it alive.'
          : 'A single workout starts a streak.',
        at,
      });
      if (id) scheduled.push(id);
    }
  }

  if (await getSetting('waterReminders')) {
    const shortfall = (waterGoalMl || 0) - (waterMl || 0);

    if (shortfall > 0) {
      for (const hour of WATER_HOURS) {
        const at = todayAt(hour);
        if (at <= now) continue;

        const id = await schedule({
          title: 'Water',
          body: `${(shortfall / 1000).toFixed(1)}L left to reach today's goal.`,
          at,
        });
        if (id) scheduled.push(id);
      }
    }
  }

  await writeIds(scheduled);
  return scheduled.length;
}
