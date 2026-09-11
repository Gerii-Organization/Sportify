import { Platform } from 'react-native';
import { asleepMinutes, lastNightWindow } from './sleep';

export { asleepMinutes, lastNightWindow };

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

/**
 * Writes a finished session back to Apple Health.
 *
 * The integration read sleep and steps and wrote nothing, so a workout logged
 * in Sportify did not exist in the Fitness app — the rings did not close, and
 * anyone checking found a training app that takes and gives nothing back.
 *
 * Best-effort by design. It resolves false rather than throwing on every
 * failure path — wrong platform, module not linked, permission refused, write
 * rejected — because the session is already saved on the server by the time
 * this runs. A HealthKit refusal must never look like a lost workout.
 */
export async function saveWorkoutToHealth({ minutes, startedAt }) {
  if (Platform.OS !== 'ios') return false;

  const duration = Number(minutes);
  if (!Number.isFinite(duration) || duration <= 0) return false;

  let AppleHealthKit;
  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-health');
    AppleHealthKit = mod?.default ?? mod;
  } catch {
    warnOnce('module could not be loaded');
    return false;
  }

  if (!AppleHealthKit?.initHealthKit || !AppleHealthKit?.saveWorkout || !AppleHealthKit?.Constants) {
    warnOnce('native module is missing');
    return false;
  }

  const { Permissions, Activities } = AppleHealthKit.Constants;

  const permissions = {
    permissions: {
      read: [Permissions.SleepAnalysis],
      write: [Permissions.Workout],
    },
  };

  const end = startedAt ? new Date(new Date(startedAt).getTime() + duration * 60_000) : new Date();
  const start = new Date(end.getTime() - duration * 60_000);

  return new Promise((resolve) => {
    try {
      AppleHealthKit.initHealthKit(permissions, (initError) => {
        if (initError) {
          warnOnce(`write permission not granted (${initError})`);
          return resolve(false);
        }

        AppleHealthKit.saveWorkout(
          {
            // Traditional strength training is what this app records. Apple has
            // no "gym session" type, and picking something vaguer would put the
            // minutes in the wrong place in the Fitness app.
            type: Activities?.TraditionalStrengthTraining || 'TraditionalStrengthTraining',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            // No energy figure. The app has no heart rate, so any number would
            // be a guess — and once it is in Health it reads as a measurement.
          },
          (saveError) => {
            if (saveError) {
              warnOnce(`workout not written (${saveError})`);
              return resolve(false);
            }
            resolve(true);
          }
        );
      });
    } catch (e) {
      warnOnce(e?.message || 'unknown error');
      resolve(false);
    }
  });
}
