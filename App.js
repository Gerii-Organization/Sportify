import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ScanLine, Dumbbell, Activity } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './src/lib/supabase';

import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import StatsScreen from './src/screens/StatsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [isManualAuth, setIsManualAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (session || isManualAuth) {
    return (
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.2)',
              shadowColor: '#00FF66',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 15,
              elevation: 0,
              height: 60,
              borderRadius: 20,
              margin: 15,
              paddingBottom: 5,
              overflow: 'hidden',
              backgroundColor: 'transparent',
            },
            tabBarBackground: () => (
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            ),
            tabBarActiveTintColor: '#00FF66',
            tabBarInactiveTintColor: 'gray',
          }}
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

  return <AuthScreen onManualLogin={() => setIsManualAuth(true)} />;
}