import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryEntry } from '../constants/types';

const MASTERED_KEY = 'aws_quiz_mastered_questions';

// ── Insights cache invalidation ────────────────────────────────────────────
// Bumped by any write that affects InsightsScreen's three data sources.
// InsightsScreen reads this to decide whether its in-memory cache is stale.
let insightsDataVersion = 0;
export const getInsightsDataVersion = (): number => insightsDataVersion;
const bumpInsightsVersion = () => { insightsDataVersion++; };

// ── Mastered questions (answered correctly at least once) ──────────────────

export const getMasteredQuestions = async (): Promise<number[]> => {
  try {
    const raw = await AsyncStorage.getItem(MASTERED_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
};

export const addMasteredQuestions = async (numbers: number[]): Promise<void> => {
  try {
    const existing = await getMasteredQuestions();
    const merged = Array.from(new Set([...existing, ...numbers]));
    await AsyncStorage.setItem(MASTERED_KEY, JSON.stringify(merged));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

export const removeMasteredQuestions = async (numbers: number[]): Promise<void> => {
  try {
    const existing = await getMasteredQuestions();
    const set = new Set(existing);
    numbers.forEach(n => set.delete(n));
    await AsyncStorage.setItem(MASTERED_KEY, JSON.stringify(Array.from(set)));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

export const getMasteredCount = async (): Promise<number> => {
  const m = await getMasteredQuestions();
  return m.length;
};

export const resetMasteredQuestions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MASTERED_KEY);
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

// ── Question reports ───────────────────────────────────────────────────────

const REPORTS_KEY = 'quiz_reports';
const MAX_REPORTS = 100;

export interface QuestionReport {
  questionNumber: number;
  questionText: string;
  category: 'wrong_answer' | 'typo' | 'unclear' | 'other';
  note: string;
  timestamp: string;
}

export const addQuestionReport = async (report: QuestionReport): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(REPORTS_KEY);
    const existing: QuestionReport[] = raw ? JSON.parse(raw) : [];
    existing.push(report);
    if (existing.length > MAX_REPORTS) existing.splice(0, existing.length - MAX_REPORTS);
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(existing));
  } catch {
    // silently fail
  }
};

export const getQuestionReports = async (): Promise<QuestionReport[]> => {
  try {
    const raw = await AsyncStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const deleteQuestionReport = async (timestamp: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(REPORTS_KEY);
    const existing: QuestionReport[] = raw ? JSON.parse(raw) : [];
    const updated = existing.filter(r => r.timestamp !== timestamp);
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  } catch {
    // silently fail
  }
};

// ── Score History ──────────────────────────────────────────────────────────

const SCORE_HISTORY_KEY = 'quiz_score_history';
const MAX_SCORE_HISTORY = 365;

export interface ScoreSession {
  date: string;
  mode: string;
  domain: number;
  questionCount: number;
  /** How many questions the user actually answered (≤ questionCount; equal unless they quit early) */
  answeredCount?: number;
  score: number;
  pct: number;
  quit: boolean;
  /** Per-domain breakdown: key = domain 1–5, value = { c: correct, t: total } */
  domainBreakdown?: Record<number, { c: number; t: number }>;
}

export const addScoreSession = async (session: ScoreSession): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(SCORE_HISTORY_KEY);
    const existing: ScoreSession[] = raw ? JSON.parse(raw) : [];
    existing.unshift(session);
    if (existing.length > MAX_SCORE_HISTORY) existing.length = MAX_SCORE_HISTORY;
    await AsyncStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(existing));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

export const getScoreHistory = async (): Promise<ScoreSession[]> => {
  try {
    const raw = await AsyncStorage.getItem(SCORE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearScoreHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCORE_HISTORY_KEY);
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

export const removeScoreSession = async (dateIso: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(SCORE_HISTORY_KEY);
    if (!raw) return;
    const existing: ScoreSession[] = JSON.parse(raw);
    const next = existing.filter(s => s.date !== dateIso);
    if (next.length === existing.length) return;
    await AsyncStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(next));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

// ── Session Records (full history for post-session review) ─────────────────

const SESSION_RECORDS_KEY = 'quiz_session_records';
const MAX_SESSION_RECORDS = 25;

export interface SessionRecord {
  id: string;
  date: string;
  mode: 'practice' | 'exam';
  questionCount: number;
  score: number;
  pct: number;
  quit: boolean;
  elapsedSeconds?: number;
  history: HistoryEntry[];
}

export const saveSessionRecord = async (record: SessionRecord): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_RECORDS_KEY);
    const existing: SessionRecord[] = raw ? JSON.parse(raw) : [];
    existing.unshift(record);
    if (existing.length > MAX_SESSION_RECORDS) existing.length = MAX_SESSION_RECORDS;
    await AsyncStorage.setItem(SESSION_RECORDS_KEY, JSON.stringify(existing));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

export const getSessionRecords = async (): Promise<SessionRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearSessionRecords = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SESSION_RECORDS_KEY);
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

/** Remove a single SessionRecord by matching ScoreSession.date within a 5-second window. */
export const removeSessionRecordByDate = async (dateIso: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_RECORDS_KEY);
    if (!raw) return;
    const existing: SessionRecord[] = JSON.parse(raw);
    const target = new Date(dateIso).getTime();
    const next = existing.filter(r => Math.abs(new Date(r.date).getTime() - target) >= 5000);
    if (next.length === existing.length) return;
    await AsyncStorage.setItem(SESSION_RECORDS_KEY, JSON.stringify(next));
    bumpInsightsVersion();
  } catch {
    // silently fail
  }
};

// ── History screen view preferences (sort/filter/domain) ───────────────────

const HISTORY_PREFS_KEY = 'history_view_prefs_v1';

export interface HistoryViewPrefs {
  sortKey: string;
  filterKey: string;
  domainKey: number;
  rangeKey?: string;
}

export const getHistoryPrefs = async (): Promise<HistoryViewPrefs | null> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setHistoryPrefs = async (prefs: HistoryViewPrefs): Promise<void> => {
  try {
    await AsyncStorage.setItem(HISTORY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // silently fail
  }
};
