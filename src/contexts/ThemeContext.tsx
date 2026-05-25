import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, ColorScheme } from '../constants/colors';

const THEME_MODE_KEY = 'quiz_theme_mode';

interface ThemeContextValue {
  colors: ColorScheme;
  isDark: boolean;
  /** Override: 'system' | 'light' | 'dark' */
  themeMode: 'system' | 'light' | 'dark';
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  themeMode: 'system',
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<'system' | 'light' | 'dark'>('system');

  // Load persisted theme mode on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved);
      }
    }).catch(() => {});
  }, []);

  // Persist mode whenever it changes
  const setThemeMode = useCallback((mode: 'system' | 'light' | 'dark') => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => {});
  }, []);

  const resolvedScheme =
    themeMode === 'system' ? (systemScheme ?? 'light') : themeMode;
  const isDark = resolvedScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
