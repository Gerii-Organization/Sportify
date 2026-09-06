import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '../theme';

/**
 * Pull-to-refresh, wired the same way on every list.
 *
 * The app's whole sync model is "re-fetch when the screen gains focus", which
 * leaves one gap: while you are already looking at a screen there is no way to
 * ask for fresh data. People pull down anyway — it is the most reliable gesture
 * in mobile — and nothing happened.
 *
 * Usage:
 *   const { refreshControl } = useRefresh(fetchData);
 *   <ScrollView refreshControl={refreshControl}>
 *
 * The spinner is themed on both platforms: iOS reads `tintColor`, Android reads
 * `colors` (an array) and `progressBackgroundColor`. Setting only one leaves
 * the other platform with a default grey wheel on a dark screen.
 */
export default function useRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);

  const handle = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      // Always clear, even if the fetch threw — otherwise the spinner sticks
      // and the list looks permanently busy.
      setRefreshing(false);
    }
  }, [onRefresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handle}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.card}
    />
  );

  return { refreshing, refreshControl, refresh: handle };
}
