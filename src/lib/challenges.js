/**
 * Challenges between friends (roadmap S1): the words and the ordering. Scores,
 * winners and payouts are the server's (20260918_challenges.sql).
 */

export const WINNER_BONUS = 300;
export const PARTICIPANT_BONUS = 50;

export const METRICS = {
  days: { label: 'Days trained', short: 'days', defaultTitle: 'Most days trained' },
  minutes: { label: 'Minutes trained', short: 'min', defaultTitle: 'Most minutes trained' },
};

export const DURATIONS = [3, 7, 14];

/** "12 min" / "4 days" / "1 day". */
export function formatScore(score, metric) {
  const n = Math.round(Number(score) || 0);
  if (metric === 'minutes') return `${n} min`;
  return `${n} day${n === 1 ? '' : 's'}`;
}

/** "3d 4h left", "5h left", "Ends in a moment", or "Ended". */
export function timeLeft(endsAt, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'Ends in a moment';
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h left`;
}

/**
 * Participants in display order with ranks: those who joined, highest score
 * first, ties sharing a rank (1, 1, 3); then the invited, who have no rank yet.
 * Declined participants are left out.
 */
export function standings(participants) {
  const joined = (participants || [])
    .filter((p) => p.status === 'joined')
    .map((p) => ({ ...p, score: Number(p.score) || 0 }))
    .sort((a, b) => b.score - a.score || String(a.first_name || '').localeCompare(String(b.first_name || '')));

  let rank = 0;
  let previous = null;
  const ranked = joined.map((p, i) => {
    if (p.score !== previous) {
      rank = i + 1;
      previous = p.score;
    }
    return { ...p, rank };
  });

  const invited = (participants || []).filter((p) => p.status === 'invited').map((p) => ({ ...p, rank: null }));
  const top = ranked.length ? ranked[0].score : 0;
  return { rows: [...ranked, ...invited], top };
}

/** The winners of a settled challenge — everyone sharing the top score, if above zero. */
export function winners(participants) {
  const { rows, top } = standings(participants);
  if (top <= 0) return [];
  return rows.filter((p) => p.rank === 1);
}

export const CREATE_ERRORS = {
  no_friends: 'Pick at least one friend to challenge.',
  too_many_friends: 'A challenge can have up to ten friends.',
  too_many_active: 'You already have three challenges running. Wait for one to end.',
  bad_title: 'Give the challenge a name of 3 to 60 characters.',
  bad_length: 'Pick how long the challenge lasts.',
  bad_metric: 'Pick what the challenge counts.',
};
