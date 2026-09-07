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
 */
export default function useLoad(load, initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    setError(null);

    try {
      const result = await load();
      if (!mounted.current || id !== requestId.current) return;
      setData(result);
    } catch (e) {
      if (!mounted.current || id !== requestId.current) return;
      setError(e?.message || 'Something went wrong.');
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    setLoading(true);
    run();
  }, [run]);

  const { refreshControl } = useRefresh(run);

  return { data, loading, error, reload: run, refreshControl };
}
