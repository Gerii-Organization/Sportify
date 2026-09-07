import { View, Text, StyleSheet } from 'react-native';
import { Zap, Star, Snowflake, Check, Gift } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { DAILY_REWARDS } from '../constants/content';
import Press from './Press';

/**
 * The seven-day login ladder.
 *
 * Replaces a spin that rolled `random()` behind a button. A random prize cannot
 * be anticipated, so it gave no reason to open the app on any particular day —
 * and drawing 30 energy the morning after drawing 150 reads as a penalty for
 * coming back.
 *
 * Every day is drawn, including the ones already taken and the ones still
 * ahead. Seeing Sunday's reward on Monday is the mechanic; hiding it would
 * leave the same blind box the spin was.
 *
 * `day` is the last day claimed (0 = never), `claimedToday` whether today is
 * already taken. Both come from the server — the client never decides.
 */
export default function DailyRewardCard({ day = 0, claimedToday, onClaim, claiming }) {
  // The next unclaimed rung. After a full week it wraps back to the start.
  const nextDay = claimedToday ? day : (day >= 7 ? 1 : day + 1);
  const reward = DAILY_REWARDS[nextDay - 1];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.giftWrap}>
          <Gift color={claimedToday ? colors.textFaint : colors.energy} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily reward</Text>
          <Text style={styles.subtitle}>
            {claimedToday
              ? `Day ${day} claimed. Come back tomorrow.`
              : `Day ${nextDay} · ${describe(reward)}`}
          </Text>
        </View>
      </View>

      <View style={styles.ladder}>
        {DAILY_REWARDS.map((r) => {
          const taken = !claimedToday ? r.day < nextDay : r.day <= day;
          const isNext = !claimedToday && r.day === nextDay;
          const big = r.day === 7;

          return (
            <View
              key={r.day}
              style={[
                styles.rung,
                big && styles.rungBig,
                taken && styles.rungTaken,
                isNext && styles.rungNext,
              ]}
            >
              {taken ? (
                <Check color={colors.accent} size={14} strokeWidth={3} />
              ) : (
                <RewardGlyph reward={r} dim={!isNext} />
              )}
              <Text style={[styles.rungDay, isNext && { color: colors.energy }]}>
                {r.day}
              </Text>
            </View>
          );
        })}
      </View>

      <Press
        scale={0.98}
        onPress={onClaim}
        disabled={claimedToday || claiming}
        style={[styles.button, claimedToday && styles.buttonDone]}
        accessibilityLabel={claimedToday ? 'Already claimed today' : `Claim day ${nextDay} reward`}
      >
        <Text style={[styles.buttonText, claimedToday && styles.buttonTextDone]}>
          {claimedToday ? 'Claimed today' : claiming ? 'Claiming…' : `Claim ${describe(reward)}`}
        </Text>
      </Press>
    </View>
  );
}

function RewardGlyph({ reward, dim }) {
  const tint = dim ? colors.textFaint : colors.energy;
  if (reward.freezes) return <Snowflake color={dim ? colors.textFaint : colors.water} size={14} />;
  if (reward.xp) return <Star color={dim ? colors.textFaint : colors.xp} size={14} />;
  return <Zap color={tint} size={14} />;
}

/** "200 energy + a freeze" — what the button actually hands over. */
function describe(reward) {
  if (!reward) return '';
  const parts = [];
  if (reward.energy) parts.push(`${reward.energy} energy`);
  if (reward.xp) parts.push(`${reward.xp} XP`);
  if (reward.freezes) parts.push(reward.freezes === 1 ? 'a streak freeze' : `${reward.freezes} freezes`);
  return parts.join(' + ');
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  giftWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255, 216, 74, 0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  ladder: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  rung: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface,
  },
  // Day seven carries the freeze, so it is drawn as the end of the run rather
  // than as one more identical box.
  rungBig: { backgroundColor: colors.surfaceRaised },
  rungTaken: { backgroundColor: colors.accentSoft },
  rungNext: { backgroundColor: 'rgba(255, 216, 74, 0.16)' },
  rungDay: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },

  button: {
    marginTop: spacing.md,
    height: 44, borderRadius: 14,
    backgroundColor: colors.energy,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonDone: { backgroundColor: colors.surfaceHigh },
  buttonText: { color: '#2A1F00', fontSize: 15, fontWeight: '700' },
  buttonTextDone: { color: colors.textMuted },
});
