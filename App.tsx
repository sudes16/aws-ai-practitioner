import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/contexts/ThemeContext';
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
        // Wait a tiny bit extra for smooth transition
        setTimeout(() => {
          setIsReady(true);
          SplashScreen.hideAsync().catch(() => {});
        }, 500);
      }
    }

    loadData();
  }, []);

  // Stage 2: Minimal handoff loader (splash already showed full branding)
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Image
          source={require('./assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#FF9900" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A2B4C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
  },
});
