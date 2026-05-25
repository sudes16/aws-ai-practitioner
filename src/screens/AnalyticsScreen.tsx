import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, DOMAIN_LABELS } from '../constants/types';
import {
  getScoreHistory,
  getMasteredCount,
  getSessionRecords,
  ScoreSession,
  SessionRecord,
} from '../utils/storage';
import { getTotalCount } from '../utils/quizEngine';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { shadow } from '../utils/styleUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;

const DOMAIN_NUMS = [1, 2, 3, 4, 5] as const;
const TREND_COUNT = 20;

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

export default function AnalyticsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [scoreHistory, setScoreHistory] = useState<ScoreSession[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [masteredCount, setMasteredCount] = useState(0);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const totalQCount = getTotalCount();

  const loadData = useCallback(async () => {
    const [h, mc, sr] = await Promise.all([
      getScoreHistory(),
      getMasteredCount(),
      getSessionRecords(),
    ]);
    setScoreHistory(h);
    setMasteredCount(mc);
    setSessionRecords(sr);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Filtered data based on active tab ────────────────────────────────────
  const filteredHistory = useMemo(() =>
    activeTab === 'all'      ? scoreHistory
    : activeTab === 'exam'   ? scoreHistory.filter(s => s.mode === 'exam')
    : scoreHistory.filter(s => s.mode !== 'exam'),   // practice = everything except exam
    [scoreHistory, activeTab],
  );
  // ── Derived stats ────────────────────────────────────────────────────────
  const totalSessions = filteredHistory.length;
  const avgScore = totalSessions === 0
    ? 0
    : Math.round(filteredHistory.reduce((s, h) => s + h.pct, 0) / totalSessions);
  const bestScore = totalSessions === 0 ? 0 : Math.max(...filteredHistory.map(h => h.pct));
  const totalAnswered = filteredHistory.reduce((s, h) => {
    if (h.answeredCount !== undefined) return s + h.answeredCount;
    // Legacy sessions (no answeredCount stored): derive from score/pct for quit sessions
    if (h.quit) {
      if (h.pct > 0) return s + Math.round(h.score / h.pct * 100);
      return s; // quit with 0 correct and 0% → answered nothing
    }
    return s + h.questionCount; // completed session → answered everything
  }, 0);
  const totalSelected = filteredHistory.reduce((s, h) => s + h.questionCount, 0);

  // ── Score trend (last TREND_COUNT sessions, chronological order) ─────────
  const trendSessions = [...filteredHistory].slice(0, TREND_COUNT).reverse();

  // ── Domain breakdown (aggregate from filtered sessions with breakdown data) ─
  const domainTotals: Record<number, { c: number; t: number }> = {};
  filteredHistory.forEach(s => {
    if (s.domainBreakdown) {
      Object.entries(s.domainBreakdown).forEach(([key, val]) => {
        const d = Number(key);
        if (!domainTotals[d]) domainTotals[d] = { c: 0, t: 0 };
        domainTotals[d].c += val.c;
        domainTotals[d].t += val.t;
      });
    }
  });
  const hasDomainData = Object.keys(domainTotals).length > 0;

  // ── Additional derived stats ─────────────────────────────────────────────
  const passedCount    = filteredHistory.filter(s => s.pct >= 70).length;
  const passRate       = totalSessions > 0 ? Math.round((passedCount / totalSessions) * 100) : 0;
  const completedCount = filteredHistory.filter(s => !s.quit).length;
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;
  const scoreDelta     = filteredHistory.length >= 2
    ? filteredHistory[0].pct - filteredHistory[filteredHistory.length - 1].pct
    : null;
  const masteredPct    = totalQCount > 0 ? Math.round((masteredCount / totalQCount) * 100) : 0;
  const uniqueQsSeen   = (() => {
    const seen = new Set<number>();
    sessionRecords.forEach(r => r.history.forEach(h => seen.add(h.questionIndex)));
    return seen.size;
  })();
  const coveragePct    = totalQCount > 0 ? Math.round((uniqueQsSeen / totalQCount) * 100) : 0;
  const streak         = (() => {
    if (scoreHistory.length === 0) return 0;
    const days = new Set(scoreHistory.map(s => s.date.slice(0, 10)));
    let count = 0;
    const cursor = new Date();
    if (!days.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(cursor.toISOString().slice(0, 10))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  })();
  const histCounts     = HIST_BUCKETS.map(b => ({
    ...b,
    count: filteredHistory.filter(s => s.pct >= b.min && s.pct <= b.max).length,
  }));
  const histMax        = Math.max(...histCounts.map(b => b.count), 1);

  // ── Bar width for trend chart ────────────────────────────────────────────
  const chartPadding = 32;
  const barGap = 3;
  const barCount = Math.min(trendSessions.length, TREND_COUNT);
  const barWidth = barCount > 0
    ? Math.floor((screenWidth - chartPadding * 2 - barGap * (barCount - 1)) / barCount)
    : 10;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Analytics</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const count = tab.key === 'all' ? scoreHistory.length
            : tab.key === 'exam' ? scoreHistory.filter(s => s.mode === 'exam').length
            : scoreHistory.filter(s => s.mode !== 'exam').length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {totalSessions === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'all' ? 'No data yet'
                : activeTab === 'exam' ? 'No exam sessions yet'
                : 'No practice sessions yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {activeTab === 'exam'
                ? 'Complete a mock exam to see your exam analytics.'
                : 'Complete a practice session to see your analytics here.'}
            </Text>
          </View>
        ) : (
          <>
            {/* ── Summary ── */}
            <Text style={styles.sectionLabel}>SUMMARY</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalSessions}</Text>
                <Text style={styles.summaryLabel}>Sessions</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: avgScore >= 70 ? colors.correct : colors.awsOrange }]}>
                  {avgScore}%
                </Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
                {scoreDelta !== null && (
                  <Text style={[styles.summarySubLabel, {
                    color: scoreDelta >= 0 ? colors.correct : colors.wrong,
                  }]}>
                    {scoreDelta >= 0 ? `▲ +${scoreDelta}%` : `▼ ${scoreDelta}%`} vs first
                  </Text>
                )}
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: bestScore >= 70 ? colors.correct : colors.awsOrange }]}>
                  {bestScore}%
                </Text>
                <Text style={styles.summaryLabel}>Best Score</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {totalAnswered >= 1000 ? `${(totalAnswered / 1000).toFixed(1)}k` : totalAnswered}
                </Text>
                <Text style={styles.summaryLabel}>Answered</Text>
                {totalSelected !== totalAnswered && (
                  <Text style={styles.summarySubLabel}>
                    of {totalSelected >= 1000 ? `${(totalSelected / 1000).toFixed(1)}k` : totalSelected} selected
                  </Text>
                )}
              </View>
            </View>

            {/* ── Summary Row 2: Pass Rate · Day Streak · Completion ── */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: passRate >= 70 ? colors.correct : colors.awsOrange }]}>
                  {passRate}%
                </Text>
                <Text style={styles.summaryLabel}>Pass Rate</Text>
                <Text style={styles.summarySubLabel}>{passedCount}/{totalSessions} sessions</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
                <Text style={styles.summaryLabel}>Day Streak</Text>
                {streak > 0 && (
                  <Text style={styles.summarySubLabel}>consecutive days</Text>
                )}
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: completionRate >= 70 ? colors.correct : colors.awsOrange }]}>
                  {completionRate}%
                </Text>
                <Text style={styles.summaryLabel}>Completed</Text>
                <Text style={styles.summarySubLabel}>{completedCount}/{totalSessions} sessions</Text>
              </View>
            </View>

            {/* ── Score Trend ── */}
            <Text style={styles.sectionLabel}>
              {trendSessions.length >= 2
                ? `SCORE TREND — LAST ${trendSessions.length} SESSIONS`
                : 'SCORE TREND'}
            </Text>
            {trendSessions.length < 2 ? (
              <View style={styles.card}>
                <Text style={styles.noDataText}>
                  Complete at least 2 sessions to see your score trend over time.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                  <View style={styles.chartContainer}>
                    <View style={styles.chartBars}>
                      {trendSessions.map((s, i) => {
                        const barH = Math.max(4, Math.round((s.pct / 100) * 80));
                        const barColor = s.pct >= 70 ? colors.correct : s.pct >= 50 ? colors.awsOrange : colors.wrong;
                        return (
                          <View
                            key={i}
                            style={[styles.bar, {
                              width: barWidth,
                              height: barH,
                              backgroundColor: barColor,
                              marginRight: i < trendSessions.length - 1 ? barGap : 0,
                            }]}
                          />
                        );
                      })}
                    </View>
                    {/* baseline */}
                    <View style={styles.chartBaseline} />
                    {/* 70% pass line */}
                    <View style={[styles.chartPassLine, { bottom: Math.round(0.7 * 80) + 1 }]} />
                  </View>
                  <View style={styles.chartLegend}>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendDot, { backgroundColor: colors.correct }]} />
                      <Text style={styles.chartLegendText}>≥70% pass</Text>
                    </View>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendDot, { backgroundColor: colors.awsOrange }]} />
                      <Text style={styles.chartLegendText}>50–69%</Text>
                    </View>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendDot, { backgroundColor: colors.wrong }]} />
                      <Text style={styles.chartLegendText}>&lt;50%</Text>
                    </View>
                    <Text style={styles.chartLegendOldNew}>older → newer</Text>
                  </View>
                </View>
            )}

            {/* ── Score Distribution ── */}
            <Text style={styles.sectionLabel}>SCORE DISTRIBUTION</Text>
            {filteredHistory.length < 2 ? (
              <View style={styles.card}>
                <Text style={styles.noDataText}>
                  Complete at least 2 sessions to see your score distribution.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {histCounts.map((b, i) => {
                  const barColor = b.min >= 85 ? colors.correct
                    : b.min >= 70 ? colors.correct + '99'
                    : b.min >= 60 ? colors.awsOrange
                    : b.min >= 50 ? colors.awsOrange + '99'
                    : colors.wrong;
                  return (
                    <View key={i} style={styles.histRow}>
                      <Text style={styles.histLabel}>{b.label}</Text>
                      <View style={styles.histTrack}>
                        {b.count > 0 && (
                          <View style={[styles.histBar, {
                            width: `${Math.max(4, Math.round((b.count / histMax) * 100))}%` as any,
                            backgroundColor: barColor,
                          }]} />
                        )}
                      </View>
                      <Text style={[styles.histCount, { color: b.count > 0 ? colors.textPrimary : colors.textMuted }]}>
                        {b.count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Domain Breakdown ── */}
            <Text style={styles.sectionLabel}>DOMAIN BREAKDOWN</Text>
            <View style={styles.card}>
              {!hasDomainData ? (
                <Text style={styles.noDataText}>
                  Domain data is captured from sessions going forward. Complete a session to see your domain scores.
                </Text>
              ) : (() => {
                // Build sorted list: domains with data first (weakest → strongest), then no-data domains
                const domainsWithData = DOMAIN_NUMS
                  .map(d => {
                    const data = domainTotals[d];
                    const pct = data && data.t > 0 ? Math.round((data.c / data.t) * 100) : null;
                    return { d, data, pct };
                  })
                  .sort((a, b) => {
                    if (a.pct === null && b.pct === null) return 0;
                    if (a.pct === null) return 1;
                    if (b.pct === null) return -1;
                    return a.pct - b.pct; // weakest first
                  });

                const weakDomains   = domainsWithData.filter(x => x.pct !== null && x.pct < 70);
                const strongDomains = domainsWithData.filter(x => x.pct !== null && x.pct >= 70);

                return (
                  <>
                    {/* Focus callout */}
                    {weakDomains.length > 0 && (
                      <View style={styles.focusCallout}>
                        <Text style={styles.focusCalloutIcon}>⚠</Text>
                        <Text style={styles.focusCalloutText}>
                          Focus on: {weakDomains.map(x => DOMAIN_LABELS[x.d]).join(', ')}
                        </Text>
                      </View>
                    )}
                    {weakDomains.length === 0 && strongDomains.length > 0 && (
                      <View style={[styles.focusCallout, styles.focusCalloutGreen]}>
                        <Text style={styles.focusCalloutIcon}>🎉</Text>
                        <Text style={[styles.focusCalloutText, { color: colors.correct }]}>
                          All domains at or above pass threshold!
                        </Text>
                      </View>
                    )}

                    {domainsWithData.map(({ d, data, pct }) => {
                      const barColor = pct === null ? colors.border : pct >= 70 ? colors.correct : pct >= 50 ? colors.awsOrange : colors.wrong;
                      const badge = pct === null ? null
                        : pct >= 70 ? { label: 'Strong', color: colors.correct }
                        : pct >= 50 ? { label: 'Improve', color: colors.awsOrange }
                        : { label: 'Focus', color: colors.wrong };
                      return (
                        <View key={d} style={styles.domainRow}>
                          <View style={styles.domainLabelCol}>
                            <Text style={styles.domainName} numberOfLines={1}>{DOMAIN_LABELS[d]}</Text>
                            {data && data.t > 0 && (
                              <Text style={styles.domainSub}>{data.c}/{data.t} correct</Text>
                            )}
                          </View>
                          <View style={styles.domainBarTrack}>
                            <View style={[styles.domainBarFill, {
                              width: pct !== null ? `${pct}%` as any : '0%',
                              backgroundColor: barColor,
                            }]} />
                          </View>
                          <Text style={[styles.domainPct, { color: barColor }]}>
                            {pct !== null ? `${pct}%` : '—'}
                          </Text>
                          {badge && (
                            <View style={[styles.domainBadge, { borderColor: badge.color }]}>
                              <Text style={[styles.domainBadgeText, { color: badge.color }]}>{badge.label}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                );
              })()}
            </View>

            {/* ── Mastery Progress ── */}
            <Text style={styles.sectionLabel}>MASTERY PROGRESS</Text>
            <View style={styles.card}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>
                  {masteredCount}{' '}
                  <Text style={styles.progressOf}>of {totalQCount} mastered</Text>
                </Text>
                <Text style={[styles.progressPct, {
                  color: masteredPct >= 50 ? colors.correct : masteredPct >= 20 ? colors.awsOrange : colors.textSecondary,
                }]}>
                  {masteredPct}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${masteredPct}%` as any,
                  backgroundColor: masteredPct >= 50 ? colors.correct : colors.awsOrange,
                }]} />
              </View>
              <Text style={styles.progressHint}>
                Tap "Mark as Mastered" after a correct answer to track your confident questions.
              </Text>
            </View>

            {/* ── Questions Coverage ── */}
            <Text style={styles.sectionLabel}>QUESTION COVERAGE</Text>
            <View style={styles.card}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>
                  {uniqueQsSeen}{' '}
                  <Text style={styles.progressOf}>of {totalQCount} questions seen</Text>
                </Text>
                <Text style={[styles.progressPct, {
                  color: coveragePct >= 50 ? colors.correct : coveragePct >= 20 ? colors.awsOrange : colors.textSecondary,
                }]}>
                  {coveragePct}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${coveragePct}%` as any,
                  backgroundColor: coveragePct >= 50 ? colors.correct : colors.awsOrange,
                }]} />
              </View>
              <Text style={styles.progressHint}>
                Tracked across your last {sessionRecords.length} recorded session{sessionRecords.length !== 1 ? 's' : ''} (all modes).
              </Text>
            </View>

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.awsDark,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: colors.awsOrange,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountActive: {
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.awsDark,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textLight },

  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  emptyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginTop: 32,
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },

  // ── Summary ──────────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  summarySubLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    opacity: 0.7,
    marginTop: 1,
    textAlign: 'center',
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  noDataText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // ── Trend chart ───────────────────────────────────────────────────────────
  chartContainer: {
    height: 100,
    position: 'relative',
    marginBottom: 12,
  },
  chartBars: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    borderRadius: 3,
    minHeight: 4,
  },
  chartBaseline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  chartPassLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.correct + '60',
    borderStyle: 'dashed',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendDot: { width: 8, height: 8, borderRadius: 4 },
  chartLegendText: { fontSize: 11, color: colors.textSecondary },
  chartLegendOldNew: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 'auto' as any,
    fontStyle: 'italic',
  },

  // ── Domain breakdown ─────────────────────────────────────────────────────
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  domainLabelCol: {
    width: 130,
    marginRight: 10,
  },
  domainName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  domainSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  domainBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginRight: 8,
  },
  domainBarFill: {
    height: 8,
    borderRadius: 4,
  },
  domainPct: {
    width: 38,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  domainBadge: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  domainBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  focusCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.wrong + '18',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  focusCalloutGreen: {
    backgroundColor: colors.correct + '18',
  },
  focusCalloutIcon: { fontSize: 14 },
  focusCalloutText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.wrong,
    lineHeight: 18,
  },


  // ── Progress bars (mastery / coverage) ───────────────────────────────────
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  progressOf: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  progressPct: {
    fontSize: 20,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  progressHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },

  // ── Score distribution histogram ──────────────────────────────────────────
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  histLabel: {
    width: 54,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  histTrack: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  histBar: {
    height: 16,
    borderRadius: 4,
  },
  histCount: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});
