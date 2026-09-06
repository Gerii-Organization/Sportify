import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Copy, Dumbbell, Trophy, Flame, TrendingUp } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
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
  workout: { icon: Dumbbell, tint: colors.accent, verb: 'trained' },
  achievement: { icon: Trophy, tint: colors.energy, verb: 'unlocked' },
  record: { icon: TrendingUp, tint: colors.streak, verb: 'set a record' },
  streak: { icon: Flame, tint: colors.streak, verb: 'is on a streak' },
};

export default function FeedCard({ event, isMine, onLike, onComment, onCopy, onOpenProfile }) {
  const kind = KINDS[event.kind] || KINDS.workout;
  const Icon = kind.icon;

  const canCopy = event.kind === 'workout' && event.meta?.workout_id && !isMine;
  const likes = Number(event.like_count) || 0;
  const comments = Number(event.comment_count) || 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onOpenProfile}
          activeOpacity={0.7}
          accessibilityLabel={`Open ${event.author_name}'s profile`}
        >
          <Avatar
            profile={{ equipped_avatar: event.author_avatar, xp: event.author_xp }}
            size={40}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {isMine ? 'You' : event.author_name}
            <Text style={styles.verb}> {kind.verb}</Text>
          </Text>
          <Text style={styles.time}>{formatRelativeDate(event.created_at)}</Text>
        </View>

        <View style={[styles.kindChip, { backgroundColor: `${kind.tint}1A` }]}>
          <Icon color={kind.tint} size={16} />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        {event.subtitle ? <Text style={[styles.subtitle, { color: kind.tint }]}>{event.subtitle}</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={onLike}
          activeOpacity={0.7}
          accessibilityLabel={event.liked_by_me ? 'Remove like' : 'Like'}
        >
          <Heart
            color={event.liked_by_me ? colors.danger : colors.textMuted}
            fill={event.liked_by_me ? colors.danger : 'transparent'}
            size={18}
          />
          {likes > 0 && (
            <Text style={[styles.count, event.liked_by_me && { color: colors.danger }]}>{likes}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={onComment}
          activeOpacity={0.7}
          accessibilityLabel="Comments"
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
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 3 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginLeft: 48,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  count: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  copyAction: {
    marginLeft: 'auto',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  copyText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});
