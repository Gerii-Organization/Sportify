import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera, Flame, Trophy, Dumbbell } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import Avatar from '../Avatar';
import NameBadge from '../NameBadge';
import Press from '../Press';

/**
 * The top of your profile, as other people would read it.
 *
 * What was here before was a form's worth of your own measurements — weight,
 * height, age — which is the one part of a profile nobody else can see and you
 * already know. This shows what a profile is FOR: who you are, how long you
 * have kept it up, and how many people are watching.
 *
 * `counts.available` is false until the follows migration is applied. The
 * social row then hides rather than showing three zeroes, which would read as
 * "nobody" instead of "not known yet".
 */
export default function ProfileHero({
  profile,
  level,
  levelXp,
  xpPercentage,
  counts,
  uploading,
  onChangePhoto,
  onOpenFollowers,
}) {
  const streak = profile?.current_streak || 0;

  return (
    <View style={styles.wrap}>
      <Press
        scale={0.96}
        onPress={onChangePhoto}
        style={styles.avatarWrap}
        accessibilityLabel={profile?.avatar_url ? 'Change your profile photo' : 'Add a profile photo'}
      >
        <Avatar profile={profile} size={104} />

        {/* Always visible, not only when there is no photo: "change it" needs
            to be as findable as "add one", and a long-press would hide it. */}
        <View style={styles.camera}>
          {uploading
            ? <ActivityIndicator color={colors.onAccent} size="small" />
            : <Camera color={colors.onAccent} size={15} />}
        </View>
      </Press>

      <Text style={styles.name} numberOfLines={1}>{profile?.first_name || 'Athlete'}</Text>

      <View style={styles.titleRow}>
        {profile?.equipped_title ? (
          <Text style={styles.title} numberOfLines={1}>{profile.equipped_title}</Text>
        ) : null}
        <NameBadge badgeId={profile?.equipped_badge} size={13} showLabel />
      </View>

      <View style={styles.levelBar}>
        <View style={[styles.levelFill, { width: xpPercentage }]} />
      </View>
      <Text style={styles.levelText}>Level {level} · {levelXp}/100 XP</Text>

      {counts?.available ? (
        <View style={styles.social}>
          <Stat value={counts.followers} label="followers" onPress={() => onOpenFollowers?.('followers')} />
          <View style={styles.socialRule} />
          <Stat value={counts.following} label="following" onPress={() => onOpenFollowers?.('following')} />
          <View style={styles.socialRule} />
          <Stat value={counts.friends} label="friends" onPress={() => onOpenFollowers?.('friends')} />
        </View>
      ) : null}

      <View style={styles.badges}>
        <Badge icon={<Flame color={colors.streak} size={15} fill={streak > 0 ? colors.streak : 'transparent'} />}
               text={`${streak} day streak`} tint={colors.streak} />
        <Badge icon={<Trophy color={colors.energy} size={15} />}
               text={`${(profile?.xp || 0).toLocaleString()} XP`} tint={colors.energy} />
        <Badge icon={<Dumbbell color={colors.accent} size={15} />}
               text={`${profile?.workouts_per_week || 0}× a week`} tint={colors.accent} />
      </View>
    </View>
  );
}

function Stat({ value, label, onPress }) {
  return (
    <Press scale={0.95} style={styles.statCell} onPress={onPress} accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{Number(value).toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Press>
  );
}

function Badge({ icon, text, tint }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${tint}1A` }]}>
      {icon}
      <Text style={[styles.badgeText, { color: tint }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  avatarWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute', right: -2, bottom: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.background,
  },

  name: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  title: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  levelBar: {
    width: 180, height: 5, borderRadius: 3,
    backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: spacing.md,
  },
  levelFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  levelText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 7 },

  social: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingVertical: 14, marginTop: spacing.lg, alignSelf: 'stretch',
  },
  socialRule: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.border },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3, letterSpacing: 0.3 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
