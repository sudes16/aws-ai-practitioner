import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, HistoryEntry } from '../constants/types';
import { getAllQuestions } from '../utils/quizEngine';
import { shadow } from '../utils/styleUtils';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { formatDate } from '../utils/dateUtils';
import { useNotes } from '../contexts/NotesContext';
import ExplanationModal from '../components/ExplanationModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;
type Filter = 'all' | 'correct' | 'wrong' | 'flagged' | 'noted';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'correct', label: '✓ Correct' },
  { key: 'wrong', label: '✗ Wrong' },
  { key: 'flagged', label: '🚩 Flagged' },
  { key: 'noted', label: '✎ Noted' },
];

export default function ReviewScreen({ navigation, route }: Props) {
  const { history, initialFilter, date, mode, total, pct, quit } = route.params;
  const questions = getAllQuestions();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all');
  const [modalEntry, setModalEntry] = useState<HistoryEntry | null>(null);
  const { notesMap } = useNotes();

  const flatListRef = useRef<FlatList>(null);
  const filterListRef = useRef<FlatList>(null);
  const isInternalScroll = useRef(false);

  // Refs for internal lists to reset position
  const listRefs = useRef<Record<string, FlatList | null>>({});

  // Sync header tabs when filter changes (due to swipe or tap)
  useEffect(() => {
    const idx = FILTERS.findIndex(f => f.key === filter);
    if (idx !== -1) {
      filterListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5, // Centers the item
      });
    }
  }, [filter]);

  useEffect(() => {
    // If there's an initial filter, scroll to it on mount
    if (initialFilter) {
      const idx = FILTERS.findIndex(f => f.key === initialFilter);
      if (idx !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, animated: false });
        }, 100);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Scroll active list back to top ONLY when entering the screen
    listRefs.current[filter]?.scrollToOffset({ offset: 0, animated: false });
  }, []));

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isInternalScroll.current) return;
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index >= 0 && index < FILTERS.length) {
      setFilter(FILTERS[index].key);
    }
  };

  const scrollToFilter = (key: Filter) => {
    if (filter === key) return;
    const index = FILTERS.findIndex(f => f.key === key);
    if (index !== -1) {
      isInternalScroll.current = true;
      setFilter(key);
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setTimeout(() => { isInternalScroll.current = false; }, 400);
    }
  };

  const handleRetry = () => {
    // Extract question indices from the session and shuffle them (Fisher-Yates)
    const indices = history.map(h => h.questionIndex);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    navigation.navigate('Quiz', {
      config: {
        mode: 'random',
        fromQ: 1,
        toQ: indices.length,
        count: indices.length,
        timed: false,
        timePerQuestion: 60,
        indices,
        questionType: 'all',
        domain: 0,
        studyMode: false,
        isExam: false,
      },
    });
  };

  const modalQuestion = modalEntry
    ? questions[modalEntry.questionIndex]
    : null;

  const renderQuestionItem = ({ item }: { item: HistoryEntry }) => {
    const q = questions[item.questionIndex];
    if (!q) return null;

    const statusColor =
      item.isHotspot
        ? colors.awsOrange
        : item.correct === true
        ? colors.correct
        : colors.wrong;

    const statusIcon = item.isHotspot ? '⚡' : item.correct ? '✓' : '✗';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setModalEntry(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardQNum}>Q {q.number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {statusIcon}{' '}
                {item.isHotspot
                  ? 'Hotspot'
                  : item.correct
                  ? 'Correct'
                  : 'Wrong'}
              </Text>
            </View>
            {item.flagged && <Text style={styles.flaggedIcon}>🚩</Text>}
          </View>

          <Text style={styles.cardQuestion} numberOfLines={2}>
            {q.question}
          </Text>

          {!item.isHotspot && (
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>
                Your answer:{' '}
                <Text
                  style={[
                    styles.answerValue,
                    { color: item.correct === true ? colors.correct : colors.wrong },
                  ]}
                >
                  {item.userLetters.length > 0
                    ? item.userLetters.join(', ')
                    : '(none)'}
                </Text>
              </Text>
              {item.correct !== true && (
                <Text style={styles.answerLabel}>
                  {'  '}Correct:{' '}
                  <Text style={[styles.answerValue, { color: colors.correct }]}>
                    {item.correctLetters.join(', ')}
                  </Text>
                </Text>
              )}
            </View>
          )}

          {q.explanation ? (
            <Text style={styles.tapHint}>Tap for explanation →</Text>
          ) : null}
          {notesMap[q.number] ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteCardLabel}>{'✏ Note'}</Text>
              <Text style={styles.noteCardText}>{notesMap[q.number]}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterPage = ({ item }: { item: Filter }) => {
    const filterKey = item;
    const filteredData = history.filter(entry => {
      if (filterKey === 'all') return true;
      if (filterKey === 'correct') return entry.correct === true;
      if (filterKey === 'wrong') return entry.correct === false;
      if (filterKey === 'flagged') return entry.flagged;
      if (filterKey === 'noted') return !!notesMap[entry.questionNumber];
      return true;
    });

    return (
      <View style={{ width: screenWidth }}>
        <FlatList
          ref={r => { listRefs.current[filterKey] = r; }}
          data={filteredData}
          keyExtractor={item => String(item.questionNumber)}
          renderItem={renderQuestionItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No questions in this filter.</Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {date
              ? (mode === 'exam' ? '🎓 Exam Session' : '📝 Practice Session')
              : 'Review Answers'}
          </Text>
          {date && (
            <Text style={styles.headerContextSub} numberOfLines={1}>
              {formatDate(date)}{total !== undefined ? ` | ${total}Q` : ''}{pct !== undefined ? ` | ${pct}%` : ''}{quit ? ' (quit)' : ''}
            </Text>
          )}
        </View>
        <Text style={styles.headerSub}>{history.length} answered</Text>
      </View>

      <View style={styles.filterWrap}>
        <FlatList
          ref={filterListRef}
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === f.key && styles.filterTabActive,
              ]}
              onPress={() => scrollToFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f.key && styles.filterTabTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
          onScrollToIndexFailed={info => {
            filterListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
        />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={FILTERS.map(f => f.key)}
          renderItem={renderFilterPage}
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

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.homeBtnText}>⬅  Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>↺  Retry</Text>
          <Text style={styles.retryBtnSub}>{history.length}Q | reshuffled</Text>
        </TouchableOpacity>
      </View>

      <ExplanationModal
        visible={!!modalEntry}
        explanation={modalQuestion?.explanation ?? ''}
        correctAnswer={modalEntry?.correctLetters.join(', ') ?? ''}
        isCorrect={modalEntry?.correct ?? null}
        onClose={() => setModalEntry(null)}
        questionText={modalQuestion?.question}
        optionsText={modalQuestion ? Object.entries(modalQuestion.options)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([letter, text]) => `${letter}. ${text}`)
          .join('\n') : undefined}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.awsDark,
    gap: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textLight,
    textAlign: 'center',
  },
  headerContextSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  filterWrap: {
    backgroundColor: colors.awsDark,
    paddingBottom: 10,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: colors.awsOrange,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  filterTabTextActive: {
    color: '#fff',
  },

  listContent: {
    padding: 12,
    gap: 10,
    backgroundColor: colors.background,
    flexGrow: 1,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  statusStrip: {
    width: 5,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardQNum: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  flaggedIcon: { fontSize: 14, marginLeft: 'auto' },

  cardQuestion: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },

  answerRow: {
    gap: 2,
    marginBottom: 6,
  },
  answerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  answerValue: {
    fontWeight: '700',
  },

  tapHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  noteCard: {
    marginTop: 8,
    backgroundColor: colors.btnSecondary + '1A',
    borderLeftWidth: 3,
    borderLeftColor: colors.btnSecondary,
    borderRadius: 6,
    padding: 8,
  },
  noteCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.btnSecondary,
    marginBottom: 3,
  },
  noteCardText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  homeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.awsOrange,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  retryBtnSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
});
