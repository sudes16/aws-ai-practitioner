import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'quiz_note_';

export async function saveNoteForQuestion(qNumber: number, note: string): Promise<void> {
  try {
    if (note.trim()) {
      await AsyncStorage.setItem(PREFIX + qNumber, note.trim());
    } else {
      await AsyncStorage.removeItem(PREFIX + qNumber);
    }
  } catch {
    // silently fail — note loss is preferable to crashing an active quiz
  }
}

export async function getAllNotes(): Promise<Record<number, string>> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const noteKeys = keys.filter(k => k.startsWith(PREFIX));
    if (noteKeys.length === 0) return {};
    const pairs = await AsyncStorage.multiGet(noteKeys);
    const map: Record<number, string> = {};
    for (const [key, val] of pairs) {
      if (val) {
        const num = parseInt(key.slice(PREFIX.length), 10);
        if (!isNaN(num)) map[num] = val;
      }
    }
    return map;
  } catch {
    return {};
  }
}
