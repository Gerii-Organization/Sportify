/**
 * The pure half of the Apple Health sleep read.
 *
 * Split out of health.js so it can be tested. health.js imports `Platform`
 * from react-native at the top, which means importing it at all pulls in the
 * whole native resolver — and the merging arithmetic below is precisely the
 * part that was wrong (it reported 24 hours for a 7h45 night by summing
 * overlapping samples). Untestable code is not where that belongs.
 *
 * health.js re-exports both functions, so no call site changed.
 */

/** States that count as sleep. INBED is presence, not sleep; AWAKE is neither. */
const ASLEEP_STATES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

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
