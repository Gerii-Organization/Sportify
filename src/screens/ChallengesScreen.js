import { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Plus, Swords, Trophy, Check, Zap } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { unwrap } from '../lib/query';
import {
  METRICS, DURATIONS, WINNER_BONUS, formatScore, timeLeft, standings, winners, CREATE_ERRORS,
} from '../lib/challenges';
import Avatar from '../components/Avatar';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

/**
 * Challenges between friends (roadmap S1).
 *
 * Invites first, because they are waiting on you; then what is running, with
 * live standings; then what ended in the last month, with who won. Scores and
 * payouts come from the server — this screen settles anything that has ended
 * before it reads, so opening it is what pays a finished challenge out.
 */
export default function ChallengesScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const { data: settled } = await supabase.rpc('settle_my_challenges');
      if (settled?.settled > 0) refreshProfile?.();

      const [list, friendRows] = await Promise.all([
        unwrap(supabase.rpc('get_my_challenges')),
        unwrap(supabase.from('friendships').select('user_id, friend_id').eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)),
      ]);
      const ids = (friendRows || []).map((row) => (row.user_id === user.id ? row.friend_id : row.user_id));
      const people = ids.length ? await unwrap(supabase.from('public_profiles').select('*').in('id', ids)) : [];

      setChallenges(list || []);
      setFriends((people || []).sort((a, b) => String(a.first_name || '').localeCompare(String(b.first_name || ''))));
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [user, refreshProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (challenge, join) => {
    setBusy(challenge.id);
    const { data } = await supabase.rpc('respond_challenge', { p_challenge: challenge.id, p_join: join });
    setBusy(null);
    if (!data?.ok) {
      Alert.alert('Could not respond', 'This challenge may have ended.');
    }
    load();
  };

  const invites = challenges.filter((c) => c.status === 'active' && c.my_status === 'invited');
  const running = challenges.filter((c) => c.status === 'active' && c.my_status === 'joined');
  const ended = challenges.filter((c) => c.status === 'settled');

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="ember" height={300} intensity={0.3} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.round} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>Challenges</Text>
          <Press scale={0.92} onPress={() => setCreating(true)} style={[styles.round, styles.roundPrimary]} accessibilityLabel="Start a challenge">
            <Plus color={colors.onAccent} size={20} />
          </Press>
        </View>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : challenges.length === 0 ? (
          <EmptyState
            icon={<Swords color={colors.textFaint} size={44} />}
            title="No challenges yet"
            message={`Pick a few friends and race them for a week. The winner gets ${WINNER_BONUS} energy.`}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {invites.length ? <Text style={styles.section}>Invites</Text> : null}
            {invites.map((c, i) => {
              const from = (c.participants || []).find((p) => p.status === 'joined');
              return (
                <FadeIn key={c.id} index={i} style={styles.card}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.meta}>
                    {from?.first_name ? `${from.first_name} invited you · ` : ''}{METRICS[c.metric]?.label} · {timeLeft(c.ends_at)}
                  </Text>
                  <View style={styles.actions}>
                    <Button label="Decline" variant="secondary" onPress={() => respond(c, false)} style={styles.flex} disabled={busy === c.id} />
                    <Button label="Join" onPress={() => respond(c, true)} style={styles.flex} loading={busy === c.id} />
                  </View>
                </FadeIn>
              );
            })}

            {running.length ? <Text style={styles.section}>Running</Text> : null}
            {running.map((c, i) => (
              <FadeIn key={c.id} index={invites.length + i} style={styles.card}>
                <ChallengeCard challenge={c} me={user?.id} />
              </FadeIn>
            ))}

            {ended.length ? <Text style={styles.section}>Ended</Text> : null}
            {ended.map((c, i) => {
              const top = winners(c.participants);
              return (
                <FadeIn key={c.id} index={invites.length + running.length + i} style={styles.card}>
                  <ChallengeCard challenge={c} me={user?.id} />
                  <View style={styles.result}>
                    <Trophy color={colors.gold} size={16} />
                    <Text style={styles.resultText}>
                      {top.length
                        ? `${top.map((w) => (w.user_id === user?.id ? 'You' : w.first_name || 'Someone')).join(' & ')} won`
                        : 'Nobody scored, so nobody won'}
                    </Text>
                    {c.my_reward > 0 ? (
                      <View style={styles.reward}>
                        <Zap color={colors.gold} size={12} fill={colors.gold} />
                        <Text style={styles.rewardText}>+{c.my_reward}</Text>
                      </View>
                    ) : null}
                  </View>
                </FadeIn>
              );
            })}
          </ScrollView>
        )}

        <NewChallengeSheet
          visible={creating}
          friends={friends}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

