import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Share2, Check } from 'lucide-react-native';
import { colors } from '../theme';
import { useT } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { loadFriends } from '../lib/friends';
import { shareViewAsImage, captureViewToFile } from '../lib/shareImage';
import { uploadShareCard, sendImageMessage } from '../lib/chatShare';
import WorkoutShareCard, { SHARE_CARD_SIZE } from './WorkoutShareCard';
import Avatar from './Avatar';
import Button from './Button';
import Press from './Press';

/** Captured at story resolution (1080 × 1920) whatever size the preview is drawn at. */
const CAPTURE = { width: SHARE_CARD_SIZE.width * 4, height: SHARE_CARD_SIZE.height * 4 };

/**
 * Where a finished workout gets shared from.
 *
 * The preview lives here rather than on the summary: most sessions are not
 * shared, and a phone-sized picture of the numbers you just read, sitting
 * under them, was the heaviest thing on that screen. Here it is the point.
 *
 * Two ways out: the system share sheet (stories, WhatsApp, saving to Photos),
 * or straight into a friend's chat. The card is uploaded once, on the first
 * friend, and the same image goes to everyone after.
 */
export default function ShareWorkoutSheet({ visible, onClose, stats, workoutName, units }) {
  const { t } = useT();
  const { user, profile } = useAuth();
  const cardRef = useRef(null);
  /** The upload in flight or done, shared by every send. */
  const upload = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [friends, setFriends] = useState(null);
  /** friend id → 'sending' | 'sent' */
  const [sent, setSent] = useState({});

  useEffect(() => {
    if (!visible || !user || friends) return;
    loadFriends(user.id).then(setFriends).catch(() => setFriends([]));
  }, [visible, user, friends]);

  const shareImage = async () => {
    if (sharing) return;
    setSharing(true);
    const result = await shareViewAsImage(cardRef, { dialogTitle: t('Share your workout'), ...CAPTURE });
    setSharing(false);

    if (result.reason === 'unavailable') {
      Alert.alert(t('Sharing is not available'), t('Update the app to share your workout as an image.'));
    } else if (result.reason === 'failed') {
      Alert.alert(t('Could not share'), t('The image could not be created. Try again.'));
    }
  };

  const cardUrl = () => {
    if (!upload.current) {
      upload.current = (async () => {
        const shot = await captureViewToFile(cardRef, CAPTURE);
        if (!shot.ok) {
          throw new Error(shot.reason === 'unavailable'
            ? t('Update the app to share your workout as an image.')
            : t('The image could not be created. Try again.'));
        }
        return uploadShareCard(shot.uri, user.id);
      })();
      // A failed upload is not remembered: the next tap tries again.
      upload.current.catch(() => { upload.current = null; });
    }
    return upload.current;
  };

  const sendTo = async (friend) => {
    if (sent[friend.id]) return;
    setSent((s) => ({ ...s, [friend.id]: 'sending' }));
    try {
      await sendImageMessage({
        from: user.id,
        to: friend.id,
        imageUrl: await cardUrl(),
        text: t('Just finished {name}', { name: workoutName || t('a workout') }),
      });
      setSent((s) => ({ ...s, [friend.id]: 'sent' }));
    } catch (e) {
      setSent((s) => {
        const next = { ...s };
        delete next[friend.id];
        return next;
      });
      Alert.alert(t('Could not send'), e?.message || t('Try again in a moment.'));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // The native card sheet on iOS: it sits over the summary and swipes away.
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Share your workout')}</Text>
          <Press scale={0.9} style={styles.close} onPress={onClose} hitSlop={8} accessibilityLabel={t('Close')}>
            <X color={colors.text} size={20} />
          </Press>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* The preview is the image: this exact view is captured. */}
          <View style={styles.preview}>
            <WorkoutShareCard
              ref={cardRef}
              stats={stats}
              workoutName={workoutName}
              units={units}
              firstName={profile?.first_name}
            />
          </View>

          <Button
            label={t('Share image')}
            icon={<Share2 color={colors.onAccent} size={18} />}
            onPress={shareImage}
            loading={sharing}
          />

          {user ? (
            <View style={styles.friendsBlock}>
              <Text style={styles.sectionTitle}>{t('Send to a friend')}</Text>
              {friends === null ? (
                <ActivityIndicator color={colors.textMuted} style={styles.spinner} />
              ) : friends.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.bleed}
                  contentContainerStyle={styles.friendRow}
                >
                  {friends.map((friend) => {
                    const state = sent[friend.id];
                    const name = friend.first_name || t('Athlete');
                    return (
                      <Press
                        key={friend.id}
                        scale={0.94}
                        style={styles.friend}
                        onPress={() => sendTo(friend)}
                        // Not `disabled`: that dims it, and a sent tick should
                        // read as done, not as unavailable. sendTo ignores repeats.
                        accessibilityState={{ disabled: !!state }}
                        accessibilityLabel={state === 'sent' ? t('Sent to {name}', { name }) : t('Send to {name}', { name })}
                      >
                        <View>
                          <Avatar profile={friend} size={56} />
                          {state ? (
                            <View style={[styles.badge, state === 'sent' && styles.badgeSent]}>
                              {state === 'sent'
                                ? <Check color={colors.onAccent} size={12} strokeWidth={3} />
                                : <ActivityIndicator color={colors.text} size="small" style={styles.badgeSpinner} />}
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {state === 'sent' ? t('Sent') : name}
                        </Text>
                      </Press>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.muted}>{t('Add friends to send them your workouts.')}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  close: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  preview: {
    alignItems: 'center', marginTop: 12, marginBottom: 22,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },

  friendsBlock: { marginTop: 28 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  spinner: { alignSelf: 'flex-start', marginVertical: 18 },
  bleed: { marginHorizontal: -20 },
  friendRow: { paddingHorizontal: 20, gap: 16 },
  friend: { width: 64, alignItems: 'center' },
  friendName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 8, maxWidth: 64 },
  badge: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.background,
  },
  badgeSent: { backgroundColor: colors.accent },
  badgeSpinner: { transform: [{ scale: 0.6 }] },
  muted: { color: colors.textMuted, fontSize: 13 },
});
