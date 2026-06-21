import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { RootStackParamList, DOMAIN_LABELS, DomainFilter, QuizConfig } from '../constants/types';
import {
  getScoreHistory,
  getMasteredCount,
  getSessionRecords,
  getInsightsDataVersion,
  ScoreSession,
  SessionRecord,
} from '../utils/storage';
import { getTotalCount, buildIndices, getDomainCounts, getDomainForIndex } from '../utils/quizEngine';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { shadow, SHARED_STYLES } from '../utils/styleUtils';
import { toLocalDateKey } from '../utils/dateUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

const DOMAIN_NUMS = [1, 2, 3, 4, 5] as const;
const TREND_COUNT = 15;
// Domain breakdown gating: hide a percentage until at least this many attempts
// in the domain, and scale by coverage so a tiny sample can't claim mastery.
const MIN_DOMAIN_SAMPLE = 5;
const DOMAIN_CONF_FLOOR = 0.5; // coverage at/above 50% = full confidence
// Best Score only counts fully-completed sessions of at least this size so a
// 1-of-1 perfect run can't claim 100%. Exams are 65 questions so they always qualify.
const BEST_SCORE_MIN_QS = 30;

// In-screen explainer popups for metrics whose rules aren't obvious from the UI
// alone. Tapping a card opens the matching modal so users don't have to leave
// Insights to figure out why a number looks the way it does.
type MetricInfoKey = 'bestPractice' | 'bestExam' | 'bestScore' | 'readiness' | 'domain';
const METRIC_INFO: Record<MetricInfoKey, { title: string; body: string }> = {
  bestPractice: {
    title: 'Best Practice',
    body:
      'Your highest score from a Practice session of at least 30 questions that you finished (not quit).\n\n' +
      'Why 30? A perfect 5/5 doesn’t really prove mastery, so a meaningful sample is required before crowning a “best”. Quit sessions are excluded because their score is a partial-credit estimate, not a real result.',
  },
  bestExam: {
    title: 'Best Exam',
    body:
      'Your highest score from a completed full-length Exam session.\n\n' +
      'Exams are 65 questions, so they always meet the 30-question minimum that Best Practice requires. Quit exams are excluded.',
  },
  bestScore: {
    title: 'Best Score',
    body:
      'Your highest score from any completed session of at least 30 questions in this tab. Practice and Exam scores are pooled together here.\n\n' +
      'The 30-question minimum and “not quit” rule keep this metric honest — a 5/5 perfect run on a short practice won’t inflate the headline.',
  },
  readiness: {
    title: 'Exam Readiness',
    body:
      'A weighted composite of three signals:\n\n' +
      '• 50% from your Pass Rate\n' +
      '• 30% from your recent average (last 3 sessions)\n' +
      '• 20% from how much of the question bank you’ve answered\n\n' +
      'The result is then multiplied by a confidence factor that scales from 0 up to 1 as your coverage reaches 50% of the bank. So if you’ve only answered 10% of questions, readiness is scaled down to 20% of its raw value — no matter how well you scored.\n\n' +
      'This prevents a single great session from claiming “Exam-ready” before you’ve actually covered the material.',
  },
  domain: {
    title: 'Domain Breakdown',
    body:
      'Per-domain accuracy across all your sessions in this tab.\n\n' +
      'A domain is hidden until you’ve answered at least 5 questions in it. Once unlocked, the percentage is scaled down based on how much of the domain’s question bank you’ve covered — full credit only kicks in at 50% coverage.\n\n' +
      'So 100% accuracy on 5 of 50 questions won’t show as 100% mastery. Coverage builds confidence over time, and the bar reflects that.',
  },
};

const HIST_BUCKETS = [
  { label: '<50%',   min: 0,  max: 49  },
  { label: '50–59%', min: 50, max: 59  },
  { label: '60–69%', min: 60, max: 69  },
  { label: '70–84%', min: 70, max: 84  },
  { label: '85%+',   min: 85, max: 100 },
];

type TabKey = 'all' | 'practice' | 'exam';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'practice', label: 'Practice' },
  { key: 'exam',     label: 'Exam' },
];

