import { useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, spacing } from '../theme';
import AmbientGlow from '../components/AmbientGlow';
import Press from '../components/Press';
import ScreenHeader from '../components/ScreenHeader';
import StatsScreen from './StatsScreen';
import HistoryScreen from './HistoryScreen';
import RecordsScreen from './RecordsScreen';
import AchievementsScreen from './AchievementsScreen';

/**
 * Everything that accumulates, in one place.
 *
 * Analytics, History and Records were each reachable only through the sidebar
 * menu, which is where features go to be forgotten. They are the part of the
 * app that pays off logging a workout at all — the reason to fill in the
 * weights is being able to look at them later.
 *
 * Reached from the profile rather than the tab bar. This is not somewhere you
 * go several times a day; it is where you look at what you have accumulated,
 * which is what a profile is for.
 *
 * The three keep their own files and stay routable on their own; they take an
 * `embedded` prop that drops their back button and background so they can be
 * rendered as panels here.
 */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'records', label: 'Records' },
  { id: 'badges', label: 'Badges' },
];

export default function ProgressScreen({ navigation }) {
  const [tab, setTab] = useState('overview');

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={300} intensity={0.24} />

        <ScreenHeader title="Progress" compact />

        <View style={styles.segments}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <Press
                key={t.id}
                scale={0.98}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setTab(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t.label}
                </Text>
              </Press>
            );
          })}
        </View>

        {/* Mounted one at a time rather than all four hidden behind opacity:
            each one fetches on mount, so keeping them alive would fire four
            sets of queries every time this opens. */}
        <View style={{ flex: 1 }}>
          {tab === 'overview' && <StatsScreen navigation={navigation} embedded />}
          {tab === 'history' && <HistoryScreen navigation={navigation} embedded />}
          {tab === 'records' && <RecordsScreen navigation={navigation} embedded />}
          {tab === 'badges' && <AchievementsScreen navigation={navigation} embedded />}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: colors.surfaceHigh },
  // Four segments now, so the label drops a point to keep one line each.
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
});
