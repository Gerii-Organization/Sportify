import { getSetting } from './settings';
import { schedule, cancel, notificationsAvailable } from './notify';

/**
 * A local notification when the rest period ends.
 *
 * Without this the timer is only useful while you are staring at the screen —
 * but people put the phone down between sets.
 *
 * The lazy module loading and permission handling live in lib/notify.js, shared
 * with the daily reminders.
 */

/** Returns the scheduled id, or null when nothing was scheduled. */
export async function scheduleRestAlert(seconds) {
  if (seconds < 1) return null;
  if (!(await getSetting('restAlerts'))) return null;

  return schedule({
    title: 'Rest over',
    body: 'Time for your next set.',
    seconds,
  });
}

/** Cancels a pending alert — the user skipped the rest, or finished early. */
export const cancelRestAlert = cancel;

export { notificationsAvailable };