/** Derive how many questions were actually answered (handles legacy data). */
function resolveAnswered(s: ScoreSession): number {
  if (s.answeredCount !== undefined) return s.answeredCount;
  if (s.quit) {
    if (s.pct > 0) return Math.round(s.score / s.pct * 100);
    return 0;
  }
  return s.questionCount;
}

/** Human-readable "x days ago" / "today" / "yesterday" for the last session line. */
function relativeDay(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// Module-level cache: survives tab switches; invalidated via getInsightsDataVersion().
type InsightsCache = {
  version: number;
  scoreHistory: ScoreSession[];
  masteredCount: number;
  sessionRecords: SessionRecord[];
};

// Everything renderPage needs that DOES NOT depend on theme/colors. Pre-computed
// once per (scoreHistory, sessionRecords) change and reused for all three tabs.
type TabComputed = {
  filteredHistory: ScoreSession[];
  scopedFull: ScoreSession[];
  scopedRecords: SessionRecord[];
  totalSessions: number;
  avgScore: number;
  bestPractice: number;
  bestExam: number;
  bestScore: number;
  practiceBestEligible: number;
  examBestEligible: number;
  bestEligible: number;
  abandonedCount: number;
  lastSessionISO: string | undefined;
  trendSessions: ScoreSession[];
  passRate: number;
  completionRate: number;
  scoreDelta: number | null;
  streak: number;
  bestStreak: number;
  histCounts: { label: string; min: number; max: number; count: number }[];
  histMax: number;
  domainStats: Record<number, { seenSize: number; correct: number; attempts: number }>;
  coveragePct: number;
  uniqueQsSeen: number;
  readinessScore: number;
};

function computeTab(
  tabKey: TabKey,
  scoreHistory: ScoreSession[],
  sessionRecords: SessionRecord[],
  totalQCount: number,
  uniqueQsSeen: number,
): TabComputed {
  const withAnswers = scoreHistory.filter(s => resolveAnswered(s) > 0);
  const filteredHistory = tabKey === 'all'
    ? withAnswers
    : tabKey === 'exam'
      ? withAnswers.filter(s => s.mode === 'exam')
      : withAnswers.filter(s => s.mode !== 'exam');

  const scopedFull = tabKey === 'all'
    ? scoreHistory
    : tabKey === 'exam'
      ? scoreHistory.filter(s => s.mode === 'exam')
      : scoreHistory.filter(s => s.mode !== 'exam');
  const abandonedCount = scopedFull.filter(s => s.quit).length;
  const lastSessionISO = scopedFull[0]?.date;

  const totalSessions = filteredHistory.length;
  const avgScore = totalSessions === 0
    ? 0
    : Math.round(filteredHistory.reduce((s, h) => s + h.pct, 0) / totalSessions);

  const practiceBestEligibleArr = filteredHistory.filter(h => h.mode !== 'exam' && !h.quit && (h.questionCount ?? 0) >= BEST_SCORE_MIN_QS);
  const examBestEligibleArr = filteredHistory.filter(h => h.mode === 'exam' && !h.quit && (h.questionCount ?? 0) >= BEST_SCORE_MIN_QS);
  const bestPractice = practiceBestEligibleArr.length === 0 ? 0 : Math.max(...practiceBestEligibleArr.map(h => h.pct));
  const bestExam = examBestEligibleArr.length === 0 ? 0 : Math.max(...examBestEligibleArr.map(h => h.pct));
  const bestEligibleArr = tabKey === 'exam' ? examBestEligibleArr : tabKey === 'practice' ? practiceBestEligibleArr : [...practiceBestEligibleArr, ...examBestEligibleArr];
  const bestScore = bestEligibleArr.length === 0 ? 0 : Math.max(...bestEligibleArr.map(h => h.pct));
  const trendSessions = [...filteredHistory].slice(0, TREND_COUNT).reverse();

  const scopedRecords = tabKey === 'all'
    ? sessionRecords
    : tabKey === 'exam'
      ? sessionRecords.filter(r => r.mode === 'exam')
      : sessionRecords.filter(r => r.mode === 'practice');

  const domainStatsRaw: Record<number, { seen: Set<number>; correct: number; attempts: number }> = {};
  DOMAIN_NUMS.forEach(d => { domainStatsRaw[d] = { seen: new Set(), correct: 0, attempts: 0 }; });
  scopedRecords.forEach(r => r.history.forEach(h => {
    if (h.correct === null) return;
    if (!h.userLetters || h.userLetters.length === 0) return;
    const d = getDomainForIndex(h.questionIndex);
    domainStatsRaw[d].seen.add(h.questionIndex);
    domainStatsRaw[d].attempts++;
    if (h.correct) domainStatsRaw[d].correct++;
  }));
  const domainStats: Record<number, { seenSize: number; correct: number; attempts: number }> = {};
  DOMAIN_NUMS.forEach(d => {
    domainStats[d] = {
      seenSize: domainStatsRaw[d].seen.size,
      correct: domainStatsRaw[d].correct,
      attempts: domainStatsRaw[d].attempts,
    };
  });

  const passedCount = filteredHistory.filter(s => s.pct >= 70).length;
  const passRate = totalSessions > 0 ? Math.round((passedCount / totalSessions) * 100) : 0;
  const completedCount = filteredHistory.filter(s => !s.quit).length;
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  const scoreDelta = filteredHistory.length >= 2
    ? filteredHistory[0].pct - filteredHistory[filteredHistory.length - 1].pct
    : null;

  const streak = (() => {
    if (scoreHistory.length === 0) return 0;
    const days = new Set(scoreHistory.map(s => toLocalDateKey(s.date)));
    let count = 0;
    const cursor = new Date();
    if (!days.has(toLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(toLocalDateKey(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  })();

  const bestStreak = (() => {
    if (scoreHistory.length === 0) return 0;
    const days = [...new Set(scoreHistory.map(s => toLocalDateKey(s.date)))].sort();
    let best = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]).getTime();
      const curr = new Date(days[i]).getTime();
      if (curr - prev === 86_400_000) {
        run++;
        if (run > best) best = run;
      } else {
        run = 1;
      }
    }
    return best;
  })();

  const histCounts = HIST_BUCKETS.map(b => ({
    ...b,
    count: filteredHistory.filter(s => s.pct >= b.min && s.pct <= b.max).length,
  }));
  const histMax = Math.max(...histCounts.map(b => b.count), 1);

  const coveragePct = totalQCount > 0 ? Math.round((uniqueQsSeen / totalQCount) * 100) : 0;

  const recentAvg = (() => {
    const last3 = filteredHistory.slice(0, 3);
    if (last3.length === 0) return 0;
    return Math.round(last3.reduce((s, h) => s + h.pct, 0) / last3.length);
  })();
  const rawReadiness = passRate * 0.5 + recentAvg * 0.3 + coveragePct * 0.2;
  const confidence = Math.min(1, coveragePct / 50);
  const readinessScore = totalSessions > 0
    ? Math.min(100, Math.round(rawReadiness * confidence))
    : 0;

  return {
    filteredHistory, scopedFull, scopedRecords,
    totalSessions, avgScore,
    bestPractice, bestExam, bestScore,
    practiceBestEligible: practiceBestEligibleArr.length,
    examBestEligible: examBestEligibleArr.length,
    bestEligible: bestEligibleArr.length,
    abandonedCount, lastSessionISO,
    trendSessions,
    passRate, completionRate, scoreDelta,
    streak, bestStreak,
    histCounts, histMax,
    domainStats,
    coveragePct, uniqueQsSeen,
    readinessScore,
  };
}
let insightsCache: InsightsCache | null = null;

export default function InsightsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shared = useMemo(() => SHARED_STYLES(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [scoreHistory, setScoreHistory] = useState<ScoreSession[]>(
    () => insightsCache?.scoreHistory ?? []
  );
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [masteredCount, setMasteredCount] = useState(
    () => insightsCache?.masteredCount ?? 0
  );
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>(
    () => insightsCache?.sessionRecords ?? []
  );
  const [loading, setLoading] = useState(insightsCache === null);
  const [practiceTarget, setPracticeTarget] = useState<DomainFilter | null>(null);
  const [infoMetric, setInfoMetric] = useState<MetricInfoKey | null>(null);
  const totalQCount = getTotalCount();

  const flatListRef = useRef<FlatList>(null);
  const isInternalScroll = useRef(false);
  const scrollRefs = useRef<Record<string, ScrollView | null>>({});

  const loadData = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    const versionAtFetch = getInsightsDataVersion();
    const [h, mc, sr] = await Promise.all([
      getScoreHistory(),
      getMasteredCount(),
      getSessionRecords(),
    ]);
    setScoreHistory(h);
    setMasteredCount(mc);
    setSessionRecords(sr);
    insightsCache = {
      version: versionAtFetch,
      scoreHistory: h,
      masteredCount: mc,
      sessionRecords: sr,
    };
    if (showSpinner) setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    const currentVersion = getInsightsDataVersion();
    if (insightsCache && insightsCache.version === currentVersion) {
      // Cache is fresh — nothing to do, render is already instant from cached state.
    } else if (insightsCache) {
      // Cache exists but stale — refresh silently in background, no spinner.
      loadData(false);
    } else {
      // Cold start — spinner is OK.
      loadData(true);
    }
    // Synchronized Reset: Scroll ALL horizontal pages back to top when entering
    Object.values(scrollRefs.current).forEach(ref => ref?.scrollTo({ y: 0, animated: false }));
  }, [loadData]));

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isInternalScroll.current) return;
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index >= 0 && index < TABS.length) {
      setActiveTab(TABS[index].key);
    }
  };

  const scrollToTab = (key: TabKey) => {
    if (activeTab === key) return;
    const index = TABS.findIndex(t => t.key === key);
    if (index !== -1) {
      isInternalScroll.current = true;
      setActiveTab(key);
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setTimeout(() => { isInternalScroll.current = false; }, 400);
    }
  };

  // Heavy work memoised. uniqueQsSeen iterates every history row, and each tab's
  // domainStats walks scopedRecords again — doing it once per data change instead
  // of on every render (theme toggle, masteredCount bump, etc.) keeps the screen
  // snappy as session history grows toward the 365-entry cap.
  const uniqueQsSeen = useMemo(() => {
    const seen = new Set<number>();
    sessionRecords.forEach(r => r.history.forEach(h => {
      if (h.userLetters && h.userLetters.length > 0) seen.add(h.questionIndex);
    }));
    return seen.size;
  }, [sessionRecords]);

  const tabData = useMemo(() => ({
    all: computeTab('all', scoreHistory, sessionRecords, totalQCount, uniqueQsSeen),
    practice: computeTab('practice', scoreHistory, sessionRecords, totalQCount, uniqueQsSeen),
    exam: computeTab('exam', scoreHistory, sessionRecords, totalQCount, uniqueQsSeen),
  }), [scoreHistory, sessionRecords, totalQCount, uniqueQsSeen]);

  const bankCounts = useMemo(() => getDomainCounts(), []);

  const renderPage = ({ item }: { item: TabKey }) => {
    const tabKey = item;
    const data = tabData[tabKey];
    const {
      scopedFull,
      totalSessions, avgScore,
      bestPractice, bestExam, bestScore,
      practiceBestEligible, examBestEligible, bestEligible,
      abandonedCount, lastSessionISO,
      trendSessions,
      passRate, completionRate, scoreDelta,
      streak, bestStreak,
      histCounts, histMax,
      domainStats,
      coveragePct,
      readinessScore,
    } = data;

    const readinessColor = readinessScore >= 70 ? colors.correct
      : readinessScore >= 50 ? colors.awsOrange
      : colors.wrong;
    const readinessLabel = readinessScore >= 80 ? 'Exam-ready'
      : readinessScore >= 60 ? 'Almost there'
      : readinessScore >= 40 ? 'Keep practicing'
      : 'Just getting started';

    const chartData = {
      labels: trendSessions.map((_, i) => (i + 1).toString()),
      datasets: [{
        data: trendSessions.map(s => s.pct),
        color: (opacity = 1) => `rgba(255, 153, 0, ${opacity})`,
        strokeWidth: 3
      }, {
        data: trendSessions.map(() => 70),
        color: (opacity = 1) => isDark ? `rgba(34, 197, 94, 0.4)` : `rgba(22, 163, 74, 0.4)`,
        strokeWidth: 1,
        withDots: false,
      }]
    };

    const masteredPct = totalQCount > 0 ? Math.round((masteredCount / totalQCount) * 100) : 0;

    return (
      <ScrollView
        ref={r => { scrollRefs.current[tabKey] = r; }}
        style={{ width: screenWidth, backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {totalSessions === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyBody}>Complete a session to see your insights.</Text>
          </View>
        ) : (
          <>
            <Text style={shared.sectionLabel}>SUMMARY</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalSessions}</Text>
                <Text style={styles.summaryLabel}>Sessions</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: avgScore >= 70 ? colors.correct : colors.awsOrange }]}>{avgScore}%</Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
                {scoreDelta !== null && (
                   <Text style={[styles.summarySubLabel, { color: scoreDelta >= 0 ? colors.correct : colors.wrong }]}>
                     {scoreDelta >= 0 ? `▲ +${scoreDelta}%` : `▼ ${scoreDelta}%`}
                   </Text>
                )}
              </View>
              {tabKey === 'all' ? (
                <>
                  <TouchableOpacity
                    style={styles.summaryCard}
                    onPress={() => setInfoMetric('bestPractice')}
                    activeOpacity={0.7}
                    accessibilityLabel="Best Practice score — tap for details"
                    accessibilityRole="button"
                  >
                    <Text style={styles.cardInfoIcon}>ⓘ</Text>
                    <Text style={[styles.summaryValue, { color: bestPractice >= 70 ? colors.correct : colors.awsOrange }]}>{bestPractice}%</Text>
                    <Text style={styles.summaryLabel}>Best Practice</Text>
                    <Text style={styles.summarySubLabel} numberOfLines={1}>
                      {practiceBestEligible === 0 ? `Needs ${BEST_SCORE_MIN_QS}+ Qs` : `${practiceBestEligible} qualifying`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.summaryCard}
                    onPress={() => setInfoMetric('bestExam')}
                    activeOpacity={0.7}
                    accessibilityLabel="Best Exam score — tap for details"
                    accessibilityRole="button"
                  >
                    <Text style={styles.cardInfoIcon}>ⓘ</Text>
                    <Text style={[styles.summaryValue, { color: bestExam >= 70 ? colors.correct : colors.awsOrange }]}>{bestExam}%</Text>
                    <Text style={styles.summaryLabel}>Best Exam</Text>
                    <Text style={styles.summarySubLabel} numberOfLines={1}>
                      {examBestEligible === 0 ? 'No exam yet' : `${examBestEligible} exam${examBestEligible === 1 ? '' : 's'}`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.summaryCard}
                  onPress={() => setInfoMetric('bestScore')}
                  activeOpacity={0.7}
                  accessibilityLabel="Best Score — tap for details"
                  accessibilityRole="button"
                >
                  <Text style={styles.cardInfoIcon}>ⓘ</Text>
                  <Text style={[styles.summaryValue, { color: bestScore >= 70 ? colors.correct : colors.awsOrange }]}>{bestScore}%</Text>
                  <Text style={styles.summaryLabel}>Best Score</Text>
                  <Text style={styles.summarySubLabel} numberOfLines={1}>
                    {bestEligible === 0 ? `Needs ${BEST_SCORE_MIN_QS}+ Qs completed` : `from ${bestEligible} qualifying`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{passRate}%</Text>
                <Text style={styles.summaryLabel}>Pass Rate</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {streak > 0 || bestStreak > 0
                    ? `🔥 ${streak} / ${bestStreak}`
                    : '—'}
                </Text>
                <Text style={styles.summaryLabel}>Streak / Best</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{completionRate}%</Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>
            </View>

            {(abandonedCount > 0 || lastSessionISO) && (
              <View style={styles.metaRow}>
                {abandonedCount > 0 && (
                  <Text style={styles.metaText}>📌 {abandonedCount} of {scopedFull.length} sessions abandoned</Text>
                )}
                {lastSessionISO && (
                  <Text style={styles.metaText}>⏱ Last session: {relativeDay(lastSessionISO)}</Text>
                )}
              </View>
            )}

            <Text style={shared.sectionLabel}>EXAM READINESS</Text>
            <TouchableOpacity
              style={shared.card}
              onPress={() => setInfoMetric('readiness')}
              activeOpacity={0.85}
              accessibilityLabel="Exam Readiness — tap for details"
              accessibilityRole="button"
            >
              <Text style={styles.cardInfoIcon}>ⓘ</Text>
              <View style={styles.readinessHeader}>
                <Text style={[styles.readinessScore, { color: readinessColor }]}>{readinessScore}%</Text>
                <Text style={[styles.readinessLabel, { color: readinessColor }]}>{readinessLabel}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${readinessScore}%` as any, backgroundColor: readinessColor }]} />
              </View>
              <Text style={styles.readinessHint}>
                Based on pass rate, recent scores, and how many unique questions you’ve answered.
              </Text>
              <Text style={styles.readinessHint}>
                Calculated from {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} • {coveragePct}% answered{coveragePct < 50 ? ' (low — score is scaled down until you reach 50%)' : ''}.
              </Text>
            </TouchableOpacity>

            <Text style={shared.sectionLabel}>SCORE TREND (LAST {trendSessions.length})</Text>
            <View style={[shared.card, { paddingLeft: 0, paddingRight: 0 }]}>
              {trendSessions.length < 2 ? (
                <View style={styles.trendEmpty}>
                  <Text style={styles.trendEmptyIcon}>📈</Text>
                  <Text style={styles.trendEmptyTitle}>
                    {trendSessions.length === 0 ? 'No trend yet' : 'One session in the books'}
                  </Text>
                  <Text style={styles.trendEmptyBody}>
                    {trendSessions.length === 0
                      ? 'Complete at least 2 sessions to see your score trend over time.'
                      : 'Take one more session to start tracking your score trend.'}
                  </Text>
                </View>
              ) : (
                <LineChart
                  data={chartData}
                  width={screenWidth - 32}
                  height={180}
                  chartConfig={{
                    backgroundColor: colors.cardBg,
                    backgroundGradientFrom: colors.cardBg,
                    backgroundGradientTo: colors.cardBg,
                    decimalPlaces: 0,
                    color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => colors.textSecondary,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "4", strokeWidth: "2", stroke: colors.awsOrange },
                    propsForBackgroundLines: { strokeDasharray: "", stroke: colors.border, strokeOpacity: 0.3 }
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                  withInnerLines={true}
                  withOuterLines={false}
                  yAxisSuffix="%"
                />
              )}
            </View>

            <Text style={shared.sectionLabel}>SCORE DISTRIBUTION</Text>
            <View style={shared.card}>
              {histCounts.map((b, i) => (
                <View key={i} style={styles.histRow}>
                  <Text style={styles.histLabel}>{b.label}</Text>
                  <View style={styles.histTrack}>
                    <View style={[styles.histBar, { width: `${Math.round((b.count / histMax) * 100)}%` as any, backgroundColor: b.min >= 70 ? colors.correct : colors.awsOrange }]} />
                  </View>
                  <Text style={styles.histCount}>{b.count}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionLabelRow}>
              <Text style={shared.sectionLabel}>DOMAIN BREAKDOWN</Text>
              <TouchableOpacity
                onPress={() => setInfoMetric('domain')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="About Domain Breakdown"
                accessibilityRole="button"
              >
                <Text style={styles.sectionInfoIcon}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            <View style={shared.card}>
              {(() => {
                const eligible = DOMAIN_NUMS.filter(d => domainStats[d].attempts >= MIN_DOMAIN_SAMPLE);
                const weakDomains = eligible.filter(d => {
                  const dStats = domainStats[d];
                  const bankTotal = bankCounts[d] || 0;
                  const coverage = bankTotal > 0 ? dStats.seenSize / bankTotal : 0;
                  const conf = Math.min(1, coverage / DOMAIN_CONF_FLOOR);
                  const scored = (dStats.correct / dStats.attempts) * conf;
                  return scored < 0.7;
                });
                if (eligible.length === 0) {
                  return (
                    <View style={[styles.focusCallout, { backgroundColor: colors.awsOrange + '15', borderLeftColor: colors.awsOrange }]}>
                      <Text style={[styles.focusText, { color: colors.awsOrange }]}>ℹ Not enough data yet — answer at least {MIN_DOMAIN_SAMPLE} questions per domain.</Text>
                    </View>
                  );
                }
                return weakDomains.length > 0 ? (
                  <View style={styles.focusCallout}>
                    <Text style={styles.focusText}>⚠ Focus on: {weakDomains.map(d => DOMAIN_LABELS[d]).join(', ')}</Text>
                  </View>
                ) : (
                  <View style={[styles.focusCallout, { backgroundColor: colors.correct + '15', borderLeftColor: colors.correct }]}>
                    <Text style={[styles.focusText, { color: colors.correct }]}>🎉 All domains on track!</Text>
                  </View>
                );
              })()}
              {DOMAIN_NUMS.map(d => {
                const dStats = domainStats[d];
                const bankTotal = bankCounts[d] || 0;
                const ungated = dStats.attempts < MIN_DOMAIN_SAMPLE;
                const accuracy = dStats.attempts > 0 ? dStats.correct / dStats.attempts : 0;
                const coverage = bankTotal > 0 ? dStats.seenSize / bankTotal : 0;
                const conf = Math.min(1, coverage / DOMAIN_CONF_FLOOR);
                const pct = ungated ? null : Math.round(accuracy * conf * 100);
                const barColor = pct === null ? colors.border : pct >= 70 ? colors.correct : pct >= 50 ? colors.awsOrange : colors.wrong;
                return (
                  <View key={d} style={styles.domainRow}>
                    <View style={styles.domainInfo}>
                      <Text style={styles.domainName} numberOfLines={1}>{DOMAIN_LABELS[d]}</Text>
                      {pct !== null
                        ? <Text style={[styles.domainPctBadge, { backgroundColor: barColor + '20', color: barColor }]}>{pct}%</Text>
                        : <Text style={styles.domainPctBadgeMuted}>Need {MIN_DOMAIN_SAMPLE - dStats.attempts} more</Text>}
                    </View>
                    <View style={styles.domainBarTrack}>
                      <View style={[styles.domainBarFill, { width: pct !== null ? `${pct}%` as any : '0%', backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.domainSubtitle}>
                      {dStats.seenSize} of {bankTotal} answered • {dStats.correct}/{dStats.attempts} correct
                    </Text>
                    <TouchableOpacity
                      style={styles.domainPracticeBtn}
                      onPress={() => setPracticeTarget(d as DomainFilter)}
                      accessibilityLabel={`Practice ${DOMAIN_LABELS[d]}`}
                    >
                      <Text style={styles.domainPracticeBtnText}>Practice →</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <Text style={shared.sectionLabel}>PROGRESS OVERVIEW</Text>
            <View style={shared.card}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Mastery: {masteredCount}/{totalQCount}</Text>
                <Text style={[styles.progressPct, { color: colors.correct }]}>{masteredPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${masteredPct}%` as any, backgroundColor: colors.correct }]} />
              </View>

              <View style={[styles.progressHeader, { marginTop: 16 }]}>
                <Text style={styles.progressTitle}>Answered: {uniqueQsSeen}/{totalQCount}</Text>
                <Text style={[styles.progressPct, { color: colors.awsOrange }]}>{coveragePct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${coveragePct}%` as any, backgroundColor: colors.awsOrange }]} />
              </View>
              <Text style={styles.progressCaption}>Unique questions you’ve answered across practice and exam sessions.</Text>
            </View>

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.awsOrange} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={shared.header}>
        <Text style={styles.headerTitle}>📊 Insights</Text>
      </View>

      <View style={styles.tabBar}>
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const scope = tab.key === 'all'
              ? scoreHistory
              : tab.key === 'exam'
                ? scoreHistory.filter(s => s.mode === 'exam')
                : scoreHistory.filter(s => s.mode !== 'exam');
            const count = scope.filter(s => resolveAnswered(s) > 0).length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => scrollToTab(tab.key)}
              >
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <Text style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          ref={flatListRef}
          data={TABS.map(t => t.key)}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          keyExtractor={item => item}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
        />
      </View>

      {/* ── Domain Practice Mode Picker ─────────────────────────────────────── */}
      <Modal
        visible={practiceTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPracticeTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Practice: {practiceTarget !== null ? DOMAIN_LABELS[practiceTarget] : ''}
            </Text>
            <Text style={styles.modalBody}>Choose a mode to start:</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setPracticeTarget(null)}
              >
                <Text style={styles.modalBtnSecText}>Cancel</Text>
              </TouchableOpacity>
              {(['Study', 'Test'] as const).map(label => (
                <TouchableOpacity
                  key={label}
                  style={[styles.modalBtn, { backgroundColor: colors.awsDark }]}
                  onPress={async () => {
                    if (practiceTarget === null) return;
                    const studyMode = label === 'Study';
                    const baseConfig: Omit<QuizConfig, 'indices'> = {
                      mode: 'random',
                      fromQ: 1,
                      toQ: 65,
                      count: 20,
                      timed: false,
                      timePerQuestion: 60,
                      questionType: 'all',
                      domain: practiceTarget,
                      studyMode,
                    };
                    const indices = await buildIndices(baseConfig);
                    setPracticeTarget(null);
                    navigation.navigate('Quiz', { config: { ...baseConfig, indices } });
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>{label} Mode</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Metric Info Popup ─────────────────────────────────────────────── */}
      <Modal
        visible={infoMetric !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoMetric(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {infoMetric ? METRIC_INFO[infoMetric].title : ''}
            </Text>
            <Text style={styles.modalBody}>
              {infoMetric ? METRIC_INFO[infoMetric].body : ''}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.awsDark }]}
                onPress={() => setInfoMetric(null)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnPrimaryText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textLight, textAlign: 'center', flex: 1 },
  tabBar: { backgroundColor: colors.awsDark, paddingBottom: 10 },
  tabRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, gap: 8 },
  tab: { width: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: colors.awsOrange },
  tabLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  tabLabelActive: { color: '#fff' },
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },
  emptyCard: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 40, alignItems: 'center', marginTop: 32, ...shadow('#000', 1, 0.06, 4), elevation: 2 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: colors.cardBg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', ...shadow('#000', 1, 0.06, 4), elevation: 2, borderWidth: 1, borderColor: colors.border },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  summarySubLabel: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  tabCount: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
  },
  tabCountActive: {
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, paddingHorizontal: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  readinessHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  readinessScore: { fontSize: 20, fontWeight: '800' },
  readinessLabel: { fontSize: 13, fontWeight: '700' },
  readinessHint: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  noDataHint: { textAlign: 'center', padding: 20, color: colors.textMuted, fontSize: 13 },
  trendEmpty: { paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
  trendEmptyIcon: { fontSize: 32, marginBottom: 8 },
  trendEmptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  trendEmptyBody: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  histLabel: { width: 50, fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  histTrack: { flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginHorizontal: 8 },
  histBar: { height: 12, borderRadius: 6 },
  histCount: { width: 20, fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  focusCallout: { backgroundColor: colors.wrong + '15', borderRadius: 8, padding: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: colors.wrong },
  focusText: { fontSize: 12, fontWeight: '600', color: colors.wrong },
  domainRow: { marginBottom: 16 },
  domainInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  domainName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  domainPctBadge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  domainPctBadgeMuted: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, color: colors.textSecondary },
  domainBarTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 6 },
  domainBarFill: { height: 8, borderRadius: 4 },
  domainSubtitle: { fontSize: 11, color: colors.textSecondary, marginBottom: 6 },
  domainPracticeBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.awsOrange },
  domainPracticeBtnText: { fontSize: 11, fontWeight: '800', color: colors.awsOrange },
  // ── Modal styles ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', backgroundColor: colors.cardBg, borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  modalBody: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: colors.border },
  modalBtnSecText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Subtle info hint shown in the top-right of tappable summary/insight cards.
  // The whole card is the tap target; the icon is just a visual affordance.
  // position:'absolute' keeps it out of flow so the value/label text below
  // sits on the same baseline as non-tappable cards in the same row.
  cardInfoIcon: {
    position: 'absolute', top: 4, right: 6,
    fontSize: 10, color: colors.textMuted, opacity: 0.6,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionInfoIcon: { fontSize: 14, color: colors.textSecondary, opacity: 0.85 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  progressTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  progressPct: { fontSize: 20, fontWeight: '800' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5 },
  progressCaption: { fontSize: 10, color: colors.textSecondary, marginTop: 4 },
});
