import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../constants/types';
import {
  getScoreHistory,
  clearScoreHistory,
  ScoreSession,
  getSessionRecords,
  clearSessionRecords,
  SessionRecord,
} from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { shadow } from '../utils/styleUtils';
import { useNotes } from '../contexts/NotesContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionHistory'>;

type TabKey = 'all' | 'practice' | 'exam';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'practice', label: 'Practice' },
  { key: 'exam',     label: 'Exam' },
];

/** Derive how many questions were actually answered for a session (handles legacy data). */
function resolveAnswered(s: ScoreSession): number {
  if (s.answeredCount !== undefined) return s.answeredCount;
  if (s.quit) {
    if (s.pct > 0) return Math.round(s.score / s.pct * 100);
    return 0;
  }
  return s.questionCount;
}

export default function SessionHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [scoreHistory, setScoreHistory]   = useState<ScoreSession[]>([]);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [activeTab, setActiveTab]          = useState<TabKey>('all');
  const { notesMap }                       = useNotes();

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

  const renderPage = ({ item }: { item: TabKey }) => {
    const tabKey = item;
    const withAnswers = scoreHistory.filter(s => resolveAnswered(s) > 0);
    const filteredHistory = tabKey === 'all'
      ? withAnswers
      : tabKey === 'exam'
        ? withAnswers.filter(s => s.mode === 'exam')
        : withAnswers.filter(s => s.mode !== 'exam');

    const filteredRecords = tabKey === 'all'
      ? sessionRecords
      : tabKey === 'exam'
        ? sessionRecords.filter(r => r.mode === 'exam')
        : sessionRecords.filter(r => r.mode !== 'exam');

    return (
      <ScrollView
        ref={r => { scrollRefs.current[tabKey] = r; }}
        style={{ width: screenWidth }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredHistory.length === 0 ? (
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
            <View style={styles.card}>
              {filteredHistory.map((s, i) => {
                const record = filteredRecords.find(r =>
                  Math.abs(new Date(r.date).getTime() - new Date(s.date).getTime()) < 5000,
                );
                const answered = resolveAnswered(s);
                const answeredLabel = `${s.score}/${answered}`;

                return (
                  <View key={i}>
                    {i > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.historyRow}
                      onPress={record ? () => navigation.navigate('Review', {
                          history: record.history,
                          date: s.date,
                          mode: s.mode,
                          total: s.questionCount,
                          pct: s.pct,
                          quit: s.quit,
                        }) : undefined}
                      activeOpacity={record ? 0.7 : 1}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyDate}>
                          {new Date(s.date).toLocaleDateString()} — {s.mode === 'exam' ? 'Exam' : 'Practice'} | {s.questionCount}Q
                        </Text>
                        <Text style={styles.historySubtitle}>
                          {answeredLabel} correct ({s.pct}%){s.quit ? ' (quit)' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.historyPct, { color: s.pct >= 70 ? colors.correct : colors.wrong }]}>
                        {s.pct}%
                      </Text>
                      {record && <Text style={styles.historyChevron}>›</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.clearRow} onPress={handleClearAll}>
              <Text style={styles.clearIcon}>🗑️</Text>
              <Text style={styles.clearText}>Clear All History</Text>
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 History</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
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

      <View style={{ flex: 1 }}>
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
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.awsDark },
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.awsDark,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

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
  noteBadge: { fontSize: 14, color: colors.awsOrange, marginRight: 4 },

  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  clearIcon: { fontSize: 18 },
  clearText: { color: colors.wrong, fontSize: 14, fontWeight: '600' },
});
