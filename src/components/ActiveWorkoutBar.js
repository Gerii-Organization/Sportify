import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Dumbbell, ChevronRight } from 'lucide-react-native';
import { colors, radius, spacing, TAB_BAR_CLEARANCE } from '../theme';
import { activeSession } from '../lib/pendingWorkouts';
import { navigate, currentRouteName } from '../lib/navigationRef';
import { formatStopwatch } from '../lib/date';
import Press from './Press';

/**
 * The bar that says a workout is still running.
 *
 * Leaving a session used to discard it, so there was nothing to come back to.
 * Now the draft survives, which creates the opposite problem: a workout can be
 * running with no sign of it anywhere, and someone who steps out to answer a
 * message has no way back and no idea the clock is going.
 *
 * The elapsed time is derived from the stored `startedAt` rather than counted
 * up, so it stays correct while the app is suspended — a setInterval stops
 * firing when iOS backgrounds the app, which is exactly when a gym session is
 * in a pocket.
 *
 * Polled rather than pushed: the draft is written by a screen that is not
 * mounted at the same time as this one, so there is no shared state to
 * subscribe to. Once a second, and only while this is on screen.
 *
 * Rendered above the whole stack rather than inside the tabs, so it survives
 * onto pushed screens — records, the streak calendar, a chat. That puts it
 * outside every navigator, which is why it reaches navigation through the
 * container ref rather than `useNavigation`.
 */
export default function ActiveWorkoutBar() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [route, setRoute] = useState(null);

  const refresh = useCallback(async () => {
    setSession(await activeSession());
    setRoute(currentRouteName());
  }, []);

  useEffect(() => {
    refresh();

    const tick = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 1000);

    // Coming back from the background is when the stored time matters most.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { setNow(Date.now()); refresh(); }
    });

    return () => { clearInterval(tick); sub.remove(); };
  }, [refresh]);

  // Nothing to announce on the workout screen itself, and nothing to announce
  // before anyone has signed in.
  if (!session || route === 'WorkoutDetailScreen' || route === 'AuthScreen') return null;

  const elapsed = Math.max(0, Math.round((now - session.startedAt) / 1000));

  // The tab bar only exists on the tab screens. Sitting at the same height
  // above a pushed screen would leave a strip of nothing underneath it.
  const bottom = route === null || route === undefined ? spacing.xl
    : TAB_ROUTES.has(route) ? TAB_BAR_CLEARANCE - 24
    : spacing.xl;

  return (
    <Press
      scale={0.99}
      style={[styles.bar, { bottom }]}
      onPress={() =>
        navigate('WorkoutDetailScreen', {
          // Rebuilt from the draft rather than fetched. The screen's own restore
          // effect puts the sets and the clock back the moment it mounts.
          workout: { id: session.id, name: session.name, exercises: session.exercises },
        })
      }
      accessibilityLabel={`Workout in progress, ${Math.round(elapsed / 60)} minutes. Tap to go back to it.`}
    >
      <View style={styles.glyph}>
        <Dumbbell color={colors.accent} size={17} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {session.name || 'Workout'} in progress
        </Text>
        <Text style={styles.meta}>
          {formatStopwatch(elapsed)} · {session.sets} set{session.sets === 1 ? '' : 's'} done
        </Text>
      </View>

      <ChevronRight color={colors.textMuted} size={18} />
    </Press>
  );
}

/** Screens that have the floating tab bar underneath them. */
const TAB_ROUTES = new Set(['Dashboard', 'Food', 'Training', 'Social', 'Shop', 'MainTabs']);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glyph: {
    width: 32, height: 32, borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
});
