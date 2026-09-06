/**
 * Date helpers.
 *
 * IMPORTANT: `todayKey` deliberately builds the date from local calendar parts
 * rather than `toISOString().split('T')[0]`. Romania is UTC+2/+3, so after
 * ~21:00 local time the ISO string rolls over to tomorrow's date and stats get
 * written to the wrong day. The old code mixed both approaches across screens.
 */

/** Today as `YYYY-MM-DD` in the device's local timezone. */
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local midnight today, as an ISO string — for `gte` queries on timestamps. */
export function startOfTodayIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

/** ISO string for N days ago, for "last 7 days" style queries. */
export function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** The last N calendar days as `YYYY-MM-DD` keys, oldest first. */
export function recentDayKeys(count) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (count - 1 - i));
    return todayKey(d);
  });
}

/** "Monday, Mar 3" — the date line shown in screen headers. */
export function formatHeaderDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** "Today" / "Yesterday" / "3 days ago" / "Mon, Mar 3". */
export function formatRelativeDate(isoString) {
  const d = new Date(isoString);
  const diffDays = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Mon, Mar 3" — no relative wording. */
export function formatShortDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "14:32" */
export function formatClockTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Seconds to "MM:SS" — the workout timer. */
export function formatStopwatch(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Minutes to "7h 30m" — sleep duration. */
export function formatDuration(totalMinutes) {
  const mins = totalMinutes || 0;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Compact timestamp for a chat list: "14:32" today, "Mon" this week, else a
 * date. A conversation list is scanned, not read — the clock time only tells
 * you anything on the day it happened.
 */
export function shortTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const days = Math.floor((now - date) / 86400000);

  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * IANA zone name for this device, e.g. "Europe/Bucharest".
 *
 * Needed whenever the server has to group timestamps into calendar days the
 * same way the app displays them. Hermes ships full ICU, but a stripped build
 * or an old device can return undefined, so UTC is the fallback.
 */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
