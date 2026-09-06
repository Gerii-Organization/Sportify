import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { AchievementIcon } from '../lib/achievements';

/**
 * Replaces four hardcoded badges that were identical for every user and could
 * never be earned. Locked badges stay visible but dimmed, with their target
 * shown, because a badge you cannot see is not a goal.
 */
export default function AchievementGrid({ achievements }) {
  if (!achievements?.length) {
    return <Text style={styles.empty}>Achievements load once you start training.</Text>;
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <View>
      <Text style={styles.progress}>
        {unlockedCount} of {achievements.length} unlocked
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {achievements.map((achievement) => (
          <View key={achievement.code} style={styles.item}>
            <View style={[styles.circle, achievement.unlocked && styles.circleUnlocked]}>
              <AchievementIcon
                name={achievement.icon}
                size={22}
                color={achievement.unlocked ? colors.accent : colors.textFaint}
              />
            </View>
            <Text
              style={[styles.name, achievement.unlocked && styles.nameUnlocked]}
              numberOfLines={2}
            >
              {achievement.name}
            </Text>
            {!achievement.unlocked && (
              <Text style={styles.hint} numberOfLines={2}>{achievement.description}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  scroll: { flexDirection: 'row', marginTop: 6 },
  item: { alignItems: 'center', marginRight: spacing.lg, width: 78 },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  circleUnlocked: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  name: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  nameUnlocked: { color: colors.text },
  hint: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 3 },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
});
