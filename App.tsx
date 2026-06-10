import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { loadCachedOtaQuestions, fetchRemoteQuestions } from './src/utils/quizEngine';

// Prevent the splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load local questions
        await loadCachedOtaQuestions();
        // Background fetch for fresh ones
        fetchRemoteQuestions().catch(() => {});
      } catch (e) {
        console.warn('Load Error:', e);
      } finally {
        // CRUCIAL: Set ready and hide splash IMMEDIATELY
        setIsReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }

    loadData();
  }, []);

  // Brand-matched splash placeholder (renders before ThemeProvider — fixed awsDark navy in both light/dark modes).
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#1A2B4C' }} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <ThemedAppShell />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ThemedAppShell() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}
