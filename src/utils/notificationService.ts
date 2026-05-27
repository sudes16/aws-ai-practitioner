import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy-import expo-notifications only on native (not web)
let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  // Register handler once at module init — must happen before any scheduling
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
}

const STORAGE_KEY = 'studyReminder';
const NOTIFICATION_ID_KEY = 'studyReminderNotifIds';

// expo-notifications weekday: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
export const DAY_LABELS: Record<number, string> = {
  1: 'Su', 2: 'M', 3: 'Tu', 4: 'W', 5: 'Th', 6: 'F', 7: 'Sa',
};
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export interface ReminderSettings {
  enabled: boolean;
  hour: number;      // 0–23
  minute: number;
  days: number[];    // subset of ALL_DAYS
  repeating: boolean;
}

export const DEFAULT_REMINDER_MINUTE = 0;

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 19,
  minute: DEFAULT_REMINDER_MINUTE,
  days: [2, 3, 4, 5, 6], // Mon–Fri
  repeating: true,
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getNextWeekdayDate(weekday: number, hour: number, minute: number): Date {
  // expo weekday 1=Sun..7=Sat  →  JS getDay() 0=Sun..6=Sat
  const jsDay = weekday - 1;
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  const diff = (jsDay - now.getDay() + 7) % 7;
  if (diff === 0 && result <= now) {
    result.setDate(result.getDate() + 7);
  } else {
    result.setDate(result.getDate() + diff);
  }
  return result;
}

export async function scheduleReminder(
  hour: number,
  minute: number,
  days: number[],
  repeating: boolean,
): Promise<void> {
  if (!Notifications || days.length === 0) return;

  await cancelReminder();

  const content = {
    title: '📚 Time to Study!',
    body: "Don't forget your AWS AI Practitioner prep. Keep the streak going!",
    sound: true as const,
  };

  const ids: string[] = [];
  for (const weekday of days) {
    let id: string;
    if (repeating) {
      id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: { weekday, hour, minute, repeats: true },
      });
    } else {
      id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: getNextWeekdayDate(weekday, hour, minute),
      });
    }
    ids.push(id);
  }

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, JSON.stringify(ids));
}

export async function cancelReminder(): Promise<void> {
  if (!Notifications) return;
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }
  } catch { /* ignore */ }
}

// ── Exam countdown notifications ──────────────────────────────────────────
const EXAM_COUNTDOWN_KEY = 'examCountdownNotifIds';

/**
 * Schedules two notifications for an upcoming exam date:
 *   - 7 days before: "1 week until your AWS exam!"
 *   - 1 day before: "Your AWS exam is tomorrow!"
 * Silently no-ops if permissions are not granted, exam is in the past, or on web.
 */
export async function scheduleExamCountdownNotifications(examDate: string): Promise<void> {
  if (!Notifications || Platform.OS === 'web') return;

  // Cancel any existing countdown notifications first
  await cancelExamCountdownNotifications();

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const examMs = new Date(examDate + 'T08:00:00').getTime();
  const now = Date.now();
  const ids: string[] = [];

  const milestones: Array<{ daysBeforeMs: number; title: string; body: string }> = [
    {
      daysBeforeMs: 7 * 24 * 60 * 60 * 1000,
      title: '📅 1 Week Until Your AWS Exam!',
      body: 'Your AWS AI Practitioner exam is in 7 days. Keep up the practice!',
    },
    {
      daysBeforeMs: 1 * 24 * 60 * 60 * 1000,
      title: '🎯 AWS Exam Tomorrow!',
      body: 'Your AWS AI Practitioner exam is tomorrow. You\'ve got this — good luck!',
    },
  ];

  for (const m of milestones) {
    const triggerMs = examMs - m.daysBeforeMs;
    if (triggerMs > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: m.title, body: m.body, sound: true },
        trigger: new Date(triggerMs),
      });
      ids.push(id);
    }
  }

  if (ids.length > 0) {
    await AsyncStorage.setItem(EXAM_COUNTDOWN_KEY, JSON.stringify(ids));
  }
}

export async function cancelExamCountdownNotifications(): Promise<void> {
  if (!Notifications) return;
  try {
    const raw = await AsyncStorage.getItem(EXAM_COUNTDOWN_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
      await AsyncStorage.removeItem(EXAM_COUNTDOWN_KEY);
    }
  } catch { /* ignore */ }
}
