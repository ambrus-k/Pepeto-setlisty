import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Song, SetlistGroup, EventProject, DriveSettings } from './types';
import { storage } from './services/storage';
import { parseMssXml, parseXlsx, pairMssAndXlsx } from './services/parser';
import { generateMssXml, generatePdf, downloadFile } from './services/exportGenerator';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/firebaseAuth';
import {
  getDriveFoldersStatus,
  findOrCreateFolder,
  getFolderById,
  uploadFileToFolder,
  downloadDriveFile,
  DEFAULT_FOLDER_DATA,
  DEFAULT_FOLDER_EXPORT,
  DEFAULT_FILE_MSS,
  DEFAULT_FILE_XLSX,
} from './services/googleDrive';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { SetTabs } from './components/SetTabs';
import { ActiveSetColumn } from './components/ActiveSetColumn';
import { LibraryColumn } from './components/LibraryColumn';
import { DriveSettingsModal } from './components/DriveSettingsModal';
import { ExportModal } from './components/ExportModal';
import { OfflineIndicator } from './components/OfflineIndicator';

const DEFAULT_SETS: SetlistGroup[] = [
  { id: 'set-1', name: 'Set 1', songIds: [] },
  { id: 'set-2', name: 'Set 2', songIds: [] },
  { id: 'set-lidovky', name: 'Lidovky', isFixed: true, songIds: [], color: '#fef08a' },
  { id: 'set-zbytek', name: 'Zbytek', isFixed: true, songIds: [], color: '#cbd5e1' },
];

