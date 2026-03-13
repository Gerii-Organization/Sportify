import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ScanLine, Dumbbell, Activity } from 'lucide-react-native';

import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import StatsScreen from './src/screens/StatsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { 
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            position: 'absolute',
            borderTopWidth: 0,
            elevation: 0,
            height: 60,
            borderRadius: 20,
            margin: 15,
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{ tabBarIcon: ({color}) => <LayoutDashboard color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Scanner" 
          component={ScannerScreen} 
          options={{ tabBarIcon: ({color}) => <ScanLine color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Training" 
          component={TrainingScreen} 
          options={{ tabBarIcon: ({color}) => <Dumbbell color={color} size={24} /> }} 
        />
        <Tab.Screen 
          name="Stats" 
          component={StatsScreen} 
          options={{ tabBarIcon: ({color}) => <Activity color={color} size={24} /> }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}