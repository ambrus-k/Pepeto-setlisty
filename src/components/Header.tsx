import React, { useState, useRef, useEffect } from 'react';
import {
  CloudUpload,
  FileText,
  Code2,
  LogOut,
  Settings,
  Upload,
  ChevronDown,
  ArrowLeftRight,
  FolderOpen,
  ListOrdered,
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
  onOpenSetlistManager: () => void;
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
  onOpenSetlistManager,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ioMenuRef = useRef<HTMLDivElement>(null);
  const [isIoMenuOpen, setIsIoMenuOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDirectFileImport(file);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!isIoMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ioMenuRef.current && !ioMenuRef.current.contains(e.target as Node)) {
        setIsIoMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsIoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isIoMenuOpen]);

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-[1600px] mx-auto px-2.5 sm:px-4 py-1.5">
        {/* Row 1 (Práce se setlisty): [Logo] [Název setlistu] [Upravit sety] [Import / Export ▼] [PWA] [⚙] [↪] */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Logo ONLY */}
          <div
            className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#3f3847] px-2 py-1 shadow-sm border border-white/10"
            title="PEPETO hudební skupina"
          >
            <img
              src="/pepeto-logo.png"
              alt="PEPETO"
              className="h-6 w-auto object-contain"
            />
          </div>

          {/* Shortened Setlist Name Input right next to Logo */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[6.5rem] max-w-[13rem] sm:max-w-[17rem] lg:max-w-[22rem]">
            <label
              htmlFor="eventNameInput"
              className="text-[0.6875rem] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0 hidden lg:inline"
            >
              Setlist:
            </label>
            <input
              id="eventNameInput"
              type="text"
              value={eventName}
              onChange={(e) => onEventNameChange(e.target.value)}
              placeholder="Název setlistu..."
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          {/* Upravit sety button right next to Setlist Name & Import/Export */}
          <button
            type="button"
            onClick={onOpenSetlistManager}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition active:scale-95 cursor-pointer shrink-0"
            title="Upravit názvy setlistů, změnit jejich pořadí nebo barvy"
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Upravit sety</span>
            <span className="sm:hidden">Sety</span>
          </button>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Hidden file input for .mss and .xlsx */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mss, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Combined Import / Export Dropdown Button */}
            <div className="relative shrink-0" ref={ioMenuRef}>
              <button
                type="button"
                onClick={() => setIsIoMenuOpen((prev) => !prev)}
                disabled={isExporting}
                aria-expanded={isIoMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-2 sm:px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                title="Import a export setlistů (.mss, .xlsx, PDF, Google Disk)"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {isExporting ? 'Exportuji...' : 'Import / Export'}
                </span>
                <span className="sm:hidden">{isExporting ? '...' : 'I/O'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    isIoMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isIoMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 z-50 animate-fadeIn"
                >
                  {/* IMPORT SECTION */}
                  <div className="px-3 pt-1 pb-1 text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Import
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsIoMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Importovat soubor
                      </div>
                      <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                        Nahrát .mss (XML) nebo .xlsx (Excel)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsIoMenuOpen(false);
                      onOpenImportModal();
                    }}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Průvodce importem (Náhled)
                      </div>
                      <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                        Kontrola spárování a ukázkové setlisty
                      </div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-slate-200 dark:border-slate-800" />

                  {/* EXPORT SECTION */}
                  <div className="px-3 pt-0.5 pb-1 text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Export
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsIoMenuOpen(false);
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

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsIoMenuOpen(false);
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
                      setIsIoMenuOpen(false);
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

            {/* PWA install prompt */}
            <PWAInstallButton />

            {/* Settings Gear Button (Display Settings, Database Sync & Admin) */}
            <button
              type="button"
              onClick={onOpenDisplaySettings}
              className="flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 p-1.5 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition shadow-xs cursor-pointer"
              title="Nastavení (databáze, administrace, vzhled a písmo)"
              aria-label="Nastavení"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout Icon Button */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/40 transition shadow-xs cursor-pointer"
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
      </div>
    </header>
  );
};
