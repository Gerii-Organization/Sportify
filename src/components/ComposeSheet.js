import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { supabase } from '../lib/supabase';
import BottomSheet from './BottomSheet';
import Press from './Press';

const MAX = 500;

/**
 * Writing something into the feed.
 *
 * The feed was written entirely by triggers, which made it a log of what the
 * app noticed rather than anything you take part in. This is the one kind of
 * entry a person writes: text, from you, and nothing that claims a record or a
 * streak you did not earn — those stay trigger-only on the server.
 */
export default function ComposeSheet({ visible, onClose, onPosted }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const clean = text.trim();
  const over = clean.length > MAX;

  const post = async () => {
    if (!clean || over || posting) return;
    setPosting(true);

    const { data, error } = await supabase.rpc('create_post', { p_text: clean });
    setPosting(false);

    if (error || !data?.ok) {
      // The function arrives with 20260914_user_posts.sql; say so rather than
      // showing a missing-function error.
      const reason = data?.reason;
      return alertFor(error ? 'unavailable' : reason);
    }

    setText('');
    onPosted?.();
    onClose?.();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Say something">
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="How did it go today?"
        placeholderTextColor={colors.textFaint}
        multiline
        autoFocus
        maxLength={MAX + 40}
        textAlignVertical="top"
      />

      <View style={styles.footer}>
        <Text style={[styles.count, over && { color: colors.danger }]}>
          {clean.length} / {MAX}
        </Text>
        <Text style={styles.who}>Your friends will see this</Text>
      </View>

      <Press
        scale={0.98}
        style={[styles.post, (!clean || over) && styles.postOff]}
        onPress={post}
        disabled={!clean || over || posting}
        accessibilityLabel="Post to your feed"
      >
        {posting
          ? <ActivityIndicator color={colors.onAccent} />
          : <Text style={[styles.postText, (!clean || over) && styles.postTextOff]}>Post</Text>}
      </Press>
    </BottomSheet>
  );
}

const MESSAGES = {
  empty: 'Write something first.',
  too_long: 'That is longer than a feed post can be.',
  too_many: 'That is a lot of posting for one hour. Try again shortly.',
  not_signed_in: 'Sign in to post.',
  unavailable: 'Posting is not set up on the server yet.',
};

function alertFor(reason) {
  // Imported lazily so this file does not pull in react-native's Alert for a
  // path most runs never take.
  // eslint-disable-next-line global-require
  const { Alert } = require('react-native');
  Alert.alert('Could not post', MESSAGES[reason] || MESSAGES.unavailable);
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    borderRadius: radius.md,
    padding: 16,
    minHeight: 130,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  count: { color: colors.textFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  who: { color: colors.textFaint, fontSize: 12 },

  post: {
    height: 52, borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.lg,
  },
  postOff: { backgroundColor: colors.surfaceHigh },
  postText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  postTextOff: { color: colors.textMuted },
});
