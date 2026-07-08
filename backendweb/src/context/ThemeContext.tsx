import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'blue' | 'green' | 'red';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

/** Apply theme by setting data-theme on BOTH html and body */
function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  document.body.setAttribute('data-theme', t);
  // Also force the body background directly so there's no delay
  const backgrounds: Record<Theme, string> = {
    dark:  '#080810',
    light: '#f0f2f8',
    blue:  '#00061c',
    green: '#010f07',
    red:   '#0f0404',
  };
  document.body.style.backgroundColor = backgrounds[t];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  // Apply theme IMMEDIATELY on mount (before first paint if possible)
  useEffect(() => {
    const saved = (localStorage.getItem('fox-theme') as Theme) || 'dark';
    applyTheme(saved);
    setThemeState(saved);
  }, []);

  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
    localStorage.setItem('fox-theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
