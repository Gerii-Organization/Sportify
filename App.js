import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ScanLine, Dumbbell, Activity } from 'lucide-react-native';

// Importuri din proiectul tău
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import StatsScreen from './src/screens/StatsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [isManualAuth, setIsManualAuth] = useState(false); // Flag pentru bypass-ul nostru
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifică sesiunea Supabase la pornire
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Ascultă login/logout real din Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Dacă avem sesiune REALA (Supabase) SAU sesiune MANUALA (Bypass), intrăm în aplicație
  if (session || isManualAuth) {
    return (
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { 
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              position: 'absolute',
              borderTopWidth: 0,
              elevation: 5,
              height: 60,
              borderRadius: 20,
              margin: 15,
              paddingBottom: 5,
            },
            tabBarActiveTintColor: '#007AFF',
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

  // Dacă nu suntem logați în niciun fel, trimitem onManualLogin ca prop către AuthScreen
  return <AuthScreen onManualLogin={() => setIsManualAuth(true)} />;
}