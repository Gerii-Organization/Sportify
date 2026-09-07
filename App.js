import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { House, UtensilsCrossed, Dumbbell, Users, TrendingUp, Store } from 'lucide-react-native';

import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme';

import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import WorkoutDetailScreen from './src/screens/WorkoutDetailScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import ShopScreen from './src/screens/ShopScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import StatsScreen from './src/screens/StatsScreen';
import StreakScreen from './src/screens/StreakScreen';
import MetricScreen from './src/screens/MetricScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import RecordsScreen from './src/screens/RecordsScreen';
import ChatScreen from './src/screens/ChatScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Feed used to sit here as its own tab. It is now a segment inside Social:
// both are "other people", and spending two of the bar's slots on one idea left
// no room for the parts of the app that pay off logging a workout.
//
// Labels are one word each because six tabs leave roughly 55pt of width apiece.
// "Dashboard" and "Progress" would both truncate.
//
// Icons name the destination rather than the mechanism: a fork over a barcode
// scanner (the screen is about food, not about scanning), a house over a
// dashboard grid.
const TABS = [
  { name: 'Dashboard', label: 'Home', component: DashboardScreen, icon: House },
  { name: 'Food', label: 'Food', component: ScannerScreen, icon: UtensilsCrossed },
  { name: 'Training', label: 'Train', component: TrainingScreen, icon: Dumbbell },
  { name: 'Social', label: 'Social', component: FriendsScreen, icon: Users },
  { name: 'Progress', label: 'Progress', component: ProgressScreen, icon: TrendingUp },
  { name: 'Shop', label: 'Shop', component: ShopScreen, icon: Store },
];

/** Screens pushed above the tabs. All share the same header-less card style. */
const STACK_SCREENS = [
  { name: 'WorkoutDetailScreen', component: WorkoutDetailScreen, presentation: 'fullScreenModal' },
  { name: 'AuthScreen', component: AuthScreen, presentation: 'modal' },
  { name: 'PublicProfileScreen', component: PublicProfileScreen, presentation: 'card' },
  { name: 'LeaderboardScreen', component: LeaderboardScreen, presentation: 'card' },
  { name: 'StatsScreen', component: StatsScreen, presentation: 'card' },
  { name: 'StreakScreen', component: StreakScreen, presentation: 'card' },
  { name: 'MetricScreen', component: MetricScreen, presentation: 'card' },
  { name: 'HistoryScreen', component: HistoryScreen, presentation: 'card' },
  { name: 'RecordsScreen', component: RecordsScreen, presentation: 'card' },
  { name: 'ChatScreen', component: ChatScreen, presentation: 'card' },
  { name: 'GroupChatScreen', component: GroupChatScreen, presentation: 'card' },
];

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        // Tinted from the ground colour, not a fixed value. This was still the
        // warm brown of a palette two redesigns ago, which gave the bar a
        // slightly sepia cast against the slate everything else now sits on.
        tabBarBackground: () => <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, styles.tabBarTint]} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        // Six tabs leave about 55pt each; 9pt keeps one word on one line.
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600', letterSpacing: 0 },
      }}
    >
      {TABS.map(({ name, label, component, icon: Icon }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarLabel: label,
            tabBarIcon: ({ color }) => <Icon color={color} size={22} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          {STACK_SCREENS.map(({ name, component, presentation }) => (
            <Stack.Screen key={name} name={name} component={component} options={{ presentation }} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  tabBarTint: { backgroundColor: 'rgba(15, 18, 22, 0.72)' },
  tabBar: {
    position: 'absolute',
    height: 62,
    marginHorizontal: 10,
    marginBottom: 16,
    borderRadius: 26,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    elevation: 0,
    // A single hairline along the top edge reads as a lit rim on frosted glass.
    // Every other border in the app is gone; this one earns its place because
    // the bar floats over scrolling content and needs a defined edge.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },
});