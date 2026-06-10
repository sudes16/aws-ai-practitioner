import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, DomainFilter, DOMAIN_LABELS, QuizMode } from '../constants/types';
import { getTotalCount, buildIndices, getDomainCounts, getAllQuestions, buildExamQuestions, getDomainForIndex, EXAM_DOMAIN_COUNTS, EXAM_DOMAIN_PCT, EXAM_TOTAL_QS } from '../utils/quizEngine';
import { getMasteredQuestions } from '../utils/storage';
import { getProfile, saveProfile, getDaysLeft, UserProfile, validateProfileInputs, getPostExamPromptState, setPostExamPromptDismissed, setPostExamPromptLater, markExamPassed } from '../utils/profileStore';
import { scheduleExamCountdownNotifications } from '../utils/notificationService';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { cssVal, shadow, SHARED_STYLES } from '../utils/styleUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type QType = 'all' | 'mc' | 'hotspot';
const Q_TYPE_OPTIONS: { key: QType; emoji: string; label: string; sub: string }[] = [
  { key: 'all',     emoji: '☰', label: 'All',             sub: 'Every question' },
  { key: 'mc',      emoji: '☑', label: 'Multiple Choice', sub: 'Single / multi-select' },
  { key: 'hotspot', emoji: '⇄', label: 'Matching',        sub: 'Ordering & matching' },
];

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shared = useMemo(() => SHARED_STYLES(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  // Fresh questions on every mount/render
  const allQuestions = getAllQuestions();
  const total = allQuestions.length;
  const hotspotCount = useMemo(() => allQuestions.filter(q => q.is_hotspot).length, [allQuestions]);
  const mcCount = total - hotspotCount;

  const [fromQ, setFromQ]           = useState('1');
  const [toQ, setToQ]               = useState(String(total || 1));
  const [count, setCount]           = useState(String(total || 20));
  const [timed, setTimed]           = useState(false);
  const [secsPerQ, setSecsPerQ]     = useState('90');
  const [loading, setLoading]       = useState(false);

  const [questionType, setQuestionType] = useState<QType | null>('all');
  const [domain, setDomain]             = useState<DomainFilter>(0);
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);
  const [studyMode, setStudyMode]       = useState(false);
  const [quizMode, setQuizMode]         = useState<QuizMode | null>('random');

  const [masteredCount, setMasteredCount] = useState(0);
  const [masteredNumbers, setMasteredNumbers] = useState<Set<number>>(new Set());
  const [appMode, setAppMode] = useState<'practice' | 'exam'>('practice');

  const flatListRef = useRef<FlatList>(null);
  const isInternalScroll = useRef(false);

  // Refs for internal scroll views to reset position
  const scrollRefs = useRef<Record<string, ScrollView | null>>({});

  const weakCount = useMemo(() => {
    const unmastered = allQuestions.reduce<number[]>((acc, q, i) => {
      if (masteredNumbers.has(q.number)) return acc;
      if (questionType === 'mc' && q.is_hotspot) return acc;
      if (questionType === 'hotspot' && !q.is_hotspot) return acc;
      if (domain !== 0 && getDomainForIndex(i) !== domain) return acc;
      acc.push(q.number);
      return acc;
    }, []);
    return unmastered.length;
  }, [questionType, domain, masteredNumbers, allQuestions]);

  const calcPoolSize = useCallback((qt: QType | null, d: DomainFilter, fq: string, tq: string) => {
    const from = parseInt(fq) || 1;
    const to   = parseInt(tq) || total;
    let pool = allQuestions.reduce<number[]>((acc, q, i) => {
      if (q.number >= from && q.number <= to) acc.push(i);
      return acc;
    }, []);
    if (qt === 'mc')      pool = pool.filter(i => !allQuestions[i].is_hotspot);
    else if (qt === 'hotspot') pool = pool.filter(i =>  allQuestions[i].is_hotspot);
    if (d !== 0) pool = pool.filter(i => getDomainForIndex(i) === d);
    return pool.length;
  }, [total, allQuestions]);

  const poolSize = useMemo(
    () => calcPoolSize(questionType, domain, fromQ, toQ),
    [calcPoolSize, questionType, domain, fromQ, toQ],
  );

  const handleDomainChange = useCallback((d: DomainFilter) => {
    setDomain(d);
    setDomainPickerOpen(false);
    setCount(String(calcPoolSize(questionType, d, fromQ, toQ)));
  }, [calcPoolSize, questionType, fromQ, toQ]);

  const handleQuestionTypeChange = useCallback((qt: QType) => {
    const next = questionType === qt ? null : qt;
    setQuestionType(next);
    setCount(String(calcPoolSize(next, domain, fromQ, toQ)));
  }, [calcPoolSize, questionType, domain, fromQ, toQ]);

  const filteredDomainCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allQuestions.forEach((q, i) => {
      if (questionType === 'mc' && q.is_hotspot) return;
      if (questionType === 'hotspot' && !q.is_hotspot) return;
      const d = getDomainForIndex(i);
      counts[d] = (counts[d] || 0) + 1;
    });
    counts[0] = Object.values(counts).reduce((s, v) => s + v, 0);
    return counts;
  }, [questionType]);

  useEffect(() => {
    const c = parseInt(count) || 0;
    if (poolSize > 0 && c > poolSize) setCount(String(poolSize));
  }, [poolSize]);

  // Sync toQ with total when the question bank grows (e.g. after OTA update)
  useEffect(() => {
    setToQ(String(total));
  }, [total]);

  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obName, setObName]             = useState('');
  const [obMonth, setObMonth]           = useState('');
  const [obDay, setObDay]               = useState('');
  const [obYear, setObYear]             = useState('');
  const [obError, setObError]           = useState('');
  const isNarrow = screenWidth < 600;

  const [showPostExamModal, setShowPostExamModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Synchronized Reset: Scroll ALL horizontal pages back to top when entering
      Object.values(scrollRefs.current).forEach(ref => ref?.scrollTo({ y: 0, animated: false }));

      getMasteredQuestions().then(nums => {
        setMasteredCount(nums.length);
        setMasteredNumbers(new Set(nums));
      });
      getProfile().then(async p => {
        if (p) {
          setProfile(p);
          if (p.examStatus !== 'passed' && getDaysLeft(p.examDate) < 0) {
            const state = await getPostExamPromptState(p.examDate);
            if (state === null || (typeof state === 'number' && Date.now() >= state)) {
              setShowPostExamModal(true);
            }
          }
        } else {
          setShowOnboarding(true);
        }
      });
    }, [])
  );

  const handlePostExamPassed = async () => {
    if (!profile) return;
    const updated = await markExamPassed(profile);
    setProfile(updated);
    await setPostExamPromptDismissed(profile.examDate);
    setShowPostExamModal(false);
  };

  const handlePostExamReschedule = async () => {
    if (!profile) return;
    await setPostExamPromptDismissed(profile.examDate);
    setShowPostExamModal(false);
    setObName(profile.name);
    setObMonth(''); setObDay(''); setObYear('');
    setObError('');
    setShowOnboarding(true);
  };

  const handlePostExamLater = async () => {
    if (!profile) return;
    await setPostExamPromptLater(profile.examDate);
    setShowPostExamModal(false);
  };

  const handleSaveProfile = async () => {
    const result = validateProfileInputs(obName, obMonth, obDay, obYear);
    if (typeof result === 'string') { setObError(result); return; }
    try {
      await saveProfile(result);
    } catch (e) {
      setObError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
      return;
    }
    setProfile(result);
    setShowOnboarding(false);
    setObError('');
    scheduleExamCountdownNotifications(result.examDate).catch(() => {});
  };

  useEffect(() => {
    const from = Math.max(1, parseInt(fromQ, 10) || 1);
    const to   = Math.min(total, parseInt(toQ,   10) || total);
    if (from <= to) setCount(String(to - from + 1));
  }, [fromQ, toQ, total]);

  const handleStart = async () => {
    if (total === 0) {
      Alert.alert('No Questions Found', 'Check your data and restart.', [{ text: 'OK' }]);
      return;
    }
    if (!questionType || !quizMode) {
      Alert.alert('Selection Required', 'Select a Question Type and Mode.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      const from = Math.max(1, parseInt(fromQ, 10) || 1);
      const to   = Math.min(total, parseInt(toQ, 10) || total);
      const cnt  = Math.max(1, parseInt(count, 10) || 20);

      const userSecs = parseInt(secsPerQ, 10) || 0;
      if (timed && userSecs < 30) {
        Alert.alert(
          'Adjust Timer',
          'The minimum time allowed is 30 seconds per question to ensure you have time to read and answer.',
          [{ text: 'OK' }]
        );
        setSecsPerQ('30');
        setLoading(false);
        return;
      }
      const secs = Math.max(30, userSecs);

      const indices = await buildIndices({
        mode: quizMode,
        fromQ: Math.min(from, to),
        toQ: Math.max(from, to),
        count: cnt,
        timed,
        timePerQuestion: secs,
        questionType,
        domain,
        studyMode,
      });

      if (indices.length === 0) {
        Alert.alert('No Questions', 'Try adjusting your filters.');
        return;
      }

      navigation.navigate('Quiz', {
        config: {
          mode: quizMode,
          fromQ: Math.min(from, to),
          toQ: Math.max(from, to),
          count: indices.length,
          timed,
          timePerQuestion: secs,
          indices,
          questionType,
          domain,
          studyMode,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExamStart = async () => {
    if (total === 0) return;
    setLoading(true);
    try {
      const indices = await buildExamQuestions();
      navigation.navigate('Quiz', {
        config: {
          mode: 'random',
          fromQ: 1,
          toQ: total,
          count: EXAM_TOTAL_QS,
          timed: false,
          timePerQuestion: 0,
          indices,
          questionType: 'all',
          domain: 0,
          studyMode: false,
          isExam: true,
          examTotalSeconds: 5400,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isInternalScroll.current) return;
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index === 0 && appMode !== 'practice') setAppMode('practice');
    else if (index === 1 && appMode !== 'exam') setAppMode('exam');
  };

  const scrollToMode = (mode: 'practice' | 'exam') => {
    if (appMode === mode) return;
    isInternalScroll.current = true;
    setAppMode(mode);
    flatListRef.current?.scrollToIndex({
      index: mode === 'practice' ? 0 : 1,
      animated: true,
    });
    // Guard duration should cover the animation time
    setTimeout(() => { isInternalScroll.current = false; }, 400);
  };

  const renderItem = ({ item }: { item: 'practice' | 'exam' }) => {
    const tabKey = item;
    if (item === 'practice') {
      return (
        <ScrollView
          ref={r => { scrollRefs.current[tabKey] = r; }}
          style={{ width: screenWidth, backgroundColor: colors.background }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{total}</Text>
              <Text style={styles.statLabel}>Total Questions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: colors.correct }]}>{masteredCount}</Text>
              <Text style={styles.statLabel}>Mastered ✓</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: colors.awsOrange }]}>{Math.max(0, total - masteredCount)}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>

          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Question Type</Text>
            <View style={styles.typeRow}>
              {Q_TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.typeBtn, questionType === opt.key && styles.typeBtnActive]}
                  onPress={() => handleQuestionTypeChange(opt.key)}
                >
                  <Text style={[styles.typeBtnEmoji, questionType === opt.key && styles.typeBtnLabelActive]}>
                    {opt.emoji}
                  </Text>
                  <View style={styles.typeBtnTextGroup}>
                    <Text
                      style={[styles.typeBtnLabel, questionType === opt.key && styles.typeBtnLabelActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={[styles.typeBtnSub, questionType === opt.key && styles.typeBtnSubActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {opt.key === 'all' ? `${total} Qs` : opt.key === 'mc' ? `${mcCount} Qs` : `${hotspotCount} Qs`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Domain</Text>
            <TouchableOpacity
              style={[styles.domainDropdownTrigger, domainPickerOpen && styles.domainDropdownTriggerOpen]}
              onPress={() => setDomainPickerOpen(o => !o)}
            >
              <Text style={styles.domainDropdownValue}>{DOMAIN_LABELS[domain]}</Text>
              {domain !== 0 && <Text style={styles.domainDropdownCount}>{filteredDomainCounts[domain] ?? 0} Qs</Text>}
              <Text style={styles.domainDropdownChevron}>{domainPickerOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          </View>

          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Mode</Text>
            <View style={[styles.typeRow, isNarrow && styles.typeRowWrap]}>
              {([
                { key: 'random',     emoji: '⇄', label: 'Random',      sub: 'Shuffled' },
                { key: 'sequential', emoji: '⇒', label: 'Sequential',  sub: 'In order' },
                { key: 'weak',       emoji: '↺', label: 'Weak',        sub: `${weakCount} not mastered` },
                { key: 'spaced',     emoji: '🧠', label: 'Smart Study', sub: 'Spaced repetition' },
              ] as const).map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.typeBtn, isNarrow && styles.typeBtnHalf, quizMode === m.key && styles.typeBtnActive]}
                  onPress={() => setQuizMode(quizMode === m.key ? null : m.key)}
                >
                  <Text style={[styles.typeBtnEmoji, quizMode === m.key && styles.typeBtnLabelActive]}>{m.emoji}</Text>
                  <View style={styles.typeBtnTextGroup}>
                    <Text
                      style={[styles.typeBtnLabel, quizMode === m.key && styles.typeBtnLabelActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {m.label}
                    </Text>
                    <Text
                      style={[styles.typeBtnSub, quizMode === m.key && styles.typeBtnSubActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {m.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {quizMode === 'spaced' && (
              <Text style={styles.modeHint}>
                🧠 Smart Study uses spaced repetition (SM-2) to prioritise questions you find difficult. Questions answered correctly appear less often; wrong answers return sooner. Ideal for long-term retention.
              </Text>
            )}
          </View>

          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Options</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity style={[styles.typeBtn, studyMode && styles.typeBtnActive]} onPress={() => setStudyMode(v => !v)}>
                <Text style={[styles.typeBtnEmoji, studyMode && styles.typeBtnLabelActive]}>{studyMode ? '✧' : '✎'}</Text>
                <View style={styles.typeBtnTextGroup}>
                  <Text style={[styles.typeBtnLabel, studyMode && styles.typeBtnLabelActive]}>{studyMode ? 'Study Mode' : 'Test Mode'}</Text>
                  {studyMode && (
                    <Text style={[styles.typeBtnSub, styles.typeBtnSubActive]}>Guided learning</Text>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, timed && styles.typeBtnActive]} onPress={() => setTimed(v => !v)}>
                <Text style={[styles.typeBtnEmoji, timed && styles.typeBtnLabelActive]}>◷</Text>
                <View style={styles.typeBtnTextGroup}>
                  <Text style={[styles.typeBtnLabel, timed && styles.typeBtnLabelActive]}>Timed</Text>
                  <Text style={[styles.typeBtnSub, timed && styles.typeBtnSubActive]}>Countdown timer</Text>
                </View>
              </TouchableOpacity>
            </View>

            {timed && (
              <View style={styles.timedSubRow}>
                <Text style={styles.timedSubLabel}>Seconds per question</Text>
                <TextInput
                  style={[styles.numInput, { width: 70 }]}
                  value={secsPerQ}
                  onChangeText={setSecsPerQ}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            )}
          </View>

          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Question Range</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Text style={styles.rangeFieldLabel}>From #</Text>
                <TextInput style={styles.numInput} value={fromQ} onChangeText={setFromQ} keyboardType="number-pad" maxLength={4} />
              </View>
              <Text style={styles.rangeDash}>—</Text>
              <View style={styles.rangeField}>
                <Text style={styles.rangeFieldLabel}>To #</Text>
                <TextInput style={styles.numInput} value={toQ} onChangeText={setToQ} keyboardType="number-pad" maxLength={4} />
              </View>
              <View style={styles.rangeField}>
                <Text style={styles.rangeFieldLabel}>Count</Text>
                <TextInput style={styles.numInput} value={count} onChangeText={setCount} keyboardType="number-pad" maxLength={3} />
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              {[25, 50, 85].map(n => (
                <TouchableOpacity
                  key={n}
                  style={styles.presetBtn}
                  onPress={() => setCount(String(n))}
                >
                  <Text style={styles.presetBtnText}>{n} Qs</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setCount(String(poolSize))}
              >
                <Text style={styles.presetBtnText}>All ({poolSize})</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      );
    } else {
      return (
        <ScrollView
          ref={r => { scrollRefs.current[tabKey] = r; }}
          style={{ width: screenWidth, backgroundColor: colors.background }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.examSpecRow}>
            {([
              { value: '65', label: 'Questions' },
              { value: '90', label: 'Minutes' },
              { value: '70%', label: 'Pass Mark' },
            ]).map((spec, i, arr) => (
              <React.Fragment key={spec.label}>
                <View style={styles.examSpecItem}>
                  <Text style={styles.examSpecValue}>{spec.value}</Text>
                  <Text style={styles.examSpecLabel}>{spec.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.examSpecDivider} />}
              </React.Fragment>
            ))}
          </View>
          <View style={shared.card}>
            <Text style={shared.sectionLabel}>Domain Breakdown</Text>
            {([1, 2, 3, 4, 5] as const).map(d => {
              const count = EXAM_DOMAIN_COUNTS[d];
              const pct   = EXAM_DOMAIN_PCT[d];
              return (
                <View key={d} style={styles.examDomainRow}>
                  <View style={styles.examDomainInfo}>
                    <Text style={styles.examDomainName}>{DOMAIN_LABELS[d]}</Text>
                    <Text style={styles.examDomainCount}>{count} questions | {pct}%</Text>
                  </View>
                  <View style={styles.examDomainBar}>
                    <View style={[styles.examDomainFill, { width: cssVal(`${pct}%`) }]} />
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.examNoteCard}>
            <Text style={styles.examNoteText}>
              Questions are randomly sampled from each domain per the AWS exam guide.
              {'\n'}No answer feedback is shown until the exam is submitted.
            </Text>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerRow}>
              <Text style={styles.headerBadge}>☁</Text>
              <View style={styles.headerTitleColumn}>
                <Text style={styles.headerTitle}>AWS AI Practitioner</Text>
                <Text style={styles.headerSub}>AIF-C01 Practice Exam</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.helpIconBtn}
            onPress={() => navigation.navigate('Help')}
            accessibilityLabel="Help"
          >
            <Text style={styles.helpIconText}>💡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {profile && (() => {
        const days = getDaysLeft(profile.examDate);
        const isPassed = profile.examStatus === 'passed';
        const onBannerPress = () => {
          if (isPassed) { navigation.navigate('Settings'); return; }
          if (days < 0) { setShowPostExamModal(true); return; }
          setObName(profile.name);
          const [y, m, d] = profile.examDate.split('-');
          setObYear(y); setObMonth(m); setObDay(d);
          setObError('');
          setShowOnboarding(true);
        };
        let label: string;
        let color: string;
        if (isPassed) {
          const pretty = profile.passedDate
            ? new Date(profile.passedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          label = pretty ? `🏆 AWS Certified — passed ${pretty}` : '🏆 AWS Certified!';
          color = colors.correct;
        } else if (days > 0) {
          label = `📅 ${days} days to exam`;
          color = days > 7 ? colors.correct : colors.awsOrange;
        } else if (days === 0) {
          label = '🎯 Exam day — good luck!';
          color = colors.awsOrange;
        } else {
          label = '📝 Awaiting result — tap to update';
          color = colors.awsOrange;
        }
        return (
          <TouchableOpacity
            style={styles.countdownBanner}
            activeOpacity={0.8}
            onPress={onBannerPress}
          >
            <Text style={styles.countdownName}>{new Date().getHours() < 12 ? '🌅 Good morning' : '☀️ Good afternoon'}{', '}{profile.name}{'!'}</Text>
            <Text style={[styles.countdownDays, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })()}

      {/* Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity style={[styles.modeTab, appMode === 'practice' && styles.modeTabActive]} onPress={() => scrollToMode('practice')}>
          <Text style={[styles.modeTabText, appMode === 'practice' && styles.modeTabTextActive]}>Practice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeTab, appMode === 'exam' && styles.modeTabActive]} onPress={() => scrollToMode('exam')}>
          <Text style={[styles.modeTabText, appMode === 'exam' && styles.modeTabTextActive]}>Exam Simulation</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={['practice', 'exam'] as const}
          renderItem={renderItem}
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

      {/* Start Button */}
      <View style={styles.startWrap}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.startBtn, (loading || (appMode === 'practice' && poolSize === 0)) && styles.startBtnDisabled]}
          onPress={appMode === 'exam' ? handleExamStart : handleStart}
          disabled={loading || (appMode === 'practice' && poolSize === 0)}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>{appMode === 'exam' ? '🎓 Take Mock Exam →' : '🎯 Start Practice →'}</Text>}
        </TouchableOpacity>
      </View>

      {/* Onboarding Modal */}
      <Modal visible={showOnboarding} transparent animationType="fade">
        <View style={styles.obOverlay}>
          <View style={styles.obCard}>
            <Text style={styles.obTitle}>Welcome!</Text>
            <Text style={styles.obSubtitle}>Let's personalise your study plan.</Text>

            <Text style={styles.obLabel}>Your name</Text>
            <TextInput
              style={styles.obInput}
              placeholder="e.g. Vayu"
              placeholderTextColor={colors.textMuted}
              value={obName}
              onChangeText={t => { setObName(t); setObError(''); }}
              autoCapitalize="words"
              maxLength={40}
            />

            <Text style={styles.obLabel}>Exam date</Text>
            <View style={styles.obDateRow}>
              <View style={styles.obDateField}>
                <Text style={styles.obDateHint}>Month</Text>
                <TextInput
                  style={styles.obDateInput}
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  value={obMonth}
                  onChangeText={t => { setObMonth(t.replace(/\D/g,'')); setObError(''); }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.obDateSep}>/</Text>
              <View style={styles.obDateField}>
                <Text style={styles.obDateHint}>Day</Text>
                <TextInput
                  style={styles.obDateInput}
                  placeholder="DD"
                  placeholderTextColor={colors.textMuted}
                  value={obDay}
                  onChangeText={t => { setObDay(t.replace(/\D/g,'')); setObError(''); }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.obDateSep}>/</Text>
              <View style={[styles.obDateField, { flex: 2 }]}>
                <Text style={styles.obDateHint}>Year</Text>
                <TextInput
                  style={styles.obDateInput}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textMuted}
                  value={obYear}
                  onChangeText={t => { setObYear(t.replace(/\D/g,'')); setObError(''); }}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            {obError ? <Text style={styles.obError}>{obError}</Text> : null}

            <TouchableOpacity style={styles.obBtn} onPress={handleSaveProfile}>
              <Text style={styles.obBtnText}>
                {profile ? 'Save Changes' : "Let's Go! →"}
              </Text>
            </TouchableOpacity>

            {profile && (
              <TouchableOpacity
                style={styles.obBtnSecondary}
                onPress={() => { setShowOnboarding(false); setObError(''); }}
              >
                <Text style={styles.obBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Post-Exam Check-in Modal ── */}
      <Modal
        visible={showPostExamModal}
        transparent
        animationType="fade"
        onRequestClose={handlePostExamLater}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{'How did your exam go? 🎓'}</Text>
            <Text style={styles.modalBody}>
              {profile
                ? `Your exam date was ${new Date(profile.examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. We hope it went well!`
                : ''}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: '#16A34A' }]}
                onPress={handlePostExamPassed}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{'🎉 I Passed!'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border }]}
                onPress={handlePostExamReschedule}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{'📅 Reschedule'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ alignSelf: 'center', marginTop: 12, padding: 8 }}
              onPress={handlePostExamLater}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, opacity: 0.65 }}>Ask Me Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Domain Picker Modal */}
      <Modal visible={domainPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.domainModalBackdrop} activeOpacity={1} onPress={() => setDomainPickerOpen(false)}>
          <View style={styles.domainModalSheet}>
            <Text style={styles.domainModalTitle}>Select Domain</Text>
            {([0, 1, 2, 3, 4, 5] as DomainFilter[]).map(d => (
              <TouchableOpacity key={d} style={styles.domainDropdownItem} onPress={() => handleDomainChange(d)}>
                <Text style={styles.domainDropdownItemText}>{DOMAIN_LABELS[d]}</Text>
                {d !== 0 && <Text style={styles.domainDropdownItemCount}>{filteredDomainCounts[d] ?? 0} Qs</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },
  headerWrap: { backgroundColor: colors.awsDark },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  headerLeft: { flex: 1 },
  headerTitleColumn: { alignItems: 'flex-start' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBadge:  { fontSize: 20, color: colors.textLight },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: colors.textLight },
  headerSub:    { fontSize: 11, color: colors.awsOrange, fontWeight: '600' },

  helpIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIconText: { fontSize: 18 },

  scrollContent: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2
  },
  statAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  statNum:   { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  section: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 16, marginBottom: 14, ...shadow('#000', 1, 0.06, 4), elevation: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeRowWrap: { flexWrap: 'wrap' },
  typeBtnHalf: { flexBasis: '48%' },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.background
  },
  typeBtnActive: { borderColor: colors.awsOrange, backgroundColor: colors.awsOrange + '20' },
  typeBtnEmoji: { fontSize: 22, marginRight: 6, color: colors.textPrimary },
  typeBtnTextGroup: { flex: 1, alignItems: 'center' },
  typeBtnLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  typeBtnLabelActive: { color: colors.awsOrange },
  typeBtnSub: { fontSize: 10, color: colors.textMuted },
  typeBtnSubActive: { color: colors.awsOrange },
  typeBtnDisabled: { opacity: 0.38 },
  modeHint: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 18, paddingHorizontal: 4 },

  domainDropdownTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, padding: 12 },
  domainDropdownTriggerOpen: { borderColor: colors.awsOrange },
  domainDropdownValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  domainDropdownCount: { fontSize: 12, color: colors.awsOrange, marginRight: 6 },
  domainDropdownChevron: { fontSize: 10, color: colors.textMuted },

  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rangeField: { flex: 1, alignItems: 'center' },
  rangeFieldLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  rangeDash: { fontSize: 18, color: colors.textMuted, paddingBottom: 8 },
  numInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: 16, textAlign: 'center', backgroundColor: colors.background, width: '100%', color: colors.textPrimary },

  presetsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  modeTabs: { flexDirection: 'row', backgroundColor: colors.awsDark, paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modeTabActive: { backgroundColor: colors.awsOrange },
  modeTabText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  modeTabTextActive: { color: '#fff' },

  startWrap: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
  },
  startBtn: {
    backgroundColor: colors.awsOrange,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow('#000', 6, 0.3, 8),
    elevation: 8,
  },
  startBtnDisabled: { opacity: 0.7 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },

  countdownBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.awsDark, paddingHorizontal: 16, paddingBottom: 10 },
  countdownName: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  countdownDays: { fontSize: 13, fontWeight: '700' },

  obOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  obCard: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, ...shadow('#000', 12, 0.25, 20), elevation: 10 },
  obTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
  obSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  obLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  obInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background, marginBottom: 20 },
  obDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 },
  obDateField: { flex: 1, alignItems: 'center' },
  obDateHint: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  obDateInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12, fontSize: 16, fontWeight: '600', textAlign: 'center', color: colors.textPrimary, backgroundColor: colors.background, width: '100%' },
  obDateSep: { fontSize: 20, color: colors.textMuted, fontWeight: '700', paddingBottom: 10 },
  obError: { fontSize: 13, color: colors.wrong, marginBottom: 12, fontWeight: '600' },
  obBtn: { backgroundColor: colors.awsOrange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  obBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  obBtnSecondary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  obBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, ...shadow('#000', 8, 0.2, 16), elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  modalBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnAction: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },

  domainModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  domainModalSheet: { backgroundColor: colors.cardBg, borderRadius: 16, overflow: 'hidden' },
  domainModalTitle: { fontSize: 13, fontWeight: '700', padding: 16, color: colors.textPrimary },
  domainDropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  domainDropdownItemText: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  domainDropdownItemCount: { fontSize: 11, color: colors.textMuted },

  examSpecRow: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: 14, margin: 16, borderWidth: 1, borderColor: colors.border },
  examSpecItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  examSpecValue: { fontSize: 26, fontWeight: '900', color: colors.awsOrange },
  examSpecLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  examSpecDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },
  examDomainRow: { marginBottom: 10 },
  examDomainInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  examDomainName: { fontSize: 13, fontWeight: '600', flex: 1, color: colors.textPrimary },
  examDomainCount: { fontSize: 12, color: colors.textSecondary },
  examDomainBar: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  examDomainFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: colors.awsOrange, borderRadius: 3 },
  examNoteCard: { backgroundColor: colors.cardBg, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
  examNoteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 20 },
  timedSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.awsOrange + '55' },
  timedSubLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
