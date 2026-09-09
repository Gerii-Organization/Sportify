import { Platform } from 'react-native';

/**
 * Last night's sleep, read from Apple Health.
 *
 * This used to live inline in DashboardScreen with three bugs, which is why
 * `daily_stats.sleep_minutes` was 0 on all 42 rows while the app told people
 * the figure came from Apple Health.
 *
 * 1. THE WINDOW STARTED AT MIDNIGHT.
 *    It queried today 00:00 → now. Sleep happens across midnight: go to bed at
 *    23:00, wake at 07:00, and the part before midnight is outside the query
 *    entirely. Reading it in the afternoon caught naps and nothing else.
 *
 * 2. EVERY SAMPLE WAS SUMMED.
 *    HealthKit returns overlapping samples for one night — its own docs say so:
 *    "In bed and sleeping samples should overlap, meaning that two (or more)
 *    samples represent a single nights sleep activity." An INBED sample spans
 *    the whole night and ASLEEP/CORE/DEEP/REM samples sit inside it, so adding
 *    them up roughly doubles the total. A watch and a phone both reporting
 *    doubles it again.
 *
 * 3. EVERY FAILURE WAS SILENT.
 *    `catch (e) { }`. react-native-health is a native module, so on a JS bundle
 *    running against a binary built before it was linked there is no data and
 *    no signal — indistinguishable from someone who simply did not sleep.
 */

/** States that count as sleep. INBED is presence, not sleep; AWAKE is neither. */
const ASLEEP_STATES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

let warned = false;

function warnOnce(detail) {
  if (warned) return;
  warned = true;
  console.warn(
    `[Sportify] Sleep sync unavailable: ${detail}. On a dev client this usually ` +
    'means react-native-health is not linked into the build yet:\n  npx expo run:ios'
  );
}

/**
 * Total minutes actually asleep, from a list of HealthKit samples.
 *
 * Overlapping ranges are merged rather than added, so one night reported by
 * both a watch and a phone counts once.
 *
 * Exported for its own sake: it is pure, and it is the part that was wrong.
 */
export function asleepMinutes(samples) {
  const ranges = (samples || [])
    .filter((s) => ASLEEP_STATES.has(String(s?.value || '').toUpperCase()))
    .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);

  if (!ranges.length) return 0;

  let total = 0;
  let [openStart, openEnd] = ranges[0];

  for (let i = 1; i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    if (start <= openEnd) {
      // Overlaps or touches the block being built — extend it.
      openEnd = Math.max(openEnd, end);
    } else {
      total += openEnd - openStart;
      [openStart, openEnd] = [start, end];
    }
  }
  total += openEnd - openStart;

  return Math.round(total / 60000);
}

/**
 * The window a night could fall in: 18:00 yesterday through now.
 *
 * Wide enough for an early bedtime, and it still ends at the present so a nap
 * this afternoon is included in today's figure.
 */
export function lastNightWindow(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

/**
 * Reads last night's sleep. Resolves to minutes, or null when unavailable —
 * wrong platform, module not linked, permission refused, no samples.
 *
 * null and 0 are deliberately different: null means "not known", 0 means
 * "known to be nothing", and only the first should leave the stored value
 * alone.
 */
export async function readSleepMinutes() {
  if (Platform.OS !== 'ios') return null;

  let AppleHealthKit;
  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-health');
    AppleHealthKit = mod?.default ?? mod;
  } catch (e) {
    warnOnce('module could not be loaded');
    return null;
  }

  if (!AppleHealthKit?.initHealthKit || !AppleHealthKit?.Constants) {
    warnOnce('native module is missing');
    return null;
  }

  const permissions = {
    permissions: { read: [AppleHealthKit.Constants.Permissions.SleepAnalysis] },
  };

  return new Promise((resolve) => {
    try {
      AppleHealthKit.initHealthKit(permissions, (initError) => {
        if (initError) {
          warnOnce(`permission not granted (${initError})`);
          return resolve(null);
        }

        AppleHealthKit.getSleepSamples(lastNightWindow(), (queryError, samples) => {
          if (queryError) {
            warnOnce(`query failed (${queryError})`);
            return resolve(null);
          }
          resolve(asleepMinutes(samples));
        });
      });
    } catch (e) {
      warnOnce(e?.message || 'unknown error');
      resolve(null);
    }
  });
}
