import { supabase } from './supabase';
import { unwrap } from './query';

/**
 * Everyone you are friends with (accepted both ways), as public profiles,
 * sorted by first name.
 *
 * Friendships are stored once per pair with either person in either column, so
 * the other side of each row is whichever id is not yours. Profiles come from
 * public_profiles: the base table is private to its owner.
 *
 * Throws on a failed request so the screen can say so instead of showing an
 * empty list that reads as "you have no friends".
 */
export async function loadFriends(userId) {
  if (!userId) return [];

  const rows = await unwrap(supabase
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`));

  const ids = [...new Set((rows || []).map((row) => (row.user_id === userId ? row.friend_id : row.user_id)))];
  if (!ids.length) return [];

  const profiles = await unwrap(supabase.from('public_profiles').select('*').in('id', ids));
  return (profiles || []).sort((a, b) => String(a.first_name || '').localeCompare(String(b.first_name || '')));
}
