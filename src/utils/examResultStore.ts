/**
 * Module-level store for exam results.
 *
 * React Navigation on Expo Web serialises route params into the URL, so passing
 * a large history array as navigation params silently fails (URL too long).
 * Instead we write results here before navigating and read them in ExamResultScreen.
 */
import { HistoryEntry } from '../constants/types';

export interface ExamResultData {
  history: HistoryEntry[];
  totalSeconds: number;
  elapsedSeconds: number;
}

let _pending: ExamResultData | null = null;

export function setExamResult(data: ExamResultData): void {
  _pending = data;
}

export function getExamResult(): ExamResultData | null {
  return _pending;
}

export function clearExamResult(): void {
  _pending = null;
}
