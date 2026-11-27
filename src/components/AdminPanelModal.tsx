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
  FileText,
  Code2,
  FileEdit,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { AdminLogEntry, ServerDriveStatus } from '../types';
import { useAuth } from '../context/AuthContext';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSync: (force: boolean) => Promise<void>;
  isSyncing: boolean;
  totalSongs: number;
  onLoadDriveSetlist?: (mssXml: string, fileName: string) => void | Promise<void>;
}

interface DriveSetlistFolderOption {
  key: string;
  label: string;
  folderId: string;
  kind: 'year' | 'osa';
  year?: number;
}

interface DriveSetlistFileEntry {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  folderKey: string;
  folderName: string;
  folderId: string;
  fileType: 'mss' | 'pdf';
}

interface YearFolderStatus {
  year: number;
  folderName: string;
  folderId: string;
  accessible: boolean;
}

interface TestReport {
  authOk: boolean;
  authMode?: 'oauth2' | 'service_account' | 'none';
  clientEmail?: string;
  projectId?: string;
  apiEnabled: boolean;
  activationUrl?: string;
  rootFolder?: {
    configured: boolean;
    folderId: string;
    accessible: boolean;
    folderName?: string;
    error?: string;
  };
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
  osaFolder?: {
    configured: boolean;
    folderId: string;
    accessible: boolean;
    folderName?: string;
    error?: string;
  };
  yearFolders?: YearFolderStatus[];
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

// Permanent default Google Drive folder IDs for Pepeto band ("Playlisty" hierarchy)
const PERMANENT_ROOT_FOLDER_ID = '148l9d_0G8INqEVa6RZa_Lo8vyH5RrUqJ';
const PERMANENT_DATA_FOLDER_ID = '1pZuDqPX6OVbGoYdfOg_p3DqJ0cEhAiq2';
const PERMANENT_OSA_FOLDER_ID = '1t-ZPYsLBE8RxsOk4hA8H8x0mmPyfyyR6';

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  onTriggerSync,
  isSyncing,
  totalSongs,
  onLoadDriveSetlist,
}) => {
  const { token, isAdminTokenVerified } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'setlists' | 'folders' | 'logs' | 'guide'>('overview');
  const [serverStatus, setServerStatus] = useState<ServerDriveStatus | null>(null);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Admin Drive Setlists browser state
  const [driveFolders, setDriveFolders] = useState<DriveSetlistFolderOption[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveSetlistFileEntry[]>([]);
  const [selectedSetlistFolder, setSelectedSetlistFolder] = useState<string>('all');
  const [isLoadingSetlists, setIsLoadingSetlists] = useState(false);
  const [setlistsConfigured, setSetlistsConfigured] = useState(true);
  const [setlistsNotice, setSetlistsNotice] = useState<string | null>(null);
  const [setlistsError, setSetlistsError] = useState<string | null>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  // Folder configuration state - prefilled permanently with band's structured folders
  const [rootFolderInput, setRootFolderInput] = useState(PERMANENT_ROOT_FOLDER_ID);
  const [dataFolderInput, setDataFolderInput] = useState(PERMANENT_DATA_FOLDER_ID);
  const [osaFolderInput, setOsaFolderInput] = useState(PERMANENT_OSA_FOLDER_ID);
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

  const loadDriveSetlistsBrowser = async (folderKey = selectedSetlistFolder) => {
    setIsLoadingSetlists(true);
    setSetlistsError(null);
    setSetlistsNotice(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(
        `/api/drive/setlists?folder=${encodeURIComponent(folderKey)}&t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Chyba serveru (${res.status}) při načítání seznamu setlistů.`);
      }
      setDriveFolders(Array.isArray(data.folders) ? data.folders : []);
      setDriveFiles(Array.isArray(data.files) ? data.files : []);
      setSetlistsConfigured(data.configured !== false);
      if (data.message) {
        setSetlistsNotice(data.message);
      }
    } catch (err: any) {
      setSetlistsError(err?.message || 'Nepodařilo se načíst seznam setlistů z Google Disku.');
    } finally {
      setIsLoadingSetlists(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'setlists') {
      loadDriveSetlistsBrowser(selectedSetlistFolder);
    }
  }, [isOpen, activeTab, selectedSetlistFolder, token]);

  const handleLoadFileForEdit = async (fileId: string, fileName: string) => {
    if (!onLoadDriveSetlist || loadingFileId) return;
    setLoadingFileId(fileId);
    setSetlistsError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(
        `/api/drive/setlists?fileId=${encodeURIComponent(fileId)}&t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false || !data.mssXml) {
        throw new Error(data.error || `Nepodařilo se stáhnout setlist „${fileName}“.`);
      }
      await onLoadDriveSetlist(data.mssXml, data.fileName || fileName);
      onClose();
    } catch (err: any) {
      setSetlistsError(err?.message || 'Nepodařilo se načíst vybraný setlist.');
    } finally {
      setLoadingFileId(null);
    }
  };

  const loadServerInfo = async () => {
    setIsLoadingLogs(true);
    try {
      const statusRes = await fetch('/api/drive/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        setServerStatus(data);
        setRootFolderInput(data.rootFolderId || data.exportFolderId || PERMANENT_ROOT_FOLDER_ID);
        setDataFolderInput(data.dataFolderId || PERMANENT_DATA_FOLDER_ID);
        setOsaFolderInput(data.osaFolderId || PERMANENT_OSA_FOLDER_ID);
      } else {
        setRootFolderInput(PERMANENT_ROOT_FOLDER_ID);
        setDataFolderInput(PERMANENT_DATA_FOLDER_ID);
        setOsaFolderInput(PERMANENT_OSA_FOLDER_ID);
      }

      const logsRes = await fetch('/api/admin/logs', {
        headers: { 'x-setlist-role': 'admin' },
        cache: 'no-store',
      });
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
        headers: {
          'Content-Type': 'application/json',
          'x-setlist-role': 'admin',
        },
        body: JSON.stringify({
          rootFolderId: rootFolderInput,
          dataFolderId: dataFolderInput,
          osaFolderId: osaFolderInput,
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Stav &amp; Diagnostika</span>
          </button>
          <button
            onClick={() => setActiveTab('setlists')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              activeTab === 'setlists'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Setlisty na Disku</span>
          </button>
          <button
            onClick={() => setActiveTab('folders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
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
                        Složka „Playlisty“ na Google Disku není plně přístupná!
                      </h4>
                      <p className="text-xs text-amber-200 mt-1">
                        Otevřete svůj Google Disk, klikněte na nadřazenou složku <strong>Playlisty</strong> pravým tlačítkem na <strong>Sdílet</strong> a nastavte pro účet aplikace oprávnění <strong>Editor</strong> (všechny podsložky přístup automaticky zdědí):
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

              {/* Overwrite Permissions Status Card */}
              <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Oprávnění zápisu a přepisování setlistů</span>
                  </span>
                  {isAdminTokenVerified ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Admin token ověřen serverem (přepis povolen)</span>
                    </span>
                  ) : token ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Admin token čeká na ověření / offline</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Chybí serverový token – při přepisu zadejte Admin PIN</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                  <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/50 px-2.5 py-2">
                    <strong className="text-emerald-300 block">Správce (Admin PIN)</strong>
                    <span>
                      Může <strong>opravovat a přepisovat</strong> existující setlisty na Disku (.mss, .pdf i Osa seznam) po potvrzení v exportním dialogu.
                    </span>
                  </div>
                  <div className="rounded-lg bg-amber-950/30 border border-amber-800/50 px-2.5 py-2">
                    <strong className="text-amber-300 block">Ostatní uživatelé (PIN muzikant)</strong>
                    <span>
                      Mohou <strong>pouze vytvářet nové</strong> setlisty. Přepsání existujících souborů je na serveru zablokováno (HTTP 409).
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <span className="text-slate-400 block text-[11px]">Zdrojová složka (Play listy MobileSheets_data):</span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">
                      {testReport?.dataFolder?.folderName || serverStatus?.dataFolderId || PERMANENT_DATA_FOLDER_ID}
                    </span>
                    {testReport?.dataFolder?.accessible ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                        <CheckCircle className="w-3 h-3" /> Přístupná
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                        <CheckCircle className="w-3 h-3" /> Nastaveno stálé ID
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
                  <span className="text-slate-400 block text-[11px]">Složka pro OSA (Osa seznam):</span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">
                      {testReport?.osaFolder?.folderName || serverStatus?.osaFolderId || PERMANENT_OSA_FOLDER_ID}
                    </span>
                    {testReport?.osaFolder?.accessible ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                        <CheckCircle className="w-3 h-3" /> Přístupná
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                        <CheckCircle className="w-3 h-3" /> Nastaveno stálé ID
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                    Aktivní počet skladeb v aplikaci: <strong className="text-white">{totalSongs} skladeb</strong>
                  </div>
                </div>
              </div>

              {/* Root Playlisty & Yearly Subfolders Card */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Nadřazená složka exportů (Playlisty) a automatické roční podsložky:
                    </span>
                    <span className="font-bold text-white">
                      {testReport?.rootFolder?.folderName || 'Playlisty'} ({serverStatus?.rootFolderId || PERMANENT_ROOT_FOLDER_ID})
                    </span>
                  </div>
                  {testReport?.rootFolder?.accessible ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                      <CheckCircle className="w-3 h-3" /> Přístupná
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                      <CheckCircle className="w-3 h-3" /> Nastaveno stálé ID
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-700/60">
                  {(testReport?.yearFolders && testReport.yearFolders.length > 0
                    ? testReport.yearFolders
                    : [2025, 2026, 2027, 2028, 2029].map((year) => ({
                        year,
                        folderName: `Playlisty ${year}`,
                        folderId: serverStatus?.yearFolderIds?.[String(year)] || '',
                        accessible: false,
                      }))
                  ).map((yf) => (
                    <span
                      key={yf.year}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                        yf.accessible
                          ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                      title={yf.folderId ? `ID: ${yf.folderId}` : 'Nenalezeno'}
                    >
                      {yf.accessible ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Folder className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{yf.folderName}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1b: ADMIN DRIVE SETLISTS BROWSER */}
          {activeTab === 'setlists' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-emerald-400" />
                    <span>Existující setlisty na Google Disku (pouze pro správce)</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Vyberte uložený setlist (.mss), načtěte ho do editoru a po úpravě jej přes <strong>Export MSS na Disk</strong> přepište.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadDriveSetlistsBrowser(selectedSetlistFolder)}
                  disabled={isLoadingSetlists}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 transition cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSetlists ? 'animate-spin' : ''}`} />
                  <span>Obnovit seznam</span>
                </button>
              </div>

              {/* Folder Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedSetlistFolder('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    selectedSetlistFolder === 'all'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Všechny roční složky
                </button>
                {driveFolders.map((folder) => (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => setSelectedSetlistFolder(folder.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      selectedSetlistFolder === folder.key
                        ? folder.kind === 'osa'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {folder.label}
                  </button>
                ))}
              </div>

              {setlistsError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/70 text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{setlistsError}</span>
                </div>
              )}

              {!setlistsConfigured && setlistsNotice && (
                <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{setlistsNotice}</span>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/80 max-h-[340px] overflow-y-auto">
                {isLoadingSetlists ? (
                  <div className="py-10 text-center text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Načítám seznam souborů z Google Disku…</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">
                    {setlistsConfigured
                      ? 'Ve zvolené složce zatím nejsou žádné exportované soubory (.mss / .pdf).'
                      : 'Lokální náhled bez aktivního Google Disk připojení.'}
                  </div>
                ) : (
                  driveFiles.map((file) => {
                    const sizeKb = file.size
                      ? `${Math.max(1, Math.round(parseInt(file.size, 10) / 1024))} kB`
                      : '';
                    const modifiedLabel = file.modifiedTime
                      ? new Date(file.modifiedTime).toLocaleString('cs-CZ')
                      : '';
                    const isMss = file.fileType === 'mss';
                    const isLoadingThis = loadingFileId === file.id;

                    return (
                      <div
                        key={file.id}
                        className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/70 transition"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isMss ? (
                            <Code2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <FileText className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{file.name}</div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-mono">
                                {file.folderName}
                              </span>
                              {modifiedLabel && <span>{modifiedLabel}</span>}
                              {sizeKb && <span className="font-mono">{sizeKb}</span>}
                            </div>
                          </div>
                        </div>

                        {isMss && onLoadDriveSetlist && (
                          <button
                            type="button"
                            onClick={() => handleLoadFileForEdit(file.id, file.name)}
                            disabled={Boolean(loadingFileId)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 transition cursor-pointer shrink-0"
                          >
                            {isLoadingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileEdit className="w-3.5 h-3.5" />
                            )}
                            <span>{isLoadingThis ? 'Načítám…' : 'Načíst k opravě'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
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
                    <span>Nastavení strukturovaných Google Drive složek</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Roční exportní podsložky (<strong>Playlisty 2025–2029+</strong>) se vyhledávají automaticky uvnitř hlavní složky <strong>Playlisty</strong>. Můžete vložit ID nebo celý URL odkaz složky.
                </p>

                {/* Root Playlisty Folder Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    1. Hlavní složka „Playlisty“ (obsahuje roční složky Playlisty 2025–2029+):
                  </label>
                  <input
                    type="text"
                    value={rootFolderInput}
                    onChange={(e) => setRootFolderInput(e.target.value)}
                    placeholder="Vložte URL nebo ID složky Playlisty..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Stálé ID složky Playlisty: <code className="text-indigo-300 font-mono">{serverStatus?.rootFolderId || PERMANENT_ROOT_FOLDER_ID}</code>
                  </span>
                </div>

                {/* Data Folder Input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-200">
                    2. Zdrojová složka dat („Play listy MobileSheets_data“ – PEPETO_KOMPLET_SETLIST.mss a PEPETA_KOMPLET.xlsx):
                  </label>
                  <input
                    type="text"
                    value={dataFolderInput}
                    onChange={(e) => setDataFolderInput(e.target.value)}
                    placeholder="Vložte URL nebo ID zdrojové složky..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Stálé ID složky Data: <code className="text-indigo-300 font-mono">{serverStatus?.dataFolderId || PERMANENT_DATA_FOLDER_ID}</code>
                  </span>
                </div>

                {/* OSA Folder Input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-200">
                    3. Složka pro OSA seznamy („Osa seznam“ – ukládá PDF pro OSA):
                  </label>
                  <input
                    type="text"
                    value={osaFolderInput}
                    onChange={(e) => setOsaFolderInput(e.target.value)}
                    placeholder="Vložte URL nebo ID složky Osa seznam..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Stálé ID složky Osa seznam: <code className="text-indigo-300 font-mono">{serverStatus?.osaFolderId || PERMANENT_OSA_FOLDER_ID}</code>
                  </span>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingFolders}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingFolders ? 'Ukládám...' : 'Uložit nastavení složek'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRootFolderInput(PERMANENT_ROOT_FOLDER_ID);
                        setDataFolderInput(PERMANENT_DATA_FOLDER_ID);
                        setOsaFolderInput(PERMANENT_OSA_FOLDER_ID);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs px-3 py-2.5 rounded-xl transition border border-slate-700 active:scale-95 cursor-pointer"
                      title="Obnovit stálá ID složek kapely Pepeto"
                    >
                      Obnovit stálé složky
                    </button>
                  </div>

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
                  <div className="font-bold text-white mb-1">3. Nasdílení nadřazené složky „Playlisty“ na Disku</div>
                  <p className="mb-2">
                    Otevřete svůj Google Disk, najděte nadřazenou složku <strong>Playlisty</strong> (která obsahuje <em>Play listy MobileSheets_data</em>, roční složky <em>Playlisty 2025–2029</em> a <em>Osa seznam</em>), klikněte na <strong>Sdílet</strong> a nastavte oprávnění <strong>Editor</strong> (všechny podsložky přístup automaticky zdědí).
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
