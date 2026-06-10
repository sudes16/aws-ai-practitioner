import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { RootStackParamList, DOMAIN_LABELS, PASS_THRESHOLD_PCT } from '../constants/types';
import { getDomainForIndex, EXAM_DOMAIN_COUNTS, EXAM_DOMAIN_PCT, EXAM_TOTAL_QS } from '../utils/quizEngine';
import { cssVal } from '../utils/styleUtils';
import { getExamResult, clearExamResult } from '../utils/examResultStore';
import { addScoreSession, saveSessionRecord, addMasteredQuestions, removeMasteredQuestions } from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamResult'>;
export default function ExamResultScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const stored = getExamResult();
  const history = stored?.history ?? [];
  const totalSeconds = stored?.totalSeconds ?? 5400;
  const elapsedSeconds = stored?.elapsedSeconds ?? 0;

  const totalCorrect = history.filter(h => h.correct === true).length;
  const percentage = Math.round((totalCorrect / EXAM_TOTAL_QS) * 100);
  const passed = totalCorrect / EXAM_TOTAL_QS >= PASS_THRESHOLD_PCT / 100;

  useEffect(() => {
    // Haptics Feedback
    if (passed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const correctNums = history.filter(h => h.correct === true).map(h => h.questionNumber);
    const wrongNums = history.filter(h => h.correct === false).map(h => h.questionNumber);

    if (correctNums.length > 0) addMasteredQuestions(correctNums);
    if (wrongNums.length > 0) removeMasteredQuestions(wrongNums);

    const pct = Math.round((totalCorrect / EXAM_TOTAL_QS) * 100);
    const answeredCount = history.filter(h => h.correct !== null).length;
    saveSessionRecord({
      id: new Date().toISOString(),
      date: new Date().toISOString(),
      mode: 'exam',
      questionCount: EXAM_TOTAL_QS,
      score: totalCorrect,
      pct,
      quit: false,
      elapsedSeconds,
      history,
    });
    const domainBreakdown: Record<number, { c: number; t: number }> = {};
    history.forEach(h => {
      if (h.correct !== null) {
        const d = getDomainForIndex(h.questionIndex);
        if (!domainBreakdown[d]) domainBreakdown[d] = { c: 0, t: 0 };
        domainBreakdown[d].t++;
        if (h.correct) domainBreakdown[d].c++;
      }
    });
    addScoreSession({
      date: new Date().toISOString(),
      mode: 'exam',
      domain: 0,
      questionCount: EXAM_TOTAL_QS,
      answeredCount,
      score: totalCorrect,
      pct,
      quit: false,
      domainBreakdown,
    });
  }, []);

  useEffect(() => {
    return () => { clearExamResult(); };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const domainStats = ([1, 2, 3, 4, 5] as const).map(d => {
    const relevant = history.filter(h => getDomainForIndex(h.questionIndex) === d);
    const correct = relevant.filter(h => h.correct === true).length;
    const total = relevant.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return {
      domain: d,
      correct,
      total,
      expected: EXAM_DOMAIN_COUNTS[d],
      examPct: EXAM_DOMAIN_PCT[d],
      pct,
    };
  });

  const handleShareResult = async () => {
    const message = `🎯 I just completed a full AWS AI Practitioner Mock Exam with a score of ${percentage}%! 🚀☁️\n\nResult: ${totalCorrect}/${EXAM_TOTAL_QS} Correct\nStatus: ${passed ? 'PASSED ✅' : 'Working hard 📚'}\n\nPreparing with this study tool! #AWS #Certification`;
    try {
      await Share.share({ message });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const isPerfect = percentage === 100;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ width: 44 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Exam Complete</Text>
          <Text style={styles.headerSub}>AWS AI Practitioner | AIF-C01</Text>
        </View>
        <TouchableOpacity onPress={handleShareResult} style={styles.shareBtnHeader}>
          <Text style={{ fontSize: 20 }}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Score Card ── */}
        <View style={[
          styles.scoreCard,
          passed ? styles.scoreCardPass : styles.scoreCardFail,
          isPerfect && styles.scoreCardPerfect
        ]}>
          <Text style={[styles.scoreNum, isPerfect && { color: '#FFD700' }]}>
            {totalCorrect}
            <Text style={styles.scoreOutOf}>/{EXAM_TOTAL_QS}</Text>
          </Text>
          <Text style={[styles.scorePct, isPerfect && { color: '#FFD700' }]}>{percentage}%</Text>
          <View style={[
            styles.passBadge,
            passed ? styles.passBadgeGreen : styles.passBadgeRed,
            isPerfect && { backgroundColor: '#FFD700' }
          ]}>
            <Text style={[styles.passBadgeText, isPerfect && { color: '#000' }]}>
              {isPerfect ? '⭐ PERFECT SCORE' : passed ? '✓ Pass' : '✗ Did not pass'}
            </Text>
          </View>
          <Text style={styles.passNote}>Pass mark: 70% ({Math.ceil(EXAM_TOTAL_QS * PASS_THRESHOLD_PCT / 100)}/{EXAM_TOTAL_QS})</Text>
        </View>

        {/* ── History hint ── */}
        <Text style={styles.historyHint}>📋 Your results and answers are saved in History for later review</Text>

        {/* ── Time row ── */}
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>⏱ Time used</Text>
          <Text style={styles.timeValue}>
            {formatTime(elapsedSeconds)} / {formatTime(totalSeconds)}
          </Text>
        </View>

        {/* ── Domain Breakdown ── */}
        <Text style={styles.sectionTitle}>Domain Breakdown</Text>

        {domainStats.map(({ domain, correct, total, expected, examPct, pct }) => (
          <View key={domain} style={styles.domainCard}>
            <View style={styles.domainHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.domainName}>{DOMAIN_LABELS[domain]}</Text>
                <Text style={styles.domainWeight}>Exam weight: {examPct}% | ~{expected} Qs</Text>
              </View>
              <Text style={[styles.domainScore, pct >= 70 ? styles.domainPass : styles.domainFail]}>
                {correct}/{total}
                <Text style={styles.domainPctText}> ({pct}%)</Text>
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: cssVal(`${Math.min(pct, 100)}%`),
                    backgroundColor: pct >= 70 ? colors.correct : colors.wrong,
                  },
                ]}
              />
              {/* 70% pass-line marker */}
              <View style={styles.passLine} />
            </View>
          </View>
        ))}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Fixed Footer ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.homeBtn, styles.footerBtnHalf]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.homeBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.reviewBtn,
            styles.footerBtnHalf,
            totalCorrect === EXAM_TOTAL_QS && { backgroundColor: colors.correct }
          ]}
          onPress={() => {
            const incorrectCount = history.filter(h => h.correct === false).length;
            if (incorrectCount > 0) {
              const wrongIndices = history
                .filter(h => h.correct === false)
                .map(h => h.questionIndex);
              navigation.replace('Quiz', {
                config: {
                  mode: 'random',
                  fromQ: 1,
                  toQ: 65,
                  count: wrongIndices.length,
                  timed: false,
                  timePerQuestion: 60,
                  indices: wrongIndices,
                  questionType: 'all',
                  domain: 0,
                  studyMode: true, // Auto-study for retrying wrong ones
                  isExam: false,
                },
              });
            } else {
              navigation.navigate('Review', { history });
            }
          }}
        >
          <Text style={styles.reviewBtnText}>
            {totalCorrect === EXAM_TOTAL_QS ? '📋 Review Answers' : `↺ Retry Wrong (${EXAM_TOTAL_QS - totalCorrect})`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.awsDark,
  },
  shareBtnHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 13,
    color: colors.awsOrange,
    fontWeight: '600',
    marginTop: 2,
  },

  content: { padding: 16, backgroundColor: colors.background },

  // ── Score Card ──────────────────────────────────────────────────────────
  scoreCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  scoreCardPass: {
    backgroundColor: colors.correctBg,
    borderColor: colors.correct,
  },
  scoreCardFail: {
    backgroundColor: colors.wrongBg,
    borderColor: colors.wrong,
  },
  scoreCardPerfect: {
    backgroundColor: colors.optionSelected,
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  scoreNum: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 72,
  },
  scoreOutOf: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  scorePct: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 12,
  },
  passBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  passBadgeGreen: { backgroundColor: colors.correct },
  passBadgeRed: { backgroundColor: colors.wrong },
  passBadgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  passNote: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  // ── Time ────────────────────────────────────────────────────────────────
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  timeValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },

  // ── Domain Breakdown ────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  domainCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  domainName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  domainWeight: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  domainScore: {
    fontSize: 16,
    fontWeight: '800',
  },
  domainPass: { color: colors.correct },
  domainFail: { color: colors.wrong },
  domainPctText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.progressBg,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 4,
  },
  // Vertical dashed marker at the 70% pass threshold
  passLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: cssVal('70%'),
    width: 2,
    backgroundColor: colors.textMuted,
  },

  historyHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  footerBtnHalf: {
    flex: 1,
  },
  reviewBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.awsDark,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
  homeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  homeBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
