import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft, UserPlus, UserCheck, MessageCircle, Clock, Check, Flame, Users, Award,
  TrendingUp, UserMinus, Ban, Ellipsis, Share2, Pencil, X, Star,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients } from '../theme';
import { levelFromXp, tierFor } from '../lib/level';
import { getSocialCounts, toggleFollow, FOLLOW_ERRORS } from '../lib/social';
import { formatRelativeDate, formatMonthYear } from '../lib/date';
import { AchievementIcon } from '../lib/achievements';
import { useAuth } from '../context/AuthContext';
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
 * Built around the relationship rather than the numbers. What you decide here
 * is whether to add, follow or message this person, so those actions sit
 * directly under their name, and what helps you decide — their tier, how
 * consistent they are, what they have unlocked, what they trained lately —
 * follows. The XP-to-next-level maths, friends list and records belong to
 * your own profile, where they are something to act on.
 *
 * Remove and Block moved into the ⋯ menu. A red button beside "Message" made
 * the most destructive thing on the screen the easiest one to hit.
 */

const PRIMARY = {
  none: { label: 'Add friend', Icon: UserPlus, filled: true },
  pending_received: { label: 'Accept request', Icon: Check, filled: true },
  pending_sent: { label: 'Requested', Icon: Clock, filled: false },
  friends: { label: 'Message', Icon: MessageCircle, filled: true },
};

