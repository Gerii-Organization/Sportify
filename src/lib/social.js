import { supabase } from './supabase';

/**
 * Followers, following and friends.
 *
 * Following is one-way and needs nobody's permission; friendship is mutual and
 * needs accepting. The app only had the second, which forces an athlete with
 * two thousand readers to approve two thousand friend requests before any of
 * them can see a workout.
 *
 * EVERYTHING HERE DEGRADES. The tables and functions arrive with
 * `supabase/migrations/20260912_follows.sql`, and until that is applied the
 * RPCs do not exist. A profile with no follower count is a profile missing a
 * line; a profile that fails to open because a count could not be fetched is a
 * broken screen. So a failure returns zeroes and says so in `available`.
 */

const EMPTY = { followers: 0, following: 0, friends: 0, iFollow: false, available: false };

export async function getSocialCounts(userId) {
  if (!userId) return EMPTY;

  const { data, error } = await supabase.rpc('get_social_counts', { p_user_id: userId });
  if (error || !data) return EMPTY;

  return {
    followers: Number(data.followers) || 0,
    following: Number(data.following) || 0,
    friends: Number(data.friends) || 0,
    iFollow: !!data.i_follow,
    available: true,
  };
}

/**
 * Follows or unfollows, whichever applies, and returns the resulting state.
 *
 * The server decides which: the client's idea of whether it already follows can
 * be stale, and choosing wrong gives either a duplicate-key error or a silent
 * no-op that looks like the button is broken.
 */
export async function toggleFollow(userId) {
  const { data, error } = await supabase.rpc('toggle_follow', { p_user_id: userId });

  if (error) return { ok: false, reason: error.message };
  if (!data?.ok) return { ok: false, reason: data?.reason || 'unknown' };

  return { ok: true, following: !!data.following };
}

export const FOLLOW_ERRORS = {
  self: 'You cannot follow yourself.',
  blocked: 'That is not available.',
  not_signed_in: 'Sign in to follow people.',
};
