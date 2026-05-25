import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, HistoryEntry, PASS_THRESHOLD_PCT } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { shadow } from '../utils/styleUtils';
import { ColorScheme } from '../constants/colors';
import { addMasteredQuestions, addScoreSession, saveSessionRecord } from '../utils/storage';
import { getDomainForIndex } from '../utils/quizEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

function MiniCircle({
  pct,
  label,
  color,
}: {
  pct: number;
  label: string;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.miniCircleWrap}>
      <View style={[styles.miniCircle, { borderColor: color }]}>
        <Text style={[styles.miniCirclePct, { color }]}>{pct.toFixed(0)}%</Text>
        <Text style={[styles.miniCircleSubLabel, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

function ScoreCircle({
  score,
  total,
  pct,
}: {
  score: number;
  total: number;
  pct: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pass = pct >= PASS_THRESHOLD_PCT;
  const color = pass ? colors.scorePass : pct >= 50 ? colors.awsOrange : colors.scoreFail;
  return (
    <View style={[styles.circleWrap, { borderColor: color }]}>
      <Text style={[styles.circleScore, { color }]}>{score}</Text>
      <Text style={styles.circleDivider}>/{total}</Text>
      <Text style={[styles.circlePct, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

function feedbackMsg(pct: number): string {
  if (pct >= 90) return '🏆 Outstanding! You\'re exam-ready.';
  if (pct >= PASS_THRESHOLD_PCT) return '🎉 Passed! Great work — keep reviewing!';
  if (pct >= 55) return '💪 Almost there! Focus on explanations.';
  if (pct >= 40) return '📚 Keep studying — review the wrong answers.';
  return '🔁 Don\'t give up — read each explanation carefully.';
}

export default function ResultScreen({ navigation, route }: Props) {
  const { history, total, score, quit } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const answered     = history.length;
  const pct          = answered > 0 ? (score / answered) * 100 : 0;
  const pass         = pct >= PASS_THRESHOLD_PCT;
  const correct      = history.filter(h => h.correct === true).length;
  const incorrect    = history.filter(h => h.correct === false).length;
  const flaggedCount = history.filter(h => h.flagged).length;
  const unanswered   = total - answered;

  // Persist mastered questions (answered correctly) to AsyncStorage
  useEffect(() => {
    const correctNums = history
      .filter(h => h.correct === true)
      .map(h => h.questionNumber);
    if (correctNums.length > 0) {
      addMasteredQuestions(correctNums);
    }
    const answeredCount = history.filter(h => h.correct !== null).length;
    // Quit sessions are penalised against the full pool (score/total), not just what was answered
    const pct = quit
      ? Math.round((score / total) * 100)
      : (answeredCount > 0 ? Math.round((score / answeredCount) * 100) : 0);
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
      mode: 'quiz',
      domain: 0,
      questionCount: total,
      answeredCount,
      score,
      pct,
      quit,
      domainBreakdown,
    });
    saveSessionRecord({
      id: new Date().toISOString(),
      date: new Date().toISOString(),
      mode: 'practice',
      questionCount: total,
      score,
      pct,
      quit,
      history,
    });
  }, [history]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {quit ? 'Quiz Summary' : 'Exam Complete'}
        </Text>
        {quit && (
          <Text style={styles.headerSub}>
            {answered} of {total} answered
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Section — main circle flanked by correct / incorrect mini circles */}
        <View style={styles.scoreSection}>
          <View style={styles.circleRow}>
            <MiniCircle
              pct={answered > 0 ? (correct / answered) * 100 : 0}
              label="Correct"
              color={colors.correct}
            />
            <ScoreCircle score={score} total={answered} pct={pct} />
            <MiniCircle
              pct={answered > 0 ? (incorrect / answered) * 100 : 0}
              label="Wrong"
              color={colors.wrong}
            />
          </View>
          <View
            style={[
              styles.passBadge,
              pass ? styles.passBadgePass : styles.passBadgeFail,
            ]}
          >
            <Text style={styles.passBadgeText}>
              {pass ? '✓ PASSED' : '✗ NOT PASSED'} · {PASS_THRESHOLD_PCT}% required
            </Text>
          </View>
          <Text style={styles.feedbackMsg}>{feedbackMsg(pct)}</Text>
        </View>

        {/* Stats breakdown */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Results Breakdown</Text>

          <View style={styles.statsGrid}>
            <StatBox
              label="Correct"
              value={correct}
              color={colors.correct}
              icon="✓"
              onPress={() => navigation.navigate('Review', { history, initialFilter: 'correct' })}
            />
            <StatBox
              label="Wrong"
              value={incorrect}
              color={colors.wrong}
              icon="✗"
              onPress={() => navigation.navigate('Review', { history, initialFilter: 'wrong' })}
            />
            <StatBox
              label="Flagged"
              value={flaggedCount}
              color="#7C3AED"
              icon="🚩"
              onPress={() => navigation.navigate('Review', { history, initialFilter: 'flagged' })}
            />
            {unanswered > 0 && (
              <StatBox
                label="Unanswered"
                value={unanswered}
                color={colors.textMuted}
                icon="—"
                dimmed
              />
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsWrap}>
          {flaggedCount > 0 && (
            <TouchableOpacity
              style={styles.flaggedBtn}
              onPress={() => navigation.navigate('Review', { history, initialFilter: 'flagged' })}
            >
              <Text style={styles.flaggedBtnText}>🚩 Review Flagged ({flaggedCount})</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Pinned footer ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnHome, styles.footerBtnHalf]}
          onPress={() => navigation.replace('Home')}
        >
          <Text style={styles.footerBtnHomeText}>🏠 Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnReview, styles.footerBtnHalf, history.length === 0 && styles.footerBtnDisabled]}
          onPress={history.length > 0 ? () => navigation.navigate('Review', { history }) : undefined}
          disabled={history.length === 0}
        >
          <Text style={[styles.footerBtnReviewText, history.length === 0 && styles.footerBtnDisabledText]}>
            {history.length > 0 ? '📋 Review Answers' : '📭 No Review'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatBox({
  label,
  value,
  color,
  icon,
  onPress,
  dimmed,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  onPress?: () => void;
  dimmed?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = (
    <>
      <Text style={styles.statBoxIcon}>{icon}</Text>
      <Text style={[styles.statBoxValue, { color }]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
      {onPress && <Text style={[styles.statBoxTap, { color }]}>›</Text>}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.statBox, styles.statBoxTappable]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.statBox, dimmed && { opacity: 0.45 }]}>{content}</View>;
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.awsDark,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textLight,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  scoreSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  miniCircleWrap: {
    alignItems: 'center',
  },
  miniCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    ...shadow('#000', 2, 0.08, 6),
    elevation: 3,
  },
  miniCirclePct: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  miniCircleSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.75,
  },
  circleWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    ...shadow('#000', 4, 0.1, 12),
    elevation: 6,
  },
  circleScore: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
  },
  circleDivider: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '600',
  },
  circlePct: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  passBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  passBadgePass: { backgroundColor: colors.correctBg },
  passBadgeFail: { backgroundColor: colors.wrongBg },
  passBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  feedbackMsg: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  statsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statBoxIcon: { fontSize: 18, marginBottom: 4 },
  statBoxValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statBoxLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statBoxTappable: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statBoxTap: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    opacity: 0.6,
  },

  actionsWrap: { gap: 12 },
  reviewBtn: {
    backgroundColor: colors.awsDark,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow('#000', 2, 0.15, 6),
    elevation: 4,
  },
  reviewBtnText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
  },
  flaggedBtn: {
    backgroundColor: '#5B21B6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow('#5B21B6', 3, 0.35, 6),
    elevation: 4,
  },
  flaggedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  newQuizBtn: {
    backgroundColor: colors.awsOrange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow(colors.awsOrange, 4, 0.4, 8),
    elevation: 6,
  },
  newQuizBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnHalf: {
    flex: 1,
  },
  footerBtnHome: {
    flex: 1,
    backgroundColor: colors.awsDark,
  },
  footerBtnHomeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerBtnReview: {
    backgroundColor: colors.awsOrange,
  },
  footerBtnReviewText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footerBtnDisabled: {
    backgroundColor: colors.cardBg,
  },
  footerBtnDisabledText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});
