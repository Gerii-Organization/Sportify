/**
 * The countdowns the shop shows.
 *
 * Everything counts to UTC boundaries because the rotation does:
 * `daily_shop_ids()` hashes `(now() at time zone 'utc')::date`. A timer
 * counting to local midnight would be off by the device's offset — in
 * Bucharest it would promise a restock three hours after the items had
 * already changed.
 */

const DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

/** Whole seconds, never negative: a timer that has run out shows zeros, not "-1s". */
const seconds = (ms) => Math.max(0, Math.floor((Number(ms) || 0) / 1000));

/** Until the next 00:00 UTC. At midnight exactly that is a full day, never 0. */
export function msUntilUtcMidnight(now = Date.now()) {
  return (Math.floor(now / DAY) + 1) * DAY - now;
}

/**
 * Until the next Monday 00:00 UTC, when the featured offer turns over.
 *
 * Day 0 of the epoch was a Thursday, so `(day + 3) % 7` is 0 on a Monday. On a
 * Monday itself the answer is the following one — the offer that just started
 * has a week to run, not zero seconds.
 */
export function msUntilUtcMonday(now = Date.now()) {
  const day = Math.floor(now / DAY);
  const weekday = (day + 3) % 7;
  return (day + 7 - weekday) * DAY - now;
}

/** "14:22:05". Hours are not wrapped at 24; callers pass spans under a day. */
export function formatClock(ms) {
  const t = seconds(ms);
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

/** "14h 22m" */
export function formatHoursMinutes(ms) {
  const t = seconds(ms);
  return `${Math.floor(t / 3600)}h ${pad(Math.floor((t % 3600) / 60))}m`;
}

/**
 * "2d 08h", then "08h 12m" once under a day.
 *
 * Two units, always the two largest that are still moving. "2d 08h 12m 05s"
 * is precise and unreadable at a glance, which is the only way anyone reads a
 * badge.
 */
export function formatDaysHours(ms) {
  const t = seconds(ms);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  return d > 0 ? `${d}d ${pad(h)}h` : `${pad(h)}h ${pad(m)}m`;
}
