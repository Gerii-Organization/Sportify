import { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Users, Trophy, ChevronLeft, Flame, Shield, Dumbbell } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { levelFromXp } from '../lib/level';
import { deviceTimeZone } from '../lib/date';
import { seasonName, seasonTimeLeft, rankLine } from '../lib/seasons';
import { gradients } from '../theme';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AmbientGlow from '../components/AmbientGlow';
import { unwrap } from '../lib/query';
import { SkeletonLeaderboard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import NameBadge from '../components/NameBadge';
import useRefresh from '../lib/useRefresh';


/**
 * `embedded` drops the screen's own background and nav row so it can render as
 * a panel inside Social. It is one of three lists about other people — chats,
 * feed, ranking — and reaching it meant a trophy button in the corner while the
 * other two were a tap apart.
 */
export default function LeaderboardScreen({ embedded = false }) {
  const { refreshControl } = useRefresh(() => fetchData());
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('friends');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [error, setError] = useState(null);
  /** The signed-in user's groups, and the one the Groups board is showing. */
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  // Read by fetchData, which is created fresh each render but called from a
  // focus effect that does not re-run when the chip changes.
  const groupIdRef = useRef(null);
  /** Global board: this month's season, or all-time XP. */
  const [globalScope, setGlobalScope] = useState('season');
  const [season, setSeason] = useState(null);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab, user?.id, globalScope])
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        // public_profiles is closed to anon (20260916), so a guest's query only
        // ever came back "permission denied". Guests get a sign-in prompt.
        setMyId(null);
        setLeaderboardData([]);
        return;
      }
      setMyId(user.id);

      if (activeTab === 'friends') {
        await fetchFriendsLeaderboard(user.id);
      } else if (activeTab === 'groups') {
        await fetchGroupLeaderboard(user.id);
      } else {
        await fetchGlobalLeaderboard();
      }
    } catch (e) {
      // An empty board and an unreachable one used to render the same blank
      // scroll view. On the friends tab that blank reads as "you have no
      // friends", which is a rough thing to be told by a failed request.
      setError(e?.message || 'Something went wrong.');
      setLeaderboardData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendsLeaderboard = async (userId) => {
    // Accepted friendships only.
    const fData = await unwrap(supabase.from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`));

    let ids = [userId]; // The current user ranks alongside their friends.
    if (fData) {
      fData.forEach(f => {
        ids.push(f.user_id === userId ? f.friend_id : f.user_id);
      });
    }

    // Profiles, highest XP first.
    const pData = await unwrap(supabase.from('public_profiles')
      .select('*')
      .in('id', ids)
      .order('xp', { ascending: false }));

    setLeaderboardData(pData || []);
  };

  /**
   * One group's week: sessions and minutes since Monday, most first.
   *
   * Weekly rather than lifetime XP, because inside a group of five a lifetime
   * board is settled by who joined first. The counts come from
   * get_group_leaderboard — other people's sessions are private under RLS, and
   * the function only answers for a group you are in.
   */
  const fetchGroupLeaderboard = async (userId, preferredId = groupIdRef.current) => {
    const memberships = await unwrap(supabase.from('group_members').select('group_id').eq('user_id', userId));
    const ids = (memberships || []).map((m) => m.group_id);
    const mine = ids.length
      ? (await unwrap(supabase.from('groups').select('id, name').in('id', ids).order('created_at', { ascending: false }))) || []
      : [];
    setGroups(mine);

    const chosen = mine.some((g) => g.id === preferredId) ? preferredId : mine[0]?.id || null;
    groupIdRef.current = chosen;
    setGroupId(chosen);
    if (!chosen) {
      setLeaderboardData([]);
      return;
    }

    const board = await unwrap(supabase.rpc('get_group_leaderboard', { p_group_id: chosen, p_tz: deviceTimeZone() }));
    setLeaderboardData(board || []);
  };

  const selectGroup = async (id) => {
    if (!user || id === groupIdRef.current) return;
    groupIdRef.current = id;
    setGroupId(id);
    setLoading(true);
    setError(null);
    try {
      await fetchGroupLeaderboard(user.id, id);
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
      setLeaderboardData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalLeaderboard = async () => {
    if (user && globalScope === 'season') {
      // Pays out last month's podium the first time anyone looks. Idempotent.
      await supabase.rpc('settle_last_season');
      const [mine, board] = await Promise.all([
        unwrap(supabase.rpc('get_my_season')),
        unwrap(supabase.rpc('get_season_leaderboard', { p_scope: 'global' })),
      ]);
      setSeason(mine);
      setLeaderboardData(board || []);
      return;
    }
    const data = await unwrap(supabase.from('public_profiles')
      .select('*')
      .order('xp', { ascending: false })
      .limit(50));
    setLeaderboardData(data || []);
  };


  const renderUserItem = (item, index) => {
    const level = levelFromXp(item.xp);
    const isMe = item.id === myId;

    return (
      <TouchableOpacity activeOpacity={0.7} 
        key={item.id || index} 
        style={[styles.userCard, isMe && styles.myUserCard]}
        onPress={() => navigation.navigate('PublicProfileScreen', { userId: item.id })}
      >
        <View style={styles.rankBox}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        <Avatar profile={item} rank={index + 1} />

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.first_name || 'Athlete'} {isMe && '(you)'}
            </Text>
            {/* Icon only here: a labelled pill on every row would compete with
                the rank number, which is what the list is actually for. */}
            <NameBadge badgeId={item.equipped_badge} size={14} />
          </View>
          <Text style={styles.userTitle}>{item.equipped_title || 'Novice'} • Lvl {level}</Text>
        </View>

        {activeTab === 'global' && globalScope === 'season' && user ? (
          <View style={styles.userStats}>
            <View style={styles.statChipWeek}>
              <Text style={styles.statChipTextWeek}>{item.season_points || 0} pts</Text>
            </View>
            <View style={styles.statChip}>
              <Flame color={colors.streak} size={14} fill={colors.streak} />
              <Text style={styles.statChipText}>{item.current_streak || 0}</Text>
            </View>
          </View>
        ) : activeTab === 'groups' ? (
          <View style={styles.userStats}>
            <View style={styles.statChipWeek}>
              <Dumbbell color={colors.accent} size={14} />
              <Text style={styles.statChipTextWeek}>{item.workouts_week || 0}</Text>
            </View>
            <View style={styles.statChipXP}>
              <Text style={styles.statChipTextXP}>{item.minutes_week || 0} min</Text>
            </View>
          </View>
        ) : (
          <View style={styles.userStats}>
            <View style={styles.statChip}>
              <Flame color={colors.streak} size={14} fill={colors.streak} />
              <Text style={styles.statChipText}>{item.current_streak || 0}</Text>
            </View>
            <View style={styles.statChipXP}>
              <Text style={styles.statChipTextXP}>{item.xp || 0} XP</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const content = !user ? (
    <EmptyState
      icon={<Trophy color={colors.textFaint} size={44} />}
      title="Rankings need an account"
      message="Sign in to see how you compare with your friends and everyone else training on Sportify."
      actionLabel="Log in or sign up"
      onAction={() => navigation.navigate('AuthScreen')}
    />
  ) : (
    <>
        {/* TOGGLE PENTRU CLASAMENTE */}
        <View style={styles.toggleContainerWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity activeOpacity={0.7} 
              style={[styles.toggleBtn, activeTab === 'friends' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Users color={activeTab === 'friends' ? colors.onAccent : colors.textFaint} size={18} />
              <Text style={[styles.toggleText, activeTab === 'friends' && styles.toggleTextActive]}>Friends</Text>
            </TouchableOpacity>

            {/* Groups are membership, so there is nothing to show a guest. */}
            {user ? (
              <TouchableOpacity activeOpacity={0.7}
                style={[styles.toggleBtn, activeTab === 'groups' && styles.toggleBtnActive]}
                onPress={() => setActiveTab('groups')}
              >
                <Shield color={activeTab === 'groups' ? colors.onAccent : colors.textFaint} size={18} />
                <Text style={[styles.toggleText, activeTab === 'groups' && styles.toggleTextActive]}>Groups</Text>
              </TouchableOpacity>
            ) : null}
            
            <TouchableOpacity activeOpacity={0.7} 
              style={[styles.toggleBtn, activeTab === 'global' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('global')}
            >
              <Trophy color={activeTab === 'global' ? colors.onAccent : colors.textFaint} size={18} />
              <Text style={[styles.toggleText, activeTab === 'global' && styles.toggleTextActive]}>Global</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'global' && user ? (
          <View style={styles.seasonWrap}>
            <View style={styles.scopeRow}>
              {[['season', 'This season'], ['all', 'All time']].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.7}
                  onPress={() => setGlobalScope(key)}
                  style={[styles.scopeChip, globalScope === key && styles.scopeChipOn]}
                  accessibilityState={{ selected: globalScope === key }}
                >
                  <Text style={[styles.scopeText, globalScope === key && styles.scopeTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {globalScope === 'season' && season?.ok ? (
              <View style={styles.seasonCard}>
                <View style={styles.seasonHead}>
                  <Text style={styles.seasonName}>{seasonName(season.season)} season</Text>
                  <Text style={styles.seasonLeft}>{seasonTimeLeft(season.ends_at)}</Text>
                </View>
                <Text style={styles.seasonMine}>
                  {rankLine(season.rank)} · {season.points || 0} pts
                </Text>
                <Text style={styles.seasonNote}>
                  10 pts a day you train, +1 per 10 minutes. Top 3 win a title and energy.
                </Text>
                {season.podium?.length ? (
                  <Text style={styles.seasonPodium} numberOfLines={2}>
                    Last season: {season.podium.map((p) => `${p.rank}. ${p.user_id === myId ? 'You' : p.first_name || 'Athlete'}`).join('  ')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'groups' && groups.length > 0 ? (
          <View style={styles.groupBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  activeOpacity={0.7}
                  onPress={() => selectGroup(group.id)}
                  style={[styles.groupChip, group.id === groupId && styles.groupChipActive]}
                  accessibilityState={{ selected: group.id === groupId }}
                >
                  <Text style={[styles.groupChipText, group.id === groupId && styles.groupChipTextActive]} numberOfLines={1}>
                    {group.name || 'Group'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.groupNote}>Workouts this week · resets Monday</Text>
          </View>
        ) : null}

        {error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : loading ? (
          <SkeletonLeaderboard count={7} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
            {leaderboardData.length === 0 ? (
              <EmptyState
                icon={<Users color={colors.textFaint} size={44} />}
                title={activeTab === 'friends' ? 'No one to rank yet' : activeTab === 'groups' ? 'No groups yet' : 'Nobody on the board'}
                message={activeTab === 'friends'
                  ? 'Add friends to see how you compare.'
                  : activeTab === 'groups'
                    ? 'Start a group chat with a few friends and see who trains most each week.'
                    : 'The global board fills up as people train.'}
              />
            ) : (
              leaderboardData.map((user, index) => renderUserItem(user, index))
            )}
          </ScrollView>
        )}

    </>
  );

  if (embedded) return content;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradientBg}>
        <AmbientGlow tone="ember" height={280} intensity={0.4} />

        {/* HEADER DE NAVIGARE */}
        <View style={styles.navHeader}>
          <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{width: 28}} /> {/* Spacer pentru centrare */}
        </View>

        {content}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: { flex: 1 },
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  backBtn: { padding: 6 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  
  toggleContainerWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 6 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14 },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontWeight: '600', marginLeft: 10 },
  toggleTextActive: { color: colors.onAccent },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Inside the Social tab now, so the list has to clear the floating bar —
  // the same 130 the feed beside it uses.
  scrollContent: { paddingHorizontal: 20, paddingBottom: 130 },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 24, marginBottom: 10 },
  myUserCard: { borderColor: colors.accent + '55', backgroundColor: 'rgba(155, 157, 214, 0.05)' },
  rankBox: { width: 30, alignItems: 'center' },
  rankText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  
  avatarBase: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  crownRank: { position: 'absolute', top: -14, left: -6, transform: [{rotate: '-15deg'}] },
  
  userInfo: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  userTitle: { color: colors.accent, fontSize: 13, marginTop: 2 },
  
  userStats: { alignItems: 'flex-end' },
  statChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(224, 161, 122, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 6 },
  statChipText: { color: colors.streak, fontWeight: '600', fontSize: 13, marginLeft: 6 },
  statChipXP: { backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statChipWeek: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(155, 157, 214, 0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 6 },
  statChipTextWeek: { color: colors.accent, fontWeight: '600', fontSize: 13, marginLeft: 6 },

  groupBar: { marginBottom: 12 },
  seasonWrap: { paddingHorizontal: 20, marginBottom: 12, gap: 10 },
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  scopeChipOn: { backgroundColor: colors.surfaceHigh, borderColor: colors.accent },
  scopeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  scopeTextOn: { color: colors.text },
  seasonCard: { backgroundColor: colors.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.goldBorder },
  seasonHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  seasonName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  seasonLeft: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  seasonMine: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  seasonNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  seasonPodium: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  groupChips: { paddingHorizontal: 20, gap: 8 },
  groupChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 180 },
  groupChipActive: { backgroundColor: colors.surfaceHigh, borderColor: colors.accent },
  groupChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  groupChipTextActive: { color: colors.text },
  groupNote: { color: colors.textMuted, fontSize: 12, marginTop: 8, paddingHorizontal: 20 },
  statChipTextXP: { color: colors.text, fontWeight: '600', fontSize: 13 },
});