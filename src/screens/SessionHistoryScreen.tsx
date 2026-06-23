import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  FlatList,
  Modal,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, DOMAIN_LABELS, PASS_THRESHOLD_PCT } from '../constants/types';
import {
  getScoreHistory,
  clearScoreHistory,
  ScoreSession,
  getSessionRecords,
  clearSessionRecords,
  SessionRecord,
  removeScoreSession,
  removeSessionRecordByDate,
  getHistoryPrefs,
  setHistoryPrefs,
} from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { shadow, SHARED_STYLES } from '../utils/styleUtils';
import { useNotes } from '../contexts/NotesContext';
import { formatSessionTimestamp, getDateBucket, DateBucket } from '../utils/dateUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionHistory'>;

type TabKey = 'all' | 'practice' | 'exam';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'practice', label: 'Practice' },
  { key: 'exam',     label: 'Exam' },
];

type SortKey   = 'newest' | 'oldest' | 'highest' | 'lowest' | 'longest';
type FilterKey = 'all' | 'completed' | 'quit' | 'passed' | 'failed';
type DomainKey = 0 | 1 | 2 | 3 | 4 | 5;
type RangeKey  = 'all' | '7d' | '30d' | '90d';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',  label: 'Newest'         },
  { key: 'oldest',  label: 'Oldest'         },
  { key: 'highest', label: 'Highest score'  },
  { key: 'lowest',  label: 'Lowest score'   },
  { key: 'longest', label: 'Longest'        },
];

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All sessions'           },
  { key: 'completed', label: 'Completed'              },
  { key: 'quit',      label: 'Quit'                   },
  { key: 'passed',    label: `Passed (≥${PASS_THRESHOLD_PCT}%)` },
  { key: 'failed',    label: `Failed (<${PASS_THRESHOLD_PCT}%)` },
];

const DOMAIN_OPTIONS: { key: DomainKey; label: string }[] = [
  { key: 0, label: DOMAIN_LABELS[0] }, // 'All Domains'
  { key: 1, label: DOMAIN_LABELS[1] },
  { key: 2, label: DOMAIN_LABELS[2] },
  { key: 3, label: DOMAIN_LABELS[3] },
  { key: 4, label: DOMAIN_LABELS[4] },
  { key: 5, label: DOMAIN_LABELS[5] },
];

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time'     },
  { key: '7d',  label: 'Last 7 days'  },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
];

