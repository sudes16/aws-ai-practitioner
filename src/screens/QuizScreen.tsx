import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, HistoryEntry, Question, OptionState } from '../constants/types';
import { getAllQuestions, parseCorrectLetters } from '../utils/quizEngine';
import { setExamResult } from '../utils/examResultStore';
import { saveNoteForQuestion, getAllNotes } from '../utils/noteStore';
import { addQuestionReport, QuestionReport } from '../utils/storage';
import { updateSRRecord } from '../utils/spacedRepetition';
import { useTheme } from '../contexts/ThemeContext';
import { ColorScheme } from '../constants/colors';
import { cssVal, shadow, noShadow } from '../utils/styleUtils';
import ProgressBar from '../components/ProgressBar';
import OptionButton from '../components/OptionButton';
import ExplanationModal from '../components/ExplanationModal';
import HotspotQuestion from '../components/HotspotQuestion';

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

export default function QuizScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { config } = route.params;
  const isExam = config.isExam ?? false;
  const EXAM_TOTAL = config.examTotalSeconds ?? 5400;
  const questions = getAllQuestions();
  const totalQuestions = config.indices.length;

  // ── Core quiz state ──────────────────────────────────────────────────────
  // history.length === number of answered questions
  // currentPos === history.length (next unanswered)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [score, setScore] = useState(0);

  // Active question interaction state
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [hotspotSelections, setHotspotSelections] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  const hotspotSelectionsRef = useRef<string[]>([]);
  hotspotSelectionsRef.current = hotspotSelections;

  // Stable ref so the timer effect doesn't restart when selectedLetters changes
  const doSubmitRef = useRef<(forced?: boolean) => void>(() => {});

  // Navigation / review
  const [viewPos, setViewPos] = useState(0); // which position we are VIEWING

  // Flags (by question number)
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  // Notes & Reports
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [reportedSet, setReportedSet] = useState<Set<number>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<QuestionReport['category']>('wrong_answer');
  const [reportNote, setReportNote] = useState('');
  const [reportSaved, setReportSaved] = useState(false);

  // Load notes on mount
  useEffect(() => { getAllNotes().then(setNotesMap); }, []);

  // Modals
  const [showExplanation, setShowExplanation] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [examTimeLeft, setExamTimeLeft] = useState(isExam ? EXAM_TOTAL : 0);
  const examTimeLeftRef = useRef(isExam ? EXAM_TOTAL : 0);
  const [showExamReview, setShowExamReview] = useState(false);
  const [showExamConfirm, setShowExamConfirm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  // Exam mode: unlocks the Questions panel once user has visited the last question
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  // Exam mode: draft answers keyed by question position (0-based), saved as user selects
  const [examDraftAnswers, setExamDraftAnswers] = useState<Record<number, string[]>>({});

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(
    config.timed ? config.timePerQuestion : null
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const scoreRef = useRef(0);

  // Keep refs in sync for use inside callbacks
  historyRef.current = history;
  scoreRef.current = score;
  examTimeLeftRef.current = examTimeLeft;

  const currentPos = history.length; // next unanswered position

  // ── Derived display values ───────────────────────────────────────────────
  const isReviewingPast = viewPos < currentPos;
  const reviewEntry = isReviewingPast ? history[viewPos] : null;

  const displayQuestion: Question | undefined = (() => {
    if (isExam) {
      // Exam mode: always show the question at viewPos directly
      const idx = config.indices[viewPos];
      return idx !== undefined ? questions[idx] : undefined;
    }
    const idx = isReviewingPast
      ? history[viewPos]?.questionIndex
      : config.indices[currentPos];
    return idx !== undefined ? questions[idx] : undefined;
  })();

  const correctLetters = displayQuestion
    ? parseCorrectLetters(displayQuestion.answer, displayQuestion.is_multi)
    : [];

  // ── Timer ────────────────────────────────────────────────────────────────
  const doSubmit = useCallback(
    (forced = false) => {
      if (!displayQuestion) return;
      const current = historyRef.current;
      const currentIdx = current.length;
      if (currentIdx >= totalQuestions) return;

      const qIdx = config.indices[currentIdx];
      const q = questions[qIdx];
      if (!q) return;

      // ── Structured hotspot: can be auto-graded ──────────────────────────
      if (q.is_hotspot && q.answer && Object.keys(q.options).length > 0) {
        const correctOrder = q.answer.split(',').map(s => s.trim().toUpperCase());
        const hsSelections = hotspotSelectionsRef.current;
        const isCorrect =
          correctOrder.length === hsSelections.length &&
          correctOrder.every(
            (c, i) => c === (hsSelections[i] ?? '').toUpperCase()
          );
        const hsEntry: HistoryEntry = {
          questionNumber: q.number,
          questionIndex: qIdx,
          userLetters: hsSelections,
          correctLetters: correctOrder,
          correct: isCorrect,
          isHotspot: true,
          flagged: flagged.has(q.number),
        };
        setHistory(prev => [...prev, hsEntry]);
        if (isCorrect) setScore(s => s + 1);
        setLastResult(isCorrect);
        setSubmitted(true);
        if (config.studyMode) setShowExplanation(true);
        if (config.mode === 'spaced') updateSRRecord(q.number, isCorrect ? 4 : 1).catch(() => {});
        return;
      }

      // ── Regular / unstructured hotspot ─────────────────────────────────
      const correct = parseCorrectLetters(q.answer, q.is_multi);
      const userLetters = forced ? [] : selectedLetters;

      const isCorrect = q.is_hotspot
        ? null
        : q.is_multi
        ? correct.length === userLetters.length &&
          userLetters.every(l => correct.includes(l))
        : userLetters[0] === correct[0];

      const entry: HistoryEntry = {
        questionNumber: q.number,
        questionIndex: qIdx,
        userLetters,
        correctLetters: correct,
        correct: isCorrect,
        isHotspot: q.is_hotspot,
        flagged: flagged.has(q.number),
      };

      setHistory(prev => [...prev, entry]);
      if (isCorrect === true) setScore(s => s + 1);
      setLastResult(isCorrect);
      setSubmitted(true);
      if (config.studyMode && q.explanation) setShowExplanation(true);
      if (config.mode === 'spaced' && isCorrect !== null) {
        updateSRRecord(q.number, isCorrect ? 4 : 1).catch(() => {});
      }
    },
    [displayQuestion, selectedLetters, config.indices, questions, totalQuestions, flagged]
  );
  // Keep doSubmitRef in sync after the callback is (re)created
  doSubmitRef.current = doSubmit;

  // ── Exam submission ──────────────────────────────────────────────────────
  // Grades all questions from examDraftAnswers, pads stubs for unanswered, navigates to ExamResult
  const submitExam = () => {
    try {
      const h: HistoryEntry[] = [];
      for (let i = 0; i < totalQuestions; i++) {
        const qIdx = config.indices[i];
        const q = questions[qIdx];
        if (!q) continue;
        const userLetters = examDraftAnswers[i] ?? [];
        const correctLettersList = q.answer ? parseCorrectLetters(q.answer, q.is_multi) : [];
        const isCorrect: boolean | null = q.is_hotspot
          ? null
          : userLetters.length > 0 && correctLettersList.length > 0
            ? q.is_multi
              ? correctLettersList.length === userLetters.length &&
                userLetters.every(l => correctLettersList.includes(l))
              : userLetters[0] === correctLettersList[0]
            : false;
        h.push({
          questionNumber: q.number,
          questionIndex: qIdx,
          userLetters,
          correctLetters: correctLettersList,
          correct: isCorrect,
          isHotspot: q.is_hotspot,
          flagged: flagged.has(q.number),
        });
      }
      setExamResult({
        history: h,
        totalSeconds: EXAM_TOTAL,
        elapsedSeconds: EXAM_TOTAL - examTimeLeftRef.current,
      });
      navigation.navigate('ExamResult');
    } catch (err) {
      Alert.alert('Submission Error', String(err));
    }
  };
  const submitExamRef = useRef(submitExam);
  submitExamRef.current = submitExam;

  useEffect(() => {
    if (!config.timed || timeLeft === null) return;
    if (timeLeft <= 0) {
      doSubmitRef.current(true);
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // intentional: doSubmitRef and timerRef are refs; refs are guaranteed stable and
  // do not need to appear in the deps array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, config.timed]);

  // Reset timer when advancing to new question
  useEffect(() => {
    if (config.timed) {
      setTimeLeft(config.timePerQuestion);
    }
    setSubmitted(false);
    setSelectedLetters([]);
    setHotspotSelections([]);
    setLastResult(null);
  }, [currentPos, config.timed, config.timePerQuestion]);

  // Close explanation modal when navigating between questions
  useEffect(() => {
    setShowExplanation(false);
  }, [viewPos]);

  // Exam mode: global 90-min countdown — auto-submit when time runs out
  useEffect(() => {
    if (!isExam) return;
    if (examTimeLeft <= 0) {
      submitExamRef.current();
      return;
    }
    const t = setTimeout(() => setExamTimeLeft(e => e - 1), 1000);
    return () => clearTimeout(t);
    // intentional: submitExamRef is a ref, guaranteed stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examTimeLeft, isExam]);

  // Exam mode: auto-advance viewPos when a question is answered;
  // if all 65 answered, open the review modal instead of advancing past end
  useEffect(() => {
    if (!isExam) return;
    if (currentPos >= totalQuestions) {
      setShowExamReview(true);
    } else {
      setViewPos(currentPos);
    }
    // intentional: isExam and totalQuestions are derived from stable route params and
    // never change during a quiz session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPos]);

  // Exam mode: restore draft selection when navigating to a different question
  // Also unlock the Questions panel once the user reaches the last question
  useEffect(() => {
    if (!isExam) return;
    setSelectedLetters(examDraftAnswers[viewPos] ?? []);
    setHotspotSelections([]);
    if (viewPos === totalQuestions - 1) setHasReachedEnd(true);
  // intentional: isExam, totalQuestions, and examDraftAnswers are stable across the
  // exam lifecycle; reading them here always gives the current snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPos]);

  // Android back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      isExam ? setShowExamReview(true) : setShowEndModal(true);
      return true;
    });
    return () => handler.remove();
    // intentional: setShowExamReview and setShowEndModal are stable React dispatch functions
    // and do not need to be listed as dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExam]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getOptionState = (letter: string): OptionState => {
    const afterSubmit = submitted || isReviewingPast;
    if (!afterSubmit) {
      return selectedLetters.includes(letter) ? 'selected' : 'default';
    }
    if (displayQuestion?.is_hotspot) return 'default';

    // Exam mode: show only user selection (no correct/wrong colours during exam)
    if (isExam) {
      const userLetters = isReviewingPast
        ? (reviewEntry?.userLetters ?? [])
        : selectedLetters;
      return userLetters.includes(letter) ? 'selected' : 'default';
    }

    const effectiveUser = isReviewingPast
      ? (reviewEntry?.userLetters ?? [])
      : selectedLetters;

    const isCorrectOpt = correctLetters.includes(letter);
    const userChose = effectiveUser.includes(letter);

    if (isCorrectOpt && userChose) return 'correct';
    if (isCorrectOpt && !userChose) return 'missed';
    if (!isCorrectOpt && userChose) return 'wrong';
    return 'default';
  };

  const handleOptionPress = (letter: string) => {
    if (isExam) {
      // Exam mode: freely toggle selection and persist to draft
      setSelectedLetters(prev => {
        let next: string[];
        if (displayQuestion?.is_multi) {
          next = prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter];
        } else {
          // Single choice: clicking same option deselects (allows skipping)
          next = prev[0] === letter ? [] : [letter];
        }
        setExamDraftAnswers(d => ({ ...d, [viewPos]: next }));
        return next;
      });
      return;
    }
    if (submitted || isReviewingPast || displayQuestion?.is_hotspot) return;
    if (displayQuestion?.is_multi) {
      setSelectedLetters(prev =>
        prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter]
      );
    } else {
      setSelectedLetters([letter]);
    }
  };

  const handleSubmit = () => {
    if (displayQuestion?.is_hotspot) {
      doSubmit(false);
      return;
    }
    if (selectedLetters.length === 0) return;
    doSubmit(false);
  };

  const handleClear = () => {
    setSelectedLetters([]);
    setHotspotSelections([]);
  };

  const toggleFlag = () => {
    if (!displayQuestion) return;
    const qNum = displayQuestion.number;
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(qNum)) next.delete(qNum);
      else next.add(qNum);
      return next;
    });
  };

  const handleNoteOpen = () => {
    if (!displayQuestion) return;
    setNoteInput(notesMap[displayQuestion.number] ?? '');
    setShowNoteSheet(true);
  };

  const handleNoteSave = async () => {
    if (!displayQuestion) return;
    const qNum = displayQuestion.number;
    await saveNoteForQuestion(qNum, noteInput);
    setNotesMap(prev => {
      const next = { ...prev };
      if (noteInput.trim()) next[qNum] = noteInput.trim();
      else delete next[qNum];
      return next;
    });
    setShowNoteSheet(false);
  };

  const handleShareQuestion = async () => {
    if (!displayQuestion) return;
    const q = displayQuestion;
    const opts = Object.entries(q.options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, text]) => `${letter}. ${text}`)
      .join('\n');
    const multiNote = q.is_multi ? ' (Select all that apply)' : '';
    const msg =
      `AWS AI Practitioner (AIF-C01) – Question #${q.number}${multiNote}\n\n` +
      `${q.question}\n\n${opts}`;
    try { await Share.share({ message: msg }); } catch (_) {}
  };

  const handleReport = () => {
    if (!displayQuestion) return;
    setReportCategory('wrong_answer');
    setReportNote('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!displayQuestion) return;
    const report: QuestionReport = {
      questionNumber: displayQuestion.number,
      questionText: displayQuestion.question,
      category: reportCategory,
      note: reportNote.trim(),
      timestamp: new Date().toISOString(),
    };
    await addQuestionReport(report);
    setReportedSet(prev => new Set(prev).add(displayQuestion.number));
    setReportSaved(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSaved(false);
    }, 1200);
  };

  const finishQuiz = (quit: boolean) => {
    const h = historyRef.current;
    navigation.replace('Result', {
      history: h,
      total: totalQuestions,
      score: scoreRef.current,
      quit,
    });
  };

  // ── Guard: no questions ──────────────────────────────────────────────────
  if (!displayQuestion) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No questions loaded.{'\n'}Run setup.ps1 first.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFlagged = flagged.has(displayQuestion.number);
  const hasNote = !!notesMap[displayQuestion.number];
  const isReported = reportedSet.has(displayQuestion.number);
  const canGoPrev = viewPos > 0;
  const canGoNext = isExam ? viewPos < totalQuestions - 1 : viewPos < currentPos;
  const isCurrentQ = viewPos === currentPos;
  // Structured hotspot: Submit enabled only when every step has a selection
  const isStructuredHotspot =
    displayQuestion.is_hotspot &&
    displayQuestion.answer.length > 0 &&
    Object.keys(displayQuestion.options).length > 0;
  const hotspotStepCount = isStructuredHotspot
    ? displayQuestion.answer.split(',').length
    : 0;
  const canSubmit = isStructuredHotspot
    ? hotspotSelections.length === hotspotStepCount &&
      hotspotSelections.every(s => s !== '')
    : displayQuestion.is_hotspot || selectedLetters.length > 0;

  const hasSelection =
    selectedLetters.length > 0 || hotspotSelections.some(s => s !== '');

  // Feedback display — hidden entirely during exam (no mid-exam feedback)
  const showFeedback = !isExam && (submitted || isReviewingPast);
  const feedbackIsCorrect = isReviewingPast
    ? reviewEntry?.correct ?? null
    : lastResult;

  // Time display helpers
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          AWS AI Practitioner · AIF-C01
        </Text>
        <View style={styles.headerRight}>
          {config.studyMode && (
            <View style={styles.studyBadge}>
              <Text style={styles.studyBadgeText}>📖 Study</Text>
            </View>
          )}
          {isExam ? (
            <View
              style={[
                styles.timerPill,
                examTimeLeft < 600 && styles.timerWarning,
                examTimeLeft < 120 && styles.timerDanger,
              ]}
            >
              <Text style={styles.timerText}>⏱ {formatTime(examTimeLeft)}</Text>
            </View>
          ) : (
            config.timed && timeLeft !== null && (
              <View
                style={[
                  styles.timerPill,
                  timeLeft <= 30 && styles.timerWarning,
                  timeLeft <= 10 && styles.timerDanger,
                ]}
              >
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </View>
            )
          )}
        </View>
      </View>

      {/* ── Progress Bar ── */}
      <ProgressBar
        current={
          isExam
            ? Object.values(examDraftAnswers).filter(a => a.length > 0).length
            : isReviewingPast ? viewPos + 1 : currentPos + 1
        }
        total={totalQuestions}
      />

      {/* ── Question Meta Row ── */}
      <View style={styles.metaRow}>
        {/* Top line: Q counter + Score */}
        <View style={styles.metaTopRow}>
          <Text style={styles.qCounter}>
            Q {viewPos + 1}
            <Text style={styles.qCounterSub}> / {totalQuestions}</Text>
            <Text style={styles.qCounterRef}>  #{displayQuestion.number}</Text>
          </Text>
          {!isExam && (
            <Text style={styles.scoreText}>
              Score: {score}/{currentPos}
            </Text>
          )}
        </View>
        {/* Bottom line: action buttons spread equally */}
        <View style={styles.metaBtnRow}>
          <TouchableOpacity style={styles.flagBtn} onPress={toggleFlag}
            accessibilityLabel={isFlagged ? 'Unflag question' : 'Flag question'}
            accessibilityRole="button">
            <Text style={styles.flagIcon}>{isFlagged ? '🚩' : '⚑'}</Text>
            <Text style={[styles.flagLabel, isFlagged && styles.flagLabelActive]}>
              {isFlagged ? 'Flagged' : 'Flag'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.flagBtn} onPress={handleNoteOpen}
            accessibilityLabel={hasNote ? 'Edit note' : 'Add note'}
            accessibilityRole="button">
            <Text style={styles.flagIcon}>{'\u270F'}</Text>
            <Text style={[styles.flagLabel, hasNote && styles.noteLabelActive]}>
              {hasNote ? 'Noted' : 'Note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.flagBtn} onPress={handleReport}
            accessibilityLabel="Report question"
            accessibilityRole="button">
            <Text style={styles.flagIcon}>{'\u26A0'}</Text>
            <Text style={[styles.flagLabel, isReported && styles.reportLabelActive]}>
              {isReported ? 'Reported' : 'Report'}
            </Text>
          </TouchableOpacity>

          {!isExam && (
            <TouchableOpacity style={styles.flagBtn} onPress={handleShareQuestion}
              accessibilityLabel="Share question"
              accessibilityRole="button">
              <Text style={styles.flagIcon}>📤</Text>
              <Text style={styles.flagLabel}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Review banner (when looking at a past question) ── */}
      {isReviewingPast && (
        <TouchableOpacity
          style={styles.reviewBanner}
          onPress={() => setViewPos(currentPos)}
        >
          <Text style={styles.reviewBannerText}>
            📋 Review Mode · Tap to return to current question
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Main Scrollable Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question Card */}
        <View style={styles.questionCard}>
          {displayQuestion.is_hotspot && (
            <View style={[styles.typeBadge, styles.hotspotBadge]}>
              <Text style={styles.typeBadgeText}>⚡ MATCHING / ORDERING</Text>
            </View>
          )}
          {displayQuestion.is_multi && (
            <View style={[styles.typeBadge, styles.multiBadge]}>
              <Text style={styles.typeBadgeText}>☑ SELECT ALL THAT APPLY</Text>
            </View>
          )}
          <Text style={styles.questionText}>{displayQuestion.question}</Text>
        </View>

        {/* ── Options ── */}
        <View style={styles.optionsWrap}>
          {displayQuestion.is_hotspot ? (
            isStructuredHotspot ? (
              <HotspotQuestion
                key={viewPos}
                options={displayQuestion.options}
                correctOrder={displayQuestion.answer
                  .split(',')
                  .map(s => s.trim().toUpperCase())}
                itemLabels={
                  displayQuestion.items && displayQuestion.items.length > 0
                    ? displayQuestion.items
                    : undefined
                }
                selections={hotspotSelections}
                onSelectionsChange={setHotspotSelections}
                submitted={submitted}
                isReviewing={isReviewingPast}
                reviewSelections={reviewEntry?.userLetters}
              />
            ) : (
              <View style={styles.hotspotCard}>
                <Text style={styles.hotspotHint}>
                  This is a matching/ordering question. Read carefully, then
                  reveal the answer and explanation.
                </Text>
                {isCurrentQ && !submitted && (
                  <TouchableOpacity
                    style={styles.revealBtn}
                    onPress={() => doSubmit(false)}
                  >
                    <Text style={styles.revealBtnText}>Reveal Answer</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          ) : (
            Object.entries(displayQuestion.options).map(([letter, text]) => (
              <OptionButton
                key={letter}
                letter={letter}
                text={text}
                state={getOptionState(letter)}
                onPress={() => handleOptionPress(letter)}
                disabled={submitted || isReviewingPast}
                isMulti={displayQuestion.is_multi}
              />
            ))
          )}
        </View>

        {/* ── Feedback Box ── */}
        {showFeedback && (
          <View
            style={[
              styles.feedbackBox,
              feedbackIsCorrect === true
                ? styles.feedbackCorrect
                : feedbackIsCorrect === false
                ? styles.feedbackWrong
                : styles.feedbackNeutral,
            ]}
          >
            {feedbackIsCorrect === true ? (
              <Text style={[styles.feedbackTitle, { color: colors.correct }]}>
                ✓ Correct!
              </Text>
            ) : feedbackIsCorrect === false ? (
              <>
                <Text style={[styles.feedbackTitle, { color: colors.wrong }]}>
                  ✗ Wrong
                </Text>
                <Text style={styles.feedbackSub}>
                  Correct answer:{' '}
                  <Text style={styles.feedbackAnswer}>
                    {correctLetters.join(', ')}
                  </Text>
                </Text>
              </>
            ) : (
              <Text style={[styles.feedbackTitle, { color: colors.textSecondary }]}>
                📋 Hotspot question
              </Text>
            )}
          </View>
        )}

        {/* ── Explanation Button ── */}
        {showFeedback && displayQuestion.explanation && (
          <TouchableOpacity
            style={styles.explBtn}
            onPress={() => setShowExplanation(true)}
          >
            <Text style={styles.explBtnText}>📖 View Explanation</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Bottom Navigation ── */}
      <View style={styles.bottomNav}>
        {/* Previous */}
        <TouchableOpacity
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          onPress={() => setViewPos(v => v - 1)}
          disabled={!canGoPrev}
        >
          <Text style={[styles.navBtnText, !canGoPrev && styles.navBtnTextDisabled]}>
            ◀ Prev
          </Text>
        </TouchableOpacity>

        {isExam ? (
          /* ── Exam mode: Questions (center) — unlocks after reaching last question ── */
          <TouchableOpacity
            style={[styles.endBtnExam, !hasReachedEnd && styles.navBtnDisabled]}
            onPress={() => hasReachedEnd && setShowExamReview(true)}
            disabled={!hasReachedEnd}
          >
            <Text style={[styles.endBtnExamText, !hasReachedEnd && styles.navBtnTextDisabled]}>Review</Text>
          </TouchableOpacity>
        ) : (
          /* ── Practice mode: End (center) ── */
          <TouchableOpacity
            style={styles.endBtn}
            onPress={() => setShowEndModal(true)}
          >
            <Text style={styles.endBtnText}>Quit</Text>
          </TouchableOpacity>
        )}

        {isExam ? (
          /* ── Exam mode: Next only (no Submit/Clear) ── */
          <TouchableOpacity
            style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
            onPress={() => {
              const hasAnswer = (examDraftAnswers[viewPos]?.length ?? 0) > 0;
              if (!hasAnswer) {
                setShowSkipConfirm(true);
              } else {
                setViewPos(v => v + 1);
              }
            }}
            disabled={!canGoNext}
          >
            <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>
              Next ▶
            </Text>
          </TouchableOpacity>
        ) : (
          /* ── Practice mode: Clear + Submit/Next ── */
          <>
            <TouchableOpacity
              style={[styles.clearBtn, !(isCurrentQ && !submitted && hasSelection) && styles.navBtnDisabled]}
              onPress={handleClear}
              disabled={!(isCurrentQ && !submitted && hasSelection)}
            >
              <Text style={[styles.clearBtnText, !(isCurrentQ && !submitted && hasSelection) && styles.navBtnTextDisabled]}>✕ Clear</Text>
            </TouchableOpacity>

            {isCurrentQ ? (
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.navBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityLabel="Submit answer"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
              >
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
                onPress={() => {
                  const nextPos = viewPos + 1;
                  if (nextPos >= totalQuestions) {
                    finishQuiz(false);
                  } else {
                    setViewPos(nextPos);
                  }
                }}
                disabled={!canGoNext}
                accessibilityLabel={viewPos + 1 >= totalQuestions ? 'Finish quiz' : 'Next question'}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canGoNext }}
              >
                <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>
                  {viewPos + 1 >= totalQuestions ? 'Finish ✓' : 'Next ▶'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ── Explanation Modal ── */}
      <ExplanationModal
        visible={showExplanation}
        explanation={displayQuestion.explanation}
        correctAnswer={correctLetters.join(', ')}
        isCorrect={feedbackIsCorrect}
        onClose={() => setShowExplanation(false)}
      />

      {/* ── Exam Review Modal ── */}
      {showExamReview && (
        <View style={styles.examReviewOverlay}>
          <View style={styles.examReviewPanel}>
            <Text style={styles.examReviewTitle}>Review Exam</Text>

            {/* Stats summary */}
            <View style={styles.examReviewStats}>
              <Text style={[styles.examReviewStat, { color: colors.correct }]}>
                ✓ {Object.values(examDraftAnswers).filter(a => a.length > 0).length} answered
              </Text>
              <Text style={[styles.examReviewStat, { color: colors.awsOrange }]}>
                ⚑ {flagged.size} flagged
              </Text>
              <Text style={[styles.examReviewStat, { color: colors.textMuted }]}>
                ✎ {config.indices.filter(idx => idx !== undefined && !!notesMap[questions[idx]?.number]?.trim()).length} noted
              </Text>
              <Text style={[styles.examReviewStat, { color: colors.textMuted }]}>
                □ {totalQuestions - Object.values(examDraftAnswers).filter(a => a.length > 0).length} remaining
              </Text>
            </View>

            {/* Question grid */}
            <ScrollView
              style={styles.examReviewScroll}
              contentContainerStyle={styles.examReviewGrid}
              showsVerticalScrollIndicator={false}
            >
              {Array.from({ length: totalQuestions }, (_, i) => {
                const qIdx = config.indices[i];
                const q = qIdx !== undefined ? questions[qIdx] : undefined;
                const isCurrent = i === viewPos;
                const hasAnswer = (examDraftAnswers[i]?.length ?? 0) > 0;
                const isFlaggedQ = q ? flagged.has(q.number) : false;
                const hasNote = q ? !!notesMap[q.number]?.trim() : false;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.examTile,
                      isCurrent && styles.examTileCurrent,
                      hasAnswer && styles.examTileAnswered,
                      !hasAnswer && !isCurrent && styles.examTileSkipped,
                      isFlaggedQ && styles.examTileFlagged,
                    ]}
                    onPress={() => {
                      setShowExamReview(false);
                      setViewPos(i);
                    }}
                  >
                    <Text style={[styles.examTileNum, hasAnswer && styles.examTileNumLight]}>
                      {i + 1}
                    </Text>
                    {isFlaggedQ && <Text style={styles.examTileFlag}>⚑</Text>}
                    {hasNote && <Text style={styles.examTileNote}>✎</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Legend */}
            <View style={styles.examLegend}>
              <View style={[styles.legendDot, { backgroundColor: colors.awsDark }]} />
              <Text style={styles.legendText}>Answered</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.border, marginLeft: 12 }]} />
              <Text style={styles.legendText}>Skipped</Text>
              <Text style={[styles.legendText, { color: colors.awsOrange, marginLeft: 12 }]}>⚑ Flagged</Text>
              <Text style={[styles.legendText, { color: colors.textMuted, marginLeft: 12 }]}>✎ Note</Text>
            </View>

            {/* Buttons */}
            <View style={styles.examReviewBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowExamReview(false)}
              >
                <Text style={styles.modalBtnSecText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.examSubmitBtn]}
                onPress={() => setShowExamConfirm(true)}
              >
                <Text style={styles.examSubmitBtnText}>End Exam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Exam Submit Confirmation Modal ── */}
      <Modal
        visible={showExamConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExamConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Submit Exam?</Text>
            <Text style={styles.modalBody}>
              {(() => {
                const answered = Object.values(examDraftAnswers).filter(a => a.length > 0).length;
                const unanswered = totalQuestions - answered;
                return unanswered > 0
                  ? `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}.\nOnce submitted, you cannot change your answers.`
                  : 'Once submitted, you cannot change your answers.';
              })()}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowExamConfirm(false)}
              >
                <Text style={styles.modalBtnSecText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => {
                  setShowExamConfirm(false);
                  setShowExamReview(false);
                  // Direct call is safe in event handlers: the callback captures the current
                  // render's closures, so examDraftAnswers and flagged are always up to date.
                  // submitExamRef is only needed in effects where stale closures are a risk.
                  submitExam();
                }}
              >
                <Text style={styles.modalBtnDangerText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Skip Question Confirmation Modal ── */}
      <Modal
        visible={showSkipConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Skip this question?</Text>
            <Text style={styles.modalBody}>
              You haven’t answered Question {viewPos + 1}. You can come back to it later from the Review panel.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowSkipConfirm(false)}
              >
                <Text style={styles.modalBtnSecText}>Answer It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => {
                  setShowSkipConfirm(false);
                  setViewPos(v => v + 1);
                }}
              >
                <Text style={styles.modalBtnDangerText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── End Exam Confirmation Modal ── */}
      <Modal
        visible={showEndModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>End Exam?</Text>
            <Text style={styles.modalBody}>
              You've answered{' '}
              <Text style={styles.modalBold}>{currentPos}</Text> of{' '}
              <Text style={styles.modalBold}>{totalQuestions}</Text> questions.
              {'\n'}Your score will be shown.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowEndModal(false)}
              >
                <Text style={styles.modalBtnSecText}>Keep Going</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => {
                  setShowEndModal(false);
                  finishQuiz(true);
                }}
              >
                <Text style={styles.modalBtnDangerText}>End Exam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Note Bottom Sheet ── */}
      <Modal
        visible={showNoteSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteSheet(false)}
      >
        <KeyboardAvoidingView
          style={styles.noteSheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowNoteSheet(false)}
          />
          <View style={styles.noteSheet}>
            <Text style={styles.noteSheetTitle}>
              {'\u270F Note for Q'}{displayQuestion.number}
            </Text>
            <TextInput
              style={styles.noteInput}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="Add your study note here..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.noteSheetBtns}>
              <TouchableOpacity
                style={styles.noteSheetClear}
                onPress={() => setNoteInput('')}
              >
                <Text style={styles.noteSheetClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteSheetCancel}
                onPress={() => setShowNoteSheet(false)}
              >
                <Text style={styles.noteSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteSheetSave}
                onPress={handleNoteSave}
              >
                <Text style={styles.noteSheetSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Report Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.noteSheetOverlay}
        >
          <View style={styles.noteSheet}>
            <Text style={styles.noteSheetTitle}>Report Question</Text>
            {(['wrong_answer', 'typo', 'unclear', 'other'] as QuestionReport['category'][]).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.reportCatBtn, reportCategory === cat && styles.reportCatBtnActive]}
                onPress={() => setReportCategory(cat)}
              >
                <Text style={[styles.reportCatText, reportCategory === cat && styles.reportCatTextActive]}>
                  {cat === 'wrong_answer' ? 'Wrong Answer' : cat === 'typo' ? 'Typo / Spelling' : cat === 'unclear' ? 'Unclear / Confusing' : 'Other'}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.noteInput}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textMuted}
              value={reportNote}
              onChangeText={setReportNote}
              multiline
              maxLength={300}
              editable={!reportSaved}
            />
            {reportSaved && (
              <Text style={styles.reportSavedMsg}>✓ Report saved</Text>
            )}
            <View style={styles.noteSheetBtns}>
              <TouchableOpacity
                style={styles.noteSheetCancel}
                onPress={() => setShowReportModal(false)}
                disabled={reportSaved}
              >
                <Text style={styles.noteSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteSheetSave, reportSaved && { opacity: 0.5 }]}
                onPress={handleSubmitReport}
                disabled={reportSaved}
              >
                <Text style={styles.noteSheetSaveText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.awsDark },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.awsDark,
    borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.awsDark,
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.3,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  studyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.btnSecondary,
    borderRadius: 12,
  },
  studyBadgeText: { color: colors.btnSecondaryText, fontWeight: '700', fontSize: 11 },
  timerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    marginLeft: 8,
  },
  timerWarning: { backgroundColor: colors.awsOrange },
  timerDanger: { backgroundColor: colors.btnDanger },
  timerText: { color: colors.textLight, fontWeight: '700', fontSize: 14 },

  metaRow: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qCounter: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  qCounterSub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  qCounterRef: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
  },
  flagBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  flagIcon: { fontSize: 15 },
  flagLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  flagLabelActive: { color: colors.wrong },
  noteLabelActive: { color: colors.btnSecondary },
  reportLabelActive: { color: colors.btnDanger },

  noteSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  noteSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  noteSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 110,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteSheetBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  noteSheetClear: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: cssVal('auto'),
  },
  noteSheetClearText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  noteSheetCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteSheetCancelText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  noteSheetSave: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.btnSecondary,
  },
  noteSheetSaveText: { color: colors.btnSecondaryText, fontSize: 13, fontWeight: '700' },

  reportCatBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  reportCatBtnActive: {
    borderColor: colors.btnSecondary,
    backgroundColor: colors.btnSecondary + '20',
  },
  reportCatText: { color: colors.textSecondary, fontSize: 13 },
  reportCatTextActive: { color: colors.btnSecondary, fontWeight: '600' },
  reportSavedMsg: {
    color: colors.correct,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
  },

  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    minWidth: 70,
    textAlign: 'right',
  },

  reviewBanner: {
    backgroundColor: colors.awsDark,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  reviewBannerText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16 },

  questionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    ...shadow('#000', 2, 0.07, 6),
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: colors.awsOrange,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  hotspotBadge: { backgroundColor: colors.awsOrange + '20' },
  multiBadge: { backgroundColor: colors.btnSecondary + '20' },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  questionText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 26,
    fontWeight: '400',
  },

  optionsWrap: { marginBottom: 8 },

  hotspotCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.awsOrange + '60',
    marginBottom: 10,
  },
  hotspotHint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  revealBtn: {
    backgroundColor: colors.awsOrange,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  revealBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  feedbackBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  feedbackCorrect: {
    backgroundColor: colors.correctBg,
    borderColor: colors.correctBorder,
  },
  feedbackWrong: {
    backgroundColor: colors.wrongBg,
    borderColor: colors.wrongBorder,
  },
  feedbackNeutral: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  feedbackAnswer: {
    fontWeight: '700',
    color: colors.correct,
  },

  explBtn: {
    backgroundColor: colors.awsDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  explBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 15,
  },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    ...shadow('#000', 2, 0.08, 4),
    elevation: 2,
  },
  navBtnDisabled: {
    borderColor: colors.btnDisabled,
    backgroundColor: colors.background,
    ...noShadow(),
    elevation: 0,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  navBtnTextDisabled: { color: colors.btnDisabledText },

  endBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    ...shadow('#000', 2, 0.08, 4),
    elevation: 2,
  },
  endBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    ...shadow('#000', 2, 0.08, 4),
    elevation: 2,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  submitBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.awsOrange,
    alignItems: 'center',
    ...shadow(colors.awsOrange, 3, 0.3, 6),
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    ...shadow('#000', 8, 0.2, 16),
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  modalBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalBtnSecText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalBtnDanger: {
    backgroundColor: colors.wrong,
  },
  modalBtnDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Exam mode: "Review & Submit" End button ──────────────────────────────
  endBtnExam: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.awsOrange,
    alignItems: 'center',
    ...shadow(colors.awsOrange, 3, 0.3, 6),
    elevation: 4,
  },
  endBtnExamText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Exam Review Modal ────────────────────────────────────────────────────
  examReviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  examReviewPanel: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  examReviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  examReviewStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  examReviewStat: {
    fontSize: 12,
    fontWeight: '700',
  },
  examReviewScroll: {
    maxHeight: 260,
  },
  examReviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 8,
  },
  examTile: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examTileCurrent: {
    borderColor: colors.awsOrange,
    borderWidth: 2,
  },
  examTileAnswered: {
    backgroundColor: colors.awsDark,
    borderColor: colors.awsDark,
  },
  examTileSkipped: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    opacity: 0.5,
  },
  examTileFlagged: {
    borderColor: colors.awsOrange,
    borderWidth: 2,
  },
  examTileFuture: {
    opacity: 0.25,
  },
  examTileNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  examTileNumLight: {
    color: '#fff',
  },
  examTileFlag: {
    position: 'absolute',
    top: 1,
    right: 2,
    fontSize: 8,
  },
  examTileNote: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    fontSize: 8,
    color: colors.textMuted,
  },
  examLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  examReviewBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  examSubmitBtn: {
    backgroundColor: colors.awsOrange,
  },
  examSubmitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