export default function PublicProfileScreen({ route, navigation }) {
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
  const [counts, setCounts] = useState(null);
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
      const [workouts, social, catalogue, unlocked, pair] = await Promise.all([
        // Through an RPC: it returns four columns and refuses when either side
        // has blocked the other. The table itself is private.
        supabase.rpc('get_public_workouts', { p_user_id: userId }).then(({ data }) => data || []),
        getSocialCounts(userId),
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
      setRecentWorkouts(workouts.slice(0, 5));
      setCounts(social);
      setFriendship(pair);
    } catch (e) {
      setLoadError(e?.message || 'Something went wrong.');
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

  const name = profile?.first_name || 'this athlete';

  const sendRequest = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .insert([{ user_id: myId, friend_id: userId, status: 'pending' }])
      .select()
      .single();
    if (error) return Alert.alert('Could not send the request', error.message);
    setFriendship(data);
  };

  const acceptRequest = async () => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id);
    if (error) return Alert.alert('Could not accept', error.message);
    setFriendship((f) => ({ ...f, status: 'accepted' }));
  };

  const cancelRequest = async () => {
    const ok = await confirmAction({
      icon: X,
      title: 'Cancel friend request?',
      message: `${name} will no longer see your request.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    const { error } = await supabase.from('friendships').delete().eq('id', friendship.id);
    if (error) return Alert.alert('Could not cancel it', error.message);
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
      title: `Remove ${name}?`,
      message: 'You will no longer be friends. You can send a new request later.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await supabase.from('friendships').delete().eq('id', friendship.id);
    setFriendship(null);
  };

  const handleBlock = async () => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Ban,
      title: `Block ${name}?`,
      message: 'You will not be able to contact each other, and they will be removed from your friends.',
      confirmLabel: 'Block',
    });
    if (!ok) return;
    if (friendship) await supabase.from('friendships').delete().eq('id', friendship.id);
    await supabase.from('blocks').insert([{ blocker_id: myId, blocked_id: userId }]);
    navigation.goBack();
  };

  /** Optimistic: the count moves on tap and rolls back if the server refuses. */
  const handleFollow = async () => {
    if (!counts?.available || busy) return;
    const before = counts;
    setCounts({ ...before, iFollow: !before.iFollow, followers: before.followers + (before.iFollow ? -1 : 1) });

    const result = await toggleFollow(userId);
    if (!result.ok) {
      setCounts(before);
      Alert.alert('Could not update', FOLLOW_ERRORS[result.reason] || 'Please try again.');
      return;
    }
    setCounts((c) => ({ ...c, iFollow: result.following }));
  };

  const shareProfile = async () => {
    if (!profile) return;
    const level = levelFromXp(profile.xp);
    const streak = profile.current_streak || 0;
    const facts = [`Level ${level} ${tierFor(level).name}`];
    if (streak > 0) facts.push(`${streak}-day streak`);

    try {
      await Share.share({
        title: `${profile.first_name} on Sportify`,
        message: `Check out ${profile.first_name} on Sportify: ${facts.join(' · ')}.`,
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
      <Press scale={0.9} style={styles.navBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <ChevronLeft color={colors.text} size={24} />
      </Press>
      {myId && !isSelf && profile && !isBlocked ? (
        <Press scale={0.9} style={styles.navBtn} onPress={() => setMenuOpen(true)} accessibilityLabel="More options">
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
          <Text style={styles.blockedTitle}>Profile unavailable</Text>
          <Text style={styles.blockedBody}>You cannot view this profile.</Text>
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
            title="Profile not found"
            message="This account may have been deleted."
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
  const relation = friendStatus === 'pending_received'
    ? `${profile.first_name} sent you a friend request`
    : friendStatus === 'friends'
      ? (formatMonthYear(friendship?.created_at) ? `Friends since ${formatMonthYear(friendship.created_at)}` : 'Friends')
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      {/* The top of the screen takes the colour of their tier: a Legend's
          profile should not open looking the same as a first-week account's. */}
      <LinearGradient colors={[`${tier.color}38`, 'rgba(17, 19, 27, 0)']} style={styles.cover} pointerEvents="none" />
      {nav}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeIn style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Avatar profile={profile} size={96} />
            <View style={[styles.levelChip, { backgroundColor: tier.color }]}>
              <Text style={styles.levelChipText}>{level}</Text>
            </View>
          </View>

          <Text style={styles.name} numberOfLines={1}>{profile.first_name || 'Athlete'}</Text>

          {profile.equipped_title || profile.equipped_badge ? (
            <View style={styles.titleRow}>
              {profile.equipped_title ? <Text style={styles.title}>{profile.equipped_title}</Text> : null}
              <NameBadge badgeId={profile.equipped_badge} size={13} showLabel />
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={[styles.tierPill, { backgroundColor: `${tier.color}1F`, borderColor: `${tier.color}55` }]}>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.name} · Level {level}</Text>
            </View>
            {joined ? <Text style={styles.joined}>Joined {joined}</Text> : null}
          </View>

          {relation ? <Text style={styles.relation}>{relation}</Text> : null}

          {isSelf ? (
            <>
              <Text style={styles.selfNote}>This is how other people see your profile.</Text>
              <Press
                scale={0.97}
                style={[styles.actionBtn, styles.actionQuiet, styles.selfBtn]}
                onPress={() => navigation.navigate('ProfileScreen')}
                accessibilityLabel="Edit your profile"
              >
                <Pencil color={colors.text} size={16} />
                <Text style={styles.actionText}>Edit your profile</Text>
              </Press>
            </>
          ) : myId && primary ? (
            <View style={styles.actions}>
              <Press
                scale={0.97}
                style={[styles.actionBtn, styles.flex, primary.filled ? styles.actionFilled : styles.actionQuiet, busy && styles.busy]}
                onPress={handlePrimary}
                accessibilityLabel={primary.label}
              >
                <PrimaryIcon color={primary.filled ? colors.onAccent : colors.text} size={17} />
                <Text style={[styles.actionText, primary.filled && styles.actionTextFilled]}>{primary.label}</Text>
              </Press>

              {counts?.available ? (
                <Press
                  scale={0.97}
                  style={[styles.actionBtn, counts.iFollow ? styles.actionQuiet : styles.actionOutline]}
                  onPress={handleFollow}
                  accessibilityLabel={counts.iFollow ? `Unfollow ${name}` : `Follow ${name}`}
                  accessibilityState={{ selected: counts.iFollow }}
                >
                  {counts.iFollow ? <UserCheck color={colors.text} size={16} /> : null}
                  <Text style={[styles.actionText, !counts.iFollow && styles.actionTextAccent]}>
                    {counts.iFollow ? 'Following' : 'Follow'}
                  </Text>
                </Press>
              ) : null}

              <Press scale={0.92} style={styles.iconBtn} onPress={shareProfile} accessibilityLabel={`Share ${name}'s profile`}>
                <Share2 color={colors.text} size={18} />
              </Press>
            </View>
          ) : null}
        </FadeIn>

        <FadeIn index={1}>
          <View style={styles.stats}>
            <Stat
              icon={<Flame color={colors.streak} size={18} fill={profile.current_streak ? colors.streak : 'transparent'} />}
              value={profile.current_streak || 0}
              label="Day streak"
            />
            <View style={styles.rule} />
            {counts?.available ? (
              <Stat icon={<Users color={colors.accent} size={18} />} value={counts.followers} label="Followers" />
            ) : (
              <Stat icon={<Star color={colors.xp} size={18} fill={colors.xp} />} value={profile.xp || 0} label="Total XP" />
            )}
            <View style={styles.rule} />
            <Stat icon={<Award color={colors.gold} size={18} />} value={badges.length} label="Badges" />
          </View>
        </FadeIn>

        <FadeIn index={2}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Badges</Text>
            {badgeTotal ? <Text style={styles.sectionAside}>{badges.length} of {badgeTotal}</Text> : null}
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
                    <AchievementIcon name={badge.icon} size={22} color={colors.gold} />
                  </View>
                  <Text style={styles.badgeName} numberOfLines={2}>{badge.name}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyText}>
                {isSelf ? 'You have not unlocked a badge yet.' : `${profile.first_name || 'They'} has not unlocked a badge yet.`}
              </Text>
            </View>
          )}
        </FadeIn>

        <FadeIn index={3}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
          </View>
          {recentWorkouts.length ? (
            recentWorkouts.map((w, i) => (
              <View key={w.id || i} style={[styles.card, styles.activityRow]}>
                <View style={styles.activityIcon}>
                  <TrendingUp color={colors.accent} size={18} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{w.workout_name}</Text>
                  <Text style={styles.rowMeta}>{formatRelativeDate(w.completed_at)}</Text>
                </View>
                {w.duration_minutes ? (
                  <View style={styles.durationPill}>
                    <Text style={styles.durationText}>{w.duration_minutes} min</Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyText}>No recent workouts.</Text>
            </View>
          )}
        </FadeIn>
      </ScrollView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={profile.first_name} avoidKeyboard={false}>
        <MenuRow icon={Share2} label="Share profile" onPress={fromMenu(shareProfile)} />
        {friendStatus === 'pending_sent' ? (
          <MenuRow icon={X} label="Cancel friend request" onPress={fromMenu(cancelRequest)} />
        ) : null}
        {friendStatus === 'friends' ? (
          <MenuRow icon={UserMinus} label="Remove friend" danger onPress={fromMenu(handleUnfriend)} />
        ) : null}
        <MenuRow icon={Ban} label={`Block ${profile.first_name || 'user'}`} danger onPress={fromMenu(handleBlock)} last />
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label }) {
  return (
    <View style={styles.statCell}>
      {icon}
      <Text style={styles.statValue}>{Number(value || 0).toLocaleString()}</Text>
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
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(25, 28, 40, 0.75)', borderWidth: 1, borderColor: colors.border,
  },
  navSpacer: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 20 },
  avatarWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  levelChip: {
    position: 'absolute', right: -6, bottom: -4,
    minWidth: 34, height: 30, borderRadius: 15, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.background,
  },
  levelChipText: { color: colors.onAccent, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  title: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  tierPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  tierText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  joined: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  relation: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 10 },
  selfNote: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 14 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  actionBtn: {
    height: 48, borderRadius: 24, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  actionFilled: { backgroundColor: colors.accent },
  actionQuiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  actionOutline: { borderWidth: 1, borderColor: colors.accentBorder },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionTextFilled: { color: colors.onAccent },
  actionTextAccent: { color: colors.accent },
  busy: { opacity: 0.6 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  selfBtn: { marginTop: 12, alignSelf: 'center' },

  stats: {
    flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 22, paddingVertical: 16, marginTop: 4,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 6, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sectionAside: { color: colors.textFaint, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

  bleed: { marginHorizontal: -20 },
  badgeRow: { paddingHorizontal: 20, gap: 12 },
  badge: { width: 76, alignItems: 'center' },
  badgeCircle: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldBorder,
  },
  badgeName: { color: colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 16, marginBottom: 8,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 18 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  durationPill: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  durationText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

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
