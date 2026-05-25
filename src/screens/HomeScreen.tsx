import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, DomainFilter, DOMAIN_LABELS, QuizMode } from '../constants/types';
import { getTotalCount, buildIndices, getDomainCounts, getAllQuestions, buildExamQuestions, getDomainForIndex, EXAM_DOMAIN_COUNTS, EXAM_DOMAIN_PCT, EXAM_TOTAL_QS } from '../utils/quizEngine';
import { getMasteredQuestions, resetMasteredQuestions } from '../utils/storage';
import { getProfile, saveProfile, getDaysLeft, UserProfile, validateProfileInputs, getPostExamPromptState, setPostExamPromptDismissed, setPostExamPromptLater } from '../utils/profileStore';
import { scheduleExamCountdownNotifications } from '../utils/notificationService';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { cssVal, shadow } from '../utils/styleUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type QType = 'all' | 'mc' | 'hotspot';
const Q_TYPE_OPTIONS: { key: QType; emoji: string; label: string; sub: string }[] = [
  { key: 'all',     emoji: '\u2630', label: 'All',             sub: 'Every question' },
  { key: 'mc',      emoji: '\u2611', label: 'Multiple Choice', sub: 'Single / multi-select' },
  { key: 'hotspot', emoji: '\u21C4', label: 'Matching',        sub: 'Ordering & matching' },
];

