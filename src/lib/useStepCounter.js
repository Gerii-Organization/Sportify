import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { supabase } from './supabase';
import { todayKey } from './date';

/**
 * Today's steps from the phone's motion sensor, saved as they change.
 *
 * Lifted out of DashboardScreen (roadmap Q4) with its behaviour intact. The
 * screen also kept `isPedometerAvailable` and `deviceSteps` in state, but
 * nothing ever read either, so they did not come along: the count reaches the
 * screen through `onSteps` and nowhere else.
 *
 * Where the count starts differs by platform. iOS keeps step history, so it
 * can be asked for "since midnight". Android has no history query —
 * getStepCountAsync rejects there — so it resumes from what was last saved
 * today and counts on while the app is open.
 */

/**
 * One upsert instead of select-then-update-or-insert. The pedometer fires
 * often, so two read-then-writes could interleave, both insert, and the second
 * hit `daily_steps_user_id_record_date_key` — silently stopping the day's saves.
 */
async function saveSteps(userId, steps) {
  if (!userId) return;
  const { error } = await supabase.from('daily_steps').upsert(
    { user_id: userId, record_date: todayKey(), step_count: steps },
    { onConflict: 'user_id,record_date' }
  );
  if (error) console.warn(`[Sportify] Could not save steps: ${error.message}`);
}

export default function useStepCounter(user, onSteps) {
  // Read through a ref so the subscription, set up once, always calls the
  // latest handler rather than the one from the first render.
  const handler = useRef(onSteps);
  handler.current = onSteps;

  useEffect(() => {
    let subscription;
    let cancelled = false;

    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return;

        let baseSteps = 0;
        if (Platform.OS === 'android') {
          const { granted } = await Pedometer.requestPermissionsAsync();
          if (!granted) return;
          if (user?.id) {
            const { data } = await supabase
              .from('daily_steps')
              .select('step_count')
              .eq('user_id', user.id)
              .eq('record_date', todayKey())
              .maybeSingle();
            baseSteps = data?.step_count || 0;
          }
        } else {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const result = await Pedometer.getStepCountAsync(start, new Date());
          baseSteps = result?.steps || 0;
          saveSteps(user?.id, baseSteps);
        }
        if (cancelled) return;
        handler.current?.(baseSteps);

        // watchStepCount reports steps since it subscribed, not since midnight,
        // so the live figure is the starting count plus that.
        subscription = Pedometer.watchStepCount((stepResult) => {
          const updated = baseSteps + (stepResult.steps || 0);
          handler.current?.(updated);
          saveSteps(user?.id, updated);
        });
      } catch {
        // No sensor, no permission, no module: the ring stays at the last
        // saved figure, which is the honest thing to show.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // Once per session, as before: resubscribing on every render would reset
    // the base count mid-walk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
