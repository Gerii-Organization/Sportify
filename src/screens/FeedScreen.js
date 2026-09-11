import { useState, useCallback } from 'react';
import {
  FlatList, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
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
import { SkeletonRows } from '../components/Skeleton';
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
export default function FeedScreen({ embedded = false }) {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const data = await unwrap(supabase.rpc('get_feed', { p_limit: PAGE_SIZE, p_before: null }));
      setEvents(data || []);
      setExhausted((data?.length || 0) < PAGE_SIZE);
    } catch (e) {
      // Without this the feed rendered "Nothing here yet" on a dead network,
      // which reads as "none of your friends did anything" — a claim about
      // other people, made from a failed request.
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
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
    if (!workoutId) return;

    const { data, error } = await supabase.rpc('copy_workout', { p_workout_id: workoutId });

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
      'Added to your workouts',
      `"${data.name}" is now in your list, with the sets cleared so you can log your own.`,
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Open it', onPress: () => navigation.navigate('Training') },
      ]
    );
  };

  const content = (
    <>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <SkeletonRows count={5} />
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
              <EmptyState
                icon={<Users color={colors.textFaint} size={44} />}
                title="Nothing here yet"
                message="Finish a workout, or add a few friends — everything you and they do shows up here."
                actionLabel="Find friends"
                onAction={() => navigation.navigate('Social')}
              />
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
          onPosted={(eventId) =>
            setEvents((prev) =>
              prev.map((e) =>
                e.id === eventId ? { ...e, comment_count: Number(e.comment_count) + 1 } : e
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
