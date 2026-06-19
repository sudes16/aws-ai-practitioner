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

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

const DOMAIN_NUMS = [1, 2, 3, 4, 5] as const;
const TREND_COUNT = 15;
// Domain breakdown gating: hide a percentage until at least this many attempts
// in the domain, and scale by coverage so a tiny sample can't claim mastery.
const MIN_DOMAIN_SAMPLE = 5;
const DOMAIN_CONF_FLOOR = 0.5; // coverage at/above 50% = full confidence

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

  const renderPage = ({ item }: { item: TabKey }) => {
    const tabKey = item;
    // Calculate data independently per page
    const withAnswers = scoreHistory.filter(s => resolveAnswered(s) > 0);
    const filteredHistory = tabKey === 'all'
      ? withAnswers
      : tabKey === 'exam'
        ? withAnswers.filter(s => s.mode === 'exam')
        : withAnswers.filter(s => s.mode !== 'exam');

    // Abandoned: any session the user did not complete (quit at any point).
    const scopedFull = tabKey === 'all'
      ? scoreHistory
      : tabKey === 'exam'
        ? scoreHistory.filter(s => s.mode === 'exam')
        : scoreHistory.filter(s => s.mode !== 'exam');
    const abandonedCount = scopedFull.filter(s => s.quit).length;
    const lastSessionISO = scopedFull[0]?.date;

    const totalSessions = filteredHistory.length;
    const avgScore = totalSessions === 0 ? 0 : Math.round(filteredHistory.reduce((s, h) => s + h.pct, 0) / totalSessions);
    const bestScore = totalSessions === 0 ? 0 : Math.max(...filteredHistory.map(h => h.pct));
    const trendSessions = [...filteredHistory].slice(0, TREND_COUNT).reverse();

    // Per-domain stats derived from full session history (last 25 sessions).
    // Tracks UNIQUE questions seen per domain so coverage reflects bank progress,
    // not raw attempt count. Hotspots are excluded (no measurable accuracy).
    const scopedRecords = tabKey === 'all'
      ? sessionRecords
      : tabKey === 'exam'
        ? sessionRecords.filter(r => r.mode === 'exam')
        : sessionRecords.filter(r => r.mode === 'practice');
    const bankCounts = getDomainCounts();
    const domainStats: Record<number, { seen: Set<number>; correct: number; attempts: number }> = {};
    DOMAIN_NUMS.forEach(d => { domainStats[d] = { seen: new Set(), correct: 0, attempts: 0 }; });
    scopedRecords.forEach(r => r.history.forEach(h => {
      if (h.isHotspot) return;
      if (!h.userLetters || h.userLetters.length === 0) return;
      const d = getDomainForIndex(h.questionIndex);
      domainStats[d].seen.add(h.questionIndex);
      domainStats[d].attempts++;
      if (h.correct) domainStats[d].correct++;
    }));

    const passedCount    = filteredHistory.filter(s => s.pct >= 70).length;
    const passRate       = totalSessions > 0 ? Math.round((passedCount / totalSessions) * 100) : 0;
    const completedCount = filteredHistory.filter(s => !s.quit).length;
    const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

    const scoreDelta = filteredHistory.length >= 2
      ? filteredHistory[0].pct - filteredHistory[filteredHistory.length - 1].pct
      : null;

    const streak = (() => {
      if (scoreHistory.length === 0) return 0;
      const days = new Set(scoreHistory.map(s => s.date.slice(0, 10)));
      let count = 0;
      const cursor = new Date();
      if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toISOString().slice(0, 10))) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      }
      return count;
    })();

    const bestStreak = (() => {
      if (scoreHistory.length === 0) return 0;
      const days = [...new Set(scoreHistory.map(s => s.date.slice(0, 10)))].sort();
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
    // Coverage counts only questions the user actually engaged with (answered),
    // not every question that appeared in a session pool.
    const uniqueQsSeen = (() => {
      const seen = new Set<number>();
      sessionRecords.forEach(r => r.history.forEach(h => {
        if (h.userLetters && h.userLetters.length > 0) seen.add(h.questionIndex);
      }));
      return seen.size;
    })();
    const coveragePct = totalQCount > 0 ? Math.round((uniqueQsSeen / totalQCount) * 100) : 0;

    // Exam readiness: weighted composite of pass rate, recent avg, and coverage,
    // scaled by a coverage-based confidence factor so a single high-scoring session
    // can't claim full readiness. Confidence reaches 1.0 at 50% coverage; below that
    // the score is scaled down proportionally.
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
    const readinessColor = readinessScore >= 70 ? colors.correct
      : readinessScore >= 50 ? colors.awsOrange
      : colors.wrong;
    const readinessLabel = readinessScore >= 80 ? 'Exam-ready'
      : readinessScore >= 60 ? 'Almost there'
      : readinessScore >= 40 ? 'Keep practicing'
      : 'Just getting started';

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
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: bestScore >= 70 ? colors.correct : colors.awsOrange }]}>{bestScore}%</Text>
                <Text style={styles.summaryLabel}>Best Score</Text>
              </View>
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
            <View style={shared.card}>
              <View style={styles.readinessHeader}>
                <Text style={[styles.readinessScore, { color: readinessColor }]}>{readinessScore}%</Text>
                <Text style={[styles.readinessLabel, { color: readinessColor }]}>{readinessLabel}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${readinessScore}%` as any, backgroundColor: readinessColor }]} />
              </View>
              <Text style={styles.readinessHint}>
                Based on pass rate, recent scores, and question coverage.
              </Text>
              <Text style={styles.readinessHint}>
                Calculated from {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} • {coveragePct}% coverage{coveragePct < 50 ? ' (low — score is scaled down until you reach 50%)' : ''}.
              </Text>
            </View>

            <Text style={shared.sectionLabel}>SCORE TREND (LAST {trendSessions.length})</Text>
            <View style={[shared.card, { paddingLeft: 0, paddingRight: 0 }]}>
              {trendSessions.length < 2 ? (
                <Text style={styles.noDataHint}>Need at least 2 sessions for trend</Text>
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

            <Text style={shared.sectionLabel}>DOMAIN BREAKDOWN</Text>
            <View style={shared.card}>
              {(() => {
                const eligible = DOMAIN_NUMS.filter(d => domainStats[d].attempts >= MIN_DOMAIN_SAMPLE);
                const weakDomains = eligible.filter(d => {
                  const data = domainStats[d];
                  const bankTotal = bankCounts[d] || 0;
                  const coverage = bankTotal > 0 ? data.seen.size / bankTotal : 0;
                  const conf = Math.min(1, coverage / DOMAIN_CONF_FLOOR);
                  const scored = (data.correct / data.attempts) * conf;
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
                const data = domainStats[d];
                const bankTotal = bankCounts[d] || 0;
                const ungated = data.attempts < MIN_DOMAIN_SAMPLE;
                const accuracy = data.attempts > 0 ? data.correct / data.attempts : 0;
                const coverage = bankTotal > 0 ? data.seen.size / bankTotal : 0;
                const conf = Math.min(1, coverage / DOMAIN_CONF_FLOOR);
                const pct = ungated ? null : Math.round(accuracy * conf * 100);
                const barColor = pct === null ? colors.border : pct >= 70 ? colors.correct : pct >= 50 ? colors.awsOrange : colors.wrong;
                return (
                  <View key={d} style={styles.domainRow}>
                    <View style={styles.domainInfo}>
                      <Text style={styles.domainName} numberOfLines={1}>{DOMAIN_LABELS[d]}</Text>
                      {pct !== null
                        ? <Text style={[styles.domainPctBadge, { backgroundColor: barColor + '20', color: barColor }]}>{pct}%</Text>
                        : <Text style={styles.domainPctBadgeMuted}>Need {MIN_DOMAIN_SAMPLE - data.attempts} more</Text>}
                    </View>
                    <View style={styles.domainBarTrack}>
                      <View style={[styles.domainBarFill, { width: pct !== null ? `${pct}%` as any : '0%', backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.domainSubtitle}>
                      {data.seen.size} of {bankTotal} answered • {data.correct}/{data.attempts} correct
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
                <Text style={styles.progressTitle}>Coverage: {uniqueQsSeen}/{totalQCount}</Text>
                <Text style={[styles.progressPct, { color: colors.awsOrange }]}>{coveragePct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${coveragePct}%` as any, backgroundColor: colors.awsOrange }]} />
              </View>
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
  modalBody: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: colors.border },
  modalBtnSecText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  progressTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  progressPct: { fontSize: 20, fontWeight: '800' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5 },
});
