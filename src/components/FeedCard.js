import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { Heart, MessageCircle, Copy, Dumbbell, Trophy, Flame, TrendingUp } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { PRESS_SPRING } from '../lib/motion';
import { formatRelativeDate } from '../lib/date';
import Avatar from './Avatar';

/**
 * One item in the activity feed.
 *
 * Each kind of event gets its own accent and icon, so the feed is readable by
 * shape before it is read by word — a wall of identical cards is what makes
 * social feeds feel like noise.
 *
 * The action row is deliberately restrained: like and comment always, copy only
 * on a workout that can actually be copied. A row of disabled buttons teaches
 * people to stop looking at the row.
 */
const KINDS = {
  // A post has no verb: "Victor posted Bench felt light today" reads as a
  // report about somebody writing, not as the thing they wrote.
  post: { icon: MessageCircle, tint: colors.textSecondary, verb: '' },
  workout: { icon: Dumbbell, tint: colors.accent, verb: 'trained' },
  achievement: { icon: Trophy, tint: colors.energy, verb: 'unlocked' },
  record: { icon: TrendingUp, tint: colors.streak, verb: 'set a record' },
  streak: { icon: Flame, tint: colors.streak, verb: 'is on a streak' },
};

/** The small buttons are 26pt tall; this brings each touch area to 44. */
const HIT = { top: 9, bottom: 9, left: 8, right: 8 };

/**
 * The heart pops when you like something. Only on the change: a card that
 * scrolls into view already liked stays still.
 */
function LikeHeart({ liked }) {
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (liked) scale.value = withSequence(withSpring(1.35, PRESS_SPRING), withSpring(1, PRESS_SPRING));
  }, [liked, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Heart
        color={liked ? colors.danger : colors.textMuted}
        fill={liked ? colors.danger : 'transparent'}
        size={18}
      />
    </Animated.View>
  );
}

export default function FeedCard({ event, isMine, onLike, onComment, onCopy, onOpenProfile }) {
  const kind = KINDS[event.kind] || KINDS.workout;
  const Icon = kind.icon;
  const isPost = event.kind === 'post';
  const author = event.author_name || 'Athlete';

  const canCopy = event.kind === 'workout' && event.meta?.workout_id && !isMine;
  const likes = Number(event.like_count) || 0;
  const comments = Number(event.comment_count) || 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onOpenProfile}
          activeOpacity={0.7}
          accessibilityLabel={`Open ${author}'s profile`}
        >
          <Avatar
            profile={{ equipped_avatar: event.author_avatar, xp: event.author_xp }}
            size={40}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          {/* The name opens the profile too — it is where people tap. */}
          <Text style={styles.name} numberOfLines={1} onPress={onOpenProfile} suppressHighlighting accessibilityRole="link">
            {isMine ? 'You' : author}
            <Text style={styles.verb}> {kind.verb}</Text>
          </Text>
          <Text style={styles.time}>{formatRelativeDate(event.created_at)}</Text>
        </View>

        <View style={[styles.kindChip, { backgroundColor: `${kind.tint}1A` }]}>
          <Icon color={kind.tint} size={16} />
        </View>
      </View>

      <View style={styles.body}>
        {/* A post is up to 500 characters and was cut to two lines, so most
            of what people wrote could not be read anywhere. It shows in full,
            set as text rather than as a headline. */}
        <Text style={isPost ? styles.postText : styles.title} numberOfLines={isPost ? undefined : 2}>{event.title}</Text>
        {event.subtitle ? <Text style={[styles.subtitle, { color: kind.tint }]}>{event.subtitle}</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={onLike}
          activeOpacity={0.7}
          hitSlop={HIT}
          accessibilityRole="button"
          accessibilityLabel={`Like, ${likes} ${likes === 1 ? 'like' : 'likes'}`}
          accessibilityState={{ selected: !!event.liked_by_me }}
        >
          <LikeHeart liked={!!event.liked_by_me} />
          {likes > 0 && (
            <Text style={[styles.count, event.liked_by_me && { color: colors.danger }]}>{likes}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={onComment}
          activeOpacity={0.7}
          hitSlop={HIT}
          accessibilityRole="button"
          accessibilityLabel={comments ? `Comments, ${comments}` : 'Comment'}
        >
          <MessageCircle color={colors.textMuted} size={18} />
          {comments > 0 && <Text style={styles.count}>{comments}</Text>}
        </TouchableOpacity>

        {canCopy && (
          <TouchableOpacity
            style={[styles.action, styles.copyAction]}
            onPress={onCopy}
            activeOpacity={0.7}
            accessibilityLabel={`Copy ${event.title}`}
          >
            <Copy color={colors.accent} size={16} />
            <Text style={styles.copyText}>Copy workout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  verb: { color: colors.textSecondary, fontWeight: '400' },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  kindChip: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { marginTop: spacing.sm, marginLeft: 48 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  postText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 3 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginLeft: 48,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  count: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  copyAction: {
    marginLeft: 'auto',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  copyText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});
