import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { loadCachedOtaQuestions, fetchRemoteQuestions } from './src/utils/quizEngine';

// Keep the splash screen visible while we load cached questions
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadCachedOtaQuestions()
      .catch(() => {})
      .finally(() => {
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
        // Fetch fresh questions in the background after the app is visible
        fetchRemoteQuestions().catch(() => {});
      });
  }, []);

  if (!isReady) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
