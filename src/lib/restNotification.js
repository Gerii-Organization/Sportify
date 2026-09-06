import { getSetting } from './settings';

/**
 * A local notification when the rest period ends.
 *
 * Without this the timer is only useful while you are staring at the screen —
 * but people put the phone down between sets.
 *
 * WHY THE MODULE IS LOADED LAZILY
 *
 * `import * as Notifications from 'expo-notifications'` at the top of this file
 * crashes the app on startup with:
 *
 *   Cannot find native module 'ExpoPushTokenManager'
 *
 * The package's entry point reaches for the push-token native module as soon as
 * it is imported, whether or not you ever ask for a push token. On a dev client
 * built before the package was linked, that module does not exist, and the
 * error happens during bundle evaluation — before any screen renders, so there
 * is nothing to catch it.
 *
 * Requiring it inside the functions means the cost is only paid when a rest
 * timer actually starts, and a missing native module degrades to "no
 * notification" instead of a white screen.
 */

let notifications = null;
let loadAttempted = false;
let configured = false;
let warned = false;

/** Resolves the module once, or gives up permanently. */
function load() {
  if (loadAttempted) return notifications;
  loadAttempted = true;
  try {
    // eslint-disable-next-line global-require
    notifications = require('expo-notifications');
  } catch {
    notifications = null;
  }
  return notifications;
}

function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    '[Sportify] expo-notifications is not linked into this build, so rest ' +
    'timer alerts will not fire while the app is in the background. ' +
    'Rebuild the dev client to enable them:\n  npx expo run:ios'
  );
}

function configure(Notifications) {
  if (configured) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  } catch {
    // A handler that fails to register only affects presentation while the app
    // is foregrounded; the notification itself still schedules.
  }
}

/** Returns the scheduled id, or null when nothing was scheduled. */
export async function scheduleRestAlert(seconds) {
  try {
    if (seconds < 1) return null;
    if (!(await getSetting('restAlerts'))) return null;

    const Notifications = load();
    if (!Notifications) {
      warnOnce();
      return null;
    }

    configure(Notifications);

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.', sound: true },
      trigger: { seconds },
    });
  } catch {
    warnOnce();
    return null;
  }
}

/** Cancels a pending alert — the user skipped the rest, or finished early. */
export async function cancelRestAlert(id) {
  if (!id) return;
  const Notifications = load();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled; nothing to do.
  }
}

/** True when alerts can actually be delivered on this build. */
export const notificationsAvailable = () => load() !== null;
