import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Share,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { RootStackParamList } from '../constants/types';
import { getProfile, saveProfile, getDaysLeft, UserProfile, validateProfileInputs } from '../utils/profileStore';
import {
  getReminderSettings,
  saveReminderSettings,
  requestNotificationPermissions,
  scheduleReminder,
  cancelReminder,
  scheduleExamCountdownNotifications,
  DAY_LABELS,
  ALL_DAYS,
  DEFAULT_REMINDER_MINUTE as REMINDER_MINUTE,
} from '../utils/notificationService';
import { getExamSeenCount, getTotalCount, resetExamHistory } from '../utils/quizEngine';
import { getQuestionReports, resetMasteredQuestions, getMasteredQuestions } from '../utils/storage';

import { resetSRData, getSRRecordCount } from '../utils/spacedRepetition';
import { getAiKey, saveAiKey } from '../utils/aiService';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.awsquiz.aifpractitioner';
const SHARE_MESSAGE = 'Preparing for the AWS AI Practitioner (AIF-C01) exam? Check out this free practice quiz app!';
const AI_STUDIO_URL = 'https://aistudio.google.com/';

export default function SettingsScreen({ navigation }: Props) {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing]   = useState(false);
  const [obName, setObName]     = useState('');
  const [obMonth, setObMonth]   = useState('');
  const [obDay, setObDay]       = useState('');
  const [obYear, setObYear]     = useState('');
  const [obError, setObError]   = useState('');

  // ── AI Key state ──
  const [aiKey, setAiKey] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);

  // ── Exam history state ──
  const [examSeenCount, setExamSeenCount] = useState(0);
  const [srRecordCount, setSrRecordCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const totalQuestions = getTotalCount();
  const [masteredCount, setMasteredCount] = useState(0);

  // ── Reminder state ──
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour]       = useState(19);
  const [reminderDays, setReminderDays]       = useState<number[]>([2, 3, 4, 5, 6]);
  const [reminderRepeating, setReminderRepeating] = useState(true);

  // ── Automatic Version Logic ──
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber;
  const fullVersionString = buildNumber ? `${appVersion} (Build ${buildNumber})` : appVersion;
  const packageId = Constants.expoConfig?.android?.package ?? 'com.awsquiz.aifpractitioner';

  useFocusEffect(
    React.useCallback(() => {
      // Scroll to top when screen is focused
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      const loadData = async () => {
        try {
          const [p, k, es, sr, rc, ms] = await Promise.all([
            getProfile(),
            getAiKey(),
            getExamSeenCount(),
            getSRRecordCount(),
            getQuestionReports(),
            getMasteredQuestions(),
          ]);

          if (p) {
            setProfile(p);
            const [y, m, d] = p.examDate.split('-');
            setObName(p.name);
            setObMonth(m);
            setObDay(d);
            setObYear(y);
          }
          setAiKey(k ?? '');
          setExamSeenCount(es);
          setSrRecordCount(sr);
          setReportCount(rc.length);
          setMasteredCount(ms.length);
        } catch (err) {
          console.error("Settings load failed", err);
        }
      };

      loadData();

      getReminderSettings().then(s => {
        setReminderEnabled(s.enabled);
        setReminderHour(s.hour);
        setReminderDays(s.days ?? [2, 3, 4, 5, 6]);
        setReminderRepeating(s.repeating ?? true);
      });
    }, [])
  );

  const handleSave = async () => {
    const result = validateProfileInputs(obName, obMonth, obDay, obYear);
    if (typeof result === 'string') { setObError(result); return; }
    try {
      await saveProfile(result);
    } catch (e) {
      setObError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
      return;
    }
    setProfile(result);
    setEditing(false);
    setObError('');
    scheduleExamCountdownNotifications(result.examDate).catch(() => {});
  };

  const handleAiKeySave = async (text: string) => {
    setAiKey(text);
    await saveAiKey(text);
  };

  // Web-safe confirmation: Alert.alert is a no-op on Expo Web
  const confirmAction = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleResetSR = () => {
    confirmAction(
      'Reset Spaced Repetition',
      'This will erase all spaced repetition progress. Your study intervals will restart from scratch. Continue?',
      'Reset',
      async () => { await resetSRData(); setSrRecordCount(0); },
    );
  };

  const handleResetMastered = () => {
    confirmAction(
      'Reset Progress?',
      'This will permanently clear all your mastered questions. The Weak mode pool will reset to all questions. Continue?',
      'Reset',
      async () => { await resetMasteredQuestions(); setMasteredCount(0); },
    );
  };

  // ── Reminder handlers ──
  const handleResetExamHistory = () => {
    if (examSeenCount === 0) return;
    confirmAction(
      'Reset Exam History',
      `This will clear the record of ${examSeenCount} seen questions so the next exam picks from the full bank again. Continue?`,
      'Reset',
      async () => { await resetExamHistory(); setExamSeenCount(0); },
    );
  };

  const handleReminderToggle = async (value: boolean) => {
    if (value && Platform.OS !== 'web') {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission denied', 'Please enable notifications in your device settings to use Study Reminders.');
        return;
      }
      await scheduleReminder(reminderHour, REMINDER_MINUTE, reminderDays, reminderRepeating);
    } else if (!value && Platform.OS !== 'web') {
      await cancelReminder();
    }
    setReminderEnabled(value);
    await saveReminderSettings({ enabled: value, hour: reminderHour, minute: REMINDER_MINUTE, days: reminderDays, repeating: reminderRepeating });
  };

  const handleReminderHourChange = async (delta: number) => {
    const newHour = (reminderHour + delta + 24) % 24;
    setReminderHour(newHour);
    await saveReminderSettings({ enabled: reminderEnabled, hour: newHour, minute: REMINDER_MINUTE, days: reminderDays, repeating: reminderRepeating });
    if (reminderEnabled && Platform.OS !== 'web') await scheduleReminder(newHour, REMINDER_MINUTE, reminderDays, reminderRepeating);
  };

  const handleDayToggle = async (day: number) => {
    const newDays = reminderDays.includes(day)
      ? reminderDays.filter(d => d !== day)
      : [...reminderDays, day].sort();
    if (newDays.length === 0) return; // must keep at least one day
    setReminderDays(newDays);
    await saveReminderSettings({ enabled: reminderEnabled, hour: reminderHour, minute: REMINDER_MINUTE, days: newDays, repeating: reminderRepeating });
    if (reminderEnabled && Platform.OS !== 'web') await scheduleReminder(reminderHour, REMINDER_MINUTE, newDays, reminderRepeating);
  };

  const handleRepeatingToggle = async (value: boolean) => {
    setReminderRepeating(value);
    await saveReminderSettings({ enabled: reminderEnabled, hour: reminderHour, minute: REMINDER_MINUTE, days: reminderDays, repeating: value });
    if (reminderEnabled && Platform.OS !== 'web') await scheduleReminder(reminderHour, REMINDER_MINUTE, reminderDays, value);
  };

  const formatHour = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${suffix}`;
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          await (navigator as any).share({ title: 'AWS AI Practitioner Quiz', text: SHARE_MESSAGE });
        } else {
          try {
            await (navigator as any).clipboard?.writeText(SHARE_MESSAGE);
            Alert.alert('Copied!', 'Share message copied to clipboard.');
          } catch {
            Alert.alert('Share', 'Could not access clipboard. Please copy this message manually:\n\n' + SHARE_MESSAGE);
          }
        }
      } else {
        await Share.share({ message: SHARE_MESSAGE });
      }
    } catch { /* user cancelled */ }
  };

  const daysLeft = profile ? getDaysLeft(profile.examDate) : null;
  const examDateFormatted = profile
    ? new Date(profile.examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile ── */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.card}>
          {!editing ? (
            <>
              <View style={styles.profileRow}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {profile ? profile.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{profile?.name ?? '—'}</Text>
                  {profile && (
                    <Text
                      style={styles.profileDate}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {'Exam: '}{examDateFormatted}
                      {daysLeft !== null && (
                        <>
                          <Text style={{ color: colors.textMuted }}>{'  |  '}</Text>
                          <Text style={[
                            styles.profileDaysTag,
                            { color: daysLeft > 7 ? colors.correct : daysLeft > 2 ? colors.awsOrange : daysLeft >= 0 ? colors.wrong : colors.textMuted },
                          ]}>
                            {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Today!' : `${Math.abs(daysLeft)}d ago`}
                          </Text>
                        </>
                      )}
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Your name</Text>
              <TextInput
                style={styles.input}
                value={obName}
                onChangeText={t => { setObName(t); setObError(''); }}
                placeholder="e.g. Vayu"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>Exam date</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.dateHint}>Month</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={obMonth}
                    onChangeText={t => { setObMonth(t.replace(/\D/g, '')); setObError(''); }}
                    placeholder="MM"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={styles.dateSep}>/</Text>
                <View style={styles.dateField}>
                  <Text style={styles.dateHint}>Day</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={obDay}
                    onChangeText={t => { setObDay(t.replace(/\D/g, '')); setObError(''); }}
                    placeholder="DD"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={styles.dateSep}>/</Text>
                <View style={[styles.dateField, { flex: 2 }]}>
                  <Text style={styles.dateHint}>Year</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={obYear}
                    onChangeText={t => { setObYear(t.replace(/\D/g, '')); setObError(''); }}
                    placeholder="YYYY"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
              {obError ? <Text style={styles.errorText}>{obError}</Text> : null}
              <View style={styles.editBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setEditing(false); setObError(''); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── Appearance ── */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🎨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Theme</Text>
              <Text style={styles.rowSub}>Choose light, dark, or follow system</Text>
            </View>
          </View>
          <View style={styles.themeOptions}>
            {(['system', 'light', 'dark'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.themeBtn, themeMode === mode && styles.themeBtnActive]}
                onPress={() => setThemeMode(mode)}
              >
                <Text style={[styles.themeBtnText, themeMode === mode && styles.themeBtnTextActive]}>
                  {mode === 'system' ? '⚙ System' : mode === 'light' ? '☀ Light' : '🌙 Dark'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── AI Insights ── */}
        <Text style={styles.sectionLabel}>AI Insights</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Gemini API Key</Text>
              <Text style={styles.rowSub}>Get a free key at <Text style={{ color: colors.awsOrange, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(AI_STUDIO_URL)}>Google AI Studio</Text></Text>
            </View>
            <TouchableOpacity onPress={() => setShowAiKey(!showAiKey)}>
              <Text style={{ fontSize: 18 }}>{showAiKey ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { marginTop: 0, marginBottom: 16 }]}
            value={aiKey}
            onChangeText={handleAiKeySave}
            placeholder="Paste your API key here..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showAiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={[styles.rowSub, { fontStyle: 'italic' }]}>
              Note: This key is stored locally on your device and used only to generate deep-dive explanations during quizzes.
            </Text>
          </View>
        </View>

        {/* ── Notifications ── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Study Reminder</Text>
              <Text style={styles.rowSub}>Daily notification to keep your prep on track</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, reminderEnabled && styles.toggleOn]}
              onPress={() => handleReminderToggle(!reminderEnabled)}
            >
              <View style={[styles.toggleThumb, reminderEnabled && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          {reminderEnabled && (
            <View style={styles.reminderSubBlock}>
              {/* Time picker */}
              <View style={styles.rowDivider} />
              <View style={[styles.row, styles.subRow]}>
                <Text style={[styles.rowIcon, styles.subRowIcon]}>🕐</Text>
                <Text style={[styles.rowLabel, styles.subRowLabel, { flex: 1 }]}>Time</Text>
                <View style={styles.timeControl}>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => handleReminderHourChange(-1)}>
                    <Text style={styles.timeBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{formatHour(reminderHour)}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => handleReminderHourChange(1)}>
                    <Text style={styles.timeBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Day picker */}
              <View style={styles.rowDivider} />
              <View style={[styles.row, styles.subRow, { flexWrap: 'wrap', gap: 6 }]}>
                <Text style={[styles.rowIcon, styles.subRowIcon]}>📅</Text>
                <Text style={[styles.rowLabel, styles.subRowLabel, { flex: 1 }]}>Days</Text>
                <View style={styles.dayPicker}>
                  {ALL_DAYS.map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayBtn, reminderDays.includes(day) && styles.dayBtnOn]}
                      onPress={() => handleDayToggle(day)}
                    >
                      <Text style={[styles.dayBtnText, reminderDays.includes(day) && styles.dayBtnTextOn]}>
                        {DAY_LABELS[day]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Repeat toggle */}
              <View style={styles.rowDivider} />
              <View style={[styles.row, styles.subRow]}>
                <Text style={[styles.rowIcon, styles.subRowIcon]}>🔁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, styles.subRowLabel]}>Repeat weekly</Text>
                  <Text style={styles.rowSub}>
                    {reminderRepeating ? 'Fires every selected day' : 'Fires once on the next occurrence'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, reminderRepeating && styles.toggleOn]}
                  onPress={() => handleRepeatingToggle(!reminderRepeating)}
                >
                  <View style={[styles.toggleThumb, reminderRepeating && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Share & Feedback ── */}
        <Text style={styles.sectionLabel}>Share & Feedback</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleShare}>
            <Text style={styles.rowIcon}>📤</Text>
            <Text style={styles.rowLabel}>Share App</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
          >
            <Text style={styles.rowIcon}>⭐</Text>
            <Text style={styles.rowLabel}>Rate on Play Store</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Onboarding', { replay: true })}
          >
            <Text style={styles.rowIcon}>🗺️</Text>
            <Text style={styles.rowLabel}>Replay App Tour</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Data & Progress ── */}
        <Text style={styles.sectionLabel}>Data &amp; Progress</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Mastered questions</Text>
              <Text style={styles.rowSub}>
                {masteredCount} questions marked as confident
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResetMastered}
              disabled={masteredCount === 0}
              style={[styles.resetBtn, masteredCount === 0 && styles.resetBtnDisabled]}
            >
              <Text style={[styles.resetBtnText, masteredCount === 0 && styles.resetBtnTextDisabled]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🎓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Exam question history</Text>
              <Text style={styles.rowSub}>
                {examSeenCount} of {totalQuestions} questions seen
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResetExamHistory}
              disabled={examSeenCount === 0}
              style={[styles.resetBtn, examSeenCount === 0 && styles.resetBtnDisabled]}
            >
              <Text style={[styles.resetBtnText, examSeenCount === 0 && styles.resetBtnTextDisabled]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🧠</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Spaced repetition data</Text>
              <Text style={styles.rowSub}>
                {srRecordCount > 0 ? `${srRecordCount} question${srRecordCount !== 1 ? 's' : ''} tracked` : 'No data'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResetSR}
              disabled={srRecordCount === 0}
              style={[styles.resetBtn, srRecordCount === 0 && styles.resetBtnDisabled]}
            >
              <Text style={[styles.resetBtnText, srRecordCount === 0 && styles.resetBtnTextDisabled]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Question Reports ── */}
        <Text style={styles.sectionLabel}>Question Reports</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Reports')}>
            <Text style={styles.rowIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>My Question Reports</Text>
              <Text style={styles.rowSub}>
                {reportCount > 0
                  ? `${reportCount} flagged question${reportCount !== 1 ? 's' : ''}`
                  : 'No reports yet'}
              </Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Support & Help ── */}
        <Text style={styles.sectionLabel}>Support & Help</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Help')}
          >
            <Text style={styles.rowIcon}>💡</Text>
            <Text style={styles.rowLabel}>How to Use</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('https://d1.awsstatic.com/training-and-certification/docs-ai-practitioner/AWS-Certified-AI-Practitioner_Exam-Guide.pdf')}
          >
            <Text style={styles.rowIcon}>📚</Text>
            <Text style={styles.rowLabel}>AWS Exam Guide</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Legal ── */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={styles.rowIcon}>🔒</Text>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── About ── */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutKey}>App</Text>
            <Text style={styles.aboutVal}>AWS AI Practitioner Quiz</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutKey}>Version</Text>
            <Text style={styles.aboutVal}>{fullVersionString}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutKey}>Identifier</Text>
            <Text style={styles.aboutVal}>{packageId}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutKey}>Platform</Text>
            <Text style={styles.aboutVal}>Expo SDK 52 | React Native</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutKey}>Disclaimer</Text>
            <Text style={[styles.aboutVal, { flex: 2, textAlign: 'right' }]}>
              Independent study tool. Not affiliated with Amazon Web Services.
            </Text>
          </View>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textLight },

  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  // Profile
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.awsOrange,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 20, fontWeight: '800', color: colors.textLight },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  profileDate: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  profileDaysTag: { fontSize: 13, fontWeight: '700' },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: colors.awsOrange,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.awsOrange },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginHorizontal: 16,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.background,
    marginHorizontal: 16, marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 6, marginHorizontal: 16, marginBottom: 16,
  },
  dateField: { flex: 1, alignItems: 'center' },
  dateHint: {
    fontSize: 10, color: colors.textMuted, fontWeight: '600',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dateInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 11,
    fontSize: 15, fontWeight: '600', textAlign: 'center',
    color: colors.textPrimary, backgroundColor: colors.background, width: '100%',
  },
  dateSep: { fontSize: 18, color: colors.textMuted, fontWeight: '700', paddingBottom: 10 },
  errorText: { fontSize: 13, color: colors.wrong, fontWeight: '600', marginHorizontal: 16, marginBottom: 8 },
  editBtnRow: { flexDirection: 'row', gap: 10, margin: 16, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  saveBtn: {
    flex: 2, paddingVertical: 11, borderRadius: 10,
    backgroundColor: colors.awsOrange, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: colors.textLight },

  // List rows
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowChevron: { fontSize: 20, color: colors.textMuted, fontWeight: '300' },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 54 },

  // Toggle
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: 'center', padding: 3,
  },
  toggleOn: { backgroundColor: colors.awsOrange },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.textLight,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Theme selector
  themeOptions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  themeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
    backgroundColor: colors.background,
  },
  themeBtnActive: { borderColor: colors.awsOrange, backgroundColor: colors.awsOrange + '18' },
  themeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  themeBtnTextActive: { color: colors.awsOrange, fontWeight: '700' },

  // Time control
  timeControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, lineHeight: 22 },
  timeValue: { fontSize: 15, fontWeight: '700', color: colors.awsOrange, minWidth: 72, textAlign: 'center' },

  // Day picker
  reminderSubBlock: {
    marginLeft: 18,
    borderLeftWidth: 2,
    borderLeftColor: colors.awsOrange + '60',
    backgroundColor: 'rgba(255,153,0,0.03)',
  },
  subRowLabel: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  subRowIcon:  { fontSize: 15 },
  subRow:      { paddingVertical: 10 },

  // Day picker
  dayPicker: { flexDirection: 'row', gap: 4 },
  dayBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayBtnOn: { backgroundColor: colors.awsOrange },
  dayBtnText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dayBtnTextOn: { color: colors.textLight },

  // Reset button (inline, compact)
  resetBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: colors.btnDanger + '20', borderWidth: 1, borderColor: colors.btnDanger,
  },
  resetBtnDisabled: { backgroundColor: colors.border, borderColor: colors.border },
  resetBtnText: { fontSize: 13, fontWeight: '700', color: colors.btnDanger },
  resetBtnTextDisabled: { color: colors.textSecondary },

  // About
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, paddingHorizontal: 16, gap: 8 },
  aboutKey: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, width: 80 },
  aboutVal: { flex: 1, fontSize: 14, color: colors.textPrimary, textAlign: 'right' },
});