// Compact shortenings for the always-visible pill labels.
const SORT_PILL_LABEL: Record<SortKey, string> = {
  newest:  'Newest',
  oldest:  'Oldest',
  highest: 'Top score',
  lowest:  'Low score',
  longest: 'Longest',
};
const FILTER_PILL_LABEL: Record<FilterKey, string> = {
  all:       'All',
  completed: 'Completed',
  quit:      'Quit',
  passed:    'Passed',
  failed:    'Failed',
};
const DOMAIN_PILL_LABEL: Record<DomainKey, string> = {
  0: 'All',
  1: 'AI/ML',
  2: 'Gen AI',
  3: 'FM Apps',
  4: 'Resp AI',
  5: 'Sec & Gov',
};
const RANGE_PILL_LABEL: Record<RangeKey, string> = {
  all: 'Anytime',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

// Friendly names for the practice-mode token in the row descriptor.
const MODE_NAMES: Record<string, string> = {
  exam:       'Exam',
  random:     'Random',
  sequential: 'Sequential',
  weak:       'Weak mode',
  spaced:     'Smart Study',
};

/** Derive how many questions were actually answered for a session (handles legacy data). */
function resolveAnswered(s: ScoreSession): number {
  if (s.answeredCount !== undefined) return s.answeredCount;
  if (s.quit) {
    if (s.pct > 0) return Math.round(s.score / s.pct * 100);
    return 0;
  }
  return s.questionCount;
}

/** Lookup elapsed time for a ScoreSession by matching the linked SessionRecord (5s window). */
function findElapsedSeconds(s: ScoreSession, records: SessionRecord[]): number | undefined {
  const t = new Date(s.date).getTime();
  const match = records.find(r => Math.abs(new Date(r.date).getTime() - t) < 5000);
  return match?.elapsedSeconds;
}

/**
 * Build a single-line descriptor like "Practice • Random • 20 Qs • 8 min" or
 * "AI/ML Fundamentals • Weak mode • 15 Qs • Quit". Drops duration when the
 * session was quit (replaced by "Quit") or when no record is linked.
 */
function buildSessionDescriptor(s: ScoreSession, elapsedSeconds?: number): string {
  const parts: string[] = [];
  if (s.mode === 'exam') {
    parts.push('Exam');
  } else {
    parts.push(s.domain && s.domain > 0 && DOMAIN_LABELS[s.domain] ? DOMAIN_LABELS[s.domain] : 'Practice');
    const friendly = MODE_NAMES[s.mode] || (s.mode ? s.mode.charAt(0).toUpperCase() + s.mode.slice(1) : 'Random');
    parts.push(friendly);
  }
  parts.push(`${s.questionCount} Qs`);
  if (s.quit) {
    parts.push('Quit');
  } else if (elapsedSeconds && elapsedSeconds > 0) {
    parts.push(`${Math.max(1, Math.round(elapsedSeconds / 60))} min`);
  }
  return parts.join(' | ');
}

function applyFilter(arr: ScoreSession[], key: FilterKey): ScoreSession[] {
  switch (key) {
    case 'completed': return arr.filter(s => !s.quit);
    case 'quit':      return arr.filter(s =>  s.quit);
    case 'passed':    return arr.filter(s => s.pct >= PASS_THRESHOLD_PCT);
    case 'failed':    return arr.filter(s => s.pct <  PASS_THRESHOLD_PCT);
    default:          return arr;
  }
}

function applyDomainFilter(arr: ScoreSession[], key: DomainKey): ScoreSession[] {
  if (key === 0) return arr;
  return arr.filter(s => s.domain === key);
}

function applyRangeFilter(arr: ScoreSession[], key: RangeKey): ScoreSession[] {
  if (key === 'all') return arr;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  const cutoff = Date.now() - days * 86400000;
  return arr.filter(s => new Date(s.date).getTime() >= cutoff);
}

function applySort(arr: ScoreSession[], records: SessionRecord[], key: SortKey): ScoreSession[] {
  const copy = arr.slice();
  const elapsed = (s: ScoreSession) => findElapsedSeconds(s, records) || 0;
  switch (key) {
    case 'oldest':  copy.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
    case 'highest': copy.sort((a, b) => b.pct - a.pct); break;
    case 'lowest':  copy.sort((a, b) => a.pct - b.pct); break;
    case 'longest': copy.sort((a, b) => elapsed(b) - elapsed(a)); break;
    case 'newest':
    default:        copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return copy;
}

// Order in which date buckets render. Empty buckets are skipped.
const DATE_BUCKET_ORDER: DateBucket[] = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];

function groupByDateBucket(items: ScoreSession[]): { bucket: DateBucket; items: ScoreSession[] }[] {
  const groups = new Map<DateBucket, ScoreSession[]>();
  for (const s of items) {
    const b = getDateBucket(s.date);
    const arr = groups.get(b);
    if (arr) arr.push(s); else groups.set(b, [s]);
  }
  return DATE_BUCKET_ORDER
    .filter(k => groups.has(k))
    .map(k => ({ bucket: k, items: groups.get(k)! }));
}

// Lightweight runtime validators for persisted prefs (defends against
// corrupted JSON or a future schema change downgrading to this build).
const SORT_KEY_SET   = new Set<SortKey>(['newest', 'oldest', 'highest', 'lowest', 'longest']);
const FILTER_KEY_SET = new Set<FilterKey>(['all', 'completed', 'quit', 'passed', 'failed']);
const RANGE_KEY_SET  = new Set<RangeKey>(['all', '7d', '30d', '90d']);

export default function SessionHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shared = useMemo(() => SHARED_STYLES(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [scoreHistory, setScoreHistory]   = useState<ScoreSession[]>([]);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [activeTab, setActiveTab]          = useState<TabKey>('all');

  // Per-tab Sort + Filters. Each tab (All / Practice / Exam) keeps its own state
  // so switching tabs restores that tab's view (e.g. Domain filter on Practice
  // doesn't follow you to Exam where it would always show 0 results).
  type TabPrefs = { sortKey: SortKey; filterKey: FilterKey; domainKey: DomainKey; rangeKey: RangeKey };
  const DEFAULT_TAB_PREFS: TabPrefs = { sortKey: 'newest', filterKey: 'all', domainKey: 0, rangeKey: 'all' };
  const [tabPrefs, setTabPrefs] = useState<Record<TabKey, TabPrefs>>({
    all:      { ...DEFAULT_TAB_PREFS },
    practice: { ...DEFAULT_TAB_PREFS },
    exam:     { ...DEFAULT_TAB_PREFS },
  });

  const { sortKey, filterKey, domainKey, rangeKey } = tabPrefs[activeTab];
  const setSortKey   = (k: SortKey)   => setTabPrefs(p => ({ ...p, [activeTab]: { ...p[activeTab], sortKey:   k } }));
  const setFilterKey = (k: FilterKey) => setTabPrefs(p => ({ ...p, [activeTab]: { ...p[activeTab], filterKey: k } }));
  const setDomainKey = (k: DomainKey) => setTabPrefs(p => ({ ...p, [activeTab]: { ...p[activeTab], domainKey: k } }));
  const setRangeKey  = (k: RangeKey)  => setTabPrefs(p => ({ ...p, [activeTab]: { ...p[activeTab], rangeKey:  k } }));

  const [sortPickerOpen, setSortPickerOpen]     = useState(false);
  const [filtersOpen, setFiltersOpen]           = useState(false);
  // Multi-select state for bulk delete. selection holds the ISO `date` strings
  // of selected sessions; select mode is active whenever the set is non-empty.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const isSelectMode = selection.size > 0;
  const toggleSelect = (date: string) => setSelection(prev => {
    const next = new Set(prev);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const clearSelection = () => setSelection(new Set());
  const { notesMap }                       = useNotes();

  // Tracks whether the persisted view prefs have been loaded. Prevents the
  // "save on change" effect from clobbering stored prefs with defaults on first render.
  const prefsLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getHistoryPrefs().then(p => {
      if (cancelled) return;
      if (p) {
        setTabPrefs(prev => {
          const next = { ...prev };
          (['all', 'practice', 'exam'] as TabKey[]).forEach(tab => {
            const t = p[tab];
            if (!t) return;
            next[tab] = {
              sortKey:   SORT_KEY_SET.has(t.sortKey as SortKey)       ? (t.sortKey as SortKey)     : 'newest',
              filterKey: FILTER_KEY_SET.has(t.filterKey as FilterKey) ? (t.filterKey as FilterKey) : 'all',
              domainKey: (typeof t.domainKey === 'number' && t.domainKey >= 0 && t.domainKey <= 5)
                ? (t.domainKey as DomainKey) : 0,
              rangeKey:  t.rangeKey && RANGE_KEY_SET.has(t.rangeKey as RangeKey) ? (t.rangeKey as RangeKey) : 'all',
            };
          });
          return next;
        });
      }
      prefsLoadedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    setHistoryPrefs(tabPrefs);
  }, [tabPrefs]);

  const flatListRef = useRef<FlatList>(null);
  const isInternalScroll = useRef(false);

  // Refs for internal scroll views to reset position
  const scrollRefs = useRef<Record<string, ScrollView | null>>({});

  const loadData = useCallback(async () => {
    const [h, r] = await Promise.all([getScoreHistory(), getSessionRecords()]);
    setScoreHistory(h);
    setSessionRecords(r);
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
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

  const handleClearAll = async () => {
    const doClear = async () => {
      await clearScoreHistory();
      await clearSessionRecords();
      setScoreHistory([]);
      setSessionRecords([]);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Clear All History\n\nThis will permanently remove all session history and insights data.')) {
        await doClear();
      }
    } else {
      Alert.alert(
        'Clear All History',
        'This will permanently remove all session history and insights data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: doClear },
        ],
      );
    }
  };

  const handleDeleteSession = (s: ScoreSession) => {
    // Long-press now enters select mode with this row pre-selected; user can
    // tap more rows to add, then tap the toolbar Delete to confirm in bulk.
    setSelection(new Set([s.date]));
  };

  const handleBulkDelete = () => {
    const count = selection.size;
    if (count === 0) return;
    const dates = Array.from(selection);
    const times = dates.map(d => new Date(d).getTime());
    const doDelete = async () => {
      await Promise.all(dates.flatMap(d => [
        removeScoreSession(d),
        removeSessionRecordByDate(d),
      ]));
      setScoreHistory(prev => prev.filter(x => !selection.has(x.date)));
      setSessionRecords(prev => prev.filter(r => {
        const rt = new Date(r.date).getTime();
        return !times.some(t => Math.abs(rt - t) < 5000);
      }));
      clearSelection();
    };
    const title = `Delete ${count} session${count === 1 ? '' : 's'}?`;
    const body  = `This will permanently remove ${count === 1 ? 'it' : 'them'} from history.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${body}`)) doDelete();
    } else {
      Alert.alert(title, body, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Switching tabs exits select mode (selection is scoped to the visible list).
  useEffect(() => { setSelection(new Set()); }, [activeTab]);

  // Android hardware back: exit select mode instead of leaving the screen.
  useEffect(() => {
    if (!isSelectMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(new Set());
      return true;
    });
    return () => sub.remove();
  }, [isSelectMode]);

  const renderPage = ({ item }: { item: TabKey }) => {
    const tabKey = item;
    const withAnswers = scoreHistory.filter(s => resolveAnswered(s) > 0);
    // Mode tab is the outer filter (always honored). User filter + sort apply on top.
    const tabFiltered = tabKey === 'all'
      ? withAnswers
      : tabKey === 'exam'
        ? withAnswers.filter(s => s.mode === 'exam')
        : withAnswers.filter(s => s.mode !== 'exam');

    const userFiltered = applyFilter(tabFiltered, filterKey);
    const domainScoped = applyDomainFilter(userFiltered, domainKey);
    const rangeScoped  = applyRangeFilter(domainScoped, rangeKey);
    const finalList    = applySort(rangeScoped, sessionRecords, sortKey);

    const totalForTab     = tabFiltered.length;
    const isTabEmpty      = totalForTab === 0;
    const isFilterEmpty   = !isTabEmpty && finalList.length === 0;
    const userFiltersActive = filterKey !== 'all' || sortKey !== 'newest' || domainKey !== 0 || rangeKey !== 'all';
    const activeFilterCount =
      (filterKey !== 'all' ? 1 : 0) +
      (domainKey !== 0 ? 1 : 0) +
      (rangeKey !== 'all' ? 1 : 0);

    const renderRow = (s: ScoreSession, isFirst: boolean) => {
      const record = sessionRecords.find(r =>
        Math.abs(new Date(r.date).getTime() - new Date(s.date).getTime()) < 5000,
      );
      const elapsed = record?.elapsedSeconds;
      const descriptor = buildSessionDescriptor(s, elapsed);
      const passed = s.pct >= PASS_THRESHOLD_PCT;
      const isSelected = selection.has(s.date);
      return (
        <View key={s.date}>
          {!isFirst && <View style={styles.divider} />}
          <TouchableOpacity
            style={[styles.historyRow, isSelected && styles.historyRowSelected]}
            onPress={() => {
              if (isSelectMode) {
                toggleSelect(s.date);
              } else if (record) {
                navigation.navigate('Review', {
                  history: record.history,
                  date: s.date,
                  mode: s.mode,
                  total: s.questionCount,
                  pct: s.pct,
                  quit: s.quit,
                });
              }
            }}
            onLongPress={isSelectMode ? undefined : () => handleDeleteSession(s)}
            delayLongPress={400}
            activeOpacity={isSelectMode || record ? 0.7 : 1}
          >
            {isSelectMode && (
              <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && <Text style={styles.selectCircleCheck}>✓</Text>}
              </View>
            )}
            <View style={styles.historyLeft}>
              <Text style={styles.historyDate} numberOfLines={1}>
                {formatSessionTimestamp(s.date)}
              </Text>
              <Text style={styles.historySubtitle} numberOfLines={1}>
                {descriptor}
              </Text>
            </View>
            <Text style={[styles.historyPct, { color: passed ? colors.correct : colors.wrong }]}>
              {s.pct}%
            </Text>
            {!isSelectMode && record && <Text style={styles.historyChevron}>›</Text>}
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <ScrollView
        ref={r => { scrollRefs.current[tabKey] = r; }}
        style={{ width: screenWidth, backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isTabEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>
              {tabKey === 'all'
                ? 'No sessions yet'
                : tabKey === 'exam'
                  ? 'No exam sessions yet'
                  : 'No practice sessions yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tabKey === 'all'
                ? 'Complete a quiz or exam to see your history here.'
                : `Complete a ${tabKey} session to see it here.`}
            </Text>
          </View>
        ) : (
          <>
            {/* Control bar: count (+ Reset link when active) + sort/filter/domain/range pills.
                In select mode, swap to a Cancel | N selected | Delete toolbar. */}
            {isSelectMode ? (
              <View style={[styles.controlBar, { alignItems: 'center' }]}>
                <TouchableOpacity onPress={clearSelection} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel selection">
                  <Text style={styles.selectToolbarCancel}>← Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.selectToolbarCount}>{selection.size} selected</Text>
                <TouchableOpacity onPress={handleBulkDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${selection.size} selected sessions`}>
                  <Text style={styles.selectToolbarDelete}>🗑 Delete ({selection.size})</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.controlBar}>
                <View style={styles.controlLeft}>
                  <Text style={styles.controlCount}>
                    {finalList.length === totalForTab
                      ? `${totalForTab} session${totalForTab === 1 ? '' : 's'}`
                      : `${finalList.length} of ${totalForTab}`}
                  </Text>
                  {userFiltersActive && (
                    <TouchableOpacity
                      onPress={() => { setSortKey('newest'); setFilterKey('all'); setDomainKey(0); setRangeKey('all'); }}
                      accessibilityRole="button"
                      accessibilityLabel="Reset all filters"
                      hitSlop={8}
                    >
                      <Text style={styles.controlReset}>↻ Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.controlPills}>
                  <TouchableOpacity
                    style={[styles.pill, sortKey !== 'newest' && styles.pillActive]}
                    onPress={() => setSortPickerOpen(true)}
                    accessibilityLabel={`Sort: ${SORT_PILL_LABEL[sortKey]}. Tap to change.`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.pillIcon, sortKey !== 'newest' && styles.pillValueActive]}>⇅</Text>
                    {sortKey !== 'newest' && (
                      <Text style={[styles.pillValue, styles.pillValueActive]}>{SORT_PILL_LABEL[sortKey]}</Text>
                    )}
                    <Text style={[styles.pillValue, sortKey !== 'newest' && styles.pillValueActive]}>▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, activeFilterCount > 0 && styles.pillActive]}
                    onPress={() => setFiltersOpen(true)}
                    accessibilityLabel={`Filters${activeFilterCount > 0 ? `: ${activeFilterCount} active` : ''}. Tap to change.`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.pillIcon, activeFilterCount > 0 && styles.pillValueActive]}>☰</Text>
                    {activeFilterCount > 0 && (
                      <Text style={[styles.pillValue, styles.pillValueActive]}>({activeFilterCount})</Text>
                    )}
                    <Text style={[styles.pillValue, activeFilterCount > 0 && styles.pillValueActive]}>▾</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isFilterEmpty ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No sessions match this filter</Text>
                <Text style={styles.emptySubtitle}>
                  {totalForTab} {totalForTab === 1 ? 'session is' : 'sessions are'} hidden by the current filters.
                </Text>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => { setFilterKey('all'); setSortKey('newest'); setDomainKey(0); setRangeKey('all'); }}
                >
                  <Text style={styles.resetBtnText}>Reset filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Date-bucket headers (Today / Yesterday / This week ...) only
                    appear on the pristine default view. As soon as the user
                    picks any sort, filter, domain, or range, switch to a flat
                    globally-sorted list so the chosen order isn't undermined
                    by buckets and the UI signals "you are in a custom view". */}
                {!userFiltersActive ? (
                  groupByDateBucket(finalList).map(group => (
                    <View key={group.bucket} style={styles.groupSection}>
                      <Text style={styles.groupHeader}>{group.bucket}</Text>
                      <View style={styles.card}>
                        {group.items.map((s, i) => renderRow(s, i === 0))}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.card}>
                    {finalList.map((s, i) => renderRow(s, i === 0))}
                  </View>
                )}
                <Text style={styles.hint}>Tip: long-press a session to delete it.</Text>
              </>
            )}

            <TouchableOpacity style={styles.clearRow} onPress={handleClearAll}>
              <Text style={styles.clearIcon}>🗑️</Text>
              <Text style={styles.clearText}>Clear all history</Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={shared.header}>
        <Text style={styles.headerTitle}>🕒 History</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const count =
              tab.key === 'all'  ? scoreHistory.filter(s => resolveAnswered(s) > 0).length
              : tab.key === 'exam' ? scoreHistory.filter(s => s.mode === 'exam' && resolveAnswered(s) > 0).length
              : scoreHistory.filter(s => s.mode !== 'exam' && resolveAnswered(s) > 0).length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => scrollToTab(tab.key)}
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

      {/* ── Sort picker ─────────────────────────────────────────────────── */}
      <Modal
        visible={sortPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortPickerOpen(false)}
        >
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Sort by</Text>
            {SORT_OPTIONS.map(opt => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.modalOption, active && styles.modalOptionActive]}
                  onPress={() => { setSortKey(opt.key); setSortPickerOpen(false); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {active && <Text style={styles.modalOptionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Combined Filters sheet ──────────────────────────────────────── */}
      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFiltersOpen(false)}
        >
          <View style={styles.sheetBox} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              {(filterKey !== 'all' || domainKey !== 0 || rangeKey !== 'all') && (
                <TouchableOpacity
                  onPress={() => { setFilterKey('all'); setDomainKey(0); setRangeKey('all'); }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.sheetReset}>↻ Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetSection}>STATUS</Text>
              <View style={styles.chipRow}>
                {FILTER_OPTIONS.map(opt => {
                  const active = filterKey === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setFilterKey(opt.key)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {activeTab !== 'exam' && (
                <>
                  <Text style={styles.sheetSection}>DOMAIN</Text>
                  <View style={styles.chipRow}>
                    {DOMAIN_OPTIONS.map(opt => {
                      const active = domainKey === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setDomainKey(opt.key)}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.sheetSection}>DATE RANGE</Text>
              <View style={styles.chipRow}>
                {RANGE_OPTIONS.map(opt => {
                  const active = rangeKey === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setRangeKey(opt.key)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetDoneBtn}
              onPress={() => setFiltersOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.awsDark },
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '800',
  },

  tabBar: {
    backgroundColor: colors.awsDark,
    paddingBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    width: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive:          { backgroundColor: colors.awsOrange },
  tabLabel:           { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  tabLabelActive:     { color: '#fff' },
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

  emptyCard: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon:     { fontSize: 48 },
  emptyTitle:    { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    ...shadow('#000', 1, 0.08, 6),
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  historyLeft:     { flex: 1 },
  historyDate:     { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  historySubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  historyPct:      { fontSize: 16, fontWeight: '800', minWidth: 46, textAlign: 'right' },
  historyChevron:  { color: colors.textSecondary, fontSize: 20, marginLeft: 4 },
  historyRowSelected: { backgroundColor: 'rgba(255,153,0,0.10)' },
  noteBadge: { fontSize: 14, color: colors.awsOrange, marginRight: 4 },

  // Multi-select bulk-delete UI
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  selectCircleActive: {
    backgroundColor: colors.awsOrange,
    borderColor: colors.awsOrange,
  },
  selectCircleCheck: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 14 },
  selectToolbarCancel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  selectToolbarCount:  { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  selectToolbarDelete: { color: colors.wrong, fontSize: 14, fontWeight: '700' },

  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  clearIcon: { fontSize: 18 },
  clearText: { color: colors.wrong, fontSize: 14, fontWeight: '600' },

  // ── Sort/filter control bar above the list ───────────────────────────
  controlBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  controlCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  controlLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  controlReset: { color: colors.awsOrange, fontSize: 12, fontWeight: '700' },
  controlPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    flexShrink: 1,
    rowGap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { borderColor: colors.awsOrange, backgroundColor: 'rgba(255,153,0,0.10)' },
  pillIcon:        { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  pillValue:       { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  pillValueActive: { color: colors.awsOrange },

  // Reset button shown when the user's filter empties the list.
  resetBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.awsDark,
  },
  resetBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Sort/filter picker modal ─────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  modalOptionActive:     { backgroundColor: 'rgba(255,153,0,0.10)' },
  modalOptionText:       { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  modalOptionTextActive: { color: colors.awsOrange, fontWeight: '700' },
  modalOptionCheck:      { fontSize: 16, color: colors.awsOrange, fontWeight: '800' },

  // ── Combined Filters sheet ───────────────────────────────────────────
  sheetBox: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sheetReset: { color: colors.awsOrange, fontSize: 13, fontWeight: '700' },
  sheetScroll: { marginBottom: 10 },
  sheetSection: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.awsOrange,
    backgroundColor: 'rgba(255,153,0,0.10)',
  },
  chipText:       { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.awsOrange, fontWeight: '700' },
  sheetDoneBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.awsDark,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetDoneText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Date-bucket grouping (only when sort is date-based).
  groupSection: { marginBottom: 16 },
  groupHeader: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 8 },
});
