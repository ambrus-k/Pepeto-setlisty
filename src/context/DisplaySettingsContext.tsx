import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';
export type FontScaleLevel = 0 | 1 | 2 | 3;

export const FONT_SCALE_PX: Record<FontScaleLevel, number> = {
  0: 16,
  1: 18,
  2: 20,
  3: 22,
};

export const FONT_SCALE_OPTIONS: {
  level: FontScaleLevel;
  label: string;
  percent: string;
  desc: string;
}[] = [
  { level: 0, label: 'Výchozí', percent: '100 %', desc: 'Standardní' },
  { level: 1, label: '+1', percent: '112 %', desc: 'Větší' },
  { level: 2, label: '+2', percent: '125 %', desc: 'Velké' },
  { level: 3, label: '+3', percent: '138 %', desc: 'Největší' },
];

const STORAGE_KEY = 'setlist_studio_display_settings';

interface StoredDisplaySettings {
  theme: ThemeMode;
  fontScale: FontScaleLevel;
}

function loadStoredSettings(): StoredDisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const theme: ThemeMode = parsed.theme === 'light' ? 'light' : 'dark';
      const scaleNum = Number(parsed.fontScale);
      const fontScale: FontScaleLevel =
        scaleNum === 1 || scaleNum === 2 || scaleNum === 3 ? scaleNum : 0;
      return { theme, fontScale };
    }
  } catch {
    // ignore storage errors
  }
  return { theme: 'dark', fontScale: 0 };
}

export function applyDisplaySettingsToDOM(theme: ThemeMode, fontScale: FontScaleLevel) {
  const root = document.documentElement;
  root.style.fontSize = `${FONT_SCALE_PX[fontScale]}px`;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#1e293b' : '#f8fafc');
  }
}

interface DisplaySettingsContextValue {
  theme: ThemeMode;
  fontScale: FontScaleLevel;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setFontScale: (level: FontScaleLevel) => void;
  resetSettings: () => void;
}

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | undefined>(undefined);

export const DisplaySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoredDisplaySettings>(() => loadStoredSettings());

  useEffect(() => {
    applyDisplaySettingsToDOM(settings.theme, settings.fontScale);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScaleLevel) => {
    setSettings((prev) => ({ ...prev, fontScale }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ theme: 'dark', fontScale: 0 });
  }, []);

  return (
    <DisplaySettingsContext.Provider
      value={{
        theme: settings.theme,
        fontScale: settings.fontScale,
        setTheme,
        toggleTheme,
        setFontScale,
        resetSettings,
      }}
    >
      {children}
    </DisplaySettingsContext.Provider>
  );
};

export function useDisplaySettings() {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx) {
    throw new Error('useDisplaySettings must be used within a DisplaySettingsProvider');
  }
  return ctx;
}
