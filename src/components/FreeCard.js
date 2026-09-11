import { View, Text, StyleSheet } from 'react-native';
import { Gift, Check, Clock } from 'lucide-react-native';
import { colors } from '../theme';
import { DAILY_REWARDS } from '../constants/content';
import Press from './Press';

/**
 * The free slot in the daily shop.
 *
 * The same seven-day ladder as before, drawn as a shop item rather than as a
 * panel. Sitting beside things that cost energy is what makes "free" mean
 * something — a rewards card on its own is just a button, and the ladder that
 * makes tomorrow worth returning for was doing its work in a subtitle.
 *
 * Every rung is still visible, including the ones taken and the ones ahead.
 * Seeing Saturday's reward on a Monday is the mechanic; hiding it would be the
 * blind box the old spin was.
 *
 * `day` is the last day claimed (0 = never) and `claimedToday` whether today is
 * taken. Both come from the server — the client never decides.
 */
export default function FreeCard({ day = 0, claimedToday, claiming, onClaim }) {
  const nextDay = claimedToday ? day : (day >= 7 ? 1 : day + 1);
  const reward = DAILY_REWARDS[nextDay - 1];

  return (
    <Press
      scale={0.97}
      style={[styles.card, claimedToday && styles.cardDone]}
      onPress={onClaim}
      disabled={claimedToday || claiming}
      accessibilityLabel={claimedToday ? 'Already collected today' : `Collect day ${nextDay}: ${describe(reward)}`}
    >
      {/* The ribbon is the whole point of the tile. It has to be the first
          thing read, before the contents or the day number. */}
      <View style={[styles.ribbon, claimedToday && styles.ribbonDone]}>
        <Text style={[styles.ribbonText, claimedToday && styles.ribbonTextDone]}>
          {claimedToday ? 'TAKEN' : 'FREE'}
        </Text>
      </View>

      <View style={[styles.glyph, claimedToday && styles.glyphDone]}>
        {claimedToday
          ? <Check color={colors.textFaint} size={30} strokeWidth={3} />
          : <Gift color={colors.energy} size={30} />}
      </View>

      <Text style={styles.reward} numberOfLines={2}>
        {claimedToday ? 'Back tomorrow' : describe(reward)}
      </Text>

      {/* Seven pips, not seven boxes. At this size the ladder is a progress
          reading rather than a list you pick from. */}
      <View style={styles.pips}>
        {DAILY_REWARDS.map((r) => {
          const taken = claimedToday ? r.day <= day : r.day < nextDay;
          const isNext = !claimedToday && r.day === nextDay;

          return (
            <View
              key={r.day}
              style={[
                styles.pip,
                r.day === 7 && styles.pipLast,
                taken && styles.pipTaken,
                isNext && styles.pipNext,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        {claimedToday ? <Clock color={colors.textFaint} size={12} /> : null}
        <Text style={styles.footerText}>
          {claiming ? 'Collecting…' : claimedToday ? 'Resets at midnight' : `Day ${nextDay} of 7`}
        </Text>
      </View>
    </Press>
  );
}

/** "200 energy + a freeze" — what the tile actually hands over. */
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
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 26,
    paddingTop: 30,
    paddingBottom: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 216, 74, 0.35)',
    overflow: 'hidden',
  },
  cardDone: { borderColor: colors.border, backgroundColor: '#191C22' },

  ribbon: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: colors.energy,
    paddingVertical: 4,
    alignItems: 'center',
  },
  ribbonDone: { backgroundColor: colors.surfaceHigh },
  ribbonText: { color: '#2A1F00', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  ribbonTextDone: { color: colors.textMuted },

  glyph: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255, 216, 74, 0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 6,
  },
  glyphDone: { backgroundColor: 'rgba(255,255,255,0.04)' },

  reward: {
    color: colors.text, fontSize: 14, fontWeight: '700',
    textAlign: 'center', marginTop: 12, minHeight: 36,
  },

  pips: { flexDirection: 'row', gap: 4, marginTop: 4 },
  pip: { width: 12, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh },
  pipLast: { width: 18, backgroundColor: colors.surfaceRaised },
  pipTaken: { backgroundColor: colors.accent },
  pipNext: { backgroundColor: colors.energy },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  footerText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
