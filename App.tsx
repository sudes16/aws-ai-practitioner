import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
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
    const MIN_STAGE2_MS = 900; // ensure the tagline UI is readable
    const startedAt = Date.now();

    async function loadData() {
      try {
        await loadCachedOtaQuestions();
        fetchRemoteQuestions().catch(() => {});
      } catch (e) {
        console.warn('Load Error:', e);
      } finally {
        // Reveal the Stage 2 UI immediately by hiding the native splash,
        // then wait so the logo + tagline are visible for at least MIN_STAGE2_MS.
        SplashScreen.hideAsync().catch(() => {});
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_STAGE2_MS - elapsed);
        setTimeout(() => setIsReady(true), remaining);
      }
    }

    loadData();
  }, []);

  // Stage 2: High-Contrast Loading UI
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <Image
            source={require('./assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>AWS AI Practitioner</Text>
          <Text style={styles.subtitle}>AIF-C01 Quiz</Text>

          <View style={styles.loaderArea}>
             <ActivityIndicator size="small" color="#FF9900" style={{ marginVertical: 24 }} />
             <Text style={styles.tagline}>STUDY SMART. PASS FAST.</Text>
          </View>
        </View>
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
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  loaderArea: {
    marginTop: 40,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2.5,
    opacity: 0.95,
  },
});
