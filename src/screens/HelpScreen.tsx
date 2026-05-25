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
      'When you first open the app, a short setup screen asks for your name and exam date. This information is stored only on your device and is never shared or uploaded.\n\n' +
      'Once set up, a banner at the top of the Home screen greets you by name with a time-of-day message and shows a live countdown to your exam date. The banner colour changes as your exam approaches:\n\n' +
      '\u2022 Green \u2014 more than 7 days remaining.\n' +
      '\u2022 Orange \u2014 3\u20137 days left: time to intensify your review.\n' +
      '\u2022 Red \u2014 fewer than 3 days: focus on your weakest areas.\n\n' +
      'Tapping the banner opens the profile editor so you can update your name or exam date at any time. You can also edit your profile from Settings \u2192 Profile.',
  },
  {
    icon: '📝',
    title: 'Practice Mode',
    body:
      'Practice Mode lets you configure a custom quiz session from the full question bank. You can set the question range (e.g. questions 1–100), how many questions to attempt, and pick a question type — All, Multiple Choice, or Matching (hotspot). Quick-count presets (25, 50, 85, All) let you jump to common session lengths in one tap.\n\n' +
      'Four quiz order modes are available:\n\n' +
      '• Random — shuffles all selected questions into a new order each session.\n' +
      '• Sequential — presents questions in number order, useful for methodical coverage.\n' +
      '• Weak Mode — shows only questions you have not yet marked as mastered, helping you target your weak areas.\n' +
      '• Smart Study — uses spaced repetition to schedule each question at the optimal moment for retention (see the Smart Study section below).\n\n' +
      'The stats row at the top of the Practice tab shows three live counters: Total Questions in the bank, Mastered \u2713 (questions you have answered correctly and saved), and Remaining (still to cover). These update automatically as you study.\n\n' +
      'Inside the quiz, two badges flag special question types: an orange "\u26a1 MATCHING / ORDERING" banner for hotspot questions (arrange or match items rather than select a single letter), and a yellow "\u2611 SELECT ALL THAT APPLY" banner for multi-select questions (every correct option must be chosen before submitting).',
  },
  {
    icon: '🎓',
    title: 'Exam Simulation',
    body:
      'The Exam Simulation tab on the Home screen shows a summary card — 65 Questions, 90 Minutes, 70% Pass Mark — and a domain-weight breakdown listing all five exam domains with their question counts and percentage weights.\n\n' +
      'Tapping Take Mock Exam selects 65 questions weighted by domain to match the official AWS AIF-C01 blueprint and starts a 90-minute countdown timer. The timer pill turns yellow when fewer than 10 minutes remain and red when fewer than 2 minutes remain.\n\n' +
      'No answer feedback or explanations are shown during the exam. You can navigate freely between all 65 questions using the Prev and Next buttons at the bottom. If you press Next without selecting an answer, a confirmation prompt lets you skip the question or go back to answer it.\n\n' +
      'The Review button in the bottom centre unlocks once you have navigated through all 65 questions at least once. Tapping it opens a summary panel showing how many questions are answered, flagged, noted, and remaining, plus a grid of all 65 tiles. Tiles show \u2691 if flagged and \u270e if you have a note on that question. Tap any tile to jump back to that question, or tap End Exam to confirm submission.\n\n' +
      'The results screen after submission shows your overall score, a Pass / Did not pass verdict (70% threshold), exact time used (MM:SS / 90:00 format), and a per-domain breakdown with a 70% pass-line marker on each bar so you can see exactly which domains need more work (see Quiz Results below).',
  },
  {
    icon: '📖',
    title: 'Study vs Test Mode',
    body:
      'The Study / Test chip in the options bar controls whether explanations are shown automatically.\n\n' +
      'In Test Mode (default), you answer the question and then tap "View Explanation" manually if you want to read the reasoning. This mimics real exam conditions.\n\n' +
      'In Study Mode, the full explanation card appears automatically immediately after you submit each answer, so you can learn the reasoning without any extra taps. Study Mode is ideal when you are actively building knowledge rather than testing yourself under pressure.',
  },
  {
    icon: '\u23f1',
    title: 'Timed Mode',
    body:
      'Timed Mode adds a per-question countdown timer to Practice sessions. When enabled, a sub-row appears where you can set the number of seconds allowed per question (default 90 seconds). A timer pill in the question header counts down; when time runs out, the question is automatically submitted with no answer selected.\n\n' +
      'The timer pill changes colour as time runs short: it turns yellow when 30 seconds or fewer remain, and red when 10 seconds or fewer remain, giving you a clear visual warning to commit to an answer.\n\n' +
      'Timed Mode is separate from the Exam Simulation timer — it applies a fresh countdown to each individual question, whereas Exam Simulation uses a single 90-minute total timer for the whole 65-question session.',
  },
  {
    icon: '🗂',
    title: 'Domain Filter',
    body:
      'The Domain Filter in the Practice configuration lets you limit your quiz to questions from a specific AWS AIF-C01 exam domain. The five domains are:\n\n' +
      '• Domain 1 – AI/ML Fundamentals (20%)\n' +
      '• Domain 2 – Generative AI Basics (24%)\n' +
      '• Domain 3 – Foundation Model Applications (28%)\n' +
      '• Domain 4 – Responsible AI (14%)\n' +
      '• Domain 5 – Security & Governance (14%)\n\n' +
      'Selecting "All Domains" (the default) pulls questions from the entire bank. Selecting a specific domain lets you drill into your weakest area without distraction from other topics.',
  },
  {
    icon: '⭐',
    title: 'Mastered Questions',
    body:
      'After answering a question correctly during a Practice session, a "Mark as Mastered" button appears alongside the explanation. Tapping it saves that question number to your device so the app knows you are confident with it.\n\n' +
      'Mastered questions are excluded from Weak Mode, which means the longer you use the app the more Weak Mode focuses on your genuine trouble spots.\n\n' +
      'You can see your mastered count on the Home screen. The Reset chip in the options bar clears all mastered progress — the chip shows the current count and is disabled when there is nothing to reset. A confirmation prompt prevents accidental resets.\n\n' +
      'To reset your Smart Study (spaced repetition) history independently, go to Settings → Data & Progress → Reset Smart Study Data.',
  },
  {
    icon: '🧠',
    title: 'Smart Study (Spaced Repetition)',
    body:
      'Smart Study uses a spaced repetition algorithm to schedule each question at the optimal moment for memory retention. When you answer correctly, the next review interval grows — starting at 1 day and increasing with each subsequent correct answer. An incorrect answer shortens the interval so the question comes back sooner.\n\n' +
      'Over time, Smart Study automatically surfaces questions you keep getting wrong while letting questions you know well recede into the background. This makes your study sessions significantly more efficient than pure random practice.\n\n' +
      'Important: Smart Study is a standalone mode — it is not a filter on top of Random, Sequential, or Weak Mode. Questions you have answered in Smart Study sessions still appear normally in Exam Simulation and all other Practice modes. SR data only affects which questions are prioritised when you specifically select the Smart Study mode.\n\n' +
      'Your spaced-repetition history is stored on-device. You can reset it from Settings → Data & Progress → Reset Smart Study Data, which clears all intervals and starts fresh without affecting your mastered questions.',
  },
  {
    icon: '🚩',
    title: 'Notes & Flagging',
    body:
      'You can attach a private note to any question by tapping the note icon (\u270F) in the question toolbar during a quiz. Notes are saved per question number and persist across sessions. In the post-session Review Answers screen, any question with a note shows a blue note card beneath the answer.\n\n' +
      'Tapping the flag icon (\u2691) marks a question for later review. Flagged questions are highlighted in the Review Answers screen and can be filtered using the Flagged tab. Use flags for questions you want to revisit or research further.\n\n' +
      'Tap the Report icon (\u26a0) in the toolbar if you believe a question contains an error. Choose a category — Wrong Answer, Typo, Unclear, or Other — and add an optional note. The report is saved locally on your device; once submitted, the toolbar label changes to "Reported" for that question.\n\n' +
      'The Share button (\ud83d\udce4) in the toolbar — available in Practice mode only, not during Exam Simulation — opens your device\'s native share sheet preloaded with the question number, question text, and all answer options. The correct answer is not included, making it safe to share as a practice challenge.',
  },
  {
    icon: '🔔',
    title: 'Study Reminder',
    body:
      'Study Reminder lets you schedule a daily push notification to keep your preparation on track. Enable it in Settings → Notifications.\n\n' +
      'Once enabled, three options appear:\n\n' +
      '• Time — use the \u2212 and + buttons to set the hour for your reminder (shown in 12-hour format).\n' +
      '• Days — tap the day pills (Su M Tu W Th F Sa) to choose which days of the week the reminder fires. At least one day must stay selected. Active days are highlighted in orange.\n' +
      '• Repeat weekly — when on, the reminder fires every week on your selected days. When off, it fires once on the next occurrence of each selected day and then stops.\n\n' +
      'On Android and iOS, the app will request notification permission the first time you turn Study Reminder on. If permission was previously denied, your device settings must be used to re-enable it.',
  },
  {
    icon: '🔎',
    title: 'Review Answers',
    body:
      'After every Practice session or Exam Simulation you can tap "Review Answers" to open a scrollable list of every question in that session with your answer, the correct answer, and the full explanation.\n\n' +
      'Four filter tabs let you focus on: All questions, Correct answers only, Wrong answers only, or Flagged questions. You can flag any question during a quiz by tapping the flag icon in the question header — flagged questions are highlighted in the review list.\n\n' +
      'Questions with personal notes show a blue note card in the review list. Tapping any question card opens the full detail view with the explanation.\n\n' +
      'Reviewing wrong and flagged answers after each session is the most efficient way to improve your score between attempts.\n\n' +
      'Two action buttons are always visible at the bottom of the screen:\n\n' +
      '\u2022 Home \u2014 returns directly to the Home screen.\n' +
      '\u2022 \u21ba Retry \u2014 reshuffles the same questions from that session and starts a new quiz immediately, so you can re-attempt the questions you found difficult.\n\n' +
      'You can also open the Review screen for any past session directly from the Session History page (see below).',
  },
  {
    icon: '\ud83d\udcca',
    title: 'Quiz Results',
    body:
      'After a Practice session ends, the Results screen shows a large score circle flanked by Correct % and Wrong % mini-circles. A pass badge displays \u2713 PASSED or \u2717 NOT PASSED against the 70% threshold, and a short feedback message reflects your score band (Outstanding at \u226590%, through to encouragement to keep studying below 40%).\n\n' +
      'The Results Breakdown card shows Correct, Wrong, and Flagged counts as tappable boxes \u2014 tapping any one opens Review Answers pre-filtered to that category. If you quit a session early, an Unanswered count also appears.\n\n' +
      'The Exam Simulation result screen is separate: it shows total correct out of 65, overall percentage, Pass / Did not pass verdict, exact time used in MM:SS / 90:00 format, and a per-domain breakdown. Each domain card shows correct / total answered, the exam weight %, and a progress bar with a vertical 70% pass-line marker so you can immediately see which domains need the most work.',
  },
  {
    icon: '\ud83d\udcca',
    title: 'Analytics',
    body:
      'The Analytics screen is accessible from the \u2630 menu on the Home screen. It gives you a statistical overview of all your quiz activity with filter tabs for All, Practice, and Exam sessions.\n\n' +
      'The first Summary row shows four key metrics:\n\n' +
      '\u2022 Sessions \u2014 total number of sessions recorded.\n' +
      '\u2022 Avg Score \u2014 your average percentage, with a \u25b2 or \u25bc delta showing how much you have improved compared to your very first session.\n' +
      '\u2022 Best Score \u2014 your highest single-session result.\n' +
      '\u2022 Answered \u2014 total questions answered across all sessions.\n\n' +
      'A second row adds three more stats:\n\n' +
      '\u2022 Pass Rate \u2014 percentage of sessions where you scored \u226570%.\n' +
      '\u2022 Day Streak \u2014 \ud83d\udd25 how many consecutive calendar days you have studied.\n' +
      '\u2022 Completed \u2014 percentage of sessions finished without quitting.\n\n' +
      'The Score Trend bar chart plots your recent sessions chronologically \u2014 green (\u226570%), orange (50\u201369%), or red (<50%) \u2014 with a dashed 70% pass line for reference.\n\n' +
      'The Score Distribution histogram shows how many sessions fell in each score band (<50%, 50\u201359%, 60\u201369%, 70\u201384%, 85%+), revealing whether your scores cluster near or above the pass line.\n\n' +
      'The Domain Breakdown section shows cumulative accuracy per exam domain sorted weakest first, with Focus / Improve / Strong badges and a callout naming the domains that need the most work.\n\n' +
      'Mastery Progress shows how many questions you have marked as mastered out of the full bank, with a percentage progress bar.\n\n' +
      'Question Coverage shows how many unique questions you have encountered across your recorded sessions, giving you a sense of how much of the question bank you have explored.',
  },
  {
    icon: '\ud83d\udccb',
    title: 'Session History',
    body:
      'Session History is accessible from the \u2630 menu on the Home screen (tap \ud83d\udccb Review). It shows a scrollable list of all your past sessions with filter tabs for All, Practice, and Exam.\n\n' +
      'Each row shows the session date, mode, total questions, score, and percentage. Sessions ended early are marked (quit). Tapping a row that has a \u203a arrow opens the Review Answers screen for that session, where you can re-read every question and explanation and use the Retry button to re-attempt those questions.\n\n' +
      'A Clear All History button at the top of the screen removes all session records after a confirmation prompt.',
  },
  {
    icon: '\u2699',
    title: 'Settings',
    body:
      'Settings is accessible from the \u2630 menu in the top-right corner of the Home screen.\n\n' +
      'Profile \u2014 Shows your name, exam date, and a colour-coded days-left tag. Tap Edit to change your name or exam date at any time.\n\n' +
      'Appearance \u2014 A three-way Theme toggle lets you choose Light, Dark, or System (follow your device setting).\n\n' +
      'Data & Progress \u2014 Two independent reset options:\n' +
      '\u2022 Exam question history \u2014 tracks how many questions from the full bank you have seen across all exam sittings (shown as \u201cX of N questions seen\u201d). Resetting it lets the next Exam Simulation draw from the full bank again.\n' +
      '\u2022 Spaced repetition data \u2014 clears all Smart Study intervals and review history without affecting your Mastered list.\n\n' +
      'Share & Feedback \u2014 Share App opens a native share sheet with a preset message about the app. Rate on Play Store opens the Google Play listing.\n\n' +
      'Legal \u2014 Links to the in-app Privacy Policy and to the official AWS Certified AI Practitioner Exam Guide PDF on the AWS website.',
  },
];

export default function HelpScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💡 How to Use</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro card */}
        <View style={styles.introCard}>
          <Text style={styles.introIcon}>🎯</Text>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>AWS AI Practitioner – AIF-C01 Quiz</Text>
            <Text style={styles.introBody}>
              Everything you need to prepare for the exam, from daily practice
              drills to full timed simulations.
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.awsDark,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textLight },

  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  introCard: {
    flexDirection: 'row',
    backgroundColor: colors.optionSelected,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.optionSelectedBorder,
    alignItems: 'flex-start',
  },
  introIcon: { fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  introText: { flex: 1 },
  introTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  introBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionIcon: { fontSize: 20, lineHeight: 24, color: colors.textPrimary },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});