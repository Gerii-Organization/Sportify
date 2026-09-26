import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft, UserPlus, MessageCircle, Clock, Check, UserMinus, Ban, Ellipsis, Share2, Pencil, X,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients } from '../theme';
import { levelFromXp, tierFor } from '../lib/level';
import { formatRelativeDate, formatMonthYear } from '../lib/date';
import { AchievementIcon } from '../lib/achievements';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import Avatar from '../components/Avatar';
import NameBadge from '../components/NameBadge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import BottomSheet from '../components/BottomSheet';
import { unwrap } from '../lib/query';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonProfile } from '../components/Skeleton';

/**
 * Someone else's profile — or yours, as other people see it.
 *
 * Built around one decision: whether to add or message this person. That
 * action sits under their name; what helps you decide follows, each fact drawn
 * once — three numbers, the badges they have earned, their last few sessions.
 * Level, tier and join date share one line instead of a pill and a caption.
 *
 * Remove and Block live in the ⋯ menu. A red button beside "Message" made the
 * most destructive thing on the screen the easiest one to hit. There is no
 * Follow: the app has friends only.
 */

const PRIMARY = {
  none: { label: 'Add friend', Icon: UserPlus, filled: true },
  pending_received: { label: 'Accept request', Icon: Check, filled: true },
  pending_sent: { label: 'Requested', Icon: Clock, filled: false },
  friends: { label: 'Message', Icon: MessageCircle, filled: true },
};

/** Recent sessions shown; the rest is their business. */
const RECENT = 3;