// Computed once from the static question bank — never changes between renders
const allQuestions = getAllQuestions();
const hotspotCount = allQuestions.filter(q => q.is_hotspot).length;
const domainCounts = getDomainCounts();

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const total = getTotalCount();

  const [fromQ, setFromQ]           = useState('1');
  const [toQ, setToQ]               = useState(String(total || 1));
  const [count, setCount]           = useState(String(total || 20));
  const [timed, setTimed]           = useState(false);
  const [secsPerQ, setSecsPerQ]     = useState('90');
  const [loading, setLoading]       = useState(false);

  // New filter states
  const [questionType, setQuestionType] = useState<QType | null>('all');
  const [domain, setDomain]             = useState<DomainFilter>(0);
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);
  const [studyMode, setStudyMode]       = useState(false);
  const [quizMode, setQuizMode]         = useState<QuizMode | null>('random');

  // Stats
  const [masteredCount, setMasteredCount] = useState(0);
  const [masteredNumbers, setMasteredNumbers] = useState<Set<number>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [appMode, setAppMode] = useState<'practice' | 'exam'>('practice');

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
  }, [questionType, domain, masteredNumbers]);

  // Pool size — intersection of fromQ/toQ range + questionType + domain (sync, no async)
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
  }, [total]);

  const poolSize = useMemo(
    () => calcPoolSize(questionType, domain, fromQ, toQ),
    [calcPoolSize, questionType, domain, fromQ, toQ],
  );

  // When a PRIMARY filter (domain or questionType) changes, reset count to new pool size
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

  // Per-domain counts filtered by current questionType (so domain picker shows accurate numbers)
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

  // Clamp count when pool shrinks
  useEffect(() => {
    const c = parseInt(count) || 0;
    if (poolSize > 0 && c > poolSize) setCount(String(poolSize));
  }, [poolSize]);

  // Profile / onboarding
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obName, setObName]             = useState('');
  const [obMonth, setObMonth]           = useState('');
  const [obDay, setObDay]               = useState('');
  const [obYear, setObYear]             = useState('');
  const [obError, setObError]           = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 600;

  const [showPostExamModal, setShowPostExamModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useFocusEffect(
    useCallback(() => {
      getMasteredQuestions().then(nums => {
        setMasteredCount(nums.length);
        setMasteredNumbers(new Set(nums));
      });
      getProfile().then(async p => {
        if (p) {
          setProfile(p);
          if (getDaysLeft(p.examDate) < 0) {
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

  // Auto-update count when range changes
  useEffect(() => {
    const from = Math.max(1, parseInt(fromQ, 10) || 1);
    const to   = Math.min(total, parseInt(toQ,   10) || total);
    if (from <= to) setCount(String(to - from + 1));
  }, [fromQ, toQ, total]);

  const handleStart = async () => {
    if (total === 0) {
      Alert.alert('No Questions Found', 'Run setup.ps1 to copy question data into the app, then restart.', [{ text: 'OK' }]);
      return;
    }
    if (!questionType || !quizMode) {
      Alert.alert(
        'Selection Required',
        `Please select a ${!questionType ? 'Question Type' : 'Mode'} before starting.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setLoading(true);
    try {
      const from = Math.max(1, parseInt(fromQ, 10) || 1);
      const to   = Math.min(total, parseInt(toQ, 10) || total);
      const cnt  = Math.max(1, parseInt(count, 10) || 20);
      const secs = Math.max(30, parseInt(secsPerQ, 10) || 90);

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
        Alert.alert('No Questions', 'No questions match the selected filters. Try adjusting your settings.');
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
    if (total === 0) {
      Alert.alert('No Questions Found', 'Run setup.ps1 to copy question data, then restart.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      const indices = await buildExamQuestions();
      if (indices.length === 0) {
        Alert.alert('Build Failed', 'Could not build exam — check question bank.');
        return;
      }
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

  const mcCount = total - hotspotCount;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerRow}>
              <Text style={styles.headerBadge}>{'\u2601'}</Text>
              <View style={styles.headerTitleColumn}>
                <Text style={styles.headerTitle}>AWS AI Practitioner</Text>
                <Text style={styles.headerSub}>AIF-C01 Practice Exam</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.headerIconBtn, menuOpen && styles.headerIconBtnActive]}
              onPress={menuOpen ? closeMenu : openMenu}
              accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
              accessibilityHint={menuOpen ? 'Closes navigation menu' : 'Opens navigation menu'}
            >
              <Text style={styles.headerIconText}>{menuOpen ? '✕' : '☰'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Countdown Banner (shown when profile is set) ── */}
      {profile && (() => {
        const days = getDaysLeft(profile.examDate);
        const bannerColor = days > 7 ? '#16A34A' : days > 2 ? colors.awsOrange : days >= 0 ? '#DC2626' : colors.textMuted;
        const dayLabel = days > 0
          ? `📅 ${days} day${days !== 1 ? 's' : ''} to exam`
          : days === 0 ? '🎯 Exam day — good luck!'
          : `✓ Exam was ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
        return (
          <TouchableOpacity
            style={styles.countdownBanner}
            onPress={() => {
              setObName(profile.name);
              const [y, m, d] = profile.examDate.split('-');
              setObYear(y); setObMonth(m); setObDay(d);
              setObError('');
              setShowOnboarding(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.countdownName}>{(() => { const h = new Date().getHours(); return h < 12 ? '🌅 Good morning' : h < 17 ? '☀️ Good afternoon' : '🌙 Good evening'; })()}{', '}{profile.name}{'!'}</Text>
            <Text style={[styles.countdownDays, { color: bannerColor }]}>{dayLabel}</Text>
          </TouchableOpacity>
        );
      })()}

      {/* ── Practice / Exam Simulation tabs ── */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, appMode === 'practice' && styles.modeTabActive]}
          onPress={() => setAppMode('practice')}
          accessibilityLabel="Practice mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: appMode === 'practice' }}
        >
          <View style={styles.modeTabInner}>
            <Text style={[styles.modeTabSymbol, appMode === 'practice' && styles.modeTabTextActive]}>{'\u270E'}</Text>
            <Text style={[styles.modeTabText, appMode === 'practice' && styles.modeTabTextActive]}>Practice</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, appMode === 'exam' && styles.modeTabActive]}
          onPress={() => setAppMode('exam')}
          accessibilityLabel="Exam Simulation mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: appMode === 'exam' }}
        >
          <View style={styles.modeTabInner}>
            <Text style={[styles.modeTabSymbol, appMode === 'exam' && styles.modeTabTextActive]}>{'\u25CE'}</Text>
            <Text style={[styles.modeTabText, appMode === 'exam' && styles.modeTabTextActive]}>Exam Simulation</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Stats row (practice only) ── */}
        {appMode === 'practice' && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statAccentBar, { backgroundColor: colors.awsDark }]} />
            <Text style={styles.statNum}>{total}</Text>
            <Text style={styles.statLabel}>Total Questions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statAccentBar, { backgroundColor: colors.correct }]} />
            <Text style={[styles.statNum, { color: colors.correct }]}>{masteredCount}</Text>
            <Text style={styles.statLabel}>Mastered ✓</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statAccentBar, { backgroundColor: colors.awsOrange }]} />
            <Text style={[styles.statNum, { color: colors.awsOrange }]}>{Math.max(0, total - masteredCount)}</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>
        )}

        {/* ── Practice config (hidden in Exam mode) ── */}
        {appMode === 'practice' && (<>

        {/* ── Question Type ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Question Type</Text>
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
                  <Text style={[styles.typeBtnLabel, questionType === opt.key && styles.typeBtnLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.typeBtnSub, questionType === opt.key && styles.typeBtnSubActive]}>
                    {opt.key === 'all' ? `${total} Qs` : opt.key === 'mc' ? `${mcCount} Qs` : `${hotspotCount} Qs`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Domain Filter ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Domain</Text>
          <TouchableOpacity
            style={[styles.domainDropdownTrigger, domainPickerOpen && styles.domainDropdownTriggerOpen]}
            onPress={() => setDomainPickerOpen(o => !o)}
            activeOpacity={0.8}
          >
            <Text style={styles.domainDropdownValue}>{DOMAIN_LABELS[domain]}</Text>
            {domain !== 0 && (
              <Text style={styles.domainDropdownCount}>{filteredDomainCounts[domain] ?? 0} Qs</Text>
            )}
            <Text style={styles.domainDropdownChevron}>{domainPickerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quiz Mode ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Mode</Text>
          <View style={[styles.typeRow, isNarrow && styles.typeRowWrap]}>
            {([
              { key: 'random',     emoji: '\u21CC', label: 'Random',      sub: 'Shuffled' },
              { key: 'sequential', emoji: '\u21D2', label: 'Sequential',  sub: 'In order' },
              { key: 'weak',       emoji: '\u21BA', label: 'Weak',        sub: `${weakCount} not mastered` },
              { key: 'spaced',     emoji: '\uD83E\uDDE0', label: 'Smart Study', sub: 'Spaced repetition' },
            ] as const).map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.typeBtn, isNarrow && styles.typeBtnHalf, quizMode === m.key && styles.typeBtnActive]}
                onPress={() => setQuizMode(quizMode === m.key ? null : m.key)}
              >
                <Text style={[styles.typeBtnEmoji, quizMode === m.key && styles.typeBtnLabelActive]}>
                  {m.emoji}
                </Text>
                <View style={styles.typeBtnTextGroup}>
                  <Text style={[styles.typeBtnLabel, quizMode === m.key && styles.typeBtnLabelActive]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.typeBtnSub, quizMode === m.key && styles.typeBtnSubActive]}>
                    {m.sub}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Options Bar: Study/Test · Timed · Reset ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Options</Text>
          <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, studyMode && styles.typeBtnActive]}
            onPress={() => setStudyMode(v => !v)}
          >
            <Text style={[styles.typeBtnEmoji, studyMode && styles.typeBtnLabelActive]}>
              {studyMode ? '\u2726' : '\u270E'}
            </Text>
            <View style={styles.typeBtnTextGroup}>
              <Text style={[styles.typeBtnLabel, studyMode && styles.typeBtnLabelActive]}>
                {studyMode ? 'Study Mode' : 'Test Mode'}
              </Text>
              <Text style={[styles.typeBtnSub, studyMode && styles.typeBtnSubActive]}>
                {studyMode ? 'Auto explanation' : 'Manual explanation'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeBtn, timed && styles.typeBtnActive]}
            onPress={() => setTimed(v => !v)}
          >
            <Text style={[styles.typeBtnEmoji, timed && styles.typeBtnLabelActive]}>{'\u25F7'}</Text>
            <View style={styles.typeBtnTextGroup}>
              <Text style={[styles.typeBtnLabel, timed && styles.typeBtnLabelActive]}>{'Timed'}</Text>
              <Text style={[styles.typeBtnSub, timed && styles.typeBtnSubActive]}>{'Countdown timer'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeBtn, styles.typeBtnReset, masteredCount === 0 && styles.typeBtnDisabled]}
            disabled={masteredCount === 0}
            onPress={() => setShowResetModal(true)}
          >
            <Text style={[styles.typeBtnEmoji, styles.typeBtnResetText, masteredCount === 0 && styles.typeBtnDisabledText]}>{'\u2715'}</Text>
            <View style={styles.typeBtnTextGroup}>
              <Text style={[styles.typeBtnLabel, styles.typeBtnResetText, masteredCount === 0 && styles.typeBtnDisabledText]}>{'Reset'}</Text>
              <Text style={[styles.typeBtnSub, styles.typeBtnResetText, masteredCount === 0 && styles.typeBtnDisabledText]}>
                {masteredCount > 0 ? `${masteredCount} mastered` : 'None saved'}
              </Text>
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

        {/* ── Question Range & Count ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Question Range</Text>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>From #</Text>
              <TextInput
                style={styles.numInput}
                value={fromQ}
                onChangeText={setFromQ}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <Text style={styles.rangeDash}>—</Text>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>To #</Text>
              <TextInput
                style={styles.numInput}
                value={toQ}
                onChangeText={setToQ}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>Count</Text>
              <TextInput
                style={styles.numInput}
                value={count}
                onChangeText={setCount}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
          <Text style={styles.poolSizeLabel}>
            {poolSize === 0
              ? '⚠ No questions match these filters'
              : `${poolSize} question${poolSize !== 1 ? 's' : ''} available`}
          </Text>

          {/* Quick Presets */}
          <View style={styles.presetsRow}>
            {[25, 50, 85].filter(n => n <= poolSize).map(n => (
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



        </>)}
        {/* ── end practice config ── */}

        {/* ── Exam Simulation Card ── */}
        {appMode === 'exam' && (
          <>
            {/* Spec row */}
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

            {/* Domain breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Domain Breakdown</Text>
              {([1, 2, 3, 4, 5] as const).map(d => {
                const count = EXAM_DOMAIN_COUNTS[d];
                const pct   = EXAM_DOMAIN_PCT[d];
                return (
                  <View key={d} style={styles.examDomainRow}>
                    <View style={styles.examDomainInfo}>
                      <Text style={styles.examDomainName}>{DOMAIN_LABELS[d]}</Text>
                      <Text style={styles.examDomainCount}>{count} questions · {pct}%</Text>
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

            <View style={{ height: 4 }} />
          </>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* ── Onboarding Modal ── */}
      <Modal visible={showOnboarding} transparent animationType="fade">
        <View style={styles.obOverlay}>
          <View style={styles.obCard}>
            <Text style={styles.obTitle}>{'👋 Welcome!'}</Text>
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

      {/* ── Reset Confirmation Modal ── */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reset Progress?</Text>
            <Text style={styles.modalBody}>
              {'This will permanently clear '}
              <Text style={styles.modalBold}>{masteredCount} mastered question{masteredCount !== 1 ? 's' : ''}</Text>
              {'. The Weak mode pool will reset to all '}
              <Text style={styles.modalBold}>{total}</Text>
              {' questions.'}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalBtnSecText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={async () => {
                  setShowResetModal(false);
                  await resetMasteredQuestions();
                  setMasteredCount(0);
                }}
              >
                <Text style={styles.modalBtnDangerText}>Reset</Text>
              </TouchableOpacity>
            </View>
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
                style={[styles.modalBtn, { backgroundColor: '#16A34A' }]}
                onPress={handlePostExamPassed}
              >
                <Text style={styles.modalBtnDangerText}>{'🎉 I Passed!'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={handlePostExamReschedule}
              >
                <Text style={styles.modalBtnSecText}>{'📅 Reschedule'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ alignSelf: 'center', marginTop: 12, padding: 8 }}
              onPress={handlePostExamLater}
            >
              <Text style={[styles.modalBtnSecText, { fontSize: 13, opacity: 0.65 }]}>Ask Me Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Start Button ── */}
      <View style={styles.startWrap}>
        <TouchableOpacity
          style={[styles.startBtn, (loading || (appMode === 'practice' && poolSize === 0)) && styles.startBtnDisabled]}
          onPress={appMode === 'exam' ? handleExamStart : handleStart}
          disabled={loading || (appMode === 'practice' && poolSize === 0)}
          accessibilityLabel={appMode === 'exam' ? 'Take Mock Exam' : studyMode ? 'Start Learning' : 'Start Practice'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startBtnText}>
              {appMode === 'exam'
                ? '🎓 Take Mock Exam →'
                : studyMode ? '📖 Start Learning →' : '🎯 Start Practice →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Domain Picker Modal ── */}
      <Modal
        visible={domainPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDomainPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.domainModalBackdrop}
          activeOpacity={1}
          onPress={() => setDomainPickerOpen(false)}
        >
          <View style={styles.domainModalSheet}>
            <Text style={styles.domainModalTitle}>Select Domain</Text>
            {([0, 1, 2, 3, 4, 5] as DomainFilter[]).map((d, idx, arr) => (
              <React.Fragment key={d}>
                <TouchableOpacity
                  style={[styles.domainDropdownItem, domain === d && styles.domainDropdownItemActive]}
                  onPress={() => handleDomainChange(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.domainDropdownItemText, domain === d && styles.domainDropdownItemTextActive]}>
                    {DOMAIN_LABELS[d]}
                  </Text>
                  {d !== 0 && (
                    <Text style={[styles.domainDropdownItemCount, domain === d && styles.domainDropdownItemCountActive]}>
                      {filteredDomainCounts[d] ?? 0} Qs
                    </Text>
                  )}
                  {domain === d && <Text style={styles.domainDropdownCheck}>✓</Text>}
                </TouchableOpacity>
                {idx < arr.length - 1 && <View style={styles.domainModalDivider} />}
              </React.Fragment>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Nav Menu Dropdown ── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={closeMenu}>
          <View style={styles.menuDropdown}>
            {([
              { label: 'Analytics', icon: '📊', screen: 'Analytics' },
              { label: 'Review',    icon: '📋', screen: 'SessionHistory' },
              { label: 'Help',      icon: '💡', screen: 'Help' },
              { label: 'Settings',  icon: '⚙️', screen: 'Settings' },
            ] as { label: string; icon: string; screen: keyof RootStackParamList }[]).map((item, i, arr) => (
              <React.Fragment key={item.screen}>
                <Pressable
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.menuItem,
                    (pressed || hovered) && styles.menuItemHover,
                  ]}
                  onPress={() => { closeMenu(); navigation.navigate(item.screen as any); }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text style={styles.menuItemIcon}>{item.icon}</Text>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                </Pressable>
                {i < arr.length - 1 && <View style={styles.menuDivider} />}
              </React.Fragment>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },
  headerWrap: { backgroundColor: colors.awsDark, zIndex: 100, overflow: 'visible' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 16,
    backgroundColor: colors.awsDark,
    zIndex: 100,
    overflow: 'visible',
  },
  headerLeft: { flex: 1 },
  headerTitleColumn: { alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadge:  { fontSize: 20, color: colors.textLight },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: colors.textLight, letterSpacing: 0.3 },
  headerSub:    { fontSize: 11, color: colors.awsOrange, fontWeight: '600', marginTop: 2, letterSpacing: 1 },
  headerIcons:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8, overflow: 'visible', zIndex: 100 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerIconBtnActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  headerIconText: { fontSize: 17, color: colors.textLight, fontWeight: '700' },

  // ── Nav menu dropdown ──
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menuDropdown: {
    position: 'absolute',
    top: 58,
    right: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    minWidth: 170,
    paddingVertical: 4,
    ...shadow('#000', 4, 0.18, 12),
    elevation: 10,
    zIndex: 999,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
    borderRadius: 10,
  },
  menuItemHover: {
    backgroundColor: colors.border,
  },
  menuItemIcon: { fontSize: 16, color: colors.textPrimary, width: 22, textAlign: 'center' },
  menuItemLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 12 },

  scroll:        { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    paddingTop: 18,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  statAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  statNum:   { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500', textAlign: 'center' },

  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    ...shadow('#000', 1, 0.06, 4),
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Question type & mode row (3 equal pills)
  typeRow: { flexDirection: 'row', gap: 8 },
  typeRowWrap: { flexWrap: 'wrap' },
  typeBtnHalf: { flex: 0, flexBasis: '48%' },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
  },
  typeBtnActive:      { borderColor: colors.awsOrange, backgroundColor: colors.awsOrange + '20' },
  typeBtnEmoji:       { fontSize: 22, marginRight: 6, color: colors.textPrimary },
  typeBtnTextGroup:   { flex: 1, flexDirection: 'column', alignItems: 'center' },
  typeBtnLabel:       { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  typeBtnLabelActive: { color: colors.awsOrange },
  typeBtnSub:         { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  typeBtnSubActive:   { color: colors.awsOrange },
  typeBtnReset:        {},
  typeBtnResetText:    { color: colors.wrong },
  typeBtnDisabled:     { opacity: 0.38 },
  typeBtnDisabledText: { color: colors.textMuted },

  // Domain dropdown
  domainDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  domainDropdownTriggerOpen: {
    borderColor: colors.awsOrange,
  },
  domainDropdownValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  domainDropdownCount: {
    fontSize: 12,
    color: colors.awsOrange,
    fontWeight: '600',
    marginRight: 6,
  },
  domainDropdownChevron: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 4,
  },
  domainDropdownList: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: colors.awsOrange,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    ...shadow('#000', 4, 0.1, 8),
    elevation: 4,
  },
  domainModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  domainModalSheet: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow('#000', 8, 0.15, 16),
    elevation: 8,
  },
  domainModalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  domainModalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  domainDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  domainDropdownItemLast: { borderBottomWidth: 0 },
  domainDropdownItemActive: { backgroundColor: colors.awsOrange + '20' },
  domainDropdownItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  domainDropdownItemTextActive: { color: colors.awsOrange, fontWeight: '700' },
  domainDropdownItemCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginRight: 8,
  },
  domainDropdownItemCountActive: { color: colors.awsOrange },
  domainDropdownCheck: {
    fontSize: 13,
    color: colors.awsOrange,
    fontWeight: '700',
  },

  // Range & count
  rangeRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rangeField:     { flex: 1, alignItems: 'center' },
  rangeFieldLabel:{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  rangeDash:      { fontSize: 18, color: colors.textMuted, paddingBottom: 8 },
  numInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
    backgroundColor: colors.background,
    width: '100%',
  },
  presetsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  poolSizeLabel: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginLeft: 2 },
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

  timedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.awsOrange + '55',
  },
  timedSubLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  // Reset modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    ...shadow('#000', 8, 0.2, 16),
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalBold: { fontWeight: '700', color: colors.textPrimary },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  modalBtnSecText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  modalBtnDanger: { backgroundColor: colors.wrong },
  modalBtnDangerText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Countdown banner ─────────────────────────────────────────────────
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.awsDark,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  countdownName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  countdownDays: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Onboarding modal ─────────────────────────────────────────────────
  obOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  obCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    ...shadow('#000', 12, 0.25, 20),
    elevation: 10,
  },
  obTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  obSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  obLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  obInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginBottom: 20,
  },
  obDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 20,
  },
  obDateField: { flex: 1, alignItems: 'center' },
  obDateHint: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  obDateInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
    backgroundColor: colors.background,
    width: '100%',
  },
  obDateSep: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '700',
    paddingBottom: 10,
  },
  obError: {
    fontSize: 13,
    color: colors.wrong,
    marginBottom: 12,
    fontWeight: '600',
  },
  obBtn: {
    backgroundColor: colors.awsOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  obBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  obBtnSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  obBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  // Start button
  startWrap: {
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    backgroundColor: colors.awsOrange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow(colors.awsOrange, 4, 0.4, 8),
    elevation: 6,
  },
  startBtnDisabled: { opacity: 0.7 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },



  // ── Practice / Exam tabs ──────────────────────────────────────────────
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.awsDark,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeTabActive: {
    backgroundColor: colors.awsOrange,
    borderColor: colors.awsOrange,
  },
  modeTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modeTabSymbol: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  modeTabTextActive: { color: '#fff' },

  // ── Exam card ────────────────────────────────────────────────────────
  examSpecRow: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  examSpecItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  examSpecValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.awsOrange,
  },
  examSpecLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  examSpecDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  examDomainRow: {
    marginBottom: 10,
  },
  examDomainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  examDomainName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  examDomainCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  examDomainBar: {
    height: 6,
    backgroundColor: colors.progressBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  examDomainFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.awsOrange,
    borderRadius: 3,
  },
  examNoteCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  examNoteText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
