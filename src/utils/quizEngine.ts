import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question, QuizConfig } from '../constants/types';
import { getMasteredQuestions } from './storage';
import { getDueQuestions } from './spacedRepetition';

// Import the bundled questions JSON (copied by setup.ps1)
let _questions: Question[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _questions = require('../data/questions.json') as Question[];
} catch {
  _questions = [];
}
// Runtime guard: filter out any entries missing required fields to prevent
// deep-runtime errors (e.g. Object.entries(undefined) or q.answer.split on null)
_questions = _questions.filter(
  q =>
    typeof q.number === 'number' &&
    typeof q.question === 'string' &&
    q.options !== null &&
    typeof q.options === 'object' &&
    !Array.isArray(q.options) &&
    (typeof q.answer === 'string' || (Array.isArray(q.answer) && (q.answer as unknown[]).every(a => typeof a === 'string'))) &&
    typeof q.is_multi === 'boolean' &&
    typeof q.is_hotspot === 'boolean' &&
    typeof q.explanation === 'string'
);

export const getAllQuestions = (): Question[] => _questions;

export const getTotalCount = (): number => _questions.length;

// ── Domain detection ─────────────────────────────────────────────────────────
// Returns 1-5 based on AIF-C01 domain structure.
// Checked highest-to-lowest so more specific domains win.
const D5 = /security|compliance|governance|encryption|IAM|audit|access.?control|data.?privac|guardrail|credential|permission|vpc|logging/i;
const D4 = /responsible.?ai|bias|fairness|explainab|transparent|accountab|human.?oversight|toxic|hallucin|ethic|safety/i;
const D3 = /\bBedrock\b|Amazon\s*Q\b|Claude|Titan|Jurassic|Stable.?Diffusion|JumpStart|Agents.?for|Knowledge.?Base|inference.?profile|model.?invocation|invoke.?model/i;
const D2 = /generative.?ai|foundation.?model|large.?language.?model|\bLLM\b|prompt.?engineer|retrieval.?augmented|\bRAG\b|fine.?tun|diffusion.?model|\btoken|embedding|temperature|top.?p|in.?context.?learn/i;

function getDomain(q: Question): 1 | 2 | 3 | 4 | 5 {
  const text = q.question + ' ' + q.explanation;
  if (D5.test(text)) return 5;
  if (D4.test(text)) return 4;
  if (D3.test(text)) return 3;
  if (D2.test(text)) return 2;
  return 1;
}

// Pre-compute domain for every question once at load time
const _domainMap = new Map<number, 1 | 2 | 3 | 4 | 5>();
export function getDomainForIndex(idx: number): 1 | 2 | 3 | 4 | 5 {
  if (_domainMap.has(idx)) return _domainMap.get(idx)!;
  const d = getDomain(_questions[idx]);
  _domainMap.set(idx, d);
  return d;
}

export function getDomainCounts(): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  _questions.forEach((_, i) => {
    const d = getDomainForIndex(i);
    counts[d] = (counts[d] ?? 0) + 1;
  });
  return counts;
}

