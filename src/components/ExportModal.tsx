import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FileText,
  Code2,
  Download,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Terminal,
  Printer,
} from 'lucide-react';
import { downloadFile, cleanTitleForPdf } from '../services/exportGenerator';
import { SetlistGroup, Song } from '../types';

export interface ExportProgressStep {
  id: string;
  title: string;
  desc: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

export interface ExportProgressState {
  progress: number; // 0 to 100
  stepId: string;
  stepLabel: string;
  steps: ExportProgressStep[];
  logs: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  pdfBlob: Blob | null;
  pdfDataUrl: string | null;
  mssXml: string | null;
  sets?: SetlistGroup[];
  songsMap?: Map<number, Song>;
  isExporting: boolean;
  exportProgress: ExportProgressState;
  driveStatus: {
    state: 'idle' | 'uploading' | 'success' | 'offline_queued' | 'error';
    message?: string;
  };
}

/**
 * Highlights saxophone annotations in red within the visual preview
 */
function renderStageTitle(title: string) {
  const saxRegex = /(\s*[-–—]?\s*(?:ALT|TENOR|SOPR[AÁ]N|BARYTON)\s*Sax.*)/i;
  const match = title.match(saxRegex);
  if (!match) return <span>{title}</span>;
  const parts = title.split(saxRegex);
  return (
    <span>
      {parts.map((p, i) =>
        saxRegex.test(p) ? (
          <span key={i} className="text-red-600 font-bold ml-1">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventName,
  pdfBlob,
  mssXml,
  sets = [],
  songsMap = new Map(),
  isExporting,
  exportProgress,
  driveStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'preview' | 'xml'>('progress');
  const [copied, setCopied] = useState(false);
  const [selectedPreviewSetIdx, setSelectedPreviewSetIdx] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Keep terminal scrolled to bottom when new logs appear
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [exportProgress.logs]);

  // Sets for visual stage sheet preview
  const validSets = sets.filter((s) => s.songIds.length > 0);
  const previewSets = validSets.length > 0 ? validSets : sets;
  const currentPreviewSet = previewSets[selectedPreviewSetIdx] || previewSets[0];

  // Prepare table rows for current preview sheet
  const previewRows = useMemo(() => {
    if (!currentPreviewSet) return [];
    const isLidovky = currentPreviewSet.name.toLowerCase().includes('lidovk');
    const isZbytek = currentPreviewSet.name.toLowerCase().includes('zbytek');

    interface RowItem {
      id: string;
      title: string;
      bgColor: string;
      isBlank?: boolean;
    }

    const rows: RowItem[] = [];

    if (isLidovky) {
      currentPreviewSet.songIds.forEach((songId, idx) => {
        const song = songsMap.get(songId);
        const displayId = song ? (song.id < 0 ? '?' : String(song.id)) : (songId < 0 ? '?' : String(songId));
        const cleanTitle = song
          ? cleanTitleForPdf(song.pdf_title, song.id)
          : (songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`);
        rows.push({
          id: displayId,
          title: cleanTitle,
          bgColor: song?.bgColor || '#fef3c7',
        });
        if ((idx === 2 || idx === 5) && currentPreviewSet.songIds.length >= 7) {
          rows.push({ id: '', title: '', bgColor: '#ffffff', isBlank: true });
        }
      });
    } else {
      currentPreviewSet.songIds.forEach((songId) => {
        const song = songsMap.get(songId);
        const displayId = song ? (song.id < 0 ? '?' : String(song.id)) : (songId < 0 ? '?' : String(songId));
        const cleanTitle = song
          ? cleanTitleForPdf(song.pdf_title, song.id)
          : (songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`);
        rows.push({
          id: displayId,
          title: cleanTitle,
          bgColor: song?.bgColor || '#ffffff',
        });
      });

      if (!isZbytek && rows.length < 11) {
        const diff = 11 - rows.length;
        for (let i = 0; i < diff; i++) {
          rows.push({ id: '', title: '', bgColor: '#ffffff', isBlank: true });
        }
      }
    }

    return rows;
  }, [currentPreviewSet, songsMap]);

  if (!isOpen) return null;

  const safeName = eventName.trim() || 'Setlist';
  const pdfFileName = `${safeName}.pdf`;
  const mssFileName = `${safeName}.mss`;

  const handleDownloadPdf = () => {
    if (pdfBlob) {
      downloadFile(pdfBlob, pdfFileName, 'application/pdf');
    }
  };

  const handleDownloadMss = () => {
    if (mssXml) {
      downloadFile(mssXml, mssFileName, 'text/xml');
    }
  };

  const handleCopyXml = () => {
    if (mssXml) {
      navigator.clipboard.writeText(mssXml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 sm:p-5 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 text-white shadow-md shadow-indigo-500/20">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Generování a export setlistu na pozadí</span>
                {isExporting && (
                  <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akce: <strong className="text-slate-900 dark:text-white">{safeName}</strong> &bull; {pdfFileName} &amp; {mssFileName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Progress & Status Section */}
        <div className="my-3 space-y-2">
          {/* Progress bar with percentage */}
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  {isExporting ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin inline-block" />
                      <span>{exportProgress.stepLabel || 'Zpracovávám export...'}</span>
                    </>
                  ) : driveStatus.state === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Generování a upload úspěšně dokončeny!</span>
                    </>
                  ) : driveStatus.state === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-rose-300">Generování se nezdařilo</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                      <span>{exportProgress.stepLabel || 'Připraveno'}</span>
                    </>
                  )}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-indigo-300">
                {Math.round(exportProgress.progress)} %
              </span>
            </div>

            {/* Glowing progress line */}
            <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  driveStatus.state === 'error'
                    ? 'bg-rose-500'
                    : driveStatus.state === 'success'
                    ? 'bg-gradient-to-r from-indigo-500 via-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 animate-pulse'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, exportProgress.progress))}%` }}
              />
            </div>
          </div>

          {/* Drive Status Banner */}
          {driveStatus.state === 'success' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{driveStatus.message || 'Úspěšně uloženo na Google Disk do exportní složky kapely!'}</span>
            </div>
          )}
          {driveStatus.state === 'offline_queued' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-950/60 border border-amber-700/60 text-xs text-amber-200 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Jste v režimu offline. Export byl bezpečně uložen do lokální IndexedDB paměti a nahraje se automaticky po obnovení spojení.</span>
            </div>
          )}
          {driveStatus.state === 'error' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{driveStatus.message || 'Chyba při ukládání na Google Disk. Soubory si můžete stáhnout níže do zařízení.'}</span>
            </div>
          )}
        </div>

        {/* Action Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={handleDownloadPdf}
            disabled={!pdfBlob}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs py-2.5 shadow-sm transition active:scale-98"
          >
            <FileText className="w-4 h-4" />
            <span>Stáhnout arch v PDF ({pdfFileName})</span>
            <Download className="w-3.5 h-3.5 opacity-80" />
          </button>
          <button
            onClick={handleDownloadMss}
            disabled={!mssXml}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs py-2.5 shadow-sm transition active:scale-98"
          >
            <Code2 className="w-4 h-4" />
            <span>Stáhnout XML do MobileSheets ({mssFileName})</span>
            <Download className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'progress'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-300" />
            <span>Průběh na pozadí &amp; Log</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-rose-400" />
            <span>Vizuální náhled archu (1:1)</span>
          </button>

          <button
            onClick={() => setActiveTab('xml')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'xml'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>XML kód (.mss)</span>
          </button>

          {activeTab === 'xml' && (
            <button
              onClick={handleCopyXml}
              className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Zkopírováno' : 'Kopírovat XML'}</span>
            </button>
          )}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto mt-2.5 rounded-xl border border-slate-800 bg-slate-950 p-3 min-h-[280px]">
          {/* TAB 1: Real-time Pipeline Steps & Live Console Log */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              {/* Pipeline Steps Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exportProgress.steps.map((st, idx) => {
                  const isDone = st.status === 'done';
                  const isInProgress = st.status === 'in_progress';
                  const isErr = st.status === 'error';

                  return (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                          : isInProgress
                          ? 'bg-indigo-950/40 border-indigo-500/60 text-white ring-1 ring-indigo-500/40'
                          : isErr
                          ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {isInProgress && (
                          <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin block" />
                        )}
                        {isErr && <AlertCircle className="w-4 h-4 text-rose-400" />}
                        {!isDone && !isInProgress && !isErr && (
                          <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-500">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span className="truncate">{st.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{st.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Terminal Log Output */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Živý log operací na pozadí (Live Execution Stream)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {exportProgress.logs.length} záznamů
                  </span>
                </div>

                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {exportProgress.logs.length === 0 ? (
                    <div className="text-slate-500 italic">Čekám na zahájení exportu...</div>
                  ) : (
                    exportProgress.logs.map((log, index) => {
                      const isSuccessLog = log.includes('✓') || log.includes('úspěšně') || log.includes('OK');
                      const isErrorLog = log.includes('Chyba') || log.includes('Error') || log.includes('selhalo');

                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-2 leading-relaxed text-[11px] ${
                            isErrorLog
                              ? 'text-rose-400'
                              : isSuccessLog
                              ? 'text-emerald-300'
                              : 'text-slate-300'
                          }`}
                        >
                          <span className="text-slate-600 select-none shrink-0">&gt;</span>
                          <span className="break-all">{log}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Native 1:1 Stage Sheet Visual Preview (Never blocked by Chrome) */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              {/* Page selector bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-semibold mr-1">Stránka archu:</span>
                  {previewSets.map((s, idx) => {
                    const isSelected = selectedPreviewSetIdx === idx;
                    const label = s.name.toLowerCase().startsWith('set')
                      ? s.name.replace(/^set\s*/i, 'List ')
                      : s.name;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedPreviewSetIdx(idx)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!pdfBlob}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Stáhnout PDF</span>
                  </button>
                </div>
              </div>

              {/* The Paper Stage Sheet (A4 aspect representation with black border) */}
              <div className="bg-slate-900/60 p-2 sm:p-4 rounded-xl flex justify-center overflow-x-auto">
                <div className="w-full max-w-lg bg-white text-black rounded-lg shadow-2xl p-5 border border-slate-400 font-sans select-none">
                  {/* Centered Bold Page Title */}
                  <h3 className="text-center font-bold text-xl sm:text-2xl text-black mb-3">
                    {currentPreviewSet
                      ? (currentPreviewSet.name.toLowerCase().startsWith('set')
                          ? currentPreviewSet.name.replace(/^set\s*/i, 'List ')
                          : currentPreviewSet.name)
                      : 'List'}
                  </h3>

                  {/* Stage Table */}
                  <table className="w-full border-collapse border-2 border-black text-black">
                    <tbody>
                      {previewRows.map((row, rIdx) => {
                        const isLidovky = currentPreviewSet?.name.toLowerCase().includes('lidovk');
                        const rowBg = isLidovky ? (row.bgColor || '#ffffcc') : '#ffffff';
                        const idBg = row.isBlank ? '#ffffff' : (row.bgColor || '#ffffff');

                        return (
                          <tr key={rIdx} className="border-b border-black">
                            {/* Column 1: Colored ID cell */}
                            <td
                              className="border-r border-black w-14 sm:w-16 py-2 px-1 text-center font-bold text-base sm:text-lg select-none"
                              style={{ backgroundColor: idBg }}
                            >
                              {row.id}
                            </td>

                            {/* Column 2: Title with Saxophone tags in red */}
                            <td
                              className="py-2 px-3 font-bold text-xs sm:text-sm leading-snug align-middle"
                              style={{ backgroundColor: rowBg }}
                            >
                              {row.isBlank ? <span>&nbsp;</span> : renderStageTitle(row.title)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Page Footer */}
                  <div className="text-right text-[10px] text-slate-700 mt-2 font-mono">
                    {safeName.toLowerCase().endsWith('.xlsx') ? safeName : `${safeName}.xlsx`}
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tento vizuální náhled odpovídá přesné 1:1 podobě tištěného archu. Prohlížeč jej nikdy neblokuje.</span>
              </div>
            </div>
          )}

          {/* TAB 3: XML Source Preview */}
          {activeTab === 'xml' && (
            <pre className="p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
              {mssXml || '// Žádný XML výstup'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
