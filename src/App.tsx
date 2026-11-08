import React, { useState, useEffect, useMemo } from 'react';
import { Song, SetlistGroup, EventProject } from './types';
import { storage } from './services/storage';
import { generateMssXml, generatePdf, downloadFile } from './services/exportGenerator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { SetTabs } from './components/SetTabs';
import { ActiveSetColumn } from './components/ActiveSetColumn';
import { LibraryColumn } from './components/LibraryColumn';
import { ExportModal } from './components/ExportModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { OfflineIndicator } from './components/OfflineIndicator';

const DEFAULT_SETS: SetlistGroup[] = [
  { id: 'set-1', name: 'Set 1', songIds: [] },
  { id: 'set-2', name: 'Set 2', songIds: [] },
  { id: 'set-lidovky', name: 'Lidovky', isFixed: true, songIds: [], color: '#fef08a' },
  { id: 'set-zbytek', name: 'Zbytek', isFixed: true, songIds: [], color: '#cbd5e1' },
];

function SetlistStudio() {
  const isOnline = useOnlineStatus();
  const { role, logout } = useAuth();

  // App State - event name and setlist groups
  const [eventName, setEventName] = useState<string>('');
  const [sets, setSets] = useState<SetlistGroup[]>(DEFAULT_SETS);
  const [activeSetId, setActiveSetId] = useState<string>('set-1');
  const [songs, setSongs] = useState<Song[]>([]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
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

  // Total songs in active sets
  const totalSetSongs = useMemo(() => {
    return sets.reduce((sum, s) => sum + s.songIds.length, 0);
  }, [sets]);

  // 1. Initial Load from IndexedDB
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedSongs = await storage.getSongs();
        if (savedSongs && savedSongs.length > 0) {
          setSongs(savedSongs);
        } else {
          // If IndexedDB is empty, trigger initial fetch from backend API
          handleSyncDatabase(false);
        }

        const savedProject = await storage.getCurrentProject();
        if (savedProject) {
          if (savedProject.eventName) {
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

  // 2. Auto-save current project to IndexedDB
  useEffect(() => {
    const project: EventProject = {
      id: 'current-session',
      eventName,
      sets,
      updatedAt: Date.now(),
    };
    storage.saveCurrentProject(project).catch(console.error);
  }, [eventName, sets]);

  // 3. Sync Database from Backend API (/api/drive/sync)
  const handleSyncDatabase = async (force = false) => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const url = force ? '/api/drive/sync?force=true' : '/api/drive/sync';
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Chyba serveru (${res.status})`);
      }

      const data = await res.json();
      if (data.songs && Array.isArray(data.songs) && data.songs.length > 0) {
        setSongs(data.songs);
        await storage.saveSongs(data.songs);
        const sourceNote = data.source === 'google-drive' ? 'z Google Disku' : 'z centrální databáze';
        setSyncMessage(`Úspěšně načteno ${data.songs.length} skladeb ${sourceNote}!`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      // If we already have songs, don't wipe them
      const localSongs = await storage.getSongs();
      if (localSongs && localSongs.length > 0) {
        setSongs(localSongs);
      }
      setSyncMessage(`Chyba při synchronizaci: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Process offline export queue automatically when back online
  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      try {
        const pending = await storage.getPendingUploads();
        if (!pending || pending.length === 0) return;

        let syncedCount = 0;
        for (const item of pending) {
          try {
            let mssXml = '';
            if (item.fileType === 'mss') {
              mssXml = await item.blobData.text();
            }
            const res = await fetch('/api/drive/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.fileName,
                mssXml: mssXml || undefined,
                eventName: item.eventName,
              }),
            });
            if (res.ok) {
              await storage.removePendingUpload(item.id);
              syncedCount++;
            }
          } catch (itemErr) {
            console.warn('Could not sync offline item:', itemErr);
          }
        }

        if (syncedCount > 0) {
          setSyncMessage(`Připojení obnoveno: ${syncedCount} offline export(y) byly automaticky uloženy na Google Disk!`);
          setTimeout(() => setSyncMessage(null), 5000);
        }
      } catch (qErr) {
        console.warn('Queue processing error:', qErr);
      }
    };

    processQueue();
  }, [isOnline]);

  // Set Operations
  const handleAddSet = () => {
    const dynamicSets = sets.filter((s) => !s.isFixed);
    const newIndex = dynamicSets.length + 1;
    const newSet: SetlistGroup = {
      id: `set-${Date.now()}`,
      name: `Set ${newIndex}`,
      songIds: [],
    };

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
    setSets((prevSets) =>
      prevSets.map((s) => (s.id === activeSet.id ? { ...s, songIds: [] } : s))
    );
  };

  // Generator & Silent Backend Drive Export Execution
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

      // 3. Silent Backend Google Drive Upload via /api/drive/export
      if (isOnline) {
        // Convert pdfBlob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(pdfBlob);
        });
        const pdfBase64 = await base64Promise;

        const res = await fetch('/api/drive/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: mssFileName,
            mssXml,
            pdfBase64,
            eventName: safeName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setDriveExportStatus({
            state: 'success',
            message: data.message || `Setlist "${mssFileName}" byl tiše uložen do exportní složky na Google Disku!`,
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Server vrátil chybu při exportu.');
        }
      } else {
        // Offline queue in IndexedDB
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
        message: err.message || 'Chyba při ukládání na Google Disk.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Quick downloads
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. Header with Event Name, Role badge, and Export buttons */}
      <Header
        eventName={eventName}
        onEventNameChange={setEventName}
        role={role || 'user'}
        onLogout={logout}
        isOnline={isOnline}
        totalMasterSongs={songs.length}
        totalSetSongs={totalSetSongs}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        onSyncDatabase={() => handleSyncDatabase(false)}
        isSyncing={isSyncing}
        onGenerateAndSave={handleGenerateAndSave}
        onQuickDownloadPdf={handleQuickDownloadPdf}
        onQuickDownloadMss={handleQuickDownloadMss}
        isExporting={isExporting}
      />

      {/* Sync feedback notification banner if any */}
      {syncMessage && (
        <div className="bg-indigo-900/80 border-b border-indigo-700/50 py-1.5 px-4 text-center text-xs text-indigo-200 font-semibold animate-fadeIn">
          {syncMessage}
        </div>
      )}

      {/* 2. Sets Selector Tabs: [Set 1], [Set 2], [+ Přidat set], [Lidovky], [Zbytek] */}
      <SetTabs
        sets={sets}
        activeSetId={activeSet.id}
        onSelectSet={setActiveSetId}
        onAddSet={handleAddSet}
        onDeleteSet={handleDeleteSet}
      />

      {/* 3. Main Two-Column Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 overflow-hidden">
        {/* LEVÝ SLOUPEC: Aktivní Set */}
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-148px)] min-h-[500px]">
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
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-148px)] min-h-[500px]">
          <LibraryColumn
            songs={songs}
            activeSet={activeSet}
            allSets={sets}
            onAddSongToActiveSet={handleAddSongToActiveSet}
            onSyncDatabase={() => handleSyncDatabase(false)}
          />
        </section>
      </main>

      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Admin Panel Modal (Admin role only) */}
      {role === 'admin' && (
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          onTriggerSync={handleSyncDatabase}
          isSyncing={isSyncing}
          totalSongs={songs.length}
        />
      )}

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

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <span className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mr-2" />
        <span>Načítám Setlist Studio...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <SetlistStudio />;
}
