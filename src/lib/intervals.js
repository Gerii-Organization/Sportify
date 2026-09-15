/**
 * Interval timers: EMOM, AMRAP and Tabata as one list of timed segments.
 *
 * All three are the same thing underneath — a sequence of "do this for N
 * seconds" — so they share one clock. A plan is built once from the settings;
 * where you are in it is always computed from how long the timer has been
 * running, never counted down tick by tick. iOS stops JavaScript timers when
 * the phone locks, and a counter would come back from your pocket wrong; the
 * elapsed time does not.
 *
 *   EMOM    one segment per minute (or per interval), N rounds
 *   AMRAP   one long segment; rounds are counted by hand
 *   Tabata  work / rest pairs, N rounds, no rest after the last work
 *
 * Every plan starts with a short "get ready" segment, so tapping Start does not
 * mean the first round has already begun while you put the phone down.
 */

export const MODES = ['emom', 'amrap', 'tabata'];

export const DEFAULTS = {
  emom: { rounds: 10, interval: 60 },
  amrap: { minutes: 12 },
  tabata: { rounds: 8, work: 20, rest: 10 },
};

export const PREP_SECONDS = 10;

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Settings made safe: whole numbers, inside limits a real session would use. */
export function normaliseSettings(mode, settings = {}) {
  const d = DEFAULTS[mode] || DEFAULTS.emom;
  if (mode === 'amrap') return { minutes: clampInt(settings.minutes, 1, 90, d.minutes) };
  if (mode === 'tabata') {
    return {
      rounds: clampInt(settings.rounds, 1, 30, d.rounds),
      work: clampInt(settings.work, 5, 300, d.work),
      rest: clampInt(settings.rest, 0, 300, d.rest),
    };
  }
  return {
    rounds: clampInt(settings.rounds, 1, 60, d.rounds),
    interval: clampInt(settings.interval, 10, 600, d.interval),
  };
}

/** The segments for a mode: `{ kind: 'prep' | 'work' | 'rest', seconds, round }`. */
export function buildPlan(mode, settings) {
  const s = normaliseSettings(mode, settings);
  const plan = [{ kind: 'prep', seconds: PREP_SECONDS, round: 0 }];

  if (mode === 'amrap') {
    plan.push({ kind: 'work', seconds: s.minutes * 60, round: 1 });
    return plan;
  }

  if (mode === 'tabata') {
    for (let round = 1; round <= s.rounds; round += 1) {
      plan.push({ kind: 'work', seconds: s.work, round });
      if (round < s.rounds && s.rest > 0) plan.push({ kind: 'rest', seconds: s.rest, round });
    }
    return plan;
  }

  for (let round = 1; round <= s.rounds; round += 1) {
    plan.push({ kind: 'work', seconds: s.interval, round });
  }
  return plan;
}

export const totalSeconds = (plan) => plan.reduce((sum, segment) => sum + segment.seconds, 0);

/** Rounds in a plan — the highest round number any segment carries. */
export const roundsIn = (plan) => plan.reduce((max, segment) => Math.max(max, segment.round), 0);

/**
 * Where a plan is after `elapsed` seconds.
 *
 * `remaining` counts up to the next whole second, so the display reads 20
 * for the whole first second of a 20-second segment and reaches 0 only when
 * the segment is over — the way a gym clock reads.
 */
export function stateAt(plan, elapsed) {
  const total = totalSeconds(plan);
  const t = Math.max(0, Number(elapsed) || 0);

  if (t >= total) {
    const last = plan[plan.length - 1];
    return { done: true, index: plan.length - 1, segment: last, remaining: 0, progress: 1, round: last.round, totalRemaining: 0 };
  }

  let start = 0;
  for (let index = 0; index < plan.length; index += 1) {
    const segment = plan[index];
    const end = start + segment.seconds;
    if (t < end) {
      return {
        done: false,
        index,
        segment,
        remaining: Math.ceil(end - t),
        progress: (t - start) / segment.seconds,
        round: segment.round,
        totalRemaining: Math.ceil(total - t),
      };
    }
    start = end;
  }
  // Unreachable: t < total guarantees a segment above.
  return stateAt(plan, total);
}

/**
 * Seconds the timer has run, from a clock that can be paused.
 *
 * `clock` is `{ startedAt, pausedAt, pausedMs }` in milliseconds: when it
 * started, when it was paused (null while running), and how long all earlier
 * pauses lasted. Stored like this, a pause survives the app going to the
 * background as well as a running timer does.
 */
export function elapsedOf(clock, now = Date.now()) {
  if (!clock?.startedAt) return 0;
  const end = clock.pausedAt ?? now;
  return Math.max(0, (end - clock.startedAt - (clock.pausedMs || 0)) / 1000);
}

/** "1:05" / "12:00" / "0:09". */
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
