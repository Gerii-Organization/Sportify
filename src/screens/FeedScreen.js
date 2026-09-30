import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FlatList, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Users } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import useRefresh from '../lib/useRefresh';
import ScreenHeader from '../components/ScreenHeader';
import AmbientGlow from '../components/AmbientGlow';
import { unwrap } from '../lib/query';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { SkeletonFeed } from '../components/Skeleton';
import FeedCard from '../components/FeedCard';
import CommentSheet from '../components/CommentSheet';

/**
 * Activity from you and your friends.
 *
 * Nothing here is posted by hand. Finishing a workout, unlocking an achievement
 * or setting a personal record writes a row through a database trigger, so the
 * feed fills itself as people train — the app never has to remember to post.
 */
const PAGE_SIZE = 20;

/**
 * `embedded` drops the screen's own background and title so it can render as a
 * panel inside Social, which now owns both halves of "other people".
 */
export default function FeedScreen({ embedded = false, reloadKey = 0, onFindFriends }) {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [error, setError] = useState(null);
  /** What is on screen, for the reload to merge into without a stale closure. */
  const shown = useRef([]);
  useEffect(() => { shown.current = events; }, [events]);
  /** Events with a like or unlike still on its way; a second tap waits. */
  const liking = useRef(new Set());
  const copying = useRef(false);

  const load = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const fresh = (await unwrap(supabase.rpc('get_feed', { p_limit: PAGE_SIZE, p_before: null }))) || [];
      const prev = shown.current;

      if (fresh.length === PAGE_SIZE && prev.length > fresh.length) {
        // Coming back from a profile reloads the first page. Replacing the
        // list with it threw away every page scrolled through and yanked the
        // list up; now the newest page is refreshed and the older ones stay.
        const ids = new Set(fresh.map((e) => e.id));
        const oldest = Date.parse(fresh[fresh.length - 1].created_at);
        setEvents([...fresh, ...prev.filter((e) => !ids.has(e.id) && Date.parse(e.created_at) < oldest)]);
      } else {
        setEvents(fresh);
        setExhausted(fresh.length < PAGE_SIZE);
      }
    } catch (e) {
      // Without this the feed rendered "Nothing here yet" on a dead network,
      // which reads as "none of your friends did anything" — a claim about
      // other people, made from a failed request. A background reload that
      // fails with the feed already on screen leaves it there instead.
      if (shown.current.length === 0) setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Bumped by the composer after a post lands, so the new entry appears
  // without waiting for the screen to be left and come back.
  useEffect(() => { if (reloadKey) load(); }, [reloadKey, load]);
  const { refreshControl } = useRefresh(load);

  /** Cursor paging on created_at — stable even as new events arrive on top. */
  const loadMore = async () => {
    if (loadingMore || exhausted || events.length === 0) return;
    setLoadingMore(true);

    try {
      const data = await unwrap(supabase.rpc('get_feed', {
        p_limit: PAGE_SIZE,
        p_before: events[events.length - 1].created_at,
      }));

      setEvents((prev) => [...prev, ...(data || [])]);
      setExhausted((data?.length || 0) < PAGE_SIZE);
    } catch {
      // Deliberately quiet, and deliberately NOT setting `exhausted`: a page
      // that failed is a page to retry on the next scroll, not the end of the
      // feed. What is already on screen stays.
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Likes update on screen before the write lands. A like is trivial to undo
   * and the round trip is long enough to feel broken otherwise.
   */
  const toggleLike = async (event) => {
    if (!user || liking.current.has(event.id)) return;
    liking.current.add(event.id);
    const liked = event.liked_by_me;

    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? { ...e, liked_by_me: !liked, like_count: Number(e.like_count) + (liked ? -1 : 1) }
          : e
      )
    );

    const query = supabase.from('feed_likes');
    const { error } = liked
      ? await query.delete().eq('event_id', event.id).eq('user_id', user.id)
      : await query.insert({ event_id: event.id, user_id: user.id });
    liking.current.delete(event.id);

    // Put it back if the server disagreed.
    if (error) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, liked_by_me: liked, like_count: Number(e.like_count) + (liked ? 1 : -1) }
            : e
        )
      );
    }
  };

  const copyWorkout = async (event) => {
    const workoutId = event.meta?.workout_id;
    // A second tap while the first is on its way made a second copy.
    if (!workoutId || copying.current) return;

    copying.current = true;
    const { data, error } = await supabase.rpc('copy_workout', { p_workout_id: workoutId });
    copying.current = false;

    if (error || !data?.ok) {
      const reason =
        data?.reason === 'not_found'
          ? 'That workout is no longer available.'
          : data?.reason === 'not_allowed'
          ? 'You can only copy workouts from friends.'
          : 'Could not copy this workout.';
      return Alert.alert('Nothing copied', reason);
    }

    Alert.alert(
      'Added to your routines',
      `"${data.name}" was added to your routines.`,
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Open it', onPress: () => navigation.navigate('Training') },
      ]
    );
  };

  const content = (
    <>
        {error ? (
          <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
        ) : loading ? (
          <SkeletonFeed count={4} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            refreshControl={refreshControl}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <FeedCard
                event={item}
                isMine={item.user_id === user?.id}
                onLike={() => toggleLike(item)}
                onComment={() => setCommentsFor(item)}
                onCopy={() => copyWorkout(item)}
                onOpenProfile={() =>
                  navigation.navigate('PublicProfileScreen', { userId: item.user_id })
                }
              />
            )}
            ListEmptyComponent={
              user ? (
                <EmptyState
                  icon={<Users color={colors.textFaint} size={44} />}
                  title="Nothing here yet"
                  message="Finish a workout or add friends to see activity here."
                  actionLabel="Find friends"
                  onAction={onFindFriends || (() => navigation.navigate('Social'))}
                />
              ) : (
                // A guest was told to finish a workout to fill a feed they
                // could never see.
                <EmptyState
                  icon={<Users color={colors.textFaint} size={44} />}
                  title="See what your friends train"
                  message="Sign in to follow your friends' workouts, records and streaks."
                  actionLabel="Sign in"
                  onAction={() => navigation.navigate('AuthScreen')}
                />
              )
            }
          />
        )}

    </>
  );

  const sheet = (
        <CommentSheet
          event={commentsFor}
          visible={!!commentsFor}
          onClose={() => setCommentsFor(null)}
          currentUserId={user?.id}
          onPosted={(eventId, delta = 1) =>
            setEvents((prev) =>
              prev.map((e) =>
                e.id === eventId ? { ...e, comment_count: Math.max(0, Number(e.comment_count) + delta) } : e
              )
            )
          }
        />
  );

  if (embedded) return <>{content}{sheet}</>;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={260} intensity={0.26} />
        <ScreenHeader title="Feed" subtitle="You and your friends" />

        {content}
        {sheet}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 130 },
});
