/**
 * Achievements as ladders: one badge per family, climbing Bronze → Silver → Gold
 * (roadmap G4, see 20260917_achievement_tiers.sql).
 *
 * The rows stay one per tier — that is how the server awards them — and this
 * folds them into families for display. A row without a family (a one-off badge
 * added later) becomes a family of its own, so nothing ever disappears from the
 * screen for lack of a tier.
 */

export const TIERS = ['bronze', 'silver', 'gold'];

export const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

/** Metal colours, muted to sit in the Nocturne palette rather than shine. */
export const TIER_COLORS = { bronze: '#C98E62', silver: '#B9BDCC', gold: '#DEB866' };

const tierRank = (tier) => {
  const i = TIERS.indexOf(tier);
  return i === -1 ? 0 : i;
};

/**
 * `rows` are get_achievement_progress results. Returns families in catalogue
 * order, each:
 *   { family, tiers, earned, next, current, progress, top }
 * where `earned` is the highest unlocked tier row (or null), `next` the first
 * locked one (or null when complete), and `progress` 0–1 toward `next`,
 * measured from the previous threshold so each step fills from empty.
 */
export function groupByFamily(rows) {
  const families = new Map();

  (rows || []).forEach((row) => {
    const key = row.family || row.code;
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(row);
  });

  return [...families.entries()].map(([family, list]) => {
    const tiers = [...list].sort(
      (a, b) => Number(a.threshold) - Number(b.threshold) || tierRank(a.tier) - tierRank(b.tier)
    );
    const unlocked = tiers.filter((t) => t.unlocked_at);
    const earned = unlocked.length ? unlocked[unlocked.length - 1] : null;
    const next = tiers.find((t) => !t.unlocked_at) || null;
    const current = Math.max(0, ...tiers.map((t) => Number(t.current) || 0));

    let progress = 1;
    if (next) {
      const floor = earned ? Number(earned.threshold) || 0 : 0;
      const span = (Number(next.threshold) || 0) - floor;
      progress = span > 0 ? Math.min(1, Math.max(0, (current - floor) / span)) : 0;
    }

    return {
      family,
      tiers,
      earned,
      next,
      current,
      progress,
      // The row whose name and icon represent the family: what you have, or
      // the first thing to aim for.
      top: earned || tiers[0],
      order: Math.min(...tiers.map((t) => Number(t.sort_order) || 0)),
    };
  }).sort((a, b) => a.order - b.order);
}

/** Tier counts for the summary line: unlocked tiers and all tiers. */
export function tierTotals(rows) {
  const list = rows || [];
  return { unlocked: list.filter((r) => r.unlocked_at).length, total: list.length };
}
