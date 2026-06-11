import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../constants/types';
import HomeScreen from '../screens/HomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import QuizScreen from '../screens/QuizScreen';
import ResultScreen from '../screens/ResultScreen';
import ReviewScreen from '../screens/ReviewScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import ExamResultScreen from '../screens/ExamResultScreen';
import HelpScreen from '../screens/HelpScreen';
import SettingsScreen from '../screens/SettingsScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SessionHistoryScreen from '../screens/SessionHistoryScreen';
import ReportsScreen from '../screens/ReportsScreen';
import { useTheme } from '../contexts/ThemeContext';
import { NotesProvider } from '../contexts/NotesContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootStackParamList>();

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          let icon = '';
          if (route.name === 'Home') icon = '🏠';
          else if (route.name === 'Insights') icon = '📊';
          else if (route.name === 'SessionHistory') icon = '🕒';
          else if (route.name === 'Settings') icon = '⚙️';

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center', opacity: focused ? 1 : 0.5 }}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
            </View>
          );
        },
        tabBarActiveTintColor: colors.awsOrange,
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.awsDark,
          borderTopColor: 'rgba(255,255,255,0.1)',
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ tabBarLabel: 'Insights' }}
      />
      <Tab.Screen
        name="SessionHistory"
        component={SessionHistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<'Main' | 'Onboarding' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete')
      .then(val => {
        setInitialRoute(val === 'true' ? 'Main' : 'Onboarding');
      })
      .catch(() => setInitialRoute('Onboarding'));
  }, []);

  if (initialRoute === null) return null;

  return (
    <NotesProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Quiz" component={QuizScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="ExamResult"
          component={ExamResultScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Help"
          component={HelpScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Insights" component={InsightsScreen} />
        <Stack.Screen name="SessionHistory" component={SessionHistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </NotesProvider>
  );
}
