import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@aws_quiz_profile';

export interface UserProfile {
  name: string;
  /** ISO date string: YYYY-MM-DD */
  examDate: string;
}

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    throw new Error('Failed to save your profile. Please try again.');
  }
}

/** Returns days remaining until exam. Negative = past. 0 = today. */
export function getDaysLeft(examDate: string): number {
  const exam = new Date(examDate);
  const today = new Date();
  exam.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validates user-provided name and date fields, then constructs a UserProfile.
 * Returns the validated UserProfile on success, or an error message string on failure.
 */
export function validateProfileInputs(
  name: string,
  month: string,
  day: string,
  year: string,
): UserProfile | string {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Please enter your name.';
  const m = parseInt(month, 10);
  const d = parseInt(day,   10);
  const y = parseInt(year,  10);
  if (!month || !day || !year || isNaN(m) || isNaN(d) || isNaN(y)
    || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return 'Please enter a valid exam date.';
  }
  const examDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Reject impossible calendar dates (e.g. Feb 30) by checking for JS Date rollover
  const dateObj = new Date(examDate + 'T00:00:00');
  if (dateObj.getMonth() + 1 !== m || dateObj.getDate() !== d) {
    return 'Please enter a valid exam date.';
  }
  // Reject past dates — countdown only makes sense for a future exam
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return 'Exam date cannot be in the past. Please enter a future date.';
  }
  return { name: trimmedName, examDate };
}

// ─── Post-exam check-in prompt ───────────────────────────────────────────────
const POST_EXAM_PREFIX = '@aws_quiz_post_exam_';

/**
 * Returns null (never shown), 'dismissed' (permanent), or a Unix timestamp
 * after which the prompt should re-appear ("ask me later").
 */
export async function getPostExamPromptState(
  examDate: string,
): Promise<'dismissed' | number | null> {
  try {
    const raw = await AsyncStorage.getItem(POST_EXAM_PREFIX + examDate);
    if (!raw) return null;
    if (raw === 'dismissed') return 'dismissed';
    return parseInt(raw, 10) || null;
  } catch {
    return null;
  }
}

/** Permanently suppress the prompt for this exam date (passed or rescheduled). */
export async function setPostExamPromptDismissed(examDate: string): Promise<void> {
  try { await AsyncStorage.setItem(POST_EXAM_PREFIX + examDate, 'dismissed'); } catch {}
}

/** Re-show the prompt after 2 days (user hasn't received results yet). */
export async function setPostExamPromptLater(examDate: string): Promise<void> {
  try {
    const later = Date.now() + 2 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(POST_EXAM_PREFIX + examDate, String(later));
  } catch {}
}
