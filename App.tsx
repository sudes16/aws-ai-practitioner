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

  // Stage 2: High-Contrast Loading UI (Replaces the blank blue screen)
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

          <View style={styles.footer}>
             <ActivityIndicator size="small" color="#FF9900" style={{ marginBottom: 20 }} />
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
    backgroundColor: '#1A2B4C', // Matches icon background exactly
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
  footer: {
    position: 'absolute',
    bottom: -150, // Positions it below the main text group
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF', // Changed from grey to Pure White
    letterSpacing: 2,
    opacity: 0.9,
  },
});
