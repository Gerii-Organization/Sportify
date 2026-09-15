/**
 * Streak milestones: where you are between the last one you passed and the
 * next one ahead.
 *
 * The rewards come from `streak_milestone_rewards` and what was paid from
 * `streak_milestones` (see 20260917_streak_milestones.sql). Both are read, not
 * assumed: the server decides the numbers, and this only lays them out.
 *
 * A milestone counts as reached when it was claimed, not when the current
 * streak happens to be past it — a claim is permanent, a streak is not. Someone
 * who reached 30 days last spring and is on day 4 now has still earned the
 * 30-day milestone, and the screen should say so.
 */

export function milestoneTrack(rewards, claims, streak) {
  const current = Math.max(0, Math.floor(Number(streak) || 0));
  const claimedDays = new Set((claims || []).map((claim) => Number(claim.days)));

  const list = (rewards || [])
    .map((reward) => ({
      days: Number(reward.days),
      energy: Number(reward.energy) || 0,
      freezes: Number(reward.freezes) || 0,
    }))
    .filter((reward) => reward.days > 0)
    .sort((a, b) => a.days - b.days)
    .map((reward) => ({ ...reward, claimed: claimedDays.has(reward.days) }));

  // The next goal is the first milestone this streak has not passed yet, even
  // if an earlier one was already claimed on a previous run.
  const next = list.find((reward) => reward.days > current) || null;
  const previousDays = list.filter((reward) => reward.days <= current).map((reward) => reward.days).pop() || 0;

  const ratio = next ? (current - previousDays) / (next.days - previousDays) : 1;

  return {
    list,
    next,
    daysToNext: next ? next.days - current : 0,
    ratio: Math.min(1, Math.max(0, ratio)),
    claimedCount: list.filter((reward) => reward.claimed).length,
  };
}

/** "+150 energy · +1 Streak Freeze" for a reward, skipping the zero parts. */
export function describeReward({ energy = 0, freezes = 0 }) {
  const parts = [];
  if (energy > 0) parts.push(`+${energy} energy`);
  if (freezes > 0) parts.push(`+${freezes} Streak Freeze${freezes === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
