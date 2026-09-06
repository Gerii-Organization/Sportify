import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * Placeholder blocks shaped like the content that is loading.
 *
 * A centred spinner tells you only that something is happening; a skeleton
 * tells you what is arriving and roughly how much of it, so the screen does not
 * jump when the data lands. It also makes the wait feel shorter, because the
 * layout is already there.
 *
 * The shimmer is a slow opacity pulse rather than a sweeping highlight — it
 * needs no layout work, and it stays quiet enough not to compete with the
 * content that replaces it.
 */
function useShimmer() {
  const value = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.85, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value]);

  return value;
}

export function SkeletonBlock({ width = '100%', height = 16, radius: r = radius.sm, style }) {
  const opacity = useShimmer();
  return <Animated.View style={[styles.block, { width, height, borderRadius: r, opacity }, style]} />;
}

/** A stack of card-shaped placeholders — chats, leaderboard rows, workouts. */
export function SkeletonRows({ count = 5 }) {
  return (
    <View style={styles.rows}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBlock width={46} height={46} radius={23} />
          <View style={styles.rowText}>
            <SkeletonBlock width="55%" height={14} />
            <SkeletonBlock width="35%" height={11} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder for a horizontally scrolling shelf of shop items. */
export function SkeletonShelf({ count = 3 }) {
  return (
    <View style={styles.shelf}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.tile}>
          <SkeletonBlock width={64} height={64} radius={32} />
          <SkeletonBlock width="80%" height={12} style={{ marginTop: 14 }} />
          <SkeletonBlock width="50%" height={10} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceRaised },
  rows: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  rowText: { flex: 1, marginLeft: spacing.md },
  shelf: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  tile: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
});
