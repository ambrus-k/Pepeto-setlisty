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
import { ExportModal, ExportProgressState } from './components/ExportModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastProvider, useToast } from './components/Toast';
import { ImportModal } from './components/ImportModal';
import { ManualPairModal } from './components/ManualPairModal';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
import { SongDetailModal } from './components/SongDetailModal';
import { importMssText, importXlsxBuffer, ImportResult } from './services/importSetlist';
import { enrichSongsWithDatabase, getBundledDatabaseSongs } from './services/songEnricher';

const DEFAULT_SETS: SetlistGroup[] = [
  { id: 'set-1', name: 'Set 1', songIds: [] },
  { id: 'set-2', name: 'Set 2', songIds: [] },
  { id: 'set-lidovky', name: 'Lidovky', isFixed: true, songIds: [], color: '#fef08a' },
  { id: 'set-zbytek', name: 'Zbytek', isFixed: true, songIds: [], color: '#cbd5e1' },
];

const DEFAULT_EXPORT_PROGRESS: ExportProgressState = {
  progress: 0,
  stepId: 'init',
  stepLabel: 'Připraveno',
  steps: [
    { id: 'prep', title: '1. Příprava dat listů a skladeb', desc: 'Kontrola pořadí, názvů a barevného kódování', status: 'pending' },
    { id: 'pdf', title: '2. Generování PDF archu', desc: 'Renderování tabulek, fontů a saxofonových tagů', status: 'pending' },
    { id: 'mss', title: '3. Tvorba MobileSheets XML', desc: 'Sestavení .mss struktury se SongId a názvy', status: 'pending' },
    { id: 'drive_auth', title: '4. Spojení s Google Cloud', desc: 'Autorizace a lokalizace exportní složky kapely', status: 'pending' },
    { id: 'drive_upload', title: '5. Synchronizace na Disk', desc: 'Zápis a uložení souborů na Google Disk', status: 'pending' },
  ],
  logs: [],
};

