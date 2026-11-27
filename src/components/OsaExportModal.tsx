import React, { useEffect } from 'react';
import {
  X,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import type { OsaSongRow } from '../services/exportGenerator';

export interface OsaDriveStatus {
  state: 'idle' | 'generating' | 'uploading' | 'success' | 'offline_queued' | 'error';
  message?: string;
  updatedExisting?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRetryUpload: () => void;
  eventName: string;
  fileName: string;
  rows: OsaSongRow[];
  status: OsaDriveStatus;
}

export const OsaExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onRetryUpload,
  eventName,
  fileName,
  rows,
  status,
}) => {
  const isBusy = status.state === 'generating' || status.state === 'uploading';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  const completeCount = rows.filter((r) => r.hasAuthorInfo).length;
  const incompleteRows = rows.filter((r) => !r.hasAuthorInfo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 dark:bg-black/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={() => {
        if (!isBusy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Seznam pro OSA"
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 sm:p-5 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Seznam pro OSA
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-700/60 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  <CloudUpload className="w-3 h-3" />
                  <span>Google Disk → Play listy MobileSheets_export</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Akce: <strong className="text-slate-900 dark:text-white">{eventName.trim() || 'Setlist'}</strong> &bull; Soubor: <code className="font-mono text-indigo-600 dark:text-indigo-300">{fileName}</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banners */}
        <div className="my-3 space-y-2.5">
          {status.state === 'generating' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-700/60 text-xs text-indigo-900 dark:text-indigo-200">
              <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
              <span>Generuji PDF seznam pro OSA…</span>
            </div>
          )}

          {status.state === 'uploading' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-700/60 text-xs text-blue-900 dark:text-blue-200">
              <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
              <span>Ukládám soubor na Google Disk do složky Play listy MobileSheets_export…</span>
            </div>
          )}

          {status.state === 'success' && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/60 text-xs text-emerald-900 dark:text-emerald-200 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">
                  {status.updatedExisting
                    ? 'Soubor byl úspěšně aktualizován na Google Disku!'
                    : 'Soubor byl úspěšně uložen na Google Disk!'}
                </div>
                <div>
                  {status.message ||
                    `PDF „${fileName}“ je připraveno ve složce Play listy MobileSheets_export k přiložení do online žádosti na osa.cz.`}
                </div>
              </div>
            </div>
          )}

          {status.state === 'offline_queued' && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                {status.message ||
                  'Jste v režimu offline. Seznam pro OSA byl zařazen do lokální fronty a automaticky se uloží na Google Disk do složky Play listy MobileSheets_export po obnovení připojení.'}
              </span>
            </div>
          )}

          {status.state === 'error' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-700/60 text-xs text-rose-900 dark:text-rose-200 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>
                  {status.message ||
                    'Chyba při ukládání seznamu pro OSA na Google Disk.'}
                </span>
              </div>
              <button
                type="button"
                onClick={onRetryUpload}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Zkusit znovu nahrát na Disk</span>
              </button>
            </div>
          )}

          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Celkem skladeb: <strong className="text-slate-900 dark:text-white">{rows.length}</strong>
              </span>
              <span>
                Kompletní údaje autorů:{' '}
                <strong className={completeCount === rows.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {completeCount} / {rows.length}
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Seznam se generuje výhradně na Google Disk (složka export)
            </span>
          </div>

          {incompleteRows.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Upozornění k autorům:</strong> U {incompleteRows.length}{' '}
                {incompleteRows.length === 1 ? 'skladby' : 'skladeb'} chybí v databázi detailní rozdělení autorů hudby a textu (zkontrolujte před odesláním na OSA):{' '}
                <span className="font-semibold">
                  {incompleteRows.map((r) => r.title).join(', ')}
                </span>
                .
              </div>
            </div>
          )}
        </div>

        {/* Read-only OSA Table Preview */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 min-h-[240px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#002072] text-white z-10">
              <tr>
                <th className="py-2 px-2.5 font-bold w-10 text-right border-b border-blue-900">Č.</th>
                <th className="py-2 px-2.5 font-bold border-b border-blue-900">Název hudebního díla</th>
                <th className="py-2 px-2.5 font-bold border-b border-blue-900">Autor hudby</th>
                <th className="py-2 px-2.5 font-bold border-b border-blue-900">Autor textu</th>
                <th className="py-2 px-2.5 font-bold border-b border-blue-900">Zpracovatel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row) => (
                <tr
                  key={`${row.order}-${row.songId}`}
                  className={
                    row.hasAuthorInfo
                      ? 'odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-950 dark:even:bg-slate-900/50'
                      : 'bg-amber-50/70 dark:bg-amber-950/20'
                  }
                >
                  <td className="py-1.5 px-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                    {row.order}.
                  </td>
                  <td className="py-1.5 px-2.5 font-semibold text-slate-900 dark:text-white">
                    {row.title}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300">
                    {row.musicAuthor}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300">
                    {row.lyricsAuthor}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400">
                    {row.arranger || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer - strictly Close (plus Retry when error) */}
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          {status.state === 'error' && (
            <button
              type="button"
              onClick={onRetryUpload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Zkusit znovu nahrát na Disk</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-900 dark:text-white font-semibold text-xs px-5 py-2 transition cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
