import React from 'react';
import {
  Music,
  Cloud,
  CloudUpload,
  FileText,
  Code2,
  Database,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  FolderSync,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  eventName: string;
  onEventNameChange: (name: string) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isOnline: boolean;
  driveReady: boolean;
  totalMasterSongs: number;
  totalSetSongs: number;
  onOpenDataSources: () => void;
  onGenerateAndSave: () => void;
  onQuickDownloadPdf: () => void;
  onQuickDownloadMss: () => void;
  isExporting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  eventName,
  onEventNameChange,
  user,
  onSignIn,
  onSignOut,
  isOnline,
  driveReady,
  totalMasterSongs,
  totalSetSongs,
  onOpenDataSources,
  onGenerateAndSave,
  onQuickDownloadPdf,
  onQuickDownloadMss,
  isExporting,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Event Name input */}
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-500/20">
              <Music className="w-5 h-5" />
            </div>

            <div className="flex-1 max-w-md">
              <label
                htmlFor="eventNameInput"
                className="block text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-0.5"
              >
                Název akce / vystoupení
              </label>
              <input
                id="eventNameInput"
                type="text"
                value={eventName}
                onChange={(e) => onEventNameChange(e.target.value)}
                placeholder="např. Večírek Roudnice..."
                className="w-full rounded-lg bg-slate-800/90 border border-slate-700 px-3 py-1.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Center / Right controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
            {/* Repertoire & Drive Folders Settings button */}
            <button
              onClick={onOpenDataSources}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700/90 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm"
              title="Nastavit a spravovat Google Drive složky pro import a export"
            >
              <FolderSync className="w-3.5 h-3.5 text-indigo-400" />
              <span>Složky Disku ({totalMasterSongs})</span>
            </button>

            {/* PWA install prompt */}
            <PWAInstallButton />

            {/* Google Drive Auth Button */}
            {user ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 border border-slate-700 px-2 py-1 text-xs">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google'}
                    className="w-5 h-5 rounded-full ring-1 ring-emerald-500"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {user.email?.charAt(0).toUpperCase() || 'G'}
                  </div>
                )}
                <span className="text-slate-300 hidden sm:inline max-w-[100px] truncate" title={user.email || ''}>
                  {user.displayName || user.email}
                </span>
                <span
                  className="flex items-center text-[11px] text-emerald-400 font-medium ml-0.5"
                  title="Google Drive připojen"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <button
                  onClick={onSignOut}
                  className="p-1 text-slate-400 hover:text-rose-400 transition ml-0.5"
                  title="Odhlásit z Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-white hover:bg-slate-100 text-slate-900 px-2.5 py-1.5 text-xs font-medium shadow-sm transition active:scale-95"
                title="Přihlásit přes Google pro přístup na Google Drive"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Přihlásit Google</span>
              </button>
            )}

            {/* Quick Export Downloads */}
            <div className="flex items-center rounded-lg bg-slate-800/80 border border-slate-700 p-0.5">
              <button
                onClick={onQuickDownloadPdf}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
                title="Stáhnout barevné PDF přímo do počítače"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF</span>
              </button>
              <span className="text-slate-600 text-xs">|</span>
              <button
                onClick={onQuickDownloadMss}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
                title="Stáhnout MobileSheets XML (.mss) přímo do počítače"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>MSS</span>
              </button>
            </div>

            {/* Primary Action Button: "Vygenerovat a Uložit na Drive" */}
            <button
              onClick={onGenerateAndSave}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isExporting ? 'Generuji...' : 'Vygenerovat a Uložit na Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