/**
 * Build a randomised or ordered list of question indices based on config.
 * For 'random_unseen', pass the seen set fetched from storage.
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function buildIndices(
  config: Omit<QuizConfig, 'indices'>
): Promise<number[]> {
  const questions = getAllQuestions();
  if (questions.length === 0) return [];

  // Filter by range
  let pool = questions.reduce<number[]>((acc, q, i) => {
    if (q.number >= config.fromQ && q.number <= config.toQ) {
      acc.push(i);
    }
    return acc;
  }, []);

  // Filter by question type
  if (config.questionType === 'mc') {
    pool = pool.filter(i => !questions[i].is_hotspot);
  } else if (config.questionType === 'hotspot') {
    pool = pool.filter(i => questions[i].is_hotspot);
  }

  // Filter by domain
  if (config.domain !== 0) {
    pool = pool.filter(i => getDomainForIndex(i) === config.domain);
  }

  // Weak mode: exclude mastered questions
  if (config.mode === 'weak') {
    const mastered = await getMasteredQuestions();
    const masteredSet = new Set(mastered);
    const weak = pool.filter(i => !masteredSet.has(questions[i].number));
    // Fall back to full pool if everything is mastered
    pool = weak.length > 0 ? weak : pool;
  }

  // Spaced repetition mode: prioritise due questions
  if (config.mode === 'spaced') {
    const allNumbers = pool.map(i => questions[i].number);
    const count2 = Math.min(config.count, pool.length);
    const dueNumbers = await getDueQuestions(allNumbers, count2);
    const numberToIndex = new Map(pool.map(i => [questions[i].number, i]));
    const dueIndices = dueNumbers.map(n => numberToIndex.get(n)).filter((i): i is number => i !== undefined);
    return dueIndices.slice(0, count2);
  }

  const count = Math.min(config.count, pool.length);

  if (config.mode === 'sequential') {
    return pool.slice(0, count);
  }
  return shuffle(pool).slice(0, count);
}

export function parseCorrectLetters(answer: string | string[], isMulti: boolean): string[] {
  if (Array.isArray(answer)) return answer.map(s => String(s).toUpperCase().trim()).filter(Boolean);
  if (typeof answer !== 'string') return [];
  if (isMulti) {
    return answer
      .toUpperCase()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [answer.toUpperCase().trim()];
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')       // bold
    .replace(/\*(.*?)\*/g, '$1')           // italic
    .replace(/#{1,6}\s/g, '')             // headings
    .replace(/`(.*?)`/g, '$1')            // inline code
    .replace(/^[-*+]\s+/gm, '\u2022 ')   // unordered list items
    .replace(/^\d+\.\s+/gm, '')          // ordered list numbers
    .replace(/^>\s*/gm, '')              // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links → text
    .replace(/---+/g, '')                // horizontal rules
    .trim();
}

/** Domain weights per the AWS AIF-C01 exam guide (total = 65 questions) */
export const EXAM_DOMAIN_COUNTS: Record<number, number> = { 1: 13, 2: 16, 3: 18, 4: 9, 5: 9 };
export const EXAM_DOMAIN_PCT: Record<number, number>    = { 1: 20, 2: 24, 3: 28, 4: 14, 5: 14 };
/** Total questions in an exam simulation — derived from the sum of all domain counts */
export const EXAM_TOTAL_QS: number = Object.values(EXAM_DOMAIN_COUNTS).reduce((a, b) => a + b, 0);

const EXAM_USED_KEY = 'examUsedIndices';

