/**
 * Monthly seasons (roadmap G1): the names and countdowns. Points, ranks and
 * prizes are the server's (20260918_seasons.sql).
 */

export const SEASON_PRIZES = [
  { rank: 1, title: 'Season Champion', energy: 1000 },
  { rank: 2, title: 'Season Runner-up', energy: 600 },
  { rank: 3, title: 'Season Podium', energy: 300 },
];

/** "September 2026" from '2026-09-01'. Parsed as UTC so no zone shifts the month. */
export function seasonName(isoDate) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "15 days left", "1 day left", "Ends today". */
export function seasonTimeLeft(endsAt, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/** "#3 of the season" / "Not ranked yet". */
export function rankLine(rank) {
  const n = Number(rank);
  return Number.isFinite(n) && n > 0 ? `#${n} this season` : 'Not ranked yet';
}
