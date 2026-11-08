import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  RefreshCw,
  Server,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  Terminal,
  FolderSync,
  ExternalLink,
  Folder,
  Save,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { AdminLogEntry, ServerDriveStatus } from '../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSync: (force: boolean) => Promise<void>;
  isSyncing: boolean;
  totalSongs: number;
}

interface TestReport {
  authOk: boolean;
  authMode?: 'oauth2' | 'service_account' | 'none';
  clientEmail?: string;
  projectId?: string;
  apiEnabled: boolean;
  activationUrl?: string;
  dataFolder: {
    configured: boolean;
    folderId: string;
    accessible: boolean;
    folderName?: string;
    hasMssFile: boolean;
    hasXlsxFile: boolean;
    mssFileName?: string;
    xlsxFileName?: string;
    error?: string;
  };
  exportFolder: {
    configured: boolean;
    folderId: string;
    accessible: boolean;
    folderName?: string;
    error?: string;
  };
  overallStatus: 'OK' | 'API_DISABLED' | 'AUTH_ERROR' | 'FOLDER_NOT_SHARED' | 'FILES_MISSING';
  message: string;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  onTriggerSync,
  isSyncing,
  totalSongs,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'folders' | 'logs' | 'guide'>('overview');
  const [serverStatus, setServerStatus] = useState<ServerDriveStatus | null>(null);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Folder configuration state
  const [dataFolderInput, setDataFolderInput] = useState('');
  const [exportFolderInput, setExportFolderInput] = useState('');
  const [isSavingFolders, setIsSavingFolders] = useState(false);
  const [folderSaveSuccess, setFolderSaveSuccess] = useState(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadServerInfo();
      runConnectionTest();
    }
  }, [isOpen]);

  const loadServerInfo = async () => {
    setIsLoadingLogs(true);
    try {
      const statusRes = await fetch('/api/drive/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        setServerStatus(data);
        if (data.dataFolderId) setDataFolderInput(data.dataFolderId);
        if (data.exportFolderId) setExportFolderInput(data.exportFolderId);
      }

      const logsRes = await fetch('/api/admin/logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to load admin server info:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const runConnectionTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/drive/test');
      if (res.ok) {
        const report: TestReport = await res.json();
        setTestReport(report);
      }
    } catch (e) {
      console.warn('Connection test failed:', e);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveFolderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFolders(true);
    setFolderSaveSuccess(false);
    try {
      const res = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataFolderId: dataFolderInput,
          exportFolderId: exportFolderInput,
        }),
      });
      if (res.ok) {
        setFolderSaveSuccess(true);
        await loadServerInfo();
        await runConnectionTest();
        setTimeout(() => setFolderSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      alert(`Chyba při ukládání složek: ${err.message}`);
    } finally {
      setIsSavingFolders(false);
    }
  };

  const handleForcedSync = async () => {
    setSyncFeedback(null);
    try {
      await onTriggerSync(true);
      setSyncFeedback('Vynucená synchronizace úspěšně proběhla! Data byla aktualizována.');
      await loadServerInfo();
      await runConnectionTest();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback(`Chyba synchronizace: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 sm:p-6 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Administrace a Google Drive API</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Admin přístup
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Správa centrální databáze, nastavení složek Disku a kontrola chyb
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Stav &amp; Diagnostika</span>
          </button>
          <button
            onClick={() => setActiveTab('folders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'folders'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span>Nastavit Google složky</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Chybové logy ({logs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'guide'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Návod: Service Account</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* TAB 1: OVERVIEW & DIAGNOSTICS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Alert: Google Drive API Disabled in Google Console */}
              {testReport && !testReport.apiEnabled && testReport.activationUrl && (
                <div className="p-4 rounded-xl bg-rose-950/70 border-2 border-rose-600/80 space-y-2.5 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Problém zjištěn: Google Drive API není aktivováno v Google Cloud projektu!
                      </h4>
                      <p className="text-xs text-rose-200 mt-1">
                        Vaše přihlašovací údaje (Service Account) jsou v pořádku, ale Google blokuje přístup, protože ve vašem Google Cloud projektu (ID: <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono font-bold text-white">{testReport.projectId || '219849626989'}</code>) není zapnuté Google Drive API.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <a
                      href={testReport.activationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg active:scale-95"
                    >
                      <span>Aktivovat Google Drive API v Google Cloud Console</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={runConnectionTest}
                      disabled={isTesting}
                      className="text-xs text-rose-300 hover:text-white underline font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>Ověřit znovu po aktivaci</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Service Account Share Warning (Folder Not Shared) */}
              {testReport && testReport.apiEnabled && testReport.overallStatus === 'FOLDER_NOT_SHARED' && (
                <div className="p-4 rounded-xl bg-amber-950/70 border-2 border-amber-600/80 space-y-2.5 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Složka na Google Disku není nasdílena servisnímu účtu!
                      </h4>
                      <p className="text-xs text-amber-200 mt-1">
                        Otevřete svůj Google Disk, klikněte u zdrojové i exportní složky pravým tlačítkem na <strong>Sdílet</strong> a vložte tento e-mail s právy <strong>Editor</strong>:
                      </p>
                      <div className="mt-2 flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-amber-600/50">
                        <code className="text-xs text-amber-300 font-mono select-all flex-1 break-all">
                          {testReport.clientEmail}
                        </code>
                        <button
                          onClick={() => copyToClipboard(testReport.clientEmail || '', 'email')}
                          className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1 transition"
                        >
                          {copiedKey === 'email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'email' ? 'Zkopírováno' : 'Kopírovat'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Forced Sync Action Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-violet-950/40 border border-indigo-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FolderSync className="w-4 h-4 text-indigo-400" />
                      <span>Vynucená synchronizace hlavní databáze</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Stáhne a spáruje soubory <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">PEPETO_KOMPLET_SETLIST.mss</code> a <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">PEPETA_KOMPLET.xlsx</code> ze zadané složky.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleForcedSync}
                      disabled={isSyncing}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Synchronizuji...' : 'Spustit synchronizaci'}</span>
                    </button>
                    <button
                      onClick={runConnectionTest}
                      disabled={isTesting}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                      title="Otestovat spojení"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>Test spojení</span>
                    </button>
                  </div>
                </div>

                {syncFeedback && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{syncFeedback}</span>
                  </div>
                )}
              </div>

              {/* Auth Mode Indicator */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Režim přístupu k Disku:</span>
                  {serverStatus?.authMode === 'oauth2' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                      OAuth2 (Přímý účet majitele - neomezená kvóta)
                    </span>
                  ) : serverStatus?.authMode === 'service_account' ? (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
                      Service Account ({serverStatus.clientEmail || 'aktivní'})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                      Zatím nenakonfigurováno v .env
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {serverStatus?.hasCachedData ? `${serverStatus.totalCachedSongs} skladeb v mezipaměti` : 'Žádná mezipaměť'}
                </span>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Zdrojová složka (Data):</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-white truncate">
                      {testReport?.dataFolder?.folderName || serverStatus?.dataFolderId || 'Nenastaveno'}
                    </span>
                    {testReport?.dataFolder?.accessible ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> Přístupná
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> Nedostupná
                      </span>
                    )}
                  </div>
                  {testReport?.dataFolder?.accessible && (
                    <div className="mt-2 text-[11px] space-y-1 text-slate-300 pt-2 border-t border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <span>MSS soubor:</span>
                        <span className={testReport.dataFolder.hasMssFile ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {testReport.dataFolder.hasMssFile ? testReport.dataFolder.mssFileName : 'Nenalezen'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>XLSX soubor:</span>
                        <span className={testReport.dataFolder.hasXlsxFile ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {testReport.dataFolder.hasXlsxFile ? testReport.dataFolder.xlsxFileName : 'Nenalezen'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Cílová exportní složka:</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-white truncate">
                      {testReport?.exportFolder?.folderName || serverStatus?.exportFolderId || 'Nenastaveno'}
                    </span>
                    {testReport?.exportFolder?.accessible ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> Přístupná
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> Nedostupná
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                    Aktivní počet skladeb v aplikaci: <strong className="text-white">{totalSongs} skladeb</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOLDER CONFIGURATION FORM */}
          {activeTab === 'folders' && (
            <form onSubmit={handleSaveFolderSettings} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Folder className="w-4 h-4" />
                    <span>Nastavení Google Drive složek pro import a export</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Můžete vložit buď čisté ID složky, nebo celý odkaz (URL) z adresního řádku prohlížeče (např. <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">https://drive.google.com/drive/folders/1pZuDqPX6OV...</code>).
                </p>

                {/* Data Folder Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    1. Zdrojová složka (Data - obsahuje PEPETO_KOMPLET_SETLIST.mss a PEPETA_KOMPLET.xlsx):
                  </label>
                  <input
                    type="text"
                    value={dataFolderInput}
                    onChange={(e) => setDataFolderInput(e.target.value)}
                    placeholder="Vložte URL nebo ID složky..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Aktuální ID: <code className="text-indigo-300 font-mono">{serverStatus?.dataFolderId || 'Nenastaveno'}</code>
                  </span>
                </div>

                {/* Export Folder Input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-200">
                    2. Cílová složka (Export - kam se ukládají vygenerované soubory MSS a PDF):
                  </label>
                  <input
                    type="text"
                    value={exportFolderInput}
                    onChange={(e) => setExportFolderInput(e.target.value)}
                    placeholder="Vložte URL nebo ID složky..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Aktuální ID: <code className="text-indigo-300 font-mono">{serverStatus?.exportFolderId || 'Nenastaveno'}</code>
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={isSavingFolders}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-1.5 active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingFolders ? 'Ukládám...' : 'Uložit nastavení složek'}</span>
                  </button>

                  {folderSaveSuccess && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" /> Uloženo! Nastavení bylo aktualizováno.
                    </span>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: AUDIT & ERROR LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Záznam operací a komunikace s Google Drive API:
                </span>
                <button
                  onClick={loadServerInfo}
                  disabled={isLoadingLogs}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span>Obnovit logy</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 max-h-[360px] overflow-y-auto font-mono text-xs space-y-1.5">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">Žádné záznamy k zobrazení.</div>
                ) : (
                  logs.map((log) => {
                    const timeStr = new Date(log.timestamp).toLocaleTimeString('cs-CZ');
                    const isError = log.type === 'error';
                    const isSuccess = log.type === 'success';
                    const isWarning = log.type === 'warning';

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-lg border text-[11px] flex flex-col gap-1 ${
                          isError
                            ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                            : isSuccess
                            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                            : isWarning
                            ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-75">
                          <span className="font-bold uppercase tracking-wider">{log.action}</span>
                          <span>{timeStr}</span>
                        </div>
                        <div className="font-sans text-xs break-words leading-relaxed">{log.details}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STEP-BY-STEP SERVICE ACCOUNT GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-700/50">
                <h4 className="font-bold text-white text-sm mb-1">
                  Jak vygenerovat Google Service Account JSON klíč pro Google Drive
                </h4>
                <p className="text-slate-300 text-xs">
                  Pro trvalý přístup k Google Disku bez nutnosti přihlašování muzikantů slouží Google Service Account. Postupujte podle těchto 5 kroků:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="font-bold text-white mb-1">1. Otevření Google Cloud Console</div>
                  <p>
                    Otevřete <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a>, přihlaste se a vyberte svůj projekt (např. <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">{serverStatus?.projectId || 'pepeto-setlists'}</code>).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="font-bold text-white mb-1">2. Povolení Google Drive API (ZÁSADNÍ)</div>
                  <p>
                    Klikněte přímo na aktivační odkaz: <a href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=219849626989" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold underline inline-flex items-center gap-0.5">Aktivovat Google Drive API <ExternalLink className="w-3 h-3" /></a> a klikněte na modré tlačítko <strong>Enable (Povolit)</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="font-bold text-white mb-1">3. Nasdílení složek na Disku e-mailu servisního účtu</div>
                  <p className="mb-2">
                    Otevřete svůj Google Disk a u zdrojové složky i exportní složky klikněte na <strong>Sdílet</strong>. Vložte e-mail vašeho servisního účtu a nastavte oprávnění <strong>Editor</strong>.
                  </p>
                  {serverStatus?.clientEmail && (
                    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="font-mono text-indigo-300 select-all flex-1">{serverStatus.clientEmail}</span>
                      <button
                        onClick={() => copyToClipboard(serverStatus.clientEmail || '', 'guide-email')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-2.5 py-1 rounded transition"
                      >
                        {copiedKey === 'guide-email' ? 'Zkopírováno' : 'Kopírovat'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
