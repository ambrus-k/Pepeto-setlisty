import React, { useEffect } from 'react';
import { Settings, Sun, Moon, Type, RotateCcw, X, Check, RefreshCw, ShieldCheck, Database } from 'lucide-react';
import {
  useDisplaySettings,
  FONT_SCALE_OPTIONS,
} from '../context/DisplaySettingsContext';
import { UserRole } from '../types';

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: UserRole;
  totalMasterSongs?: number;
  isSyncing?: boolean;
  onSyncDatabase?: () => void;
  onOpenAdminPanel?: () => void;
}

export const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({
  isOpen,
  onClose,
  role,
  totalMasterSongs,
  isSyncing,
  onSyncDatabase,
  onOpenAdminPanel,
}) => {
  const { theme, fontScale, setTheme, setFontScale, resetSettings } = useDisplaySettings();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDefault = theme === 'dark' && fontScale === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="display-settings-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="display-settings-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Nastavení
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Databáze, správa, zobrazení a barevný režim
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
            aria-label="Zavřít nastavení"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Database & Admin Section (only when logged in) */}
          {onSyncDatabase && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Database className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Databáze &amp; Správa
                </span>
              </div>

              <div className={`grid gap-2.5 ${role === 'admin' && onOpenAdminPanel ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  type="button"
                  onClick={onSyncDatabase}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Načíst databázi ({totalMasterSongs ?? 0})</span>
                </button>

                {role === 'admin' && onOpenAdminPanel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdminPanel();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/60 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 transition shadow-sm cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Admin &amp; Logy</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Theme Mode Section */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Barevný režim
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 border text-sm font-semibold transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Tmavý režim</span>
                {theme === 'dark' && <Check className="w-4 h-4 ml-auto" />}
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 border text-sm font-semibold transition cursor-pointer ${
                  theme === 'light'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Světlý režim</span>
                {theme === 'light' && <Check className="w-4 h-4 ml-auto" />}
              </button>
            </div>
          </div>

          {/* Font & UI Scale Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Velikost písma a rozhraní
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {FONT_SCALE_OPTIONS.find((o) => o.level === fontScale)?.percent}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {FONT_SCALE_OPTIONS.map((option) => {
                const isActive = fontScale === option.level;
                return (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => setFontScale(option.level)}
                    className={`flex flex-col items-center justify-center rounded-xl py-2.5 px-2 border transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-500/30'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <span className="text-sm font-bold leading-tight">{option.label}</span>
                    <span
                      className={`text-xs mt-0.5 ${
                        isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {option.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-3.5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Náhled rozhraní
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-xs">
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                1.
              </span>
              <div
                className="flex-1 rounded px-2.5 py-1 text-xs sm:text-sm font-bold border border-black/15 flex items-center gap-2 truncate"
                style={{ backgroundColor: '#fef08a', color: '#000000' }}
              >
                <span className="font-mono opacity-75">#42</span>
                <span className="truncate">Ukázková skladba</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetSettings}
            disabled={isDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-xs font-semibold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Obnovit výchozí</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
};
