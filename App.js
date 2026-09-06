import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LayoutDashboard, ScanLine, Dumbbell, Users, Rss } from 'lucide-react-native';

import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme';

import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import WorkoutDetailScreen from './src/screens/WorkoutDetailScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import ShopScreen from './src/screens/ShopScreen';
import FeedScreen from './src/screens/FeedScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import StatsScreen from './src/screens/StatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Shop moved off the tab bar and onto the Dashboard header: it is somewhere you
// go occasionally to spend what you earned, not one of the five things you do
// every day. Feed takes the slot because it is checked far more often.
const TABS = [
  { name: 'Dashboard', component: DashboardScreen, icon: LayoutDashboard },
  { name: 'Food', component: ScannerScreen, icon: ScanLine },
  { name: 'Training', component: TrainingScreen, icon: Dumbbell },
  { name: 'Feed', component: FeedScreen, icon: Rss },
  { name: 'Social', component: FriendsScreen, icon: Users },
];

/** Screens pushed above the tabs. All share the same header-less card style. */
const STACK_SCREENS = [
  { name: 'WorkoutDetailScreen', component: WorkoutDetailScreen, presentation: 'fullScreenModal' },
  { name: 'AuthScreen', component: AuthScreen, presentation: 'modal' },
  { name: 'PublicProfileScreen', component: PublicProfileScreen, presentation: 'card' },
  { name: 'LeaderboardScreen', component: LeaderboardScreen, presentation: 'card' },
  { name: 'StatsScreen', component: StatsScreen, presentation: 'card' },
  { name: 'ShopScreen', component: ShopScreen, presentation: 'card' },
  { name: 'ChatScreen', component: ChatScreen, presentation: 'card' },
  { name: 'GroupChatScreen', component: GroupChatScreen, presentation: 'card' },
];

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28, 23, 18, 0.72)' }]} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
      }}
    >
      {TABS.map(({ name, component, icon: Icon }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{ tabBarIcon: ({ color }) => <Icon color={color} size={24} /> }}
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
  tabBar: {
    position: 'absolute',
    height: 62,
    marginHorizontal: 16,
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