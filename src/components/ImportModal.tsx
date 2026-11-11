import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Code2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { Song, SetlistGroup } from '../types';
import {
  importMssText,
  importXlsxBuffer,
  ImportResult,
} from '../services/importSetlist';
import {
  generateSampleOleskoXlsx,
  generateSampleMssXml,
} from '../services/sampleSetlistData';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterSongs: Song[];
  onApplyImport: (result: ImportResult) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  masterSongs,
  onApplyImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ImportResult | null>(null);
  const [editableEventName, setEditableEventName] = useState<string>('');

  if (!isOpen) return null;

  const handleReset = () => {
    setParsedPreview(null);
    setErrorMessage(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setParsedPreview(null);

    try {
      const fileName = file.name;
      const lower = fileName.toLowerCase();

      if (lower.endsWith('.mss') || lower.endsWith('.xml')) {
        const text = await file.text();
        const result = importMssText(text, masterSongs, fileName);
        setParsedPreview(result);
        setEditableEventName(result.eventName);
      } else if (
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel')
      ) {
        const buffer = await file.arrayBuffer();
        const result = await importXlsxBuffer(buffer, masterSongs, fileName);
        setParsedPreview(result);
        setEditableEventName(result.eventName);
      } else {
        throw new Error('Nepodporovaný typ souboru. Zvolte prosím soubor .mss (XML) nebo .xlsx (Excel).');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Nastala chyba při zpracování souboru.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleLoadSampleXlsx = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const { buffer, fileName } = generateSampleOleskoXlsx();
      const result = await importXlsxBuffer(buffer, masterSongs, fileName);
      setParsedPreview(result);
      setEditableEventName(result.eventName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Chyba při načítání ukázky.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSampleMss = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const { xml, fileName } = generateSampleMssXml();
      const result = importMssText(xml, masterSongs, fileName);
      setParsedPreview(result);
      setEditableEventName(result.eventName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Chyba při načítání ukázky.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview) return;
    const finalResult = {
      ...parsedPreview,
      eventName: editableEventName.trim() || parsedPreview.eventName,
    };
    onApplyImport(finalResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Import starého setlistu
              </h2>
              <p className="text-xs text-slate-400">
                Podporuje soubory MobileSheets <code className="text-indigo-300 font-mono">.mss</code> (XML) i Excel <code className="text-emerald-300 font-mono">.xlsx</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Chyba při zpracování: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* 1. If not yet parsed, show Drag & Drop Upload and Sample Buttons */}
          {!parsedPreview ? (
            <div className="space-y-4">
              {/* Drag & Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01]'
                    : 'border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mss, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Code2 className="w-6 h-6" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {isProcessing ? 'Analyzuji a páruji skladby...' : 'Přetáhněte sem soubor nebo klikněte'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Nahrajte buď <strong className="text-emerald-400">.xlsx</strong> (např. <em>Oleško 22.08.2026.xlsx</em>) nebo <strong className="text-indigo-400">.mss</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 text-[11px] font-semibold text-indigo-300 bg-indigo-950/50 border border-indigo-800/60 px-3 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Automaticky očistí doplňkové texty (- ALT Sax, kytara...) a napáruje na Master databázi</span>
                </div>
              </div>

              {/* Instant One-Click Sample Presets */}
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/70 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rychlý test se vzorovými soubory:</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Oleško 22.08.2026</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleLoadSampleXlsx}
                    disabled={isProcessing}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-emerald-600/40 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-200 text-xs font-semibold transition active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Oleško 22.08.2026.xlsx</div>
                        <div className="text-[10px] text-emerald-400/80">Excel: List 1, 2, 3, Lidovky, Zbytek</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </button>

                  <button
                    onClick={handleLoadSampleMss}
                    disabled={isProcessing}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-indigo-600/40 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-200 text-xs font-semibold transition active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold">Oleško 22.08.2026.mss</div>
                        <div className="text-[10px] text-indigo-400/80">MobileSheets XML se 4 setlisty</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 2. Parsed Preview and Confirmation */
            <div className="space-y-4">
              {/* Success Badge */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Soubor úspěšně analyzován ({parsedPreview.fileType.toUpperCase()})
                    </h4>
                    <p className="text-[11px] text-emerald-300">
                      {parsedPreview.fileName} &bull; {parsedPreview.sets.length} setů &bull; Celkem {parsedPreview.totalSongs} skladeb
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-white underline underline-offset-2 transition"
                >
                  Zvolit jiný soubor
                </button>
              </div>

              {/* Event Name Input */}
              <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3.5 space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                  Název akce / vystoupení (bude uložen do hlavičky)
                </label>
                <input
                  type="text"
                  value={editableEventName}
                  onChange={(e) => setEditableEventName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Matching Statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 p-3">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Spárováno v databázi</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-white">
                    {parsedPreview.matchedCount} / {parsedPreview.totalSongs}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {Math.round((parsedPreview.matchedCount / (parsedPreview.totalSongs || 1)) * 100)} % úspěšnost
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 p-3">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>K ruční kontrole</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-white">
                    {parsedPreview.unmatchedCount}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {parsedPreview.unmatchedCount > 0
                      ? 'Budou označeny varovnou ikonou'
                      : 'Žádné chybějící skladby'}
                  </div>
                </div>
              </div>

              {/* Unmatched list warning if any */}
              {parsedPreview.unmatchedCount > 0 && (
                <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Nespárované skladby ({parsedPreview.unmatchedCount}):</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Následující skladby nebyly 100% nalezeny v databázi. Bylo jim přiděleno dočasné ID a v aktivním setu budou označeny varovným symbolem, kde je budete moci jedním kliknutím ručně spárovat.
                  </p>
                  <ul className="text-xs divide-y divide-amber-900/40 max-h-32 overflow-y-auto pt-1">
                    {parsedPreview.unmatchedList.map((item, idx) => (
                      <li key={idx} className="py-1 flex items-center justify-between text-slate-300">
                        <span className="font-semibold text-amber-200 truncate pr-2">
                          "{item.originalTitle}"
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {item.setName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sets preview list */}
              <div className="rounded-xl bg-slate-800/40 border border-slate-700 p-3 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Nalezené setlisty ({parsedPreview.sets.length}):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {parsedPreview.sets.map((set, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-2 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {set.color && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
                            style={{ backgroundColor: set.color }}
                          />
                        )}
                        <span className="font-bold text-white truncate">{set.name}</span>
                      </div>
                      <span className="text-indigo-400 font-mono font-bold shrink-0 pl-1">
                        {set.songIds.length} skladeb
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Zrušit
          </button>

          {parsedPreview && (
            <button
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Nahrát setlisty do aplikace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
