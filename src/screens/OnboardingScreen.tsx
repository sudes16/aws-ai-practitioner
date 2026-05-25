import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';

export const ONBOARDING_KEY = 'onboarding_complete';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface Slide {
  key: string;
  icon: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 's1',
    icon: '\uD83C\uDF93',
    title: 'Welcome to AWS Quiz',
    body: 'Your AWS AI Practitioner (AIF-C01) study companion.\n\n200+ exam-style questions with full explanations to help you pass first time.',
  },
  {
    key: 's2',
    icon: '\uD83D\uDCCB',
    title: 'Two Study Modes',
    body: 'Practice Mode \u2014 choose your question range, domain, and pace.\n\nExam Simulation \u2014 timed 65-question mock exam weighted by domain, just like the real thing.',
  },
  {
    key: 's3',
    icon: '\uD83D\uDCD6',
    title: 'Review & Track Progress',
    body: 'After every session, review every answer with detailed explanations.\n\nRevisit past sessions anytime from Settings \u2192 Progress History.',
  },
  {
    key: 's4',
    icon: '\uD83E\uDDE0',
    title: 'Smart Study Tools',
    body: 'Flag questions, add notes, and use Smart Study to focus on your weakest areas.\n\nTap the \u2753 Help button anytime for a full feature guide.',
  },
];

export default function OnboardingScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isReplay = route.params?.replay === true;

  const finish = async () => {
    if (!isReplay) {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    }
    if (isReplay) {
      navigation.navigate('Home');
    } else {
      navigation.replace('Home');
    }
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      finish();
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;
  const slide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip / Close */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish} activeOpacity={0.7}>
        <Text style={styles.skipText}>{isReplay ? 'Close' : 'Skip'}</Text>
      </TouchableOpacity>

      {/* Slide content */}
      <View style={styles.slide}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Next / Get Started */}
      <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.8}>
        <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next \u2192'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    skipBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 36,
      paddingBottom: 40,
    },
    icon: {
      fontSize: 72,
      marginBottom: 28,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 20,
    },
    body: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      marginHorizontal: 5,
    },
    dotActive: {
      backgroundColor: colors.awsOrange,
      width: 24,
      borderRadius: 4,
    },
    nextBtn: {
      marginHorizontal: 24,
      marginBottom: 16,
      backgroundColor: colors.awsOrange,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    nextText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '700',
    },
  });
}
