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
