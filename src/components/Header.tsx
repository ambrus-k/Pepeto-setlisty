import React, { useState, useRef, useEffect } from 'react';
import {
  CloudUpload,
  FileText,
  Code2,
  LogOut,
  Settings,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { UserRole } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  eventName: string;
  onEventNameChange: (name: string) => void;
  role: UserRole;
  onLogout: () => void;
  onGenerateAndSave: () => void;
  onQuickDownloadPdf: () => void;
  onQuickDownloadMss: () => void;
  isExporting: boolean;
  onDirectFileImport: (file: File) => void;
  onOpenImportModal: () => void;
  onOpenDisplaySettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  eventName,
  onEventNameChange,
  role,
  onLogout,
  onGenerateAndSave,
  onQuickDownloadPdf,
  onQuickDownloadMss,
  isExporting,
  onDirectFileImport,
  onOpenImportModal,
  onOpenDisplaySettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDirectFileImport(file);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-3 py-1.5 sm:px-4 space-y-1.5">
        {/* Top Row: Brand & Compact Action Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Logo & App Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#3f3847] px-2 py-1 shadow-sm border border-white/10">
              <img
                src="/pepeto-logo.png"
                alt="PEPETO hudební skupina"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                Pepeto Setlisty
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Hidden file input for .mss and .xlsx */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mss, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Importovat button */}
            <div className="inline-flex items-center rounded-lg border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:text-indigo-950 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-md transition cursor-pointer"
                title="Nahrát soubor .mss (XML) nebo .xlsx (Excel) ze zařízení"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Importovat</span>
              </button>
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-1.5 py-1 text-[0.6875rem] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-950 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900/70 rounded-md border-l border-indigo-200 dark:border-indigo-800/60 transition cursor-pointer"
                title="Otevřít průvodce importem s náhledem a ukázkami"
              >
                Náhled
              </button>
            </div>

            {/* PWA install prompt */}
            <PWAInstallButton />

            {/* Settings Gear Button (Display Settings, Database Sync & Admin) */}
            <button
              type="button"
              onClick={onOpenDisplaySettings}
              className="flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 p-1.5 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition shadow-sm cursor-pointer"
              title="Nastavení (databáze, administrace, vzhled a písmo)"
              aria-label="Nastavení"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout Icon Button */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/40 transition shadow-sm cursor-pointer"
              title={
                role === 'admin'
                  ? 'Odhlásit se (Admin) a zamknout aplikaci PINem'
                  : 'Odhlásit se a zamknout aplikaci PINem'
              }
              aria-label="Odhlásit se"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Second Row: Compact Event / Setlist Name Input + Export MSS na Disk Menu */}
        <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0 max-w-sm sm:max-w-md">
            <label
              htmlFor="eventNameInput"
              className="text-[0.6875rem] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0 hidden sm:inline"
            >
              Setlist:
            </label>
            <input
              id="eventNameInput"
              type="text"
              value={eventName}
              onChange={(e) => onEventNameChange(e.target.value)}
              placeholder="Název setlistu / akce..."
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          {/* Primary Action Button with Export / Download Menu */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={isExporting}
              aria-expanded={isExportMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-3 py-1.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isExporting ? 'Ukládám na Disk...' : 'Export MSS na Disk'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50 animate-fadeIn"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onGenerateAndSave();
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Export MSS na Disk
                    </div>
                    <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Uložit na Google Disk a zobrazit náhled
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onQuickDownloadPdf();
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Stáhnout PDF
                    </div>
                    <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Přímé stažení barevného PDF do zařízení
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onQuickDownloadMss();
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Stáhnout MSS
                    </div>
                    <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Přímé stažení MobileSheets XML (.mss)
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
