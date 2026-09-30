import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Send, Trash2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { formatRelativeDate } from '../lib/date';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import { SkeletonComments } from './Skeleton';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmDialog';

/**
 * Comments on one feed event.
 *
 * Comments load only when the sheet opens. Fetching them for every card in the
 * list would multiply requests by the length of the feed to show something most
 * people never expand.
 */
export default function CommentSheet({ event, visible, onClose, currentUserId, onPosted }) {
  const { profile } = useAuth();
  const confirmAction = useConfirm();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  /**
   * Bumped on every load. Opening one card's comments and then another's
   * quickly could let the first answer land last, showing A's thread under B.
   */
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!event?.id) return;
    const mine = ++seq.current;
    setLoading(true);
    setFailed(false);

    const { data, error } = await supabase
      .from('feed_comments')
      .select('id, body, created_at, user_id')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });

    if (mine !== seq.current) return;
    if (error) {
      // "No comments yet" on a failed read claimed nobody had said anything.
      setFailed(true);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const authorIds = [...new Set(rows.map((c) => c.user_id))];

    // One profile lookup for every author in the thread, rather than one per
    // comment — the same person usually appears several times.
    let byId = {};
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, first_name, equipped_avatar, xp')
        .in('id', authorIds);
      byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    if (mine !== seq.current) return;
    setComments(rows.map((c) => ({ ...c, author: byId[c.user_id] })));
    setLoading(false);
  }, [event?.id]);

  useEffect(() => {
    if (visible) {
      setDraft('');
      load();
    }
  }, [visible, load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from('feed_comments')
      .insert({ event_id: event.id, user_id: currentUserId, body })
      .select('id, body, created_at, user_id')
      .single();
    setSending(false);

    if (error) {
      // It used to fail in silence, the words still in the box and no sign
      // that nothing had been posted.
      Alert.alert('Comment not posted', 'Check your connection and try again.');
      return;
    }

    // The author is you, already known — no need to re-read the thread and
    // flash the skeleton over it.
    setComments((prev) => [...prev, { ...data, author: profile }]);
    setDraft('');
    onPosted?.(event.id);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  /** Your own comments only — long-press, asked first. */
  const removeComment = async (comment) => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Trash2,
      title: 'Delete this comment?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    const { error } = await supabase.from('feed_comments').delete().eq('id', comment.id);
    if (error) {
      setComments((prev) => [...prev, comment].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
      Alert.alert('Could not delete the comment', 'Check your connection and try again.');
      return;
    }
    onPosted?.(event.id, -1);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={event?.title}>
      <ScrollView ref={listRef} style={styles.list} keyboardShouldPersistTaps="handled">
        {loading ? (
          <SkeletonComments count={3} />
        ) : failed ? (
          <View style={styles.failed}>
            <Text style={styles.empty}>Comments could not be loaded.</Text>
            <TouchableOpacity onPress={load} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : comments.length === 0 ? (
          <Text style={styles.empty}>No comments yet. Be the first.</Text>
        ) : (
          comments.map((comment) => {
            const mine = comment.user_id === currentUserId;
            // Only your own comments respond to touch; someone else's is plain
            // text, not a button VoiceOver would call dimmed.
            const Bubble = mine ? TouchableOpacity : View;
            const touch = mine ? {
              activeOpacity: 0.8,
              onLongPress: () => removeComment(comment),
              accessibilityHint: 'Long-press to delete',
              accessibilityActions: [{ name: 'delete', label: 'Delete comment' }],
              onAccessibilityAction: () => removeComment(comment),
            } : { accessible: true };
            return (
            <View key={comment.id} style={styles.row}>
              <Avatar profile={comment.author} size={32} />
              <Bubble style={styles.bubble} {...touch}>
                <Text style={styles.author}>
                  {mine ? 'You' : comment.author?.first_name || 'Athlete'}
                  <Text style={styles.when}>  {formatRelativeDate(comment.created_at)}</Text>
                </Text>
                <Text style={styles.body}>{comment.body}</Text>
              </Bubble>
            </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityLabel={sending ? 'Posting comment' : 'Post comment'}
          activeOpacity={0.7}
        >
          {sending
            ? <ActivityIndicator color={colors.onAccent} size="small" />
            : <Send color={colors.onAccent} size={18} />}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg, fontStyle: 'italic' },
  failed: { alignItems: 'center', paddingBottom: spacing.md },
  retry: { color: colors.accent, fontSize: 14, fontWeight: '700', padding: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bubble: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  author: { color: colors.text, fontSize: 13, fontWeight: '700' },
  when: { color: colors.textMuted, fontSize: 11, fontWeight: '400' },
  body: { color: colors.textSecondary, fontSize: 14, marginTop: 3, lineHeight: 19 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  send: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
