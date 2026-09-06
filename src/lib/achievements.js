import {
  Award, Crown, Dumbbell, Flame, Footprints, Star, Target, TrendingUp, Trophy, Users,
} from 'lucide-react-native';

/**
 * Achievement definitions live in the database as rows, so a new badge is an
 * INSERT rather than an app release. The database can only store the icon's
 * NAME, though — this maps that name back to a component.
 *
 * Anything unrecognised falls back to a trophy, so adding a badge with a new
 * icon never renders a blank space.
 */
const ICONS = {
  Award, Crown, Dumbbell, Flame, Footprints, Star, Target, TrendingUp, Trophy, Users,
};

export function AchievementIcon({ name, ...props }) {
  const Icon = ICONS[name] || Trophy;
  return <Icon {...props} />;
}

/**
 * Merges the full catalogue with what this user has unlocked, so the UI can
 * show locked badges greyed out rather than hiding them — seeing what is still
 * available is most of the motivation.
 */
export function mergeAchievements(catalogue, unlockedRows) {
  const unlockedAt = new Map((unlockedRows || []).map((row) => [row.code, row.unlocked_at]));

  return (catalogue || []).map((achievement) => ({
    ...achievement,
    unlocked: unlockedAt.has(achievement.code),
    unlockedAt: unlockedAt.get(achievement.code) ?? null,
  }));
}
