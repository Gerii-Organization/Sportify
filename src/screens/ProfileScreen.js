import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Share, ActivityIndicator, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Camera, Pencil, Share2, Users, UserPlus,
  TrendingUp, Sparkles, Eye, Ruler, Gift,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { inviteMessage, INVITE_BONUS } from '../lib/invites';
import { unwrap } from '../lib/query';
import { loadFriends } from '../lib/friends';
import { colors, gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { levelInfo, tierFor, XP_PER_LEVEL } from '../lib/level';
import { pickAndUploadImage } from '../lib/upload';
import { AchievementIcon, mergeAchievements } from '../lib/achievements';
import Avatar from '../components/Avatar';
import NameBadge from '../components/NameBadge';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import EditProfileSheet from '../components/EditProfileSheet';
import { SkeletonProfile } from '../components/Skeleton';

/**
 * Your own profile.
 *
 * Deliberately not the public profile with an edit button. Someone else looking
 * at you wants to know who you are and whether to add you; you, looking at
 * yourself, want to know how far you have come and who you train with.
 *
 * It is kept to four things, each drawn once: who you are (photo, name, level),
 * three numbers, your friends, your badges. Records, history and charts live
 * one tap away under Progress instead of being previewed here in cards of
 * their own, which is what made the old screen read as a dashboard.
 *
 * Friends show the first few, with the whole list a tap away in place. There
 * are no follower counts: following was removed in favour of friendship only.
 */

const EMPTY = {
  friends: [],
  totals: { workouts: 0, minutes: 0 },
  achievements: [],
};

/** How many friends show before "Show all". */
const FRIEND_PREVIEW = 3;

/** "45m", "3h 20m", "128h". Past ten hours the minutes stop being worth reading. */
function formatHours(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours >= 10 || rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Progress per badge when the server can report it, otherwise locked and
 * unlocked only.
 */
async function loadAchievements(userId) {
  const { data, error } = await supabase.rpc('get_achievement_progress');
  if (!error && Array.isArray(data)) {
    return data.map((a) => ({ ...a, unlocked: !!a.unlocked_at }));
  }

  const [{ data: catalogue }, { data: unlocked }] = await Promise.all([
    supabase.from('achievements').select('*').order('sort_order'),
    supabase.from('user_achievements').select('code, unlocked_at').eq('user_id', userId),
  ]);
  return mergeAchievements(catalogue, unlocked).map((a) => ({ ...a, unlocked_at: a.unlockedAt }));
}

export default function ProfileScreen({ navigation }) {
  const { t } = useT();
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);
  /** Shown straight away after an upload, before the profile re-fetch lands. */
  const [photoUrl, setPhotoUrl] = useState(null);

  const profile = authProfile ? { ...authProfile, ...(photoUrl ? { avatar_url: photoUrl } : null) } : null;

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);

    try {
      const [friends, sessions, achievements] = await Promise.all([
        loadFriends(user.id),
        unwrap(supabase
          .from('workout_completions')
          .select('duration_minutes')
          .eq('user_id', user.id)),
        loadAchievements(user.id),
      ]);

      setData({
        friends,
        totals: {
          workouts: sessions?.length || 0,
          minutes: (sessions || []).reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0),
        },
        achievements: achievements || [],
      });
    } catch (e) {
      setError(e?.message || t('Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /**
   * Sets or replaces the profile photo. Stored at <user-id>/avatar and
   * overwritten in place, so changing it five times leaves one file.
   */
  const changePhoto = async () => {
    if (uploading || !user) return;
    setUploading(true);

    try {
      const url = await pickAndUploadImage({
        bucket: 'avatars',
        pathPrefix: `${user.id}/avatar`,
        aspect: [1, 1],
        maxWidth: 512,
      });

      if (url) {
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        if (updateError) throw updateError;
        setPhotoUrl(url);
        refreshProfile();
      }
    } catch (e) {
      Alert.alert(t('Could not set your photo'), e.message);
    }

    setUploading(false);
  };

  const openSocial = () => navigation.navigate('MainTabs', { screen: 'Social' });

  const toggleFriends = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllFriends((open) => !open);
  };

  const nav = (
    <View style={styles.nav}>
      <Press scale={0.9} style={styles.navBtn} onPress={() => navigation.goBack()} accessibilityLabel={t('Go back')}>
        <ChevronLeft color={colors.text} size={24} />
      </Press>
      <Text style={styles.navTitle}>{t('Profile')}</Text>
      {user && profile ? (
        <Press scale={0.9} style={styles.navBtn} onPress={() => setEditing(true)} accessibilityLabel={t('Edit your profile')}>
          <Pencil color={colors.text} size={18} />
        </Press>
      ) : (
        <View style={styles.navSpacer} />
      )}
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        <EmptyState
          icon={<Users color={colors.textFaint} size={44} />}
          title={t('Sign in to see your profile')}
          message={t('Your level, friends and achievements live here.')}
          actionLabel={t('Sign in')}
          onAction={() => navigation.navigate('AuthScreen')}
        />
      </SafeAreaView>
    );
  }

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        <SkeletonProfile top={8} />
      </SafeAreaView>
    );
  }

  const level = levelInfo(profile.xp);
  const tier = tierFor(level.level);
  const streak = profile.current_streak || 0;
  const { friends, totals, achievements } = data;
  const shownFriends = showAllFriends ? friends : friends.slice(0, FRIEND_PREVIEW);

  const unlocked = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)));
  const locked = achievements
    .filter((a) => !a.unlocked)
    .map((a) => {
      const threshold = Number(a.threshold) || 0;
      return { ...a, ratio: threshold ? Math.min(1, (Number(a.current) || 0) / threshold) : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
  // What you have first, newest first; empty slots go to the badges you are
  // closest to, so a new account still sees four goals rather than a blank row.
  const showcase = [...unlocked, ...locked].slice(0, 4);

  /** The code comes from the server, so a profile loaded before invites existed still has one. */
  const inviteFriends = async () => {
    const { data: stats } = await supabase.rpc('get_invite_stats');
    const code = stats?.code || authProfile?.invite_code;
    if (!code) {
      Alert.alert(t('Invites are not ready yet'), t('Try again in a moment.'));
      return;
    }
    try {
      await Share.share({ title: t('Join me on Sportify'), message: inviteMessage(code, profile?.first_name) });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  };

  const shareProfile = async () => {
    const facts = [t('Level {level} {tier}', { level: level.level, tier: tier.name })];
    if (streak > 0) facts.push(t('{count}-day streak', { count: streak }));
    if (totals.workouts > 0) facts.push(t('{count} workouts logged', { count: totals.workouts }));

    try {
      await Share.share({
        title: t('My Sportify profile'),
        message: t('Train with me on Sportify! {name}: {facts}.', {
          name: profile.first_name || t('Athlete'),
          facts: facts.join(' · '),
        }),
      });
    } catch {
      // Dismissing the share sheet is not an error worth telling anyone about.
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      <AmbientGlow tone="accent" height={300} intensity={0.24} />
      {nav}

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* --- Who you are ------------------------------------------------ */}
          <FadeIn style={styles.hero}>
            <Press
              scale={0.96}
              onPress={changePhoto}
              style={styles.avatarWrap}
              accessibilityLabel={profile.avatar_url ? t('Change your profile photo') : t('Add a profile photo')}
            >
              <Avatar profile={profile} size={96} />
              <View style={styles.camera}>
                {uploading
                  ? <ActivityIndicator color={colors.onAccent} size="small" />
                  : <Camera color={colors.onAccent} size={14} />}
              </View>
            </Press>

            <Text style={styles.name} numberOfLines={1}>{profile.first_name || t('Athlete')}</Text>

            {profile.equipped_title || profile.equipped_badge ? (
              <View style={styles.titleRow}>
                {profile.equipped_title ? <Text style={styles.title}>{profile.equipped_title}</Text> : null}
                <NameBadge badgeId={profile.equipped_badge} size={13} showLabel />
              </View>
            ) : null}

            {/* The level as one line and a hairline bar, not a card: it is a
                fact about you, like your name, and sits with it. */}
            <View style={styles.levelBlock}>
              <Text style={styles.levelLine}>
                {t('Level {level}', { level: level.level })}
                <Text style={styles.levelDot}>{'  ·  '}</Text>
                <Text style={{ color: tier.color }}>{tier.name}</Text>
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: level.percent, backgroundColor: tier.color }]} />
              </View>
              <Text style={styles.levelNote}>
                {t('{xp} XP to level {next}', { xp: XP_PER_LEVEL - level.intoLevel, next: level.level + 1 })}
              </Text>
            </View>
          </FadeIn>

          {/* --- Three numbers ------------------------------------------------ */}
          <FadeIn index={1}>
            <View style={styles.stats}>
              <Stat
                value={totals.workouts.toLocaleString()}
                label={t('Workouts')}
                onPress={() => navigation.navigate('HistoryScreen')}
              />
              <View style={styles.rule} />
              <Stat value={formatHours(totals.minutes)} label={t('Time trained')} />
              <View style={styles.rule} />
              <Stat
                value={String(streak)}
                label={t('Day streak')}
                onPress={() => navigation.navigate('StreakScreen')}
              />
            </View>
          </FadeIn>

          {/* --- Friends ------------------------------------------------------ */}
          <FadeIn index={2}>
            <SectionHead
              title={t('Friends')}
              aside={friends.length || null}
              action={t('Add')}
              actionLabel={t('Find friends')}
              onAction={openSocial}
            />
            <View style={styles.group}>
              {friends.length ? (
                <>
                  {shownFriends.map((friend, index) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      first={index === 0}
                      onPress={() => navigation.navigate('PublicProfileScreen', { userId: friend.id })}
                    />
                  ))}
                  {friends.length > FRIEND_PREVIEW ? (
                    <Press
                      scale={0.99}
                      style={[styles.expand, styles.divider]}
                      onPress={toggleFriends}
                      accessibilityLabel={showAllFriends ? t('Show less') : t('Show all {count}', { count: friends.length })}
                      accessibilityState={{ expanded: showAllFriends }}
                    >
                      <Text style={styles.expandText}>
                        {showAllFriends ? t('Show less') : t('Show all {count}', { count: friends.length })}
                      </Text>
                      {showAllFriends
                        ? <ChevronUp color={colors.accent} size={16} />
                        : <ChevronDown color={colors.accent} size={16} />}
                    </Press>
                  ) : null}
                </>
              ) : (
                <Press scale={0.99} style={styles.row} onPress={openSocial} accessibilityLabel={t('Find friends')}>
                  <View style={styles.addDisc}>
                    <UserPlus color={colors.accent} size={18} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{t('No friends yet')}</Text>
                    <Text style={styles.rowMeta}>{t('Add friends to train together and compare progress.')}</Text>
                  </View>
                  <ChevronRight color={colors.textFaint} size={18} />
                </Press>
              )}
            </View>
          </FadeIn>

          {/* --- Achievements ------------------------------------------------- */}
          <FadeIn index={3}>
            <SectionHead
              title={t('Achievements')}
              aside={achievements.length ? `${unlocked.length}/${achievements.length}` : null}
              action={t('See all')}
              onAction={() => navigation.navigate('AchievementsScreen')}
            />
            {showcase.length ? (
              <View style={styles.badgeRow}>
                {showcase.map((a) => (
                  <View key={a.code} style={styles.badgeItem}>
                    <View style={[styles.badgeCircle, a.unlocked ? styles.badgeOn : styles.badgeOff]}>
                      <AchievementIcon name={a.icon} size={21} color={a.unlocked ? colors.gold : colors.textFaint} />
                    </View>
                    <Text style={[styles.badgeName, !a.unlocked && styles.badgeNameOff]} numberOfLines={2}>{a.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>{t('Finish a workout to start unlocking achievements.')}</Text>
            )}
          </FadeIn>

          {/* --- Elsewhere ----------------------------------------------------- */}
          <FadeIn index={4}>
            <View style={[styles.group, styles.links]}>
              <LinkRow icon={TrendingUp} label={t('Progress and records')} onPress={() => navigation.navigate('ProgressScreen')} first />
              <LinkRow icon={Ruler} label={t('Body & photos')} onPress={() => navigation.navigate('BodyScreen')} />
              <LinkRow
                icon={Gift}
                label={t('Invite friends')}
                note={t('You both get {energy} energy after their first workout', { energy: INVITE_BONUS })}
                onPress={inviteFriends}
              />
              <LinkRow icon={Sparkles} label={t('Customize your look')} onPress={() => navigation.navigate('MainTabs', { screen: 'Shop' })} />
              <LinkRow icon={Share2} label={t('Share your profile')} onPress={shareProfile} />
              <LinkRow
                icon={Eye}
                label={t('View public profile')}
                onPress={() => navigation.navigate('PublicProfileScreen', { userId: user.id })}
              />
            </View>
          </FadeIn>
        </ScrollView>
      )}

      <EditProfileSheet
        visible={editing}
        onClose={() => setEditing(false)}
        profile={profile}
        onSaved={() => {
          refreshProfile();
          setEditing(false);
        }}
      />
    </SafeAreaView>
  );
}

function SectionHead({ title, aside, action, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}
      </View>
      {action ? (
        <Press scale={0.95} onPress={onAction} hitSlop={10} accessibilityLabel={actionLabel || `${title}: ${action}`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

function Stat({ value, label, onPress }) {
  const body = (
    <>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  return onPress ? (
    <Press scale={0.95} style={styles.statCell} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>{body}</Press>
  ) : (
    <View style={styles.statCell}>{body}</View>
  );
}

function FriendRow({ friend, first, onPress }) {
  const { t } = useT();
  const level = levelInfo(friend.xp).level;
  const name = friend.first_name || t('Athlete');
  return (
    <Press
      scale={0.99}
      style={[styles.row, !first && styles.divider]}
      onPress={onPress}
      accessibilityLabel={t('Open {name}\'s profile', { name })}
    >
      <Avatar profile={friend} size={40} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowMeta}>{t('Level {level} {tier}', { level, tier: tierFor(level).name })}</Text>
      </View>
      <ChevronRight color={colors.textFaint} size={18} />
    </Press>
  );
}

function LinkRow({ icon: Icon, label, note, onPress, first = false }) {
  return (
    <Press scale={0.99} style={[styles.row, !first && styles.divider]} onPress={onPress} accessibilityLabel={label}>
      <Icon color={colors.textSecondary} size={19} />
      <View style={styles.flex}>
        <Text style={styles.linkTitle}>{label}</Text>
        {note ? <Text style={styles.rowMeta}>{note}</Text> : null}
      </View>
      <ChevronRight color={colors.textFaint} size={18} />
    </Press>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  navSpacer: { width: 44 },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  // --- Hero ---
  hero: { alignItems: 'center', paddingTop: 12 },
  avatarWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.background,
  },
  name: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  title: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  levelBlock: { alignItems: 'center', marginTop: 14 },
  levelLine: { color: colors.text, fontSize: 14, fontWeight: '700' },
  levelDot: { color: colors.textFaint },
  track: { width: 180, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 2 },
  levelNote: { color: colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 8, fontVariant: ['tabular-nums'] },

  // --- Stats ---
  stats: { flexDirection: 'row', marginTop: 28, marginBottom: 8 },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 6 },

  // --- Sections ---
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sectionAside: { color: colors.textFaint, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionAction: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  // One quiet container per list, rows split by hairlines.
  group: {
    backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  linkTitle: { color: colors.text, fontSize: 15, fontWeight: '500' },
  addDisc: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  expandText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },

  // --- Badges ---
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  badgeItem: { width: '23%', alignItems: 'center' },
  badgeCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeOn: { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
  badgeOff: { backgroundColor: colors.surface, borderColor: colors.border },
  badgeName: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  badgeNameOff: { color: colors.textFaint },

  links: { marginTop: 32 },
});