async function loadUsedExamIndices(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(EXAM_USED_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch { return new Set(); }
}

async function saveUsedExamIndices(used: Set<number>): Promise<void> {
  try { await AsyncStorage.setItem(EXAM_USED_KEY, JSON.stringify([...used])); } catch {}
}

/**
 * Build a domain-weighted list of 65 question indices for exam simulation.
 * Randomly samples within each domain to match AIF-C01 exam guide percentages.
 */
export async function buildExamQuestions(): Promise<number[]> {
  const used = await loadUsedExamIndices();

  const byDomain = new Map<number, number[]>([[1, []], [2, []], [3, []], [4, []], [5, []]]);
  _questions.forEach((_, i) => {
    const d = getDomainForIndex(i);
    byDomain.get(d)!.push(i);
  });

  const result: number[] = [];
  ([1, 2, 3, 4, 5] as const).forEach(d => {
    const pool = byDomain.get(d) ?? [];
    const needed = Math.min(EXAM_DOMAIN_COUNTS[d], pool.length);
    // Prefer questions not yet seen; fall back to seen ones if pool is exhausted
    const unseen = shuffle(pool.filter(i => !used.has(i)));
    const seen   = shuffle(pool.filter(i =>  used.has(i)));
    const picked = unseen.slice(0, needed);
    if (picked.length < needed) picked.push(...seen.slice(0, needed - picked.length));
    result.push(...picked);
  });

  const shuffled = shuffle(result);

  // Persist used indices; reset the whole set once every question has been seen
  shuffled.forEach(i => used.add(i));
  if (used.size >= _questions.length) used.clear();
  await saveUsedExamIndices(used);

  return shuffled;
}

/** Returns how many distinct questions have been seen across all past exams. */
export async function getExamSeenCount(): Promise<number> {
  const used = await loadUsedExamIndices();
  return used.size;
}

/** Clears the exam question rotation history so the next exam starts fully fresh. */
export async function resetExamHistory(): Promise<void> {
  await saveUsedExamIndices(new Set());
}

// ── OTA Question Bank Updates ─────────────────────────────────────────────────

const OTA_QUESTIONS_KEY = 'ota_questions_cache';
const OTA_ETAG_KEY      = 'ota_questions_etag';
// Set OTA_ENABLED to true and replace OTA_QUESTIONS_URL with a real hosted URL to enable OTA updates.
const OTA_ENABLED = false;
const OTA_QUESTIONS_URL = 'https://raw.githubusercontent.com/sudes16/AppStore/main/questions.json';

function isValidQuestion(q: unknown): q is Question {
  if (!q || typeof q !== 'object') return false;
  const o = q as Record<string, unknown>;
  return (
    typeof o.number === 'number' &&
    typeof o.question === 'string' &&
    o.options !== null &&
    typeof o.options === 'object' &&
    !Array.isArray(o.options) &&
    (typeof o.answer === 'string' || (Array.isArray(o.answer) && (o.answer as unknown[]).every(a => typeof a === 'string'))) &&
    typeof o.is_multi === 'boolean' &&
    typeof o.is_hotspot === 'boolean' &&
    typeof o.explanation === 'string'
  );
}

/**
 * Attempts to fetch an updated question bank from OTA_QUESTIONS_URL.
 * On success, merges remote questions into the in-memory set (remote wins on conflict by number).
 * Uses ETag to avoid re-downloading unchanged content.
 * Silently no-ops on any error so the app always works offline.
 * Returns true if questions were updated, false otherwise.
 */
export async function fetchRemoteQuestions(): Promise<boolean> {
  if (!OTA_ENABLED) return false;
  try {
    const savedEtag = await AsyncStorage.getItem(OTA_ETAG_KEY);
    const headers: Record<string, string> = {};
    if (savedEtag) headers['If-None-Match'] = savedEtag;

    const response = await fetch(OTA_QUESTIONS_URL, { headers });
    if (response.status === 304) return false; // not modified
    if (!response.ok) return false;

    const newEtag = response.headers.get('ETag');
    const json: unknown = await response.json();
    if (!Array.isArray(json)) return false;

    const remoteQuestions = (json as unknown[]).filter(isValidQuestion);
    if (remoteQuestions.length === 0) return false;

    // Merge: remote questions override bundled ones with the same number
    const map = new Map<number, Question>();
    for (const q of _questions) map.set(q.number, q);
    for (const q of remoteQuestions) map.set(q.number, q);
    _questions = Array.from(map.values()).sort((a, b) => a.number - b.number);

    // Rebuild domain map (keyed by array index, matching getDomainForIndex)
    _domainMap.clear();
    _questions.forEach((q, i) => _domainMap.set(i, getDomain(q)));

    // Persist for next launch
    await AsyncStorage.setItem(OTA_QUESTIONS_KEY, JSON.stringify(remoteQuestions));
    if (newEtag) await AsyncStorage.setItem(OTA_ETAG_KEY, newEtag);

    return true;
  } catch {
    return false;
  }
}

/**
 * Loads previously cached OTA questions at startup (no network needed).
 * Call this once on app launch before calling getAllQuestions.
 */
export async function loadCachedOtaQuestions(): Promise<void> {
  if (!OTA_ENABLED) return;
  try {
    const raw = await AsyncStorage.getItem(OTA_QUESTIONS_KEY);
    if (!raw) return;
    const cached: unknown = JSON.parse(raw);
    if (!Array.isArray(cached)) return;
    const remoteQuestions = (cached as unknown[]).filter(isValidQuestion);
    if (remoteQuestions.length === 0) return;
    const map = new Map<number, Question>();
    for (const q of _questions) map.set(q.number, q);
    for (const q of remoteQuestions) map.set(q.number, q);
    _questions = Array.from(map.values()).sort((a, b) => a.number - b.number);
    // Rebuild domain map (keyed by array index, matching getDomainForIndex)
    _domainMap.clear();
    _questions.forEach((q, i) => _domainMap.set(i, getDomain(q)));
  } catch {
    // silently fail
  }
}
