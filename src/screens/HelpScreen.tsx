import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { SHARED_STYLES } from '../utils/styleUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

interface Section {
  icon: string;
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    icon: '\ud83d\udc64',
    title: 'Profile & Exam Countdown',
    body:
      'When you first open the app, you set your name and exam date. This data is stored locally and never shared.\n\n' +
      'A live countdown banner appears on the Home screen. Tapping it lets you update your target date. If your exam date passes, the app will automatically prompt you to record your result or reschedule.',
  },
  {
    icon: '📱',
    title: 'Navigation & Swiping',
    body:
      'Use the bottom tab bar to switch between Home, Insights, History, and Settings.\n\n' +
      'The app features a fluid horizontal paging system:\n' +
      '• Home: Swipe between "Practice" and "Exam Simulation".\n' +
      '• Insights & History: Swipe between "All", "Practice", and "Exam" views.\n' +
      '• Review: Swipe between "Correct", "Wrong", and "Flagged" questions.\n\n' +
      'Navigating between tabs automatically resets the view to the top for a fresh start.',
  },
  {
    icon: '✨',
    title: 'AI Insights (Gemini)',
    body:
      'Unlock deep-dive explanations using Google Gemini AI. During any quiz, tap "View Explanation" and then "Deep Dive with AI" for a plain-English breakdown of the AWS concept.\n\n' +
      'To enable this, obtain a free API key from Google AI Studio and paste it into the "AI Insights" section in the Settings tab. Your key is stored only on your device.',
  },
  {
    icon: '⏱️',
    title: 'Timed Mode & Test Pressure',
    body:
      'Practice with a ticking clock to simulate real exam pressure. Minimum time allowed is 30 seconds per question.\n\n' +
      '• Study Mode: When time runs out, the app locks the question and waits for you to review the explanation.\n' +
      '• Test Mode: When time runs out, the app shows a "Time\'s Up!" message and automatically jumps to the next question.',
  },
  {
    icon: '📝',
    title: 'Practice Mode',
    body:
      'Configure drills by question range, count, or type (Multiple Choice vs Matching).\n\n' +
      '• Random: Shuffled order.\n' +
      '• Sequential: Numerical order.\n' +
      '• Weak Mode: Only shows questions you haven\'t mastered.\n' +
      '• Smart Study: Spaced repetition algorithm for maximum retention.',
  },
  {
    icon: '🎓',
    title: 'Exam Simulation',
    body:
      'Take a full 65-question mock exam weighted by AWS domains. Features a 90-minute timer and a comprehensive "Review" grid to verify all answers before final submission. No feedback is given until the exam is complete.',
  },
  {
    icon: '📖',
    title: 'Study vs Test Mode',
    body:
      'In Test Mode, you submit answers manually. In Study Mode, correct answers and detailed explanations are revealed automatically after every question for faster learning.',
  },
  {
    icon: '📊',
    title: 'Advanced Progress Charts',
    body:
      'Visit the Insights tab to see your learning curve on an animated line chart. Track your Score Distribution, Study Streaks, and Question Coverage (unseen vs seen) to ensure you are ready for exam day.\n\n' +
      'Pro Tip: After any session, use the "Retry Wrong" button on the Results screen to immediately drill into the questions you missed.',
  },
  {
    icon: '⭐',
    title: 'Mastered Questions',
    body:
      'Mastered questions are removed from your Weak Mode pool. To keep your prep honest, if you get a mastered question wrong in a future session, the app will automatically un-master it for you.\n\n' +
      'You can track your mastery progress in Insights and reset your progress at any time in the Settings tab.',
  },
  {
    icon: '🚩',
    title: 'Notes, Flags & Reporting',
    body:
      '• Notes (\u270F): Save private study notes per question.\n' +
      '• Flags (\u2691): Mark difficult questions for later review.\n' +
      '• Reports (\u26a0): Submit typos or errors for local tracking.',
  },
  {
    icon: '🔔',
    title: 'Study Reminders',
    body:
      'Schedule custom push notifications in Settings to stay consistent with your AWS preparation.',
  },
  {
    icon: '🔍',
    title: 'Clean Data Layout',
    body:
      'We use professional Pipe (|) separators throughout the app to group metadata clearly, ensuring easy readability on any screen size or theme.',
  },
];

export default function HelpScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shared = useMemo(() => SHARED_STYLES(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={shared.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💡 How to Use</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introIcon}>🎯</Text>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>AWS AI Practitioner Prep</Text>
            <Text style={styles.introBody}>
              Master the AIF-C01 exam with daily drills, AI-powered insights, and full-length simulations.
            </Text>
          </View>
        </View>

        {SECTIONS.map(s => (
          <View key={s.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{s.icon}</Text>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.awsDark },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textLight },
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },
  introCard: { flexDirection: 'row', backgroundColor: colors.optionSelected, borderRadius: 14, padding: 16, marginBottom: 20, gap: 14, borderWidth: 1, borderColor: colors.optionSelectedBorder, alignItems: 'flex-start' },
  introIcon: { fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  introText: { flex: 1 },
  introTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  introBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  section: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionIcon: { fontSize: 20, lineHeight: 24, color: colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  sectionBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
