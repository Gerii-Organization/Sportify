/**
 * Shared plumbing for local notifications.
 *
 * WHY THE MODULE IS LOADED LAZILY
 *
 * `import * as Notifications from 'expo-notifications'` at the top of a file
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
 * Requiring it inside the functions means the cost is only paid when something
 * actually schedules, and a missing native module degrades to "no
 * notification" instead of a white screen.
 *
 * This module exists because the rest timer and the daily reminders both need
 * the same four steps — load, configure, ask permission, schedule — and having
 * two copies meant a fix to one silently left the other broken.
 */

let notifications = null;
let loadAttempted = false;
let configured = false;
let warned = false;

/**
 * Resolves the module once, or gives up permanently.
 *
 * The probe comes first, and it matters. expo-notifications reaches for the
 * push token manager at import time — `requireNativeModule('ExpoPushTokenManager')`
 * in its PushTokenManager.native.js — and requireNativeModule THROWS. The throw
 * is reported by the native side before this catch ever sees it, so a build
 * without the module printed
 *
 *   ERROR  [Error: Cannot find native module 'ExpoPushTokenManager']
 *
 * next to our own tidy warning. Nothing was broken by it — the catch did its
 * job and the app carried on — but an ERROR in the log reads as a crash.
 *
 * requireOptionalNativeModule is the same lookup that returns null instead of
 * throwing. Asking it first means the package is only imported on a build that
 * can actually support it.
 */
export function load() {
  if (loadAttempted) return notifications;
  loadAttempted = true;

  try {
    // eslint-disable-next-line global-require
    const { requireOptionalNativeModule } = require('expo-modules-core');

    if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
      notifications = null;
      return null;
    }

    // eslint-disable-next-line global-require
    notifications = require('expo-notifications');
  } catch {
    notifications = null;
  }

  return notifications;
}

export function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    '[Sportify] expo-notifications is not linked into this build, so ' +
    'reminders and rest timer alerts will not fire. Rebuild the dev client:\n' +
    '  npx expo run:ios'
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

/**
 * Asks once, and only when something is actually about to be scheduled.
 *
 * Prompting at launch, before the user has met the feature, is how apps train
 * people to hit Deny reflexively.
 */
async function ensurePermission(Notifications) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/**
 * Schedules one notification. Returns its id, or null if anything stopped it —
 * a missing module, a denied permission, a trigger in the past.
 *
 * Callers pass `at` (a Date) or `seconds`, never a raw trigger. expo-notifications
 * 51 changed the trigger shape: a bare `{ seconds }` or `{ date }` now throws
 *
 *   The `trigger` object you provided is invalid. It needs to contain a
 *   `type` or `channelId` entry.
 *
 * and since every call here is wrapped in a catch, getting it wrong would look
 * exactly like a build without the native module — the feature would appear
 * wired and simply never fire. Building the trigger in one place means a call
 * site cannot make that mistake.
 */
export async function schedule({ title, body, at, seconds }) {
  try {
    const Notifications = load();
    if (!Notifications) {
      warnOnce();
      return null;
    }

    // The string literals are the values of Notifications.SchedulableTriggerInputTypes;
    // used directly so the trigger can be built without the enum in scope.
    let trigger;
    if (at instanceof Date) trigger = { type: 'date', date: at };
    else if (typeof seconds === 'number') trigger = { type: 'timeInterval', seconds, repeats: false };
    else return null;

    configure(Notifications);
    if (!(await ensurePermission(Notifications))) return null;

    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger,
    });
  } catch (e) {
    console.warn(`[Sportify] Could not schedule notification: ${e?.message || e}`);
    warnOnce();
    return null;
  }
}

export async function cancel(id) {
  if (!id) return;
  const Notifications = load();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled; nothing to do.
  }
}

/** True when notifications can actually be delivered on this build. */
export const notificationsAvailable = () => load() !== null;
