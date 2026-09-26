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

/**
 * What Apple Health measured during a workout: active energy (usually from an
 * Apple Watch) and heart-rate samples, for lib/energy.js to choose from.
 *
 * Reading only. The workout written by saveWorkoutToHealth still carries no
 * energy figure: if a watch recorded one, Health already has it, and writing
 * it again would count the session twice in the Fitness app.
 *
 * Resolves `{ activeKcal, heartRates }` with nulls/empties for anything
 * unavailable — wrong platform, module missing, permission refused.
 */
export async function readWorkoutEnergy({ start, end }) {
  const empty = { activeKcal: null, heartRates: [] };
  if (Platform.OS === 'android') return readHealthConnectEnergy({ start, end });
  if (Platform.OS !== 'ios') return empty;

  let AppleHealthKit;
  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-health');
    AppleHealthKit = mod?.default ?? mod;
  } catch {
    return empty;
  }
  if (!AppleHealthKit?.initHealthKit || !AppleHealthKit?.Constants) return empty;

  const { Permissions } = AppleHealthKit.Constants;
  const permissions = {
    permissions: {
      read: [Permissions.SleepAnalysis, Permissions.ActiveEnergyBurned, Permissions.HeartRate].filter(Boolean),
      write: [Permissions.Workout].filter(Boolean),
    },
  };
  const range = { startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString() };

  const query = (method, options) => new Promise((resolve) => {
    if (typeof AppleHealthKit[method] !== 'function') return resolve([]);
    try {
      AppleHealthKit[method](options, (error, results) => resolve(error ? [] : results || []));
    } catch {
      resolve([]);
    }
  });

  return new Promise((resolve) => {
    try {
      AppleHealthKit.initHealthKit(permissions, async (initError) => {
        if (initError) return resolve(empty);
        const [energy, heart] = await Promise.all([
          query('getActiveEnergyBurned', range),
          query('getHeartRateSamples', { ...range, ascending: true, limit: 2000 }),
        ]);
        const kcal = energy.map((s) => Number(s.value)).filter((v) => Number.isFinite(v) && v >= 0);
        resolve({ activeKcal: kcal.length ? kcal.reduce((a, b) => a + b, 0) : null, heartRates: heart });
      });
    } catch {
      resolve(empty);
    }
  });
}

/**
 * The Android side of readWorkoutEnergy: Health Connect.
 *
 * Loaded only here, only on Android. react-native-health-connect looks its
 * native module up the moment it is imported (TurboModuleRegistry.getEnforcing,
 * evaluated for every platform), so a top-level import would crash the iOS app
 * and any Android build made before the package was added.
 *
 * Same contract as the HealthKit path: `{ activeKcal, heartRates }`, where
 * heart rates are `{ value, startDate }` so lib/energy.js reads both platforms
 * the same way. Anything unavailable — no Health Connect app, permission
 * refused, old binary — resolves to nulls.
 */
async function readHealthConnectEnergy({ start, end }) {
  const empty = { activeKcal: null, heartRates: [] };
  let HC;
  try {
    // eslint-disable-next-line global-require
    HC = require('react-native-health-connect');
  } catch {
    return empty;
  }

  try {
    // 3 = SDK_AVAILABLE. Anything else means Health Connect is missing or
    // needs an update, and asking for permission would only show an error.
    if ((await HC.getSdkStatus()) !== 3) return empty;
    if (!(await HC.initialize())) return empty;

    const granted = await HC.requestPermission([
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    const can = (recordType) => (granted || []).some((p) => p.recordType === recordType && p.accessType === 'read');

    const timeRangeFilter = {
      operator: 'between',
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
    };

    const [calories, heart] = await Promise.all([
      can('ActiveCaloriesBurned') ? HC.readRecords('ActiveCaloriesBurned', { timeRangeFilter }) : { records: [] },
      can('HeartRate') ? HC.readRecords('HeartRate', { timeRangeFilter, ascendingOrder: true }) : { records: [] },
    ]);

    const kcal = (calories?.records || [])
      .map((r) => Number(r.energy?.inKilocalories))
      .filter((v) => Number.isFinite(v) && v >= 0);

    const heartRates = (heart?.records || []).flatMap((r) =>
      (r.samples || []).map((sample) => ({ value: sample.beatsPerMinute, startDate: sample.time }))
    );

    return { activeKcal: kcal.length ? kcal.reduce((a, b) => a + b, 0) : null, heartRates };
  } catch {
    return empty;
  }
}