function SetlistStudio() {
  const isOnline = useOnlineStatus();
  const { role, logout } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

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
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [pairingSong, setPairingSong] = useState<Song | null>(null);
  const [inspectedSong, setInspectedSong] = useState<Song | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(DEFAULT_EXPORT_PROGRESS);

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
          const enrichedLocal = enrichSongsWithDatabase(savedSongs);
          setSongs(enrichedLocal);
        } else {
          // Provide bundled DB immediately while attempting live Google Drive sync
          const bundled = getBundledDatabaseSongs();
          if (bundled.length > 0) {
            setSongs(bundled);
          }
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
        const enrichedSongs = enrichSongsWithDatabase(data.songs, data.dbSongs);
        setSongs(enrichedSongs);
        await storage.saveSongs(enrichedSongs);
        const sourceNote = data.source === 'google-drive' ? 'z Google Disku' : 'z centrální databáze';
        setSyncMessage(`Úspěšně načteno ${enrichedSongs.length} skladeb ${sourceNote}!`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      // If we already have songs, don't wipe them
      const localSongs = await storage.getSongs();
      if (localSongs && localSongs.length > 0) {
        setSongs(enrichSongsWithDatabase(localSongs));
      } else {
        const bundled = getBundledDatabaseSongs();
        if (bundled.length > 0) {
          setSongs(bundled);
        }
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

  // 5. Import Handlers for .mss and .xlsx files
  const handleApplyImport = async (result: ImportResult) => {
    // A. Update Sets state
    if (result.sets && result.sets.length > 0) {
      setSets(result.sets);
      setActiveSetId(result.sets[0].id);
    }

    // B. Update Event Name
    if (result.eventName) {
      setEventName(result.eventName);
    }

    // C. Add or update songs in state & storage (preserving saxophone notes from Excel)
    if (result.newSongs && result.newSongs.length > 0) {
      setSongs((prevSongs) => {
        const songMap = new Map(prevSongs.map((s) => [s.id, s]));
        for (const s of result.newSongs) {
          songMap.set(s.id, s);
        }
        const updated = Array.from(songMap.values());
        storage.saveSongs(updated).catch(console.error);
        return updated;
      });
    }

    // D. User Feedback Toast
    if (result.unmatchedCount > 0) {
      showWarning(
        `Importováno ${result.sets.length} setů. ${result.matchedCount} skladeb napárováno, ${result.unmatchedCount} označeno v setu ke kontrole.`,
        'Import dokončen s upozorněním'
      );
    } else {
      showSuccess(
        `Úspěšně importováno ${result.sets.length} setů s ${result.totalSongs} skladbami (100% napárováno)!`,
        'Setlist byl načten'
      );
    }
  };

  const handleDirectFileImport = async (file: File) => {
    try {
      const fileName = file.name;
      const lower = fileName.toLowerCase();

      // Ensure library is available
      let currentSongs = songs;
      if (currentSongs.length === 0) {
        const saved = await storage.getSongs();
        if (saved && saved.length > 0) {
          currentSongs = saved;
          setSongs(saved);
        }
      }

      let result: ImportResult;
      if (lower.endsWith('.mss') || lower.endsWith('.xml')) {
        const text = await file.text();
        result = importMssText(text, currentSongs, fileName);
      } else if (
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel')
      ) {
        const buffer = await file.arrayBuffer();
        result = await importXlsxBuffer(buffer, currentSongs, fileName);
      } else {
        throw new Error('Nepodporovaný typ souboru. Zvolte soubor .mss (XML) nebo .xlsx (Excel).');
      }

      await handleApplyImport(result);
    } catch (err: any) {
      console.error('Direct file import error:', err);
      showError(err.message || 'Nastala chyba při importu souboru.', 'Chyba importu');
    }
  };

  // 6. Manual Song Pairing handler
  const handlePairSong = (tempId: number, targetMasterId: number) => {
    const targetSong = songs.find((s) => s.id === targetMasterId);

    // Replace tempId with targetMasterId in all sets
    setSets((prevSets) =>
      prevSets.map((s) => ({
        ...s,
        songIds: s.songIds.map((id) => (id === tempId ? targetMasterId : id)),
      }))
    );

    // Clean up temporary song from songs state if it was a negative ID
    if (tempId < 0) {
      setSongs((prev) => prev.filter((s) => s.id !== tempId));
    }

    showSuccess(
      `Skladba byla úspěšně spárována s "${targetSong ? targetSong.pdf_title : `#${targetMasterId}`}".`,
      'Spárováno'
    );
  };

  // Generator & Silent Backend Drive Export Execution with Real-Time Background Progress
  const handleGenerateAndSave = async () => {
    setIsExporting(true);
    setIsExportOpen(true);
    setDriveExportStatus({ state: 'uploading' });

    const formatTime = () => `[${new Date().toLocaleTimeString('cs-CZ')}]`;

    const pushLog = (msg: string) => {
      setExportProgress((prev) => ({
        ...prev,
        logs: [...prev.logs, `${formatTime()} ${msg}`],
      }));
    };

    const updateStep = (
      stepId: string,
      status: 'in_progress' | 'done' | 'error',
      progress: number,
      label: string,
      desc?: string
    ) => {
      setExportProgress((prev) => ({
        ...prev,
        progress,
        stepId,
        stepLabel: label,
        steps: prev.steps.map((st) =>
          st.id === stepId ? { ...st, status, desc: desc || st.desc } : st
        ),
      }));
    };

    const safeName = eventName.trim() || 'Setlist';
    const pdfFileName = `${safeName}.pdf`;
    const mssFileName = `${safeName}.mss`;

    try {
      // 0. Initialize & Reset progress
      setExportProgress({
        progress: 5,
        stepId: 'prep',
        stepLabel: 'Zahajuji proces exportu...',
        steps: DEFAULT_EXPORT_PROGRESS.steps.map((s) => ({ ...s, status: 'pending' })),
        logs: [`${formatTime()} Zahájeno generování exportních souborů pro: ${safeName}`],
      });

      // 1. Preparation of sets & songs
      updateStep('prep', 'in_progress', 15, 'Příprava listů a ověřování skladeb...');
      const activeSets = sets.filter((s) => s.songIds.length > 0);
      pushLog(`Načteno ${activeSets.length} listů k exportu (celkem ${totalSetSongs} zařazených skladeb).`);
      await new Promise((r) => setTimeout(r, 220));
      updateStep('prep', 'done', 25, 'Data listů připravena');

      // 2. Generate PDF Stage Sheet
      updateStep('pdf', 'in_progress', 35, 'Generuji barevné PDF pro pódium...');
      pushLog('Vykresluji tiskové stránky s českým fontem (CzechFont) a autentickými barvami...');
      const { blob: pdfBlob, dataUrl } = await generatePdf(eventName, sets, songsMap);
      setExportedPdfBlob(pdfBlob);
      setExportedPdfDataUrl(dataUrl);
      pushLog(`✓ PDF arch vytvořen (${(pdfBlob.size / 1024).toFixed(1)} kB, A4 tabulkový formát).`);
      updateStep('pdf', 'done', 55, 'PDF arch vygenerován');
      await new Promise((r) => setTimeout(r, 200));

      // 3. Generate MobileSheets XML
      updateStep('mss', 'in_progress', 65, 'Sestavuji MobileSheets XML strukturu...');
      pushLog('Generuji uzly <Setlist> a <Song> pro aplikaci MobileSheets...');
      const mssXml = generateMssXml(eventName, sets, songsMap);
      setExportedMssXml(mssXml);
      const mssSize = new Blob([mssXml]).size;
      pushLog(`✓ XML kód (.mss) zkompilován (${(mssSize / 1024).toFixed(1)} kB, UTF-8).`);
      updateStep('mss', 'done', 75, 'MobileSheets XML hotovo');
      await new Promise((r) => setTimeout(r, 200));

      // 4. Google Drive connection & upload
      if (isOnline) {
        updateStep('drive_auth', 'in_progress', 82, 'Připojuji se ke Google Disku...');
        pushLog('Ověřuji spojení se službou Google Drive API přes backend...');

        // Convert PDF blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(pdfBlob);
        });
        const pdfBase64 = await base64Promise;

        updateStep('drive_auth', 'done', 88, 'Google Drive API připojeno');
        updateStep('drive_upload', 'in_progress', 92, 'Ukládám soubory na Google Disk...');
        pushLog(`Odesílám soubory "${mssFileName}" a "${pdfFileName}" do exportní složky...`);

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
          pushLog(`✓ Úspěšně nahráno a potvrzeno Google Cloudem (ID souboru: ${data.mssFileId || 'export_ok'}).`);
          updateStep('drive_upload', 'done', 100, 'Uloženo na Google Disk');
          setDriveExportStatus({
            state: 'success',
            message: data.message || `Setlist "${mssFileName}" byl úspěšně uložen do exportní složky na Google Disku!`,
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Server vrátil chybu při exportu.');
        }
      } else {
        updateStep('drive_auth', 'done', 88, 'Offline režim');
        updateStep('drive_upload', 'done', 100, 'Uloženo do lokální paměti');
        pushLog('Offline režim: Export zařazen do lokální IndexedDB fronty pro pozdější synchronizaci.');

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
      pushLog(`❌ Chyba: ${err.message || 'Chyba při exportu'}`);
      updateStep('drive_upload', 'error', 100, 'Chyba při exportu');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors">
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
        onDirectFileImport={handleDirectFileImport}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenDisplaySettings={() => setIsDisplaySettingsOpen(true)}
      />

      {/* Sync feedback notification banner if any */}
      {syncMessage && (
        <div className="bg-indigo-100 dark:bg-indigo-900/80 border-b border-indigo-200 dark:border-indigo-700/50 py-1.5 px-4 text-center text-xs text-indigo-800 dark:text-indigo-200 font-semibold animate-fadeIn">
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
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-9.5rem)] min-h-[28rem]">
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
            onOpenManualPair={setPairingSong}
          />
        </section>

        {/* PRAVÝ SLOUPEC: Knihovna skladeb */}
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-9.5rem)] min-h-[28rem]">
          <LibraryColumn
            songs={songs}
            activeSet={activeSet}
            allSets={sets}
            onAddSongToActiveSet={handleAddSongToActiveSet}
            onInspectSong={setInspectedSong}
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
        sets={sets}
        songsMap={songsMap}
        isExporting={isExporting}
        exportProgress={exportProgress}
        driveStatus={driveExportStatus}
      />

      {/* Import Setlist Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        masterSongs={songs}
        onApplyImport={handleApplyImport}
      />

      {/* Manual Song Pairing Modal */}
      <ManualPairModal
        isOpen={pairingSong !== null}
        onClose={() => setPairingSong(null)}
        unmatchedSong={pairingSong}
        masterSongs={songs}
        onPairSong={handlePairSong}
      />

      {/* Display Settings Modal (accessible to all users) */}
      <DisplaySettingsModal
        isOpen={isDisplaySettingsOpen}
        onClose={() => setIsDisplaySettingsOpen(false)}
      {/* Song Detail (?) Modal */}
      <SongDetailModal
        song={inspectedSong}
        activeSetName={activeSet.name}
        isInActiveSet={inspectedSong ? activeSet.songIds.includes(inspectedSong.id) : false}
        onClose={() => setInspectedSong(null)}
        onAddSongToActiveSet={handleAddSongToActiveSet}
      />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs">
        <span className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mr-2" />
        <span>Načítám Setlist Studio...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <ToastProvider>
      <SetlistStudio />
    </ToastProvider>
  );
}
