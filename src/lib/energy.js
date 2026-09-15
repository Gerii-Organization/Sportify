/**
 * Calories for a finished session, from the best source available (roadmap T7).
 *
 *   1. health       active energy Apple Health already recorded for the time
 *                   of the workout — an Apple Watch measured it
 *   2. heart_rate   heart-rate samples from that window, through the Keytel
 *                   equation (Keytel et al., 2005), which uses sex, weight and
 *                   age with average heart rate
 *   3. estimate     the MET estimate from minutes and bodyweight
 *                   (workoutStats.estimateKcal) — what the app showed before
 *
 * The first is a measurement; the second is a model of a measurement; the third
 * is a guess, and is labelled as one. The source travels with the number so
 * the summary can say which it is.
 */

/** kcal per minute at an average heart rate (Keytel 2005, without VO2max). */
export function keytelKcalPerMinute({ heartRate, weightKg, age, sex }) {
  const hr = Number(heartRate);
  const w = Number(weightKg) || 70;
  const a = Number(age) || 30;
  if (!Number.isFinite(hr)) return null;
  const kj = sex === 'F'
    ? -20.4022 + 0.4472 * hr - 0.1263 * w + 0.074 * a
    : -55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * a;
  return Math.max(0, kj / 4.184);
}

/**
 * Average heart rate over a workout, or null when the samples can't carry it.
 *
 * Needs at least five readings spanning half the session: two readings at the
 * start of a long workout say nothing about the rest of it. Below 80 bpm the
 * wearer was at rest — the equation was fitted on exercise, and at resting
 * rates it returns nonsense — so that is null too.
 */
export function averageHeartRate(samples, { start, end } = {}) {
  const readings = (samples || [])
    .map((s) => ({ value: Number(s.value), at: new Date(s.startDate || s.date || s.endDate).getTime() }))
    .filter((s) => Number.isFinite(s.value) && s.value >= 30 && s.value <= 230 && Number.isFinite(s.at))
    .sort((a, b) => a.at - b.at);

  if (readings.length < 5) return null;

  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
    const span = readings[readings.length - 1].at - readings[0].at;
    if (span < (to - from) / 2) return null;
  }

  const mean = readings.reduce((sum, s) => sum + s.value, 0) / readings.length;
  return mean >= 80 ? Math.round(mean) : null;
}

/** Sum of active-energy samples, in kcal, or null when there were none. */
export function totalActiveEnergy(samples) {
  const values = (samples || []).map((s) => Number(s.value)).filter((v) => Number.isFinite(v) && v >= 0);
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * The number to show and where it came from.
 * `profile` carries sex, weight (kg) and age for the heart-rate equation.
 */
export function pickBurn({ activeKcal, avgHeartRate, minutes, profile, estimateKcal }) {
  if (Number.isFinite(activeKcal) && activeKcal >= 5) {
    return { kcal: Math.round(activeKcal), source: 'health' };
  }

  const perMinute = avgHeartRate
    ? keytelKcalPerMinute({ heartRate: avgHeartRate, weightKg: profile?.weight, age: profile?.age, sex: profile?.sex })
    : null;
  const mins = Number(minutes) || 0;
  if (perMinute && mins > 0) {
    return { kcal: Math.round((perMinute * mins) / 5) * 5, source: 'heart_rate' };
  }

  return { kcal: estimateKcal ?? null, source: 'estimate' };
}

export const BURN_NOTES = {
  health: 'Apple Health',
  heart_rate: 'From heart rate',
  estimate: 'Estimated',
};