export default function App() {
  const isOnline = useOnlineStatus();

  // App State - empty event and sets, strictly drawing from Google Drive
  const [eventName, setEventName] = useState<string>('');
  const [sets, setSets] = useState<SetlistGroup[]>(DEFAULT_SETS);
  const [activeSetId, setActiveSetId] = useState<string>('set-1');
  const [songs, setSongs] = useState<Song[]>([]);

  // User & Drive state
  const [user, setUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);

  // Configurable Drive Settings
  const [driveSettings, setDriveSettings] = useState<DriveSettings>({
    dataFolderName: DEFAULT_FOLDER_DATA,
    exportFolderName: DEFAULT_FOLDER_EXPORT,
    mssFileName: DEFAULT_FILE_MSS,
    xlsxFileName: DEFAULT_FILE_XLSX,
  });

  // Modals state
  const [isDriveSettingsOpen, setIsDriveSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Generated artifacts for Export Modal
  const [exportedPdfBlob, setExportedPdfBlob] = useState<Blob | null>(null);
  const [exportedPdfDataUrl, setExportedPdfDataUrl] = useState<string | null>(null);
  const [exportedMssXml, setExportedMssXml] = useState<string | null>(null);
  const [driveExportStatus, setDriveExportStatus] = useState<{
    state: 'idle' | 'uploading' | 'success' | 'offline_queued' | 'error';
    message?: string;
  }>({ state: 'idle' });

  // Map of songs by ID for fast lookup
  const songsMap = useMemo(() => {
    const map = new Map<number, Song>();
    for (const song of songs) {
      map.set(song.id, song);
    }
    return map;
  }, [songs]);

  // Current active set
  const activeSet = useMemo(() => {
    return sets.find((s) => s.id === activeSetId) || sets[0] || DEFAULT_SETS[0];
  }, [sets, activeSetId]);

  // 1. Initial Load from IndexedDB
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedSettings = await storage.getDriveSettings();
        if (savedSettings) {
          setDriveSettings(savedSettings);
        }

        const savedSongs = await storage.getSongs();
        if (savedSongs && savedSongs.length > 0) {
          setSongs(savedSongs);
        } else {
          setSongs([]);
        }

        const savedProject = await storage.getCurrentProject();
        if (savedProject) {
          if (savedProject.eventName && savedProject.eventName !== 'Oleško 22.08.2026') {
            setEventName(savedProject.eventName);
          }
          if (savedProject.sets && savedProject.sets.length > 0) {
            setSets(savedProject.sets);
          }
        }
      } catch (err) {
        console.error('Failed to load from IndexedDB:', err);
      }
    };

    loadSavedData();
  }, []);

  // 2. Auth state initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setDriveToken(token);
      },
      () => {
        setUser(null);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // 3. Check Google Drive folders when token or settings change
  const checkDriveStatus = useCallback(
    async (token: string, currentSettings?: DriveSettings) => {
      setIsLoadingDrive(true);
      try {
        const settingsToUse = currentSettings || driveSettings;
        const status = await getDriveFoldersStatus(token, settingsToUse);
        setDriveStatus(status);
      } catch (err) {
        console.error('Error checking Drive status:', err);
      } finally {
        setIsLoadingDrive(false);
      }
    },
    [driveSettings]
  );

  useEffect(() => {
    if (driveToken) {
      checkDriveStatus(driveToken, driveSettings);
    }
  }, [driveToken, driveSettings, checkDriveStatus]);

  // 4. Auto-save current project to IndexedDB
  useEffect(() => {
    const project: EventProject = {
      id: 'current-session',
      eventName,
      sets,
      updatedAt: Date.now(),
    };
    storage.saveCurrentProject(project).catch(console.error);
  }, [eventName, sets]);

  // Handle Google Auth
  const handleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setDriveToken(result.accessToken);
        await checkDriveStatus(result.accessToken, driveSettings);
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setDriveToken(null);
    setDriveStatus(null);
  };

  // Save new drive settings
  const handleSaveDriveSettings = async (newSettings: DriveSettings) => {
    setDriveSettings(newSettings);
    await storage.saveDriveSettings(newSettings);
    if (driveToken) {
      await checkDriveStatus(driveToken, newSettings);
    }
  };



  // Set Operations
  const handleAddSet = () => {
    const dynamicSets = sets.filter((s) => !s.isFixed);
    const newIndex = dynamicSets.length + 1;
    const newSet: SetlistGroup = {
      id: `set-${Date.now()}`,
      name: `Set ${newIndex}`,
      songIds: [],
    };

    // Insert before fixed sets
    const fixedSets = sets.filter((s) => s.isFixed);
    const updated = [...dynamicSets, newSet, ...fixedSets];
    setSets(updated);
    setActiveSetId(newSet.id);
  };

  const handleDeleteSet = (id: string) => {
    if (sets.length <= 1) return;
    const updated = sets.filter((s) => s.id !== id);
    setSets(updated);
    if (activeSetId === id) {
      setActiveSetId(updated[0].id);
    }
  };

  const handleAddSongToActiveSet = (song: Song) => {
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          if (s.songIds.includes(song.id)) return s;
          return { ...s, songIds: [...s.songIds, song.id] };
        }
        return s;
      })
    );
  };

  const handleMoveSongUp = (index: number) => {
    if (index === 0) return;
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          const list = [...s.songIds];
          const temp = list[index];
          list[index] = list[index - 1];
          list[index - 1] = temp;
          return { ...s, songIds: list };
        }
        return s;
      })
    );
  };

  const handleMoveSongDown = (index: number) => {
    if (index >= activeSet.songIds.length - 1) return;
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          const list = [...s.songIds];
          const temp = list[index];
          list[index] = list[index + 1];
          list[index + 1] = temp;
          return { ...s, songIds: list };
        }
        return s;
      })
    );
  };

  const handleRemoveSong = (index: number) => {
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          const list = [...s.songIds];
          list.splice(index, 1);
          return { ...s, songIds: list };
        }
        return s;
      })
    );
  };

  const handleMoveSongToSet = (fromIndex: number, targetSetId: string) => {
    const songId = activeSet.songIds[fromIndex];
    if (songId === undefined) return;

    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          const list = [...s.songIds];
          list.splice(fromIndex, 1);
          return { ...s, songIds: list };
        }
        if (s.id === targetSetId) {
          return { ...s, songIds: [...s.songIds, songId] };
        }
        return s;
      })
    );
  };

  const handleReorderSong = (dragIndex: number, hoverIndex: number) => {
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === activeSet.id) {
          const list = [...s.songIds];
          const [dragged] = list.splice(dragIndex, 1);
          list.splice(hoverIndex, 0, dragged);
          return { ...s, songIds: list };
        }
        return s;
      })
    );
  };

  const handleClearSet = () => {
    if (window.confirm(`Opravdu chcete vyprázdnit ${activeSet.name}?`)) {
      setSets((prevSets) =>
        prevSets.map((s) => (s.id === activeSet.id ? { ...s, songIds: [] } : s))
      );
    }
  };

  // Generator & Drive Export Execution
  const handleGenerateAndSave = async () => {
    setIsExporting(true);
    setDriveExportStatus({ state: 'uploading' });
    setIsExportOpen(true);

    try {
      // 1. Generate PDF
      const { blob: pdfBlob, dataUrl } = await generatePdf(eventName, sets, songsMap);
      setExportedPdfBlob(pdfBlob);
      setExportedPdfDataUrl(dataUrl);

      // 2. Generate MSS XML
      const mssXml = generateMssXml(eventName, sets, songsMap);
      setExportedMssXml(mssXml);

      const safeName = eventName.trim() || 'Setlist';
      const pdfFileName = `${safeName}.pdf`;
      const mssFileName = `${safeName}.mss`;

      // 3. Upload to Google Drive
      let token = driveToken;
      if (!token) {
        token = await getAccessToken();
      }

      if (isOnline && token) {
        // Resolve target export folder (by ID if configured or by name)
        let exportFolderId = driveSettings.exportFolderId;
        if (exportFolderId) {
          const verified = await getFolderById(exportFolderId, token);
          if (!verified) exportFolderId = undefined;
        }

        let targetFolderId = exportFolderId;
        if (!targetFolderId) {
          const folder = await findOrCreateFolder(driveSettings.exportFolderName, token);
          targetFolderId = folder.id;
        }

        // Upload PDF
        await uploadFileToFolder(
          targetFolderId,
          pdfFileName,
          'application/pdf',
          pdfBlob,
          token,
          async (fileName) => {
            return window.confirm(
              `Soubor "${fileName}" již ve složce "${driveSettings.exportFolderName}" existuje. Přejete si jej přepsat?`
            );
          }
        );

        // Upload MSS
        await uploadFileToFolder(
          targetFolderId,
          mssFileName,
          'text/xml',
          mssXml,
          token,
          async (fileName) => {
            return window.confirm(
              `Soubor "${fileName}" již ve složce "${driveSettings.exportFolderName}" existuje. Přejete si jej přepsat?`
            );
          }
        );

        setDriveExportStatus({ state: 'success' });
        // Refresh folder status to reflect new files
        await checkDriveStatus(token, driveSettings);
      } else {
        // Offline queue
        await storage.addPendingUpload({
          id: `upload-${Date.now()}-pdf`,
          eventName,
          fileName: pdfFileName,
          fileType: 'pdf',
          blobData: pdfBlob,
          createdAt: Date.now(),
          status: 'pending',
        });

        await storage.addPendingUpload({
          id: `upload-${Date.now()}-mss`,
          eventName,
          fileName: mssFileName,
          fileType: 'mss',
          blobData: new Blob([mssXml], { type: 'text/xml' }),
          createdAt: Date.now(),
          status: 'pending',
        });

        setDriveExportStatus({ state: 'offline_queued' });
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      setDriveExportStatus({
        state: 'error',
        message: err.message || 'Chyba při exportu',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Quick direct downloads
  const handleQuickDownloadPdf = async () => {
    const { blob } = await generatePdf(eventName, sets, songsMap);
    const safeName = eventName.trim() || 'Setlist';
    downloadFile(blob, `${safeName}.pdf`, 'application/pdf');
  };

  const handleQuickDownloadMss = () => {
    const xml = generateMssXml(eventName, sets, songsMap);
    const safeName = eventName.trim() || 'Setlist';
    downloadFile(xml, `${safeName}.mss`, 'text/xml');
  };

  // Drive sync handler: loads MSS and XLSX from the configured data folder
  const handleSyncFromDrive = async () => {
    if (!driveToken || !driveStatus?.dataFolder) return;
    setIsLoadingDrive(true);
    try {
      const { mssFile, xlsxFile } = driveStatus;
      if (!mssFile || !xlsxFile) {
        alert(
          `Ve složce "${driveStatus.dataFolderName}" chybí soubor MSS nebo XLSX.\n` +
            `Hledané soubory: ${driveSettings.mssFileName} a ${driveSettings.xlsxFileName}`
        );
        return;
      }

      // Download both files
      const mssBuffer = await downloadDriveFile(mssFile.id, driveToken);
      const xlsxBuffer = await downloadDriveFile(xlsxFile.id, driveToken);

      const mssText = new TextDecoder('utf-8').decode(mssBuffer);
      const parsedMss = parseMssXml(mssText);
      const parsedXlsx = await parseXlsx(xlsxBuffer);

      const paired = pairMssAndXlsx(parsedMss, parsedXlsx);
      setSongs(paired);
      await storage.saveSongs(paired);
      alert(`Úspěšně načteno a spárováno ${paired.length} skladeb ze složky "${driveStatus.dataFolderName}" na Google Disku!`);
    } catch (err: any) {
      console.error('Sync error:', err);
      alert(`Chyba při synchronizaci: ${err.message}`);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const totalSetSongs = useMemo(() => {
    return sets.reduce((sum, s) => sum + s.songIds.length, 0);
  }, [sets]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. Header with Event Name, Drive auth, and Export buttons */}
      <Header
        eventName={eventName}
        onEventNameChange={setEventName}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isOnline={isOnline}
        driveReady={!!driveStatus?.exportFolder}
        totalMasterSongs={songs.length}
        totalSetSongs={totalSetSongs}
        onOpenDataSources={() => setIsDriveSettingsOpen(true)}
        onGenerateAndSave={handleGenerateAndSave}
        onQuickDownloadPdf={handleQuickDownloadPdf}
        onQuickDownloadMss={handleQuickDownloadMss}
        isExporting={isExporting}
      />

      {/* 2. Sets Selector Tabs: [Set 1], [Set 2], [+ Přidat set], [Lidovky], [Zbytek] */}
      <SetTabs
        sets={sets}
        activeSetId={activeSet.id}
        onSelectSet={setActiveSetId}
        onAddSet={handleAddSet}
        onDeleteSet={handleDeleteSet}
      />

      {/* 3. Main Two-Column Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* LEVÝ SLOUPEC: Aktivní Set */}
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-175px)] min-h-[500px]">
          <ActiveSetColumn
            activeSet={activeSet}
            songsMap={songsMap}
            allSets={sets}
            onMoveSongUp={handleMoveSongUp}
            onMoveSongDown={handleMoveSongDown}
            onRemoveSong={handleRemoveSong}
            onMoveSongToSet={handleMoveSongToSet}
            onClearSet={handleClearSet}
            onReorderSong={handleReorderSong}
          />
        </section>

        {/* PRAVÝ SLOUPEC: Knihovna skladeb */}
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-175px)] min-h-[500px]">
          <LibraryColumn
            songs={songs}
            activeSet={activeSet}
            allSets={sets}
            onAddSongToActiveSet={handleAddSongToActiveSet}
            onOpenDataSources={() => setIsDriveSettingsOpen(true)}
          />
        </section>
      </main>

      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Google Drive Settings Modal: 2 functions (Source Data Folder & Export Folder) */}
      <DriveSettingsModal
        isOpen={isDriveSettingsOpen}
        onClose={() => setIsDriveSettingsOpen(false)}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        driveToken={driveToken}
        driveSettings={driveSettings}
        onSaveDriveSettings={handleSaveDriveSettings}
        driveStatus={driveStatus}
        isLoadingDrive={isLoadingDrive}
        onRefreshDrive={() => driveToken && checkDriveStatus(driveToken, driveSettings)}
        onSyncFromDrive={handleSyncFromDrive}
      />

      {/* Export & Drive Results Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        eventName={eventName}
        pdfBlob={exportedPdfBlob}
        pdfDataUrl={exportedPdfDataUrl}
        mssXml={exportedMssXml}
        driveStatus={driveExportStatus}
      />
    </div>
  );
}
