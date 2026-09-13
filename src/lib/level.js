import { levelTiers } from '../theme';

/**
 * XP and level maths.
 *
 * One level costs 100 XP. This formula was previously copy-pasted into five
 * screens, so changing the curve meant editing five files.
 */

export const XP_PER_LEVEL = 100;

/** Level starts at 1, not 0 — a brand new user with 0 XP is level 1. */
export function levelFromXp(xp) {
  return Math.floor((xp || 0) / XP_PER_LEVEL) + 1;
}

/** XP earned inside the current level, 0–99. */
export function xpIntoLevel(xp) {
  return (xp || 0) % XP_PER_LEVEL;
}

/** Progress through the current level as a CSS-style width, e.g. "42%". */
export function levelProgressPercent(xp) {
  return `${xpIntoLevel(xp)}%`;
}

/** Everything a profile card needs, in one call. */
export function levelInfo(xp) {
  const total = xp || 0;
  return {
    total,
    level: levelFromXp(total),
    intoLevel: xpIntoLevel(total),
    percent: levelProgressPercent(total),
  };
}

/** Below the first ring colour. Muted, because it is where everyone starts. */
const ROOKIE = { name: 'Rookie', minLevel: 1, color: '#8C90AA' };

/**
 * The tier a level belongs to, and the one after it.
 *
 * Names and colours come from theme.levelTiers, the ladder the avatar rings
 * already use, so a Gold profile card and a gold avatar ring are the same gold.
 * Returns `{ name, minLevel, color, next: { name, minLevel } | null }`.
 */
export function tierFor(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const ladder = [
    ROOKIE,
    ...[...levelTiers]
      .sort((a, b) => a.minLevel - b.minLevel)
      .map(({ name, minLevel, color }) => ({ name, minLevel, color })),
  ];

  let index = 0;
  ladder.forEach((tier, i) => { if (lvl >= tier.minLevel) index = i; });

  const next = ladder[index + 1];
  return { ...ladder[index], next: next ? { name: next.name, minLevel: next.minLevel } : null };
}
