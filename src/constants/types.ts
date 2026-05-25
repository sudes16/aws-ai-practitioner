export interface Question {
  number: number;
  question: string;
  /** Scenario / item descriptions for matching-style hotspot questions.
   *  If present, each entry is the left-hand "item" for the corresponding answer row.
   *  Absent (or empty) for ordering-style hotspot questions → rows labeled "Step N". */
  items?: string[];
  options: Record<string, string>;
  answer: string; // "B" or "A,C" for multi-select
  is_multi: boolean;
  is_hotspot: boolean;
  explanation: string;
}

export interface HistoryEntry {
  questionNumber: number;
  questionIndex: number; // index into the main questions array
  userLetters: string[];
  correctLetters: string[];
  correct: boolean | null; // null for hotspot
  isHotspot: boolean;
  flagged: boolean;
}

export type QuizMode = 'sequential' | 'random' | 'weak' | 'spaced';

/** 0 = all domains, 1–5 = specific AIF-C01 domain */
export type DomainFilter = 0 | 1 | 2 | 3 | 4 | 5;

/** AWS AI Practitioner passing percentage threshold */
export const PASS_THRESHOLD_PCT = 70;

export const DOMAIN_LABELS: Record<number, string> = {
  0: 'All Domains',
  1: 'AI/ML Fundamentals',
  2: 'Generative AI Basics',
  3: 'Foundation Model Apps',
  4: 'Responsible AI',
  5: 'Security & Governance',
};

export interface QuizConfig {
  mode: QuizMode;
  fromQ: number;
  toQ: number;
  count: number;
  timed: boolean;
  timePerQuestion: number; // seconds per question
  indices: number[]; // pre-built ordered question indices
  /** Filter by question type */
  questionType: 'all' | 'mc' | 'hotspot';
  /** Filter by AIF-C01 domain (0 = all) */
  domain: DomainFilter;
  /** Study mode: show explanation automatically after each answer */
  studyMode: boolean;
  /** Exam simulation: 65 Qs, domain-weighted, 90-min total timer, no mid-exam feedback */
  isExam?: boolean;
  /** Total exam duration in seconds (default 5400 = 90 min) */
  examTotalSeconds?: number;
}

export type RootStackParamList = {
  Onboarding: { replay?: boolean } | undefined;
  Home: undefined;
  Quiz: { config: QuizConfig };
  Result: {
    history: HistoryEntry[];
    total: number;
    score: number;
    quit: boolean;
  };
  Review: {
    history: HistoryEntry[];
    /** Pre-select a filter tab on open */
    initialFilter?: 'all' | 'correct' | 'wrong' | 'flagged';
    /** Session context shown in the header (passed from SessionHistoryScreen) */
    date?: string;
    mode?: string;
    total?: number;
    pct?: number;
    quit?: boolean;
  };
  PrivacyPolicy: undefined;
  Help: undefined;
  Settings: undefined;
  Analytics: undefined;
  SessionHistory: undefined;
  ExamResult: undefined;
  Reports: undefined;
};

export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'missed';
