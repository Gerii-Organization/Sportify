import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import { formatRelativeDate } from '../lib/date';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';

/**
 * Comments on one feed event.
 *
 * Comments load only when the sheet opens. Fetching them for every card in the
 * list would multiply requests by the length of the feed to show something most
 * people never expand.
 */
export default function CommentSheet({ event, visible, onClose, currentUserId, onPosted }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('feed_comments')
      .select('id, body, created_at, user_id')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });

    const rows = data || [];
    const authorIds = [...new Set(rows.map((c) => c.user_id))];

    // One profile lookup for every author in the thread, rather than one per
    // comment — the same person usually appears several times.
    let byId = {};
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, equipped_avatar, xp')
        .in('id', authorIds);
      byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

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

    if (error) return;

    setComments((prev) => [...prev, { ...data, author: null }]);
    setDraft('');
    onPosted?.(event.id);
    // Re-read so the new row picks up its author profile without a special case.
    load();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={event?.title}>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
        ) : comments.length === 0 ? (
          <Text style={styles.empty}>No comments yet. Say something.</Text>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.row}>
              <Avatar profile={comment.author} size={32} />
              <View style={styles.bubble}>
                <Text style={styles.author}>
                  {comment.user_id === currentUserId ? 'You' : comment.author?.first_name || 'Athlete'}
                  <Text style={styles.when}>  {formatRelativeDate(comment.created_at)}</Text>
                </Text>
                <Text style={styles.body}>{comment.body}</Text>
              </View>
            </View>
          ))
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
          accessibilityLabel="Post comment"
          activeOpacity={0.7}
        >
          <Send color={colors.onAccent} size={18} />
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg, fontStyle: 'italic' },
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
