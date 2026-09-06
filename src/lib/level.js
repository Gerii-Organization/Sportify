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
