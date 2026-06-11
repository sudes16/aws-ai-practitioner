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
import { shadow } from '../utils/styleUtils';
import { RootStackParamList } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

const LAST_UPDATED = 'June 11, 2026';
const APP_NAME = 'AWS AI Practitioner Prep – AIF-C01 Quiz';
const CONTACT_EMAIL = 'sudesh6112@gmail.com';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: '1. Overview',
    body:
      `${APP_NAME} is an educational tool designed to help users prepare for the AWS Certified AI Practitioner (AIF-C01) examination. This Privacy Policy explains what data is collected and how it is managed.`,
  },
  {
    title: '2. Data Stored on Your Device',
    body:
      'The app stores the following data locally on your device only:\n\n' +
      '• Profile — your name and target exam date\n' +
      '• Mastered questions — used to power Weak Mode tracking\n' +
      '• Study notes — per-question notes written during sessions\n' +
      '• Study Reminder settings — your preferred notification time\n' +
      '• Exam rotation history — tracking questions seen in past simulations\n' +
      '• Gemini API Key — if provided by you to enable AI features\n\n' +
      'None of this data is ever transmitted to our servers. Your personal information remains exclusively on your device.',
  },
  {
    title: '3. AI Features (Google Gemini)',
    body:
      'The app offers optional "Deep Dive with AI" features powered by Google Gemini.\n\n' +
      '• Use of API Key: Users provide their own Gemini API key. This key is stored securely in your device\'s local storage and is used only to authenticate requests to Google.\n' +
      '• Data Transmission: When you request an AI explanation, only the question text and answer options are sent to Google\'s servers. No personal information or device identifiers are sent with these requests.\n' +
      '• Data Processing: AI-generated content is provided for educational purposes and should be verified against official AWS documentation.\n\n' +
      'Once your request reaches Google\'s servers, it is governed by Google\'s Privacy Policy (https://policies.google.com/privacy) and the Gemini API terms.',
  },
  {
    title: '4. Notifications',
    body:
      'The app uses device-local notifications to remind you to study at times you choose. Reminders are scheduled and delivered entirely on your device.\n\n' +
      '• Notifications still appear on your device exactly when you scheduled them — the Android operating system handles delivery locally, even when offline.\n' +
      '• No external push servers (e.g., Firebase Cloud Messaging) are used.\n' +
      '• No device identifier or notification token is collected or transmitted.\n' +
      '• The RECEIVE_BOOT_COMPLETED permission is used solely to re-register your scheduled study reminders after a device restart, so they continue to fire at the times you chose. It is never used for tracking.',
  },
  {
    title: '5. Data We Do NOT Collect',
    body:
      'We do not collect or share any personally identifiable information (PII). Specifically:\n\n' +
      '• No account registration is required\n' +
      '• No usage analytics or crash reports are sent to our servers\n' +
      '• No location data is accessed\n' +
      '• No advertising identifiers are used',
  },
  {
    title: '6. Question Content & Intellectual Property',
    body:
      'The practice questions bundled in this app are derived from publicly available AWS exam preparation materials. All AWS service names, logos, and trademarks are the property of Amazon Web Services, Inc. This app is an independent study tool and is not affiliated with, endorsed by, or sponsored by Amazon Web Services.',
  },
  {
    title: '7. Third-Party Services',
    body:
      'Outside of the optional connection to Google Generative AI (if an API key is provided), this app does not integrate any third-party SDKs for advertising, analytics, or social networking.',
  },
  {
    title: '8. Children\'s Privacy',
    body:
      'This app does not knowingly collect any information from children under the age of 13. Because all data is stored locally, there is no risk of data collection from any user.',
  },
  {
    title: '9. Data Security & Deletion',
    body:
      'All data remains exclusively on your local device. You have full control over your data:\n\n' +
      '• You can reset specific data (Mastered Questions, Exam History, Spaced Repetition) in the Settings tab.\n' +
      '• You can delete all application data at any time by uninstalling the app from your device.',
  },
  {
    title: '10. Contact Us',
    body:
      `If you have any questions about this Privacy Policy, please contact us at:\n\n${CONTACT_EMAIL}`,
  },
];

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>🔒</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>Your privacy is a priority</Text>
            <Text style={styles.summaryBody}>
              All data—including your Gemini API Key—is stored only on your device.
              We never collect or share your personal information.
            </Text>
          </View>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
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

  titleBlock: { marginBottom: 16 },
  appName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  lastUpdated: { fontSize: 13, color: colors.textMuted },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.correctBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.correctBorder,
    alignItems: 'flex-start',
  },
  summaryIcon: { fontSize: 28, marginTop: 2 },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.correct, marginBottom: 4 },
  summaryBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },

  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...shadow('#000', 1, 0.05, 4),
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.awsOrange,
    paddingLeft: 10,
  },
  sectionBody: { fontSize: 14, color: colors.textPrimary, lineHeight: 23 },
});
