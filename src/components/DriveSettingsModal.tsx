import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Folder,
  FolderOpen,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  Link,
  RefreshCw,
  ExternalLink,
  LogOut,
  LogIn,
  Check,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveSettings, DriveFolderInfo } from '../types';
import {
  listAvailableFolders,
  resolveFolder,
  getFolderById,
  DEFAULT_FOLDER_DATA,
  DEFAULT_FOLDER_EXPORT,
} from '../services/googleDrive';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  driveToken: string | null;
  driveSettings: DriveSettings;
  onSaveDriveSettings: (settings: DriveSettings) => Promise<void>;
  driveStatus: any;
  isLoadingDrive: boolean;
  onRefreshDrive: () => void;
  onSyncFromDrive: () => Promise<void>;
}

export const DriveSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  onSignIn,
  onSignOut,
  driveToken,
  driveSettings,
  onSaveDriveSettings,
  driveStatus,
  isLoadingDrive,
  onRefreshDrive,
  onSyncFromDrive,
}) => {
  // Folder Picker sub-view state
  const [pickingMode, setPickingMode] = useState<'data' | 'export' | null>(null);
  const [foldersList, setFoldersList] = useState<DriveFolderInfo[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Direct input fields
  const [directDataInput, setDirectDataInput] = useState('');
  const [directExportInput, setDirectExportInput] = useState('');
  const [isResolvingData, setIsResolvingData] = useState(false);
  const [isResolvingExport, setIsResolvingExport] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load folders when picker is opened
  useEffect(() => {
    if (pickingMode && driveToken) {
      loadFolders();
    }
  }, [pickingMode, driveToken]);

  const loadFolders = async (search?: string) => {
    if (!driveToken) return;
    setIsLoadingFolders(true);
    setFetchError('');
    try {
      const list = await listAvailableFolders(driveToken, search);
      setFoldersList(list);
    } catch (err: any) {
      console.error('Error fetching folders:', err);
      setFetchError(err.message || 'Nepodařilo se načíst složky z Disku.');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  if (!isOpen) return null;

  // Handle selecting a folder from the list
  const handleSelectFromList = async (folder: DriveFolderInfo) => {
    if (pickingMode === 'data') {
      await onSaveDriveSettings({
        ...driveSettings,
        dataFolderName: folder.name,
        dataFolderId: folder.id,
      });
    } else if (pickingMode === 'export') {
      await onSaveDriveSettings({
        ...driveSettings,
        exportFolderName: folder.name,
        exportFolderId: folder.id,
      });
    }
    setPickingMode(null);
    setFolderSearch('');
  };

  // Direct resolve for Data Folder
  const handleResolveDataFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directDataInput.trim() || !driveToken) return;
    setIsResolvingData(true);
    try {
      const found = await resolveFolder(directDataInput, driveToken);
      if (found) {
        await onSaveDriveSettings({
          ...driveSettings,
          dataFolderName: found.name,
          dataFolderId: found.id,
        });
        setDirectDataInput('');
      } else {
        alert('Složka nebyla na Google Disku nalezena. Zkontrolujte odkaz nebo oprávnění.');
      }
    } catch (err: any) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setIsResolvingData(false);
    }
  };

  // Direct resolve for Export Folder
  const handleResolveExportFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directExportInput.trim() || !driveToken) return;
    setIsResolvingExport(true);
    try {
      const found = await resolveFolder(directExportInput, driveToken);
      if (found) {
        await onSaveDriveSettings({
          ...driveSettings,
          exportFolderName: found.name,
          exportFolderId: found.id,
        });
        setDirectExportInput('');
      } else {
        alert('Složka nebyla na Google Disku nalezena. Zkontrolujte odkaz nebo oprávnění.');
      }
    } catch (err: any) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setIsResolvingExport(false);
    }
  };

  // Trigger Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await onSyncFromDrive();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err: any) {
      alert(`Chyba při načítání skladeb: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered folders in picker
  const filteredFolders = foldersList.filter((f) =>
    f.name.toLowerCase().includes(folderSearch.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 sm:p-6 text-slate-100 space-y-5 my-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Propojení s Google Diskem</h2>
              <p className="text-xs text-slate-400">
                Pouze 2 nastavení: Zdrojová složka a Exportní složka (jakýkoliv název na Disku)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Account Status Bar */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {user && driveToken ? (
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Google Disk připojen</p>
                <p className="text-[11px] text-slate-400">{user.email || user.displayName}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Google Disk není připojen
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pro přístup k vašim a sdíleným složkám se nejprve přihlaste.
              </p>
            </div>
          )}

          {user && driveToken ? (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onRefreshDrive}
                disabled={isLoadingDrive}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                title="Znovu zkontrolovat složky na Disku"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                <span>Obnovit</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1.5 flex items-center gap-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Odhlásit</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow active:scale-95 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Připojit Google Disk</span>
            </button>
          )}
        </div>

        {/* -------------------- INLINE FOLDER PICKER OVERLAY -------------------- */}
        {pickingMode ? (
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" />
                <span>
                  {pickingMode === 'data'
                    ? 'Vyberte složku pro Zdrojová Data (MSS a XLSX)'
                    : 'Vyberte složku pro Export (PDF a MSS)'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPickingMode(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Zrušit
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder="Hledat mezi složkami na Disku..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {fetchError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800/50">
                {fetchError}
              </p>
            )}

            {/* List of Folders */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {isLoadingFolders ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Načítám složky z Google Disku...</span>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Žádná složka nenalezena. Můžete vložit její odkaz přímo níže.
                </div>
              ) : (
                filteredFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleSelectFromList(folder)}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600 text-slate-200 hover:text-white flex items-center justify-between text-xs transition group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-indigo-400 group-hover:text-white shrink-0" />
                      <span className="font-semibold truncate">{folder.name}</span>
                      {folder.isShared && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 group-hover:bg-amber-400 group-hover:text-slate-950 font-bold shrink-0">
                          🤝 Sdíleno
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-indigo-200 shrink-0 font-mono">
                      Zvolit
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* -------------------- 2 MAIN FUNCTIONS -------------------- */
          <div className="space-y-4">
            {/* 1. ZDROJOVÁ SLOŽKA (MSS & XLSX) */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Folder className="w-4 h-4" /> 1. Složka na zdrojová data (MSS a XLSX)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Jakákoliv složka s jakýmkoliv názvem, kde jsou uložena data kapely.
                  </p>
                </div>

                {driveStatus?.dataFolder ? (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Nastaveno
                    </span>
                    <a
                      href={`https://drive.google.com/drive/folders/${driveStatus.dataFolder.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline"
                    >
                      <span>Otevřít</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[11px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md self-start sm:self-auto">
                    Složka zatím nevybrána
                  </span>
                )}
              </div>

              {/* Current Selected Folder Display */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-white truncate block">
                      {driveStatus?.dataFolder?.name || driveSettings.dataFolderName || 'Nevybráno'}
                    </span>
                    {driveStatus?.dataFolder?.isShared && (
                      <span className="text-[10px] text-amber-300 font-medium">
                        🤝 Složka sdílená od kapely Pepet
                      </span>
                    )}
                  </div>
                </div>

                {/* Button to Open Picker */}
                <button
                  type="button"
                  onClick={() => setPickingMode('data')}
                  disabled={!driveToken}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow shrink-0 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Vybrat z Disku</span>
                </button>
              </div>

              {/* Or paste link / name */}
              <form onSubmit={handleResolveDataFolder} className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={directDataInput}
                    onChange={(e) => setDirectDataInput(e.target.value)}
                    placeholder="Nebo vložte webový odkaz či název složky..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isResolvingData || !directDataInput.trim() || !driveToken}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition shrink-0"
                >
                  {isResolvingData ? '...' : 'Nastavit'}
                </button>
              </form>

              {/* Detected Data Files Status */}
              {driveStatus?.dataFolder && (
                <div className="pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">MSS soubor:</span>
                        {driveStatus.hasMssFile ? (
                          <span className="font-bold text-emerald-400 truncate">
                            {driveStatus.mssFile?.name}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">Nenalezen žádný .mss soubor</span>
                        )}
                      </div>
                      {driveStatus.hasMssFile && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-bold shrink-0">
                          OK
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">XLSX soubor:</span>
                        {driveStatus.hasXlsxFile ? (
                          <span className="font-bold text-emerald-400 truncate">
                            {driveStatus.xlsxFile?.name}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">Nenalezen žádný .xlsx soubor</span>
                        )}
                      </div>
                      {driveStatus.hasXlsxFile && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-bold shrink-0">
                          OK
                        </span>
                      )}
                    </div>

                    {driveStatus.hasMssFile && driveStatus.hasXlsxFile && (
                      <button
                        type="button"
                        onClick={handleTriggerSync}
                        disabled={isSyncing}
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg transition shadow flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>
                          {syncSuccess ? 'Data úspěšně načtena do aplikace!' : 'Načíst skladby do aplikace'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. EXPORTNÍ SLOŽKA (PDF & MSS) */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                    <Folder className="w-4 h-4" /> 2. Složka pro export hotových souborů
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Jakákoliv složka s jakýmkoliv názvem pro ukládání vygenerovaných PDF a MSS.
                  </p>
                </div>

                {driveStatus?.exportFolder ? (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Nastaveno
                    </span>
                    <a
                      href={`https://drive.google.com/drive/folders/${driveStatus.exportFolder.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline"
                    >
                      <span>Otevřít</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[11px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md self-start sm:self-auto">
                    Složka zatím nevybrána
                  </span>
                )}
              </div>

              {/* Current Selected Folder Display */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-5 h-5 text-violet-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-white truncate block">
                      {driveStatus?.exportFolder?.name || driveSettings.exportFolderName || 'Nevybráno'}
                    </span>
                    {driveStatus?.exportFolder?.isShared && (
                      <span className="text-[10px] text-amber-300 font-medium">
                        🤝 Složka sdílená od kapely Pepet
                      </span>
                    )}
                  </div>
                </div>

                {/* Button to Open Picker */}
                <button
                  type="button"
                  onClick={() => setPickingMode('export')}
                  disabled={!driveToken}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow shrink-0 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Vybrat z Disku</span>
                </button>
              </div>

              {/* Or paste link / name */}
              <form onSubmit={handleResolveExportFolder} className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={directExportInput}
                    onChange={(e) => setDirectExportInput(e.target.value)}
                    placeholder="Nebo vložte webový odkaz či název složky..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isResolvingExport || !directExportInput.trim() || !driveToken}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition shrink-0"
                >
                  {isResolvingExport ? '...' : 'Nastavit'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
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
