import AsyncStorage from '@react-native-async-storage/async-storage';

const SR_KEY = 'spaced_repetition_records';

export interface SRRecord {
  questionNumber: number;
  interval: number;    // days until next review
  repetition: number;  // number of successful reviews in a row
  efactor: number;     // easiness factor (>= 1.3)
  nextReview: string;  // ISO date string
}

// ── SM-2 Algorithm ────────────────────────────────────────────────────────────
// quality: 0-5 (0=complete blackout, 5=perfect recall)
function sm2(record: SRRecord, quality: number): SRRecord {
  const q = Math.max(0, Math.min(5, quality));
  let { interval, repetition, efactor } = record;

  if (q >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else {
    // Incorrect — reset
    repetition = 0;
    interval = 1;
  }

  // Update efactor
  efactor = Math.max(1.3, efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    questionNumber: record.questionNumber,
    interval,
    repetition,
    efactor,
    nextReview: nextReview.toISOString(),
  };
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function loadAllRecords(): Promise<Map<number, SRRecord>> {
  try {
    const raw = await AsyncStorage.getItem(SR_KEY);
    if (!raw) return new Map();
    const arr: SRRecord[] = JSON.parse(raw);
    return new Map(arr.map(r => [r.questionNumber, r]));
  } catch {
    return new Map();
  }
}

async function saveAllRecords(map: Map<number, SRRecord>): Promise<void> {
  try {
    await AsyncStorage.setItem(SR_KEY, JSON.stringify(Array.from(map.values())));
  } catch {
    // silently fail
  }
}

/**
 * Record a quiz answer for spaced repetition.
 * quality: 5 = correct on first try, 3 = correct with hesitation, 0-2 = wrong
 */
export async function updateSRRecord(questionNumber: number, quality: number): Promise<void> {
  const records = await loadAllRecords();
  const existing = records.get(questionNumber) ?? {
    questionNumber,
    interval: 1,
    repetition: 0,
    efactor: 2.5,
    nextReview: new Date().toISOString(),
  };
  const updated = sm2(existing, quality);
  records.set(questionNumber, updated);
  await saveAllRecords(records);
}

/**
 * Returns question numbers due for review today (nextReview <= now).
 * If fewer than `count` are due, pads with new/unseen questions from allNumbers.
 */
export async function getDueQuestions(allNumbers: number[], count: number): Promise<number[]> {
  const records = await loadAllRecords();
  const now = new Date();

  const due: number[] = [];
  const unseen: number[] = [];

  for (const n of allNumbers) {
    const r = records.get(n);
    if (!r) {
      unseen.push(n);
    } else if (new Date(r.nextReview) <= now) {
      due.push(n);
    }
  }

  // Shuffle due and unseen
  const shuffle = <T,>(arr: T[]) => arr.sort(() => Math.random() - 0.5);
  shuffle(due);
  shuffle(unseen);

  const result = [...due, ...unseen].slice(0, count);
  return result;
}

/** Returns the number of questions currently tracked by spaced repetition. */
export async function getSRRecordCount(): Promise<number> {
  const records = await loadAllRecords();
  return records.size;
}

/** Clears all SR data. */
export async function resetSRData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SR_KEY);
  } catch {
    // silently fail
  }
}
