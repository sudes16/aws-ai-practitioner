import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { getTotalCount } from '../utils/quizEngine';

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
    icon: '🎓',
    title: 'Welcome to AWS Quiz',
    body: `${getTotalCount()}+ exam-style questions with detailed reasoning and AI deep-dives to help you master the AIF-C01 concepts.`,
  },
  {
    key: 's2',
    icon: '📱',
    title: 'Fluid Paging & Navigation',
    body: 'Seamlessly swipe between Practice, Insights, and History. Tap any section to instantly return to the top for a fresh start.',
  },
  {
    key: 's3',
    icon: '⏱️',
    title: 'Study vs Test Mode',
    body: 'Practice at your own pace with Guided Learning or simulate exam pressure with Auto-Advance timed sessions.',
  },
  {
    key: 's4',
    icon: '🧠',
    title: 'Smart Mastery Tools',
    body: 'Flag difficult items, add private notes, and use Spaced Repetition to focus purely on your weakest areas.',
  },
  {
    key: 's5',
    icon: '🎯',
    title: 'Certification Readiness',
    body: 'Set your exam date and track your progress with our live countdown. Full-length, domain-weighted simulations ensure you land on exam day with 100% confidence.',
  },
];

export default function OnboardingScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const isReplay = route.params?.replay === true;

  const flatListRef = useRef<FlatList>(null);

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;

  const renderItem = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: screenWidth }]}>
      <Text style={styles.icon}>{item.icon}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Skip / Close */}
      <View style={styles.header}>
        {activeIndex > 0 ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true })}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        ) : <View />}

        <TouchableOpacity style={styles.skipBtn} onPress={finish} activeOpacity={0.7}>
          <Text style={styles.skipText}>{isReplay ? 'Close' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={item => item.key}
        bounces={false}
      />

      {/* Footer area */}
      <View style={styles.footer}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.8}>
          <Text style={styles.nextText}>{isLast ? (isReplay ? 'Done' : 'Get Started') : 'Next →'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    backBtn: {
      paddingVertical: 4,
    },
    backText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    skipBtn: {
      paddingVertical: 4,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    icon: {
      fontSize: 84,
      marginBottom: 32,
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 20,
      letterSpacing: 0.5,
    },
    body: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
    },
    footer: {
      paddingBottom: 20,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
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
      backgroundColor: colors.awsOrange,
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
    },
    nextText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '800',
    },
  });
}

