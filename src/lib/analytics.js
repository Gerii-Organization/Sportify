/**
 * Product analytics, if a key is configured.
 *
 * The questions this exists to answer, once there are real users: how many
 * finish onboarding, how many log a SECOND workout, and where the rest stop.
 * You cannot decide what to build next from store reviews and a hunch.
 *
 * Off by default, and inert with no key — nothing leaves the device until
 * EXPO_PUBLIC_POSTHOG_KEY is set. That is deliberate: turning this on changes
 * what the privacy policy has to say, so it should be a decision rather than a
 * side effect of installing a package.
 *
 * Rules that keep it honest:
 *   - Events are counts, never content. No exercise names, no messages, no
 *     weights, no meals.
 *   - The identifier is the Supabase user id, which is already how the account
 *     is keyed. No advertising id, no device fingerprint.
 *   - Anything with a health meaning stays out entirely.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let client = null;
let loaded = false;

function load() {
  if (loaded) return client;
  loaded = true;

  if (!KEY || __DEV__) return null;

  try {
    // eslint-disable-next-line global-require
    const { PostHog } = require('posthog-react-native');
    client = new PostHog(KEY, { host: HOST });
  } catch {
    client = null;
  }

  return client;
}

/** Names are fixed here so a typo cannot silently create a second event. */
export const EVENTS = {
  signedUp: 'signed_up',
  onboardingFinished: 'onboarding_finished',
  workoutStarted: 'workout_started',
  workoutFinished: 'workout_finished',
  workoutQueuedOffline: 'workout_queued_offline',
  splitChosen: 'split_chosen',
  itemPurchased: 'item_purchased',
};

export function track(event, properties) {
  const posthog = load();
  if (!posthog) return;

  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never be able to break the thing it is measuring.
  }
}

export function identify(userId) {
  const posthog = load();
  if (!posthog || !userId) return;

  try {
    posthog.identify(userId);
  } catch {
    /* ignored, as above */
  }
}

/** True when events are actually going somewhere. */
export const analyticsEnabled = () => load() !== null;
