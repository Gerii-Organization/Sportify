/**
 * Crash reporting, if it is configured.
 *
 * Without this a JS error anywhere in the app is a white screen and silence:
 * the user force-quits, leaves a one-star review saying "keeps closing", and
 * there is no stack trace anywhere to act on.
 *
 * Sentry is loaded lazily and only when a DSN is set, so a checkout with no
 * DSN — and every development run — behaves exactly as before. The DSN is not
 * a secret: it only permits sending events, which is why it is safe in
 * EXPO_PUBLIC_.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentry = null;
let loaded = false;

function load() {
  if (loaded) return sentry;
  loaded = true;

  if (!DSN) return null;

  try {
    // eslint-disable-next-line global-require
    const mod = require('@sentry/react-native');
    if (!mod?.init) return null;

    mod.init({
      dsn: DSN,
      // Errors only. Performance tracing on a fitness app is noise, and it is
      // the part of the free quota that runs out first.
      tracesSampleRate: 0,
      // A crash that only happens in development is a crash you are about to
      // fix at your desk; sending it costs quota and tells you nothing.
      enabled: !__DEV__,
      // The screens carry names, weights and messages. None of it belongs in a
      // bug report, and sending it would contradict the privacy policy.
      sendDefaultPii: false,
    });

    sentry = mod;
  } catch {
    sentry = null;
  }

  return sentry;
}

/** Call once, as early as possible. Safe to call when nothing is configured. */
export function initCrashReporting() {
  return load() !== null;
}

/**
 * Reports an error that was caught and handled.
 *
 * `context` is a short string naming where it happened — the screen or the
 * operation — because a stack trace through minified React tells you the
 * component tree and not what the user was doing.
 */
export function reportError(error, context) {
  const client = load();

  if (!client) {
    // Still say it out loud. On a build with no DSN this is the only record.
    console.warn(`[Sportify] ${context || 'error'}:`, error?.message || error);
    return;
  }

  client.withScope((scope) => {
    if (context) scope.setTag('where', context);
    client.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

/** True when reports are actually going somewhere. */
export const crashReportingEnabled = () => load() !== null;
