import React, { useState } from 'react';
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
} from 'lucide-react';
import { downloadFile } from '../services/exportGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  pdfBlob: Blob | null;
  pdfDataUrl: string | null;
  mssXml: string | null;
  driveStatus: {
    state: 'idle' | 'uploading' | 'success' | 'offline_queued' | 'error';
    message?: string;
  };
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventName,
  pdfBlob,
  pdfDataUrl,
  mssXml,
  driveStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'xml'>('preview');
  const [copied, setCopied] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CloudUpload className="w-5 h-5 text-indigo-400" />
              <span>Vygenerované soubory setlistu</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Akce: <strong className="text-white">{safeName}</strong> ({pdfFileName} &amp; {mssFileName})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drive Sync Status Banner */}
        <div className="my-3">
          {driveStatus.state === 'uploading' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-xs text-indigo-200">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
              <span>Nahrávám oba soubory do Google Drive složky "Playlists Mobile Sheets Export"...</span>
            </div>
          )}
          {driveStatus.state === 'success' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Úspěšně uloženo do Google Drive složky <strong>Playlists Mobile Sheets Export</strong>!</span>
            </div>
          )}
          {driveStatus.state === 'offline_queued' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-950/60 border border-amber-700/60 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Jste v režimu offline. Export byl uložen do lokální paměti (IndexedDB) a synchronizuje se po připojení.</span>
            </div>
          )}
          {driveStatus.state === 'error' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{driveStatus.message || 'Chyba při ukládání na Google Drive. Soubory si můžete stáhnout níže.'}</span>
            </div>
          )}
        </div>

        {/* Action Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 shadow transition"
          >
            <FileText className="w-4 h-4" />
            <span>Stáhnout {pdfFileName}</span>
            <Download className="w-3.5 h-3.5 opacity-80" />
          </button>
          <button
            onClick={handleDownloadMss}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 shadow transition"
          >
            <Code2 className="w-4 h-4" />
            <span>Stáhnout {mssFileName}</span>
            <Download className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>

        {/* Preview Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Náhled PDF
          </button>
          <button
            onClick={() => setActiveTab('xml')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'xml'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> XML kód (.mss)
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto mt-3 rounded-xl border border-slate-800 bg-slate-950 p-2 min-h-[260px]">
          {activeTab === 'preview' ? (
            pdfDataUrl ? (
              <iframe
                src={pdfDataUrl}
                title="Náhled PDF setlistu"
                className="w-full h-[360px] rounded-lg border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-xs text-slate-500">
                Náhled PDF se načítá...
              </div>
            )
          ) : (
            <pre className="p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
              {mssXml || '// Žádný XML výstup'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