export default function PublicProfileScreen({ route, navigation }) {
  const { t } = useT();
  const confirmAction = useConfirm();
  const { user } = useAuth();
  const { userId } = route.params;
  const myId = user?.id || null;
  const isSelf = !!myId && myId === userId;

  const [profile, setProfile] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  /** Unlocked badges, newest first, with their catalogue name and icon. */
  const [badges, setBadges] = useState([]);
  const [badgeTotal, setBadgeTotal] = useState(0);
  const [friendship, setFriendship] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => { fetchData(); }, [userId, myId]));

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      if (myId && !isSelf) {
        const blocks = await unwrap(supabase
          .from('blocks')
          .select('blocker_id')
          .or(`and(blocker_id.eq.${myId},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${myId})`)
          .limit(1));
        if (blocks?.length) {
          setIsBlocked(true);
          return;
        }
      }

      // public_profiles, not profiles: the base table is restricted to your own
      // row, because it carries weight, height, age and sex.
      const row = await unwrap(supabase.from('public_profiles').select('*').eq('id', userId).maybeSingle());
      setProfile(row);
      if (!row || !myId) return;

      // Everything below is optional decoration on a profile that has already
      // loaded. None of it is allowed to turn the screen into an error.
      const [workouts, catalogue, unlocked, pair] = await Promise.all([
        // Through an RPC: it returns four columns and refuses when either side
        // has blocked the other. The table itself is private.
        supabase.rpc('get_public_workouts', { p_user_id: userId }).then(({ data }) => data || []),
        supabase.from('achievements').select('code, name, icon, sort_order').then(({ data }) => data || []),
        supabase.from('user_achievements').select('code, unlocked_at').eq('user_id', userId).then(({ data }) => data || []),
        isSelf
          ? Promise.resolve(null)
          : supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${myId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${myId})`)
            .maybeSingle()
            .then(({ data }) => data || null),
      ]);

      const byCode = new Map(catalogue.map((a) => [a.code, a]));
      setBadges(
        unlocked
          .filter((u) => byCode.has(u.code))
          .sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)))
          .map((u) => ({ ...byCode.get(u.code), unlocked_at: u.unlocked_at }))
      );
      setBadgeTotal(catalogue.length);
      setRecentWorkouts(workouts.slice(0, RECENT));
      setFriendship(pair);
    } catch (e) {
      setLoadError(e?.message || t('Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  const friendStatus = isSelf
    ? 'self'
    : !friendship
      ? 'none'
      : friendship.status === 'accepted'
        ? 'friends'
        : friendship.user_id === myId ? 'pending_sent' : 'pending_received';

  const name = profile?.first_name || t('this athlete');

  const sendRequest = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .insert([{ user_id: myId, friend_id: userId, status: 'pending' }])
      .select()
      .single();
    if (error) return Alert.alert(t('Could not send the request'), error.message);
    setFriendship(data);
  };

  const acceptRequest = async () => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id);
    if (error) return Alert.alert(t('Could not accept'), error.message);
    setFriendship((f) => ({ ...f, status: 'accepted' }));
  };

  const cancelRequest = async () => {
    const ok = await confirmAction({
      icon: X,
      title: t('Cancel friend request?'),
      message: t('{name} will no longer see your request.', { name }),
      confirmLabel: t('Cancel request'),
      cancelLabel: t('Keep it'),
    });
    if (!ok) return;
    const { error } = await supabase.from('friendships').delete().eq('id', friendship.id);
    if (error) return Alert.alert(t('Could not cancel it'), error.message);
    setFriendship(null);
  };

  const handlePrimary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (friendStatus === 'none') await sendRequest();
      else if (friendStatus === 'pending_received') await acceptRequest();
      else if (friendStatus === 'pending_sent') await cancelRequest();
      else if (friendStatus === 'friends') {
        navigation.navigate('ChatScreen', { friendId: userId, friendName: profile.first_name });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnfriend = async () => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: UserMinus,
      title: t('Remove {name}?', { name }),
      message: t('You will no longer be friends. You can send a new request later.'),
      confirmLabel: t('Remove'),
    });
    if (!ok) return;
    await supabase.from('friendships').delete().eq('id', friendship.id);
    setFriendship(null);
  };

  const handleBlock = async () => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Ban,
      title: t('Block {name}?', { name }),
      message: t('You will not be able to contact each other, and they will be removed from your friends.'),
      confirmLabel: t('Block'),
    });
    if (!ok) return;
    if (friendship) await supabase.from('friendships').delete().eq('id', friendship.id);
    await supabase.from('blocks').insert([{ blocker_id: myId, blocked_id: userId }]);
    navigation.goBack();
  };

  const shareProfile = async () => {
    if (!profile) return;
    const level = levelFromXp(profile.xp);
    const streak = profile.current_streak || 0;
    const facts = [t('Level {level} {tier}', { level, tier: tierFor(level).name })];
    if (streak > 0) facts.push(t('{count}-day streak', { count: streak }));

    try {
      await Share.share({
        title: t('{name} on Sportify', { name: profile.first_name }),
        message: t('Check out {name} on Sportify: {facts}.', { name: profile.first_name, facts: facts.join(' · ') }),
      });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  };

  // Menu actions wait for the sheet to finish sliding away. Presenting a
  // confirmation or the share sheet while the sheet's own Modal is still
  // dismissing is the one thing iOS refuses to show.
  const fromMenu = (action) => () => {
    setMenuOpen(false);
    setTimeout(action, 350);
  };

  const nav = (
    <View style={styles.nav}>
      <Press scale={0.9} style={styles.navBtn} onPress={() => navigation.goBack()} accessibilityLabel={t('Go back')}>
        <ChevronLeft color={colors.text} size={24} />
      </Press>
      {myId && !isSelf && profile && !isBlocked ? (
        <Press scale={0.9} style={styles.navBtn} onPress={() => setMenuOpen(true)} accessibilityLabel={t('More options')}>
          <Ellipsis color={colors.text} size={22} />
        </Press>
      ) : (
        <View style={styles.navSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        <SkeletonProfile top={8} />
      </SafeAreaView>
    );
  }

  if (isBlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        <View style={styles.centerBox}>
          <View style={styles.blockedIcon}>
            <Ban color={colors.textMuted} size={30} />
          </View>
          <Text style={styles.blockedTitle}>{t('Profile unavailable')}</Text>
          <Text style={styles.blockedBody}>{t('You cannot view this profile.')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        {loadError ? (
          <ErrorState message={loadError} onRetry={fetchData} />
        ) : (
          <EmptyState
            icon={<Ban color={colors.textFaint} size={44} />}
            title={t('Profile not found')}
            message={t('This account may have been deleted.')}
          />
        )}
      </SafeAreaView>
    );
  }

  const level = levelFromXp(profile.xp);
  const tier = tierFor(level);
  const joined = formatMonthYear(profile.created_at);
  const primary = PRIMARY[friendStatus];
  const PrimaryIcon = primary?.Icon;
  const friendsSince = formatMonthYear(friendship?.created_at);
  const relation = friendStatus === 'pending_received'
    ? t('{name} sent you a friend request', { name: profile.first_name })
    : friendStatus === 'friends'
      ? (friendsSince ? t('Friends since {date}', { date: friendsSince }) : t('Friends'))
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      {/* The top of the screen takes the colour of their tier: a Legend's
          profile should not open looking the same as a first-week account's. */}
      <LinearGradient colors={[`${tier.color}30`, 'rgba(17, 19, 27, 0)']} style={styles.cover} pointerEvents="none" />
      {nav}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeIn style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Avatar profile={profile} size={96} />
            <View style={[styles.levelChip, { backgroundColor: tier.color }]}>
              <Text style={styles.levelChipText}>{level}</Text>
            </View>
          </View>

          <Text style={styles.name} numberOfLines={1}>{profile.first_name || t('Athlete')}</Text>

          {profile.equipped_title || profile.equipped_badge ? (
            <View style={styles.titleRow}>
              {profile.equipped_title ? <Text style={styles.title}>{profile.equipped_title}</Text> : null}
              <NameBadge badgeId={profile.equipped_badge} size={13} showLabel />
            </View>
          ) : null}

          <Text style={styles.meta}>
            <Text style={{ color: tier.color }}>{tier.name}</Text>
            {joined ? `  ·  ${t('Joined {date}', { date: joined })}` : ''}
          </Text>

          {relation ? <Text style={styles.relation}>{relation}</Text> : null}

          {isSelf ? (
            <>
              <Text style={styles.selfNote}>{t('This is how other people see your profile.')}</Text>
              <Press
                scale={0.97}
                style={[styles.actionBtn, styles.actionQuiet, styles.selfBtn]}
                onPress={() => navigation.navigate('ProfileScreen')}
                accessibilityLabel={t('Edit your profile')}
              >
                <Pencil color={colors.text} size={16} />
                <Text style={styles.actionText}>{t('Edit your profile')}</Text>
              </Press>
            </>
          ) : myId && primary ? (
            <View style={styles.actions}>
              <Press
                scale={0.97}
                style={[styles.actionBtn, styles.flex, primary.filled ? styles.actionFilled : styles.actionQuiet, busy && styles.busy]}
                onPress={handlePrimary}
                accessibilityLabel={t(primary.label)}
              >
                <PrimaryIcon color={primary.filled ? colors.onAccent : colors.text} size={17} />
                <Text style={[styles.actionText, primary.filled && styles.actionTextFilled]}>{t(primary.label)}</Text>
              </Press>

              <Press scale={0.92} style={styles.iconBtn} onPress={shareProfile} accessibilityLabel={t('Share {name}\'s profile', { name })}>
                <Share2 color={colors.text} size={18} />
              </Press>
            </View>
          ) : null}
        </FadeIn>

        <FadeIn index={1}>
          <View style={styles.stats}>
            <Stat value={profile.current_streak || 0} label={t('Day streak')} />
            <View style={styles.rule} />
            <Stat value={profile.xp || 0} label={t('Total XP')} />
            <View style={styles.rule} />
            <Stat value={badges.length} label={t('Badges')} />
          </View>
        </FadeIn>

        <FadeIn index={2}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('Badges')}</Text>
            {badgeTotal ? <Text style={styles.sectionAside}>{badges.length}/{badgeTotal}</Text> : null}
          </View>
          {badges.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.badgeRow}
            >
              {badges.map((badge) => (
                <View key={badge.code} style={styles.badge}>
                  <View style={styles.badgeCircle}>
                    <AchievementIcon name={badge.icon} size={21} color={colors.gold} />
                  </View>
                  <Text style={styles.badgeName} numberOfLines={2}>{badge.name}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>
              {isSelf ? t('You have not unlocked a badge yet.') : t('{name} has not unlocked a badge yet.', { name: profile.first_name || t('Athlete') })}
            </Text>
          )}
        </FadeIn>

        <FadeIn index={3}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('Recent activity')}</Text>
          </View>
          {recentWorkouts.length ? (
            <View style={styles.group}>
              {recentWorkouts.map((w, i) => (
                <View key={w.id || i} style={[styles.activityRow, i > 0 && styles.divider]}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{w.workout_name}</Text>
                    <Text style={styles.rowMeta}>{formatRelativeDate(w.completed_at)}</Text>
                  </View>
                  {w.duration_minutes ? (
                    <Text style={styles.duration}>{w.duration_minutes} min</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t('No recent workouts.')}</Text>
          )}
        </FadeIn>
      </ScrollView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={profile.first_name} avoidKeyboard={false}>
        <MenuRow icon={Share2} label={t('Share profile')} onPress={fromMenu(shareProfile)} />
        {friendStatus === 'pending_sent' ? (
          <MenuRow icon={X} label={t('Cancel friend request')} onPress={fromMenu(cancelRequest)} />
        ) : null}
        {friendStatus === 'friends' ? (
          <MenuRow icon={UserMinus} label={t('Remove friend')} danger onPress={fromMenu(handleUnfriend)} />
        ) : null}
        <MenuRow icon={Ban} label={t('Block {name}', { name: profile.first_name || t('Athlete') })} danger onPress={fromMenu(handleBlock)} last />
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{Number(value || 0).toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon: Icon, label, danger = false, onPress, last = false }) {
  return (
    <Press scale={0.99} style={[styles.menuRow, !last && styles.menuBorder]} onPress={onPress} accessibilityLabel={label}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Icon color={danger ? colors.danger : colors.textSecondary} size={18} />
      </View>
      <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(25, 28, 40, 0.75)', borderWidth: 1, borderColor: colors.border,
  },
  navSpacer: { width: 44 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  // --- Hero ---
  hero: { alignItems: 'center', paddingTop: 4 },
  avatarWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  levelChip: {
    position: 'absolute', right: -6, bottom: -4,
    minWidth: 34, height: 30, borderRadius: 15, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.background,
  },
  levelChipText: { color: colors.onAccent, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  name: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  title: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 13, fontWeight: '600', marginTop: 10 },
  relation: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 8 },
  selfNote: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 14 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  actionBtn: {
    height: 48, borderRadius: 24, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  actionFilled: { backgroundColor: colors.accent },
  actionQuiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionTextFilled: { color: colors.onAccent },
  busy: { opacity: 0.6 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  selfBtn: { marginTop: 12, alignSelf: 'center' },

  // --- Stats: on the page, not in a card ---
  stats: { flexDirection: 'row', marginTop: 28 },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 6 },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sectionAside: { color: colors.textFaint, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

  bleed: { marginHorizontal: -20 },
  badgeRow: { paddingHorizontal: 20, gap: 12 },
  badge: { width: 72, alignItems: 'center' },
  badgeCircle: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldBorder,
  },
  badgeName: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  group: {
    backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  duration: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  blockedIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  blockedTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 14 },
  blockedBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 6 },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56 },
  menuBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  menuIconDanger: { backgroundColor: 'rgba(255, 180, 171, 0.12)' },
  menuText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  menuTextDanger: { color: colors.danger },
});
