/**
 * Reading the reactions map on a message.
 *
 * Stored as `{"❤️": ["user-id", ...]}` — who reacted, not how many. Counting
 * is trivial from ids; going the other way is not, and a count alone cannot
 * answer "did I already react", which is the thing the UI needs on every
 * render.
 */

/** The emoji offered on a long press. Small on purpose — a grid is a decision. */
export const REACTIONS = ['❤️', '💪', '🔥', '👏', '😂', '😮'];

/** `[{ emoji, count, mine }]`, busiest first, for drawing the row. */
export function summarise(reactions, myId) {
  const map = reactions && typeof reactions === 'object' ? reactions : {};

  return Object.entries(map)
    .map(([emoji, holders]) => {
      const list = Array.isArray(holders) ? holders : [];
      return { emoji, count: list.length, mine: !!myId && list.includes(myId) };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/**
 * The map after you tap one, computed locally so the row reacts to the touch
 * rather than to the round trip. The server recomputes the same thing and its
 * answer replaces this.
 */
export function toggleLocally(reactions, emoji, myId) {
  const map = { ...(reactions && typeof reactions === 'object' ? reactions : {}) };
  const list = Array.isArray(map[emoji]) ? map[emoji] : [];

  const next = list.includes(myId)
    ? list.filter((id) => id !== myId)
    : [...list, myId];

  if (next.length === 0) delete map[emoji];
  else map[emoji] = next;

  return map;
}

/** How many people reacted at all, for a screen reader. */
export function totalReactions(reactions) {
  return summarise(reactions, null).reduce((total, r) => total + r.count, 0);
}
