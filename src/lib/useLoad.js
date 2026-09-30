import { useState, useEffect, useCallback, useRef } from 'react';
import useRefresh from './useRefresh';

/**
 * Fetch, loading flag, error and pull-to-refresh, in one place.
 *
 * Every data screen repeated the same four pieces: a `data` state, a `loading`
 * state, a `useCallback` loader and a `useEffect` that runs it. None of them
 * kept an error, so a failed request was indistinguishable from an empty
 * result — see the note in lib/query.js.
 *
 * `load` must be memoised by the caller (a `useCallback`), the same contract
 * the screens already follow. It should throw on failure; wrap Supabase calls
 * in `unwrap` from lib/query.js to get that.
 *
 *   const load = useCallback(() => unwrap(supabase.from('x').select('*')), []);
 *   const { data, loading, error, reload, refreshControl } = useLoad(load, []);
 *
 * `initial` is what `data` holds before the first result and after a failure,
 * so a screen can render `data.rows.map(...)` without guarding every field.
 *
 * `keepData`: when the loader changes (a filter, a timeframe), keep showing
 * the last result until the new one lands instead of dropping back to the
 * skeleton. `fetching` is true while that happens, for a screen to dim.
 */
export default function useLoad(load, initial = null, { keepData = false } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  /** Mirrors `error` for `run`, which must not change identity with it. */
  const failed = useRef(false);
  const loadedOnce = useRef(false);

  // Tracks the live request so a slow first response cannot overwrite a fast
  // second one — switching a filter twice used to leave the earlier result on
  // screen whenever it happened to land last.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    // "Try again" cleared the error and showed the screen behind it — empty,
    // since a failure leaves `initial` — until the answer arrived. "Nothing
    // logged yet" for a second, straight after "Something went wrong".
    if (failed.current) setLoading(true);
    failed.current = false;
    setError(null);
    setFetching(true);

    try {
      const result = await load();
      if (!mounted.current || id !== requestId.current) return;
      setData(result);
      loadedOnce.current = true;
    } catch (e) {
      if (!mounted.current || id !== requestId.current) return;
      failed.current = true;
      setError(e?.message || 'Something went wrong.');
    } finally {
      if (mounted.current && id === requestId.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [load]);

  useEffect(() => {
    if (!keepData || !loadedOnce.current) setLoading(true);
    run();
  }, [run, keepData]);

  const { refreshControl } = useRefresh(run);

  return { data, loading, fetching, error, reload: run, refreshControl };
}
