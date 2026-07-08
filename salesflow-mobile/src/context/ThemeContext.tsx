import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Dark Palette ─────────────────────────────────────────────────────────────
export const darkColors = {
  bg: '#0a0b12',
  bgCard: '#12131a',
  bgPanel: '#1a1b26',
  border: '#1e2030',
  accent: '#6366f1',
  accentLight: 'rgba(99,102,241,0.15)',
  success: '#10b981',
  successLight: 'rgba(16,185,129,0.12)',
  warning: '#f59e0b',
  warningLight: 'rgba(245,158,11,0.12)',
  danger: '#ef4444',
  dangerLight: 'rgba(239,68,68,0.10)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#4b5563',
  whatsapp: '#25D366',
  purple: '#a78bfa',
  purpleLight: 'rgba(167,139,250,0.12)',
  cyan: '#06b6d4',
  statusBar: 'light' as 'light' | 'dark',
};

// ─── Light Palette ─────────────────────────────────────────────────────────────
export const lightColors = {
  bg: '#f0f4ff',
  bgCard: '#ffffff',
  bgPanel: '#e8edf8',
  border: '#d1d9ef',
  accent: '#5152d0',
  accentLight: 'rgba(81,82,208,0.12)',
  success: '#059669',
  successLight: 'rgba(5,150,105,0.10)',
  warning: '#d97706',
  warningLight: 'rgba(217,119,6,0.10)',
  danger: '#dc2626',
  dangerLight: 'rgba(220,38,38,0.08)',
  textPrimary: '#0f172a',
  textSecondary: '#374151',
  textMuted: '#9ca3af',
  whatsapp: '#25D366',
  purple: '#7c3aed',
  purpleLight: 'rgba(124,58,237,0.10)',
  cyan: '#0891b2',
  statusBar: 'dark' as 'light' | 'dark',
};

export type AppColors = typeof darkColors;

interface ThemeContextType {
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

const THEME_KEY = '@salesflow_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
