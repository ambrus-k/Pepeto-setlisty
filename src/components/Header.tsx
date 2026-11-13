import React from 'react';
import {
  Music,
  CloudUpload,
  FileText,
  Code2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Settings,
  Upload,
} from 'lucide-react';
import { UserRole } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  eventName: string;
  onEventNameChange: (name: string) => void;
  role: UserRole;
  onLogout: () => void;
  isOnline: boolean;
  totalMasterSongs: number;
  totalSetSongs: number;
  onOpenAdminPanel?: () => void;
  onSyncDatabase: () => void;
  isSyncing: boolean;
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
  totalMasterSongs,
  onOpenAdminPanel,
  onSyncDatabase,
  isSyncing,
  onGenerateAndSave,
  onQuickDownloadPdf,
  onQuickDownloadMss,
  isExporting,
  onDirectFileImport,
  onOpenImportModal,
  onOpenDisplaySettings,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDirectFileImport(file);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 space-y-3">
        {/* Top Row: Brand & Action Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-500/20">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                MobileSheets Setlist Studio
              </div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400 leading-tight">
                Správa a tvorba setlistů
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 lg:justify-end">
            {/* Hidden file input for .mss and .xlsx as specified in requirement 1 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mss, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Importovat setlist button (activates hidden file input & opens modal) */}
            <div className="inline-flex items-center rounded-lg border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:text-indigo-950 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-md transition cursor-pointer"
                title="Nahrát soubor .mss (XML) nebo .xlsx (Excel) ze zařízení"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Importovat setlist</span>
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

            {/* Database Sync button (available for all to refresh from backend API) */}
            <button
              onClick={onSyncDatabase}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/90 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
              title="Aktualizovat písničky z centrální Google Drive databáze"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Načíst databázi ({totalMasterSongs})</span>
            </button>

            {/* Admin only: Nastavení & Logy */}
            {role === 'admin' && onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 transition shadow-sm cursor-pointer"
                title="Administrátorská konzole, nastavení Google Service Account a chybové logy"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Admin &amp; Logy</span>
              </button>
            )}

            {/* PWA install prompt */}
            <PWAInstallButton />

            {/* Quick Export Downloads */}
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 p-0.5">
              <button
                onClick={onQuickDownloadPdf}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Stáhnout barevné PDF přímo do zařízení"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>PDF</span>
              </button>
              <span className="text-slate-300 dark:text-slate-600 text-xs">|</span>
              <button
                onClick={onQuickDownloadMss}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Stáhnout MobileSheets XML (.mss) přímo do zařízení"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>MSS</span>
              </button>
            </div>

            {/* Role Badge and Logout */}
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs">
              {role === 'admin' ? (
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">Admin</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-medium">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden sm:inline">Muzikant</span>
                </span>
              )}

              <button
                onClick={onLogout}
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition ml-1 cursor-pointer"
                title="Odhlásit se a zamknout aplikaci PINem"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Display Settings Gear Button (accessible to ALL users) */}
            <button
              type="button"
              onClick={onOpenDisplaySettings}
              className="flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 p-1.5 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition shadow-sm cursor-pointer"
              title="Nastavení zobrazení (velikost písma, tmavý / světlý režim)"
              aria-label="Nastavení zobrazení"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Primary Action Button: "Export MSS na Disk" */}
            <button
              onClick={onGenerateAndSave}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isExporting ? 'Ukládám na Disk...' : 'Export MSS na Disk'}</span>
            </button>
          </div>
        </div>

        {/* Second Row: Full-width Event / Setlist Name Input */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label
              htmlFor="eventNameInput"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0"
            >
              Název setlistu / akce
            </label>
            <input
              id="eventNameInput"
              type="text"
              value={eventName}
              onChange={(e) => onEventNameChange(e.target.value)}
              placeholder="Zadejte název setlistu nebo vystoupení..."
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-base sm:text-lg font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
