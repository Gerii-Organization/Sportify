import { supabase } from './supabase';

/**
 * Erases the account and everything attached to it.
 *
 * Google Play requires this of any app that lets people create an account, and
 * requires that it actually delete the data rather than deactivate.
 *
 * Two halves, in this order:
 *
 * 1. FILES, through the Storage API. storage.objects carries a protect_delete()
 *    trigger — "Direct deletion from storage tables is not allowed" — so the
 *    SQL function cannot touch them. Left behind, they stay publicly readable
 *    forever in a public bucket, which is the opposite of what was asked for.
 *
 * 2. ROWS, through delete_my_account(). Every table is named there rather than
 *    relying on the foreign keys: nine cascade, nine are ON DELETE NO ACTION
 *    and would abort the delete, and seven have no key to auth.users at all.
 *
 * Files first, because the RPC ends by removing the auth row — after that the
 * session is invalid and the Storage API would refuse.
 */
const BUCKETS = ['workout_covers', 'chat_images'];

export async function deleteAccount(userId) {
  if (!userId) throw new Error('Not signed in.');

  for (const bucket of BUCKETS) {
    // A failed listing must not stop the deletion. Someone asking to be erased
    // should not be blocked by a bucket that happens to be unreachable — the
    // rows are the part that matters, and orphaned files can be swept later.
    try {
      const { data: files } = await supabase.storage.from(bucket).list(userId);
      if (files?.length) {
        await supabase.storage
          .from(bucket)
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (e) {
      console.warn(`[Sportify] Could not clear ${bucket}: ${e?.message || e}`);
    }
  }

  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.reason || 'Deletion failed.');

  // The auth row is gone, so the stored session is now a token for nobody.
  // Clearing it locally is what returns the app to the signed-out state.
  await supabase.auth.signOut();
  return true;
}