function ChallengeCard({ challenge, me }) {
  const { rows, top } = standings(challenge.participants);
  return (
    <>
      <View style={styles.cardHead}>
        <Text style={[styles.title, styles.flex]} numberOfLines={1}>{challenge.title}</Text>
        <Text style={styles.meta}>{challenge.status === 'active' ? timeLeft(challenge.ends_at) : 'Final'}</Text>
      </View>
      <Text style={styles.metaLine}>{METRICS[challenge.metric]?.label}</Text>
      {rows.map((p) => {
        const mine = p.user_id === me;
        const share = top > 0 ? Math.max(0.04, p.score / top) : 0;
        return (
          <View key={p.user_id} style={[styles.row, mine && styles.rowMine]}>
            <Text style={styles.rank}>{p.rank ?? '–'}</Text>
            <Avatar profile={p} size={30} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {mine ? 'You' : p.first_name || 'Athlete'}{p.status === 'invited' ? ' · invited' : ''}
              </Text>
              {p.status === 'joined' ? (
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} /></View>
              ) : null}
            </View>
            <Text style={styles.score}>{p.status === 'joined' ? formatScore(p.score, challenge.metric) : ''}</Text>
          </View>
        );
      })}
    </>
  );
}

function NewChallengeSheet({ visible, friends, onClose, onCreated }) {
  const [metric, setMetric] = useState('days');
  const [days, setDays] = useState(7);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, 10)));

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const name = title.trim() || `${METRICS[metric].defaultTitle}, ${days} days`;
    const { data, error } = await supabase.rpc('create_challenge', {
      p_title: name, p_metric: metric, p_days: days, p_friends: picked,
    });
    setSaving(false);
    if (error || !data?.ok) {
      Alert.alert('Could not start the challenge', CREATE_ERRORS[data?.reason] || 'Try again in a moment.');
      return;
    }
    setTitle('');
    setPicked([]);
    onCreated?.();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New challenge">
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={`${METRICS[metric].defaultTitle}, ${days} days`}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        maxLength={60}
      />

      <Text style={styles.label}>Counts</Text>
      <View style={styles.segment}>
        {Object.entries(METRICS).map(([key, m]) => (
          <Press key={key} scale={0.97} onPress={() => setMetric(key)} style={[styles.segmentItem, metric === key && styles.segmentOn]} accessibilityState={{ selected: metric === key }}>
            <Text style={[styles.segmentText, metric === key && styles.segmentTextOn]}>{m.label}</Text>
          </Press>
        ))}
      </View>

      <Text style={styles.label}>Lasts</Text>
      <View style={styles.segment}>
        {DURATIONS.map((d) => (
          <Press key={d} scale={0.97} onPress={() => setDays(d)} style={[styles.segmentItem, days === d && styles.segmentOn]} accessibilityState={{ selected: days === d }}>
            <Text style={[styles.segmentText, days === d && styles.segmentTextOn]}>{d} days</Text>
          </Press>
        ))}
      </View>

      <Text style={styles.label}>Friends {picked.length ? `· ${picked.length}` : ''}</Text>
      {friends.length === 0 ? (
        <Text style={styles.emptyFriends}>Add friends first, then challenge them.</Text>
      ) : (
        <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
          {friends.map((f) => {
            const on = picked.includes(f.id);
            return (
              <Press key={f.id} scale={0.99} onPress={() => toggle(f.id)} style={styles.friend} accessibilityState={{ checked: on }} accessibilityLabel={f.first_name || 'Friend'}>
                <Avatar profile={f} size={32} />
                <Text style={[styles.name, styles.flex]} numberOfLines={1}>{f.first_name || 'Athlete'}</Text>
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Check color={colors.onAccent} size={14} /> : null}</View>
              </Press>
            );
          })}
        </ScrollView>
      )}

      <Button label="Start challenge" onPress={create} loading={saving} disabled={!picked.length} style={{ marginTop: spacing.md }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  roundPrimary: { backgroundColor: colors.accent },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 60 },
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },

  card: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  metaLine: { color: colors.textFaint, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 12 },
  rowMine: { backgroundColor: colors.accentSoft },
  rank: { color: colors.textMuted, fontSize: 13, fontWeight: '700', width: 16, textAlign: 'center', fontVariant: ['tabular-nums'] },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: 5 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  score: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  result: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  resultText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rewardText: { color: colors.gold, fontSize: 13, fontWeight: '800' },

  input: { backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: spacing.md, marginBottom: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextOn: { color: colors.onAccent },
  friendList: { maxHeight: 220 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  emptyFriends: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
});
