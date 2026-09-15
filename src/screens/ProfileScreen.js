import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft, ChevronRight, Camera, Pencil, Share2, Flame, Dumbbell, Clock, Trophy,
  Users, UserPlus, TrendingUp, CalendarDays, Sparkles, Award, Ruler, Gift, Swords } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { inviteMessage, INVITE_BONUS } from '../lib/invites';
import { unwrap } from '../lib/query';
import { colors, gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import { levelInfo, tierFor, XP_PER_LEVEL } from '../lib/level';
import { getSocialCounts } from '../lib/social';
import { pickAndUploadImage } from '../lib/upload';
import { formatRelativeDate, formatMonthYear } from '../lib/date';
import { formatVolume } from '../lib/units';
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
 * yourself, want to know how far you have come and what is next. So this one
 * carries the things only you can act on — the XP still needed for the next
 * level, the badge you are closest to, your friends list, the photo — and the
 * public one carries the relationship: add, follow, message.
 *
 * It replaces a modal that lived inside the dashboard. A pushed screen can be
 * linked to from anywhere (the menu, the avatar, a notification), keeps its
 * scroll position when you come back from a friend's profile, and does not
 * take the dashboard's state down with it.
 */

const EMPTY = {
  counts: { followers: 0, following: 0, friends: 0, available: false },
  friends: [],
  totals: { workouts: 0, minutes: 0, volume: 0 },
  recent: [],
  achievements: [],
  records: null,
};

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
 * unlocked only. The progress RPC is what makes "Next up" possible.
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
  const { user, profile: authProfile, refreshProfile, units } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      const [counts, friendRows, sessions, recent, achievements, records] = await Promise.all([
        getSocialCounts(user.id),
        unwrap(supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)),
        unwrap(supabase
          .from('workout_completions')
          .select('duration_minutes, total_volume_kg')
          .eq('user_id', user.id)),
        unwrap(supabase
          .from('workout_completions')
          .select('id, workout_name, completed_at, duration_minutes, total_volume_kg')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(4)),
        loadAchievements(user.id),
        // A count, not the rows. Null rather than 0 when it cannot be read, so
        // the tile says "—" instead of claiming you have no records.
        supabase
          .from('personal_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count, error: countError }) => (countError ? null : count ?? 0)),
      ]);

      const ids = (friendRows || []).map((row) => (row.user_id === user.id ? row.friend_id : row.user_id));
      const friends = ids.length
        ? await unwrap(supabase.from('public_profiles').select('*').in('id', ids))
        : [];

      setData({
        counts,
        friends: (friends || []).sort((a, b) => String(a.first_name || '').localeCompare(String(b.first_name || ''))),
        totals: {
          workouts: sessions?.length || 0,
          minutes: (sessions || []).reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0),
          volume: (sessions || []).reduce((sum, s) => sum + (Number(s.total_volume_kg) || 0), 0),
        },
        recent: recent || [],
        achievements: achievements || [],
        records,
      });
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [user]);

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
      // The bucket and the column arrive with 20260912_profile_photo.sql.
      const missing = /column|bucket|not found/i.test(e?.message || '');
      Alert.alert('Could not set your photo', missing ? 'Profile photos are not available yet.' : e.message);
    }

    setUploading(false);
  };

  const openSocial = () => navigation.navigate('MainTabs', { screen: 'Social' });

  const nav = (
    <View style={styles.nav}>
      <Press scale={0.9} style={styles.navBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <ChevronLeft color={colors.text} size={24} />
      </Press>
      <Text style={styles.navTitle}>Profile</Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
        {nav}
        <EmptyState
          icon={<Users color={colors.textFaint} size={44} />}
          title="Sign in to see your profile"
          message="Your level, friends and achievements live here."
          actionLabel="Sign in"
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
  const memberSince = formatMonthYear(profile.created_at);
  const { counts, friends, totals, recent, achievements, records } = data;
  const friendCount = counts.available ? counts.friends : friends.length;

  const unlocked = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)));
  const locked = achievements
    .filter((a) => !a.unlocked)
    .map((a) => {
      const threshold = Number(a.threshold) || 0;
      return { ...a, threshold, current: Number(a.current) || 0, ratio: threshold ? Math.min(1, (Number(a.current) || 0) / threshold) : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
  // What you have first, newest first; empty slots go to the badges you are
  // closest to, so a new account still sees four goals rather than a blank row.
  const showcase = [...unlocked, ...locked].slice(0, 4);
  const nextUp = locked[0] || null;

  /** The code comes from the server, so a profile loaded before invites existed still has one. */
  const inviteFriends = async () => {
    const { data: stats } = await supabase.rpc('get_invite_stats');
    const code = stats?.code || authProfile?.invite_code;
    if (!code) {
      Alert.alert('Invites are not ready yet', 'Try again in a moment.');
      return;
    }
    try {
      await Share.share({ title: 'Join me on Sportify', message: inviteMessage(code, profile?.first_name) });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  };

  const shareProfile = async () => {
    const parts = [`Level ${level.level} ${tier.name}`];
    if (streak > 0) parts.push(`${streak}-day streak`);
    if (totals.workouts > 0) parts.push(`${totals.workouts} workout${totals.workouts === 1 ? '' : 's'} logged`);

    try {
      await Share.share({
        title: 'My Sportify profile',
        message: `Train with me on Sportify! ${profile.first_name || 'I am'}: ${parts.join(' · ')}.`,
      });
    } catch {
      // Dismissing the share sheet is not an error worth telling anyone about.
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      <AmbientGlow tone="accent" height={320} intensity={0.32} />
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
              accessibilityLabel={profile.avatar_url ? 'Change your profile photo' : 'Add a profile photo'}
            >
              <Avatar profile={profile} size={104} />
              <View style={styles.camera}>
                {uploading
                  ? <ActivityIndicator color={colors.onAccent} size="small" />
                  : <Camera color={colors.onAccent} size={15} />}
              </View>
            </Press>

            <Text style={styles.name} numberOfLines={1}>{profile.first_name || 'Athlete'}</Text>

            {profile.equipped_title || profile.equipped_badge ? (
              <View style={styles.titleRow}>
                {profile.equipped_title ? <Text style={styles.title}>{profile.equipped_title}</Text> : null}
                <NameBadge badgeId={profile.equipped_badge} size={13} showLabel />
              </View>
            ) : null}

            {memberSince ? (
              <View style={styles.since}>
                <CalendarDays color={colors.textFaint} size={13} />
                <Text style={styles.sinceText}>Member since {memberSince}</Text>
              </View>
            ) : null}

            <View style={styles.heroActions}>
              <Press scale={0.97} style={[styles.pill, styles.pillQuiet]} onPress={() => setEditing(true)} accessibilityLabel="Edit your profile">
                <Pencil color={colors.text} size={15} />
                <Text style={styles.pillText}>Edit profile</Text>
              </Press>
              <Press scale={0.97} style={styles.flex} onPress={shareProfile} accessibilityLabel="Share your profile">
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
                  <Share2 color={colors.onAccent} size={15} />
                  <Text style={[styles.pillText, styles.pillTextOn]}>Share profile</Text>
                </LinearGradient>
              </Press>
            </View>
          </FadeIn>

          {/* --- Level ------------------------------------------------------- */}
          <FadeIn index={1}>
            <LinearGradient
              colors={[`${tier.color}29`, colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, styles.levelCard, { borderColor: `${tier.color}45` }]}
            >
              <View style={[styles.levelBadge, { borderColor: tier.color }]}>
                <Text style={styles.levelSmall}>LEVEL</Text>
                <Text style={[styles.levelBig, { color: tier.color }]}>{level.level}</Text>
              </View>

              <View style={styles.flex}>
                <View style={styles.spread}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
                  <Text style={styles.totalXp}>{level.total.toLocaleString()} XP</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: level.percent, backgroundColor: tier.color }]} />
                </View>
                <Text style={styles.levelNote}>
                  {XP_PER_LEVEL - level.intoLevel} XP to level {level.level + 1}
                </Text>
                <Text style={styles.levelHint}>
                  {tier.next ? `${tier.next.name} unlocks at level ${tier.next.minLevel}` : 'You have reached the top tier'}
                </Text>
              </View>
            </LinearGradient>
          </FadeIn>

          {/* --- People and badges at a glance ----------------------------- */}
          <FadeIn index={2}>
            <View style={[styles.card, styles.strip]}>
              <StripStat value={friendCount} label="Friends" onPress={openSocial} />
              {counts.available ? (
                <>
                  <View style={styles.rule} />
                  <StripStat value={counts.followers} label="Followers" />
                  <View style={styles.rule} />
                  <StripStat value={counts.following} label="Following" />
                </>
              ) : null}
              <View style={styles.rule} />
              <StripStat value={unlocked.length} label="Badges" onPress={() => navigation.navigate('AchievementsScreen')} />
            </View>
          </FadeIn>

          {/* --- Friends ------------------------------------------------------ */}
          <FadeIn index={3}>
            <SectionHead title="Friends" aside={friends.length || null} action="See all" onAction={openSocial} />
            {friends.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.friendRow}
              >
                {friends.slice(0, 12).map((friend) => (
                  <Press
                    key={friend.id}
                    scale={0.95}
                    style={styles.friend}
                    onPress={() => navigation.navigate('PublicProfileScreen', { userId: friend.id })}
                    accessibilityLabel={`Open ${friend.first_name}'s profile`}
                  >
                    <Avatar profile={friend} size={56} />
                    <Text style={styles.friendName} numberOfLines={1}>{friend.first_name}</Text>
                    <Text style={styles.friendLevel}>Level {levelInfo(friend.xp).level}</Text>
                  </Press>
                ))}
                <Press scale={0.95} style={styles.friend} onPress={openSocial} accessibilityLabel="Add more friends">
                  <View style={styles.addFriend}>
                    <UserPlus color={colors.accent} size={22} />
                  </View>
                  <Text style={styles.friendName}>Add</Text>
                </Press>
              </ScrollView>
            ) : (
              <Press scale={0.98} style={[styles.card, styles.row]} onPress={openSocial} accessibilityLabel="Find friends">
                <View style={styles.softIcon}>
                  <Users color={colors.accent} size={19} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>No friends yet</Text>
                  <Text style={styles.rowMeta}>Add friends to train together and compare progress.</Text>
                </View>
                <ChevronRight color={colors.textFaint} size={18} />
              </Press>
            )}
          </FadeIn>

          {/* --- Training totals ---------------------------------------------- */}
          <FadeIn index={4}>
            <SectionHead title="Training" />
            <View style={styles.grid}>
              <Tile
                icon={<Flame color={colors.streak} size={17} fill={streak > 0 ? colors.streak : 'transparent'} />}
                tint={colors.streak}
                value={streak}
                label="Day streak"
                onPress={() => navigation.navigate('StreakScreen')}
              />
              <Tile
                icon={<Dumbbell color={colors.accent} size={17} />}
                tint={colors.accent}
                value={totals.workouts}
                label="Workouts"
                note={totals.volume > 0 ? `${formatVolume(totals.volume, units)} lifted` : null}
                onPress={() => navigation.navigate('HistoryScreen')}
              />
              <Tile
                icon={<Clock color={colors.activity} size={17} />}
                tint={colors.activity}
                value={formatHours(totals.minutes)}
                label="Time trained"
              />
              <Tile
                icon={<Trophy color={colors.gold} size={17} />}
                tint={colors.gold}
                value={records ?? '—'}
                label="Records"
                onPress={() => navigation.navigate('RecordsScreen')}
              />
            </View>
          </FadeIn>

          {/* --- Achievements ------------------------------------------------- */}
          <FadeIn index={5}>
            <SectionHead
              title="Achievements"
              aside={achievements.length ? `${unlocked.length}/${achievements.length}` : null}
              action="See all"
              onAction={() => navigation.navigate('AchievementsScreen')}
            />
            <View style={styles.card}>
              {showcase.length ? (
                <View style={styles.badgeRow}>
                  {showcase.map((a) => (
                    <View key={a.code} style={styles.badgeItem}>
                      <View style={[styles.badgeCircle, a.unlocked ? styles.badgeOn : styles.badgeOff]}>
                        <AchievementIcon name={a.icon} size={22} color={a.unlocked ? colors.gold : colors.textFaint} />
                      </View>
                      <Text style={[styles.badgeName, !a.unlocked && styles.badgeNameOff]} numberOfLines={2}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>Finish a workout to start unlocking achievements.</Text>
              )}

              {nextUp ? (
                <View style={[styles.nextUp, showcase.length ? styles.nextUpDivider : null]}>
                  <Text style={styles.eyebrow}>NEXT UP</Text>
                  <View style={styles.row}>
                    <View style={styles.softIcon}>
                      <AchievementIcon name={nextUp.icon} size={18} color={colors.accent} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{nextUp.name}</Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>{nextUp.description}</Text>
                    </View>
                    {nextUp.threshold ? (
                      <Text style={styles.nextCount}>{Math.min(nextUp.current, nextUp.threshold)}/{nextUp.threshold}</Text>
                    ) : null}
                  </View>
                  {nextUp.threshold ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round(nextUp.ratio * 100)}%`, backgroundColor: colors.accent }]} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </FadeIn>

          {/* --- Recent activity ---------------------------------------------- */}
          <FadeIn index={6}>
            <SectionHead
              title="Recent activity"
              action={recent.length ? 'See all' : null}
              onAction={() => navigation.navigate('HistoryScreen')}
            />
            {recent.length ? (
              recent.map((session) => (
                <View key={session.id} style={[styles.card, styles.row, styles.activity]}>
                  <View style={styles.softIcon}>
                    <TrendingUp color={colors.accent} size={18} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{session.workout_name}</Text>
                    <Text style={styles.rowMeta}>
                      {formatRelativeDate(session.completed_at)} · {session.duration_minutes} min
                    </Text>
                  </View>
                  {Number(session.total_volume_kg) > 0 ? (
                    <Text style={styles.volume}>{formatVolume(session.total_volume_kg, units)}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Press
                scale={0.98}
                style={[styles.card, styles.row]}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Training' })}
                accessibilityLabel="Start a workout"
              >
                <View style={styles.softIcon}>
                  <Dumbbell color={colors.accent} size={18} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>No workouts yet</Text>
                  <Text style={styles.rowMeta}>Start a routine and it will show up here.</Text>
                </View>
                <ChevronRight color={colors.textFaint} size={18} />
              </Press>
            )}
          </FadeIn>

          {/* --- Elsewhere ----------------------------------------------------- */}
          <FadeIn index={7}>
            <View style={[styles.card, styles.links]}>
              <LinkRow
                icon={TrendingUp}
                label="Progress"
                note="Charts, history and records"
                onPress={() => navigation.navigate('ProgressScreen')}
              />
              <LinkRow
                icon={Swords}
                label="Challenges"
                note="Race friends for a few days, winner takes energy"
                onPress={() => navigation.navigate('ChallengesScreen')}
              />
              <LinkRow
                icon={Gift}
                label="Invite friends"
                note={`You both get ${INVITE_BONUS} energy after their first workout`}
                onPress={inviteFriends}
              />
              <LinkRow
                icon={Ruler}
                label="Body & photos"
                note="Measurements and private progress photos"
                onPress={() => navigation.navigate('BodyScreen')}
              />
              <LinkRow
                icon={Sparkles}
                label="Customize your look"
                note="Frames, rings, badges and titles"
                onPress={() => navigation.navigate('MainTabs', { screen: 'Shop' })}
              />
              <LinkRow
                icon={Award}
                label="View public profile"
                note="See what other people see"
                onPress={() => navigation.navigate('PublicProfileScreen', { userId: user.id })}
                last
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

function SectionHead({ title, aside, action, onAction }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}
      </View>
      {action ? (
        <Press scale={0.95} onPress={onAction} hitSlop={8} accessibilityLabel={`${title}: ${action}`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

function StripStat({ value, label, onPress }) {
  const body = (
    <>
      <Text style={styles.stripValue}>{Number(value || 0).toLocaleString()}</Text>
      <Text style={styles.stripLabel}>{label}</Text>
    </>
  );
  return onPress ? (
    <Press scale={0.95} style={styles.stripCell} onPress={onPress} accessibilityLabel={`${value} ${label}`}>{body}</Press>
  ) : (
    <View style={styles.stripCell}>{body}</View>
  );
}

function Tile({ icon, tint, value, label, note, onPress }) {
  const body = (
    <>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1F` }]}>{icon}</View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {note ? <Text style={styles.tileNote} numberOfLines={1}>{note}</Text> : null}
    </>
  );
  return onPress ? (
    <Press scale={0.97} style={styles.tile} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>{body}</Press>
  ) : (
    <View style={styles.tile}>{body}</View>
  );
}

function LinkRow({ icon: Icon, label, note, onPress, last = false }) {
  return (
    <Press scale={0.99} style={[styles.linkRow, !last && styles.linkBorder]} onPress={onPress} accessibilityLabel={label}>
      <View style={styles.linkIcon}>
        <Icon color={colors.textSecondary} size={18} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowMeta}>{note}</Text>
      </View>
      <ChevronRight color={colors.textFaint} size={18} />
    </Press>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  navSpacer: { width: 40 },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 22 },
  avatarWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute', right: -2, bottom: -2,
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.background,
  },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  title: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  since: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sinceText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  pill: {
    flex: 1, height: 46, borderRadius: 23,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pillQuiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pillTextOn: { color: colors.onAccent },

  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 22, padding: 16, marginBottom: 12,
  },

  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  levelBadge: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  levelSmall: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  levelBig: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, lineHeight: 32, fontVariant: ['tabular-nums'] },
  tierName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  totalXp: { color: colors.textMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 4 },
  levelNote: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 8 },
  levelHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },

  strip: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 0 },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  stripCell: { flex: 1, alignItems: 'center' },
  stripValue: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  stripLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sectionAside: { color: colors.textFaint, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  bleed: { marginHorizontal: -20, marginBottom: 12 },
  friendRow: { paddingHorizontal: 20, gap: 14 },
  friend: { width: 64, alignItems: 'center' },
  friendName: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6, maxWidth: 64 },
  friendLevel: { color: colors.textFaint, fontSize: 10, fontWeight: '600', marginTop: 1 },
  addFriend: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accentBorder,
  },

  softIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  muted: { color: colors.textMuted, fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: {
    width: '48%', flexGrow: 1, padding: 14, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tileIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 10, fontVariant: ['tabular-nums'] },
  tileLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  tileNote: { color: colors.textFaint, fontSize: 11, marginTop: 4 },

  badgeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  badgeItem: { width: '23%', alignItems: 'center' },
  badgeCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeOn: { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
  badgeOff: { backgroundColor: colors.surface, borderColor: colors.border },
  badgeName: { color: colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  badgeNameOff: { color: colors.textFaint },
  nextUp: {},
  nextUpDivider: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  eyebrow: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  nextCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  activity: { marginBottom: 8, paddingVertical: 14 },
  volume: { color: colors.gold, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  links: { paddingVertical: 0, marginTop: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  linkBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  linkIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
});
