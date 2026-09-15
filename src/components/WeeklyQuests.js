import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Dumbbell, Timer, Footprints, Droplets, Zap, CheckCircle2 } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { supabase } from '../lib/supabase';
import { deviceTimeZone } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import Press from './Press';
import { useT } from '../i18n';

/**
 * This week's quests: the app's goals, with rewards, beside the daily list
 * that is the player's own.
 *
 * Nothing here is counted on the phone. get_weekly_quests works the progress
 * out from what the server already holds, and claim_weekly_quest checks it
 * again before paying — see 20260917_weekly_quests.sql. The card only shows
 * the numbers and offers the button once a goal is met.
 *
 * Hidden when signed out or when the list is empty, rather than showing a
 * placeholder: a card of goals nobody can reach is noise on the dashboard.
 */

const ICONS = { workouts: Dumbbell, minutes: Timer, steps: Footprints, water_days: Droplets };
const TINTS = { workouts: colors.activity, minutes: colors.accent, steps: colors.accent, water_days: colors.water };

const CLAIM_ERRORS = {
  not_complete: 'This quest is not finished yet.',
  already_claimed: 'You already claimed this one.',
  unknown_quest: 'This quest is no longer available.',
};

function formatAmount(value, metric) {
  const n = Math.round(Number(value) || 0);
  if (metric === 'minutes') return `${n}`;
  return n.toLocaleString('en-US');
}

/** "3d 4h" or "5h 12m" until the Monday reset. */
function resetsIn(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h ${Math.floor(ms / 60_000) % 60}m`;
}

export default function WeeklyQuests({ onClaimed }) {
  const { user, refreshProfile } = useAuth();
  const { t } = useT();
  const [quests, setQuests] = useState(null);
  const [claiming, setClaiming] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setQuests(null);
      return;
    }
    const { data, error } = await supabase.rpc('get_weekly_quests', { p_tz: deviceTimeZone() });
    // A failed load keeps whatever was showing: the card is a bonus, and
    // blanking it for a dropped request would read as the quests vanishing.
    if (!error) setQuests(data || []);
  }, [user]);

  // On focus, so a workout finished a moment ago shows up on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const claim = async (quest) => {
    if (claiming) return;
    setClaiming(quest.code);
    const { data, error } = await supabase.rpc('claim_weekly_quest', { p_code: quest.code, p_tz: deviceTimeZone() });
    setClaiming(null);

    if (error || !data?.ok) {
      Alert.alert(t('Could not claim'), t(CLAIM_ERRORS[data?.reason] || 'Something went wrong. Try again.'));
      load();
      return;
    }

    setQuests((list) => (list || []).map((q) => (q.code === quest.code ? { ...q, claimed: true } : q)));
    refreshProfile?.();
    onClaimed?.(data);
  };

  if (!user || !quests?.length) return null;

  const claimed = quests.filter((q) => q.claimed).length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.title}>{t('This week')}</Text>
          <Text style={styles.subtitle}>
            {claimed === quests.length ? t('Every quest claimed') : t('{claimed} of {total} claimed', { claimed, total: quests.length })}
            {' · '}
            {t('resets in {time}', { time: resetsIn(quests[0].resets_at) })}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        {quests.map((quest) => {
          const Icon = ICONS[quest.metric] || Zap;
          const ratio = quest.target > 0 ? Math.min(1, quest.progress / quest.target) : 0;
          const ready = !quest.claimed && ratio >= 1;
          const tint = TINTS[quest.metric] || colors.accent;

          return (
            <View key={quest.code} style={styles.row}>
              <View style={[styles.iconDisc, { backgroundColor: `${tint}22` }]}>
                <Icon color={tint} size={16} />
              </View>

              <View style={styles.flex}>
                <View style={styles.titleLine}>
                  <Text style={[styles.rowTitle, quest.claimed && styles.rowTitleDone]} numberOfLines={1}>
                    {quest.title}
                  </Text>
                  <Text style={styles.count}>
                    {formatAmount(quest.progress, quest.metric)}/{formatAmount(quest.target, quest.metric)}
                  </Text>
                </View>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${Math.round(ratio * 100)}%`, backgroundColor: quest.claimed ? colors.textFaint : tint },
                    ]}
                  />
                </View>
              </View>

              {quest.claimed ? (
                <View style={styles.claimed} accessibilityLabel={`${quest.title}, claimed`}>
                  <CheckCircle2 color={colors.success} size={18} />
                </View>
              ) : ready ? (
                <Press hitSlop={7}
                  scale={0.95}
                  onPress={() => claim(quest)}
                  style={styles.claimBtn}
                  accessibilityLabel={t('Claim {energy} energy and {xp} XP for {title}', { energy: quest.energy, xp: quest.xp, title: quest.title })}
                >
                  {claiming === quest.code ? (
                    <ActivityIndicator color={colors.onGold} size="small" />
                  ) : (
                    <>
                      <Zap color={colors.onGold} fill={colors.onGold} size={12} />
                      <Text style={styles.claimText}>{quest.energy}</Text>
                    </>
                  )}
                </Press>
              ) : (
                <View style={styles.reward} accessibilityLabel={t('Reward: {energy} energy and {xp} XP', { energy: quest.energy, xp: quest.xp })}>
                  <Zap color={colors.gold} size={12} />
                  <Text style={styles.rewardText}>{quest.energy}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.md,
    marginHorizontal: 20,
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },

  rows: { marginTop: spacing.md, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconDisc: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  rowTitleDone: { color: colors.textMuted },
  count: { color: colors.textMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', borderRadius: 3 },

  claimBtn: {
    minWidth: 58, height: 30, paddingHorizontal: 10, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.gold,
  },
  claimText: { color: colors.onGold, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reward: { minWidth: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  rewardText: { color: colors.gold, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  claimed: { minWidth: 58, alignItems: 'flex-end' },
});
