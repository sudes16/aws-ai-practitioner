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

const LAST_UPDATED = 'May 19, 2026';
const APP_NAME = 'AWS AI Practitioner – AIF-C01 Quiz';
const CONTACT_EMAIL = 'sudesh6112@gmail.com';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: '1. Overview',
    body:
      `${APP_NAME} is an offline practice exam app designed to help users prepare for the AWS Certified AI Practitioner (AIF-C01) examination. This Privacy Policy explains what data, if any, is collected when you use the app.`,
  },
  {
    title: '2. Data We Do NOT Collect',
    body:
      'We do not collect, store, transmit, or share any personally identifiable information (PII). Specifically:\n\n' +
      '• No account registration is required\n' +
      '• No name, email address, or contact details are collected\n' +
      '• No usage analytics or crash reports are sent to external servers\n' +
      '• No location data is accessed\n' +
      '• No advertising identifiers are used\n' +
      '• The app does not require an internet connection to function',
  },
  {
    title: '3. Data Stored on Your Device',
    body:
      'The app stores the following data locally on your device only:\n\n' +
      '• Mastered questions — question numbers you have answered correctly, used to power Weak Mode\n' +
      '• Study notes — per-question notes written during quiz sessions\n' +
      '• Profile — your name and target exam date (for the countdown banner only)\n' +
      '• Study Reminder settings — your preferred notification time, days, and enabled state\n' +
      '• Exam rotation history — which questions have appeared in past Exam Simulation sessions\n\n' +
      'None of this data ever leaves your device. Mastered progress and exam history can be reset using the Reset buttons in the Settings screen. Uninstalling the app permanently removes all locally stored data.',
  },
  {
    title: '4. Question Content & Intellectual Property',
    body:
      'The practice questions bundled in this app are derived from publicly available AWS exam preparation materials. All AWS service names, logos, and trademarks are the property of Amazon Web Services, Inc. This app is an independent study tool and is not affiliated with, endorsed by, or sponsored by Amazon Web Services.',
  },
  {
    title: '5. Third-Party Services',
    body:
      'This app does not integrate any third-party SDKs for advertising, analytics, crash reporting, or social networking. No data is shared with any third party.',
  },
  {
    title: '6. Children\'s Privacy',
    body:
      'This app is not directed at children under the age of 13 and does not knowingly collect any information from children. Because no personal data is collected from any user, there is no additional risk to children.',
  },
  {
    title: '7. Data Security',
    body:
      'Because this app does not collect or transmit any personal data, there is no data security risk related to this app. All quiz progress data remains exclusively on your local device.',
  },
  {
    title: '8. Changes to This Policy',
    body:
      'If we update this Privacy Policy in the future, the revised version will be published at the same URL and the "Last Updated" date at the top of this page will be changed. Continued use of the app after any changes constitutes acceptance of the updated policy.',
  },
  {
    title: '9. Contact Us',
    body:
      `If you have any questions or concerns about this Privacy Policy, please contact us at:\n\n${CONTACT_EMAIL}`,
  },
];

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
        </View>

        {/* Summary badge */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>🔒</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>Your privacy is fully protected</Text>
            <Text style={styles.summaryBody}>
              This app is 100% offline. No personal data is collected, stored on
              servers, or shared with anyone — ever.
            </Text>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {/* Footer note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This app is an independent study tool and is not affiliated with or
            endorsed by Amazon Web Services, Inc. AWS and its service names are
            trademarks of Amazon.com, Inc. or its affiliates.
          </Text>
        </View>

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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textLight,
  },

  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  titleBlock: {
    marginBottom: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 13,
    color: colors.textMuted,
  },

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
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.correct,
    marginBottom: 4,
  },
  summaryBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },

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
  sectionBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 23,
  },

  footer: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
  },
});
