/**
 * Turns a Supabase result into a value or an exception.
 *
 * supabase-js never throws: a failed request comes back as
 * `{ data: null, error }`. Every screen in this app destructured `{ data }` and
 * dropped the error on the floor, so a dead network produced `data === null`,
 * which each screen then rendered as its empty state. Someone with 33 finished
 * workouts, offline, was told "No finished workouts yet".
 *
 * An empty list and a failed request are different facts and must not render
 * the same. Wrapping a call here makes the failure throw, which is what
 * `useLoad` needs in order to show a retry instead of a lie.
 *
 *   const rows = await unwrap(supabase.from('x').select('*'));
 */
export async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Same, for `supabase.rpc(...)`. Reads better at the call site. */
export const unwrapRpc = unwrap;

/**
 * A failed write, as a sentence for an Alert.
 *
 * Postgres messages ("new row for relation \"profiles\" violates check
 * constraint \"profiles_weight_check\"") were shown to people as they were.
 * The SQLSTATE class says which of three things happened: the value was
 * refused, the row was not yours, or the request never arrived.
 */
export function writeErrorMessage(error) {
  const code = String(error?.code || '');
  if (code.startsWith('22') || code === '23514' || code === '23502') {
    return 'One of the values was not accepted. Check your details and try again.';
  }
  if (code === '42501' || code === 'PGRST301') {
    return 'You do not have permission to do that. Try signing in again.';
  }
  return 'Check your connection and try again.';
}
