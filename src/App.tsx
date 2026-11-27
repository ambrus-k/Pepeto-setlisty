import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Song, SetlistGroup, EventProject } from './types';
import { storage } from './services/storage';
import {
  generateMssXml,
  generatePdf,
  downloadFile,
  generateOsaPdf,
  buildOsaSongRows,
  buildOsaFileBaseName,
  OsaSongRow,
} from './services/exportGenerator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { SetTabs, PaneSide } from './components/SetTabs';
import { CommanderToolbar } from './components/CommanderToolbar';
import { CommanderPane, PaneDisplayRow } from './components/CommanderPane';
import { ExportModal, ExportProgressState } from './components/ExportModal';
import { OsaExportModal, OsaDriveStatus } from './components/OsaExportModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastProvider, useToast } from './components/Toast';
import { ImportModal } from './components/ImportModal';
import { ManualPairModal } from './components/ManualPairModal';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
import { SongDetailModal } from './components/SongDetailModal';
import { SetlistManagerModal } from './components/SetlistManagerModal';
import { importMssText, importXlsxBuffer, ImportResult } from './services/importSetlist';
import { enrichSongsWithDatabase, getBundledDatabaseSongs } from './services/songEnricher';
import {
  SongFilterState,
  DEFAULT_SONG_FILTER,
  buildCategoryOptions,
  extractSingers,
  hasAnySearchOrFilter,
  matchesSongFilter,
  compareSongsBySort,
} from './utils/songFilters';

const MAX_HISTORY_STEPS = 5;

interface HistorySnapshot {
  eventName: string;
  sets: SetlistGroup[];
  label: string;
}

function cloneSets(sets: SetlistGroup[]): SetlistGroup[] {
  return sets.map((s) => ({ ...s, songIds: [...s.songIds] }));
}

const DEFAULT_LIDOVKY_SONG_IDS = [503, 518, 501, 506, 519, 514, 504, 523, 502];

const DEFAULT_SETS: SetlistGroup[] = [
  { id: 'set-1', name: 'Set 1', songIds: [] },
  { id: 'set-2', name: 'Set 2', songIds: [] },
  { id: 'set-lidovky', name: 'Lidovky', isFixed: true, songIds: [...DEFAULT_LIDOVKY_SONG_IDS], color: '#fef08a' },
  { id: 'set-zbytek', name: 'Zbytek', isFixed: true, songIds: [], color: '#cbd5e1' },
];

function createFreshSets(): SetlistGroup[] {
  const ts = Date.now();
  const numbered: SetlistGroup[] = Array.from({ length: 9 }, (_, i) => ({
    id: `set-${ts}-${i + 1}`,
    name: `Set ${i + 1}`,
    songIds: [],
    isFixed: false,
  }));
  return [
    ...numbered,
    { id: `set-${ts}-lidovky`, name: 'Lidovky', isFixed: true, songIds: [...DEFAULT_LIDOVKY_SONG_IDS], color: '#fef08a' },
    { id: `set-${ts}-zbytek`, name: 'Zbytek', isFixed: true, songIds: [], color: '#cbd5e1' },
  ];
}

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

function formatCzechSongCount(count: number): string {
  if (count === 1) return '1 skladba';
  if (count >= 2 && count <= 4) return `${count} skladby`;
  return `${count} skladeb`;
}

function buildPaneData(
  sourceId: string,
  filter: SongFilterState,
  songs: Song[],
  sets: SetlistGroup[],
  songsMap: Map<number, Song>,
  assignedSongIds: Map<number, string>
): {
  isLibrary: boolean;
  setGroup?: SetlistGroup;
  sourceLabel: string;
  totalCount: number;
  rows: PaneDisplayRow[];
  hasFilter: boolean;
} {
  const hasFilter = hasAnySearchOrFilter(filter);

  if (sourceId === 'library') {
    const matched = songs.filter((song) =>
      matchesSongFilter(song, song.id, filter, assignedSongIds)
    );
    const ordered =
      filter.sortBy === 'default'
        ? matched
        : [...matched].sort((a, b) => compareSongsBySort(a, a.id, b, b.id, filter.sortBy));

    return {
      isLibrary: true,
      sourceLabel: 'Knihovna skladeb',
      totalCount: songs.length,
      rows: ordered.map((song) => ({
        rowKey: song.id,
        songId: song.id,
        song,
      })),
      hasFilter,
    };
  }

  const setGroup = sets.find((s) => s.id === sourceId) || sets[0] || DEFAULT_SETS[0];
  const entries: PaneDisplayRow[] = setGroup.songIds.map((songId, originalIndex) => ({
    rowKey: originalIndex,
    songId,
    song: songsMap.get(songId),
    originalIndex,
  }));

  const matched = hasFilter
    ? entries.filter((entry) =>
        matchesSongFilter(entry.song, entry.songId, filter, assignedSongIds)
      )
    : entries;

  const ordered =
    filter.sortBy === 'default'
      ? matched
      : [...matched].sort((a, b) =>
          compareSongsBySort(a.song, a.songId, b.song, b.songId, filter.sortBy)
        );

  return {
    isLibrary: false,
    setGroup,
    sourceLabel: setGroup.name,
    totalCount: setGroup.songIds.length,
    rows: ordered,
    hasFilter,
  };
}

function SetlistStudio() {
  const isOnline = useOnlineStatus();
  const { role, logout } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  // Instant synchronous hydration from localStorage mirror (survives Android pull-to-refresh without race condition)
  const initialSyncProjectRef = useRef<EventProject | null | undefined>(undefined);
  if (initialSyncProjectRef.current === undefined) {
    initialSyncProjectRef.current = storage.getCurrentProjectSync();
  }
  const initialUiRef = useRef(storage.getWorkspaceUiSync());

  // App State - event name, setlist groups, and master song database
  const [eventName, setEventName] = useState<string>(
    () => initialSyncProjectRef.current?.eventName ?? ''
  );
  const [sets, setSets] = useState<SetlistGroup[]>(() =>
    initialSyncProjectRef.current?.sets && initialSyncProjectRef.current.sets.length > 0
      ? initialSyncProjectRef.current.sets
      : DEFAULT_SETS
  );
  const [songs, setSongs] = useState<Song[]>([]);

  // Total Commander Dual-Pane State
  const [leftSourceId, setLeftSourceId] = useState<string>(
    () =>
      initialUiRef.current?.leftSourceId ||
      initialSyncProjectRef.current?.sets?.[0]?.id ||
      'set-1'
  );
  const [rightSourceId, setRightSourceId] = useState<string>(
    () => initialUiRef.current?.rightSourceId || 'library'
  );
  const [activePane, setActivePane] = useState<PaneSide>(
    () => initialUiRef.current?.activePane || 'right'
  );

  // Hydration & flush guards so mount NEVER overwrites saved IndexedDB/localStorage data
  const hasHydratedProjectRef = useRef<boolean>(false);
  const latestProjectRef = useRef<{ eventName: string; sets: SetlistGroup[] }>({
    eventName,
    sets,
  });
  latestProjectRef.current = { eventName, sets };

  // Undo / Redo history stacks (up to 5 steps back & 5 steps forward)
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const recordHistory = useCallback((label: string) => {
    const snap: HistorySnapshot = {
      eventName: latestProjectRef.current.eventName,
      sets: cloneSets(latestProjectRef.current.sets),
      label,
    };
    setUndoStack((prev) => [...prev, snap].slice(-MAX_HISTORY_STEPS));
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    const currentSnap: HistorySnapshot = {
      eventName: latestProjectRef.current.eventName,
      sets: cloneSets(latestProjectRef.current.sets),
      label: prevSnap.label,
    };
    const nextUndo = undoStack.slice(0, -1);
    const nextRedo = [...redoStack, currentSnap].slice(-MAX_HISTORY_STEPS);

    setUndoStack(nextUndo);
    setRedoStack(nextRedo);
    setEventName(prevSnap.eventName);
    setSets(cloneSets(prevSnap.sets));
    setLeftSelection(new Set());
    setRightSelection(new Set());
    showSuccess(`Zpět: ${prevSnap.label} (${nextUndo.length}/${MAX_HISTORY_STEPS})`);
  }, [undoStack, redoStack, showSuccess]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnap = redoStack[redoStack.length - 1];
    const currentSnap: HistorySnapshot = {
      eventName: latestProjectRef.current.eventName,
      sets: cloneSets(latestProjectRef.current.sets),
      label: nextSnap.label,
    };
    const nextRedo = redoStack.slice(0, -1);
    const nextUndo = [...undoStack, currentSnap].slice(-MAX_HISTORY_STEPS);

    setRedoStack(nextRedo);
    setUndoStack(nextUndo);
    setEventName(nextSnap.eventName);
    setSets(cloneSets(nextSnap.sets));
    setLeftSelection(new Set());
    setRightSelection(new Set());
    showSuccess(`Vpřed: ${nextSnap.label} (${nextRedo.length}/${MAX_HISTORY_STEPS})`);
  }, [undoStack, redoStack, showSuccess]);

  // Per-pane selection (song.id for Library, originalIndex for Set)
  const [leftSelection, setLeftSelection] = useState<Set<number>>(() => new Set());
  const [rightSelection, setRightSelection] = useState<Set<number>>(() => new Set());
  const lastClickedVisibleIdxRef = useRef<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });

  // Per-pane filter state controlled via unified top CommanderToolbar
  const [leftFilter, setLeftFilter] = useState<SongFilterState>(DEFAULT_SONG_FILTER);
  const [rightFilter, setRightFilter] = useState<SongFilterState>(DEFAULT_SONG_FILTER);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [isSetlistManagerOpen, setIsSetlistManagerOpen] = useState<boolean>(false);
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

  // OSA export state (uploads exclusively to Google Drive export folder)
  const [isOsaExportOpen, setIsOsaExportOpen] = useState<boolean>(false);
  const [osaExportRows, setOsaExportRows] = useState<OsaSongRow[]>([]);
  const [osaFileName, setOsaFileName] = useState<string>('');
  const [osaDriveStatus, setOsaDriveStatus] = useState<OsaDriveStatus>({ state: 'idle' });

  // Map of songs by ID for fast lookup
  const songsMap = useMemo(() => {
    const map = new Map<number, Song>();
    for (const song of songs) {
      map.set(song.id, song);
    }
    return map;
  }, [songs]);

  // Map of all song IDs assigned across all sets (songId -> first set name)
  const assignedSongIds = useMemo(() => {
    const map = new Map<number, string>();
    for (const set of sets) {
      for (const id of set.songIds) {
        if (!map.has(id)) {
          map.set(id, set.name);
        }
      }
    }
    return map;
  }, [sets]);

  // Distinct singers and category options for the shared Filter panel
  const singers = useMemo(() => extractSingers(songs), [songs]);
  const categoryOptions = useMemo(() => buildCategoryOptions(songs), [songs]);

  // Total songs in active sets
  const totalSetSongs = useMemo(() => {
    return sets.reduce((sum, s) => sum + s.songIds.length, 0);
  }, [sets]);

  // Ensure pane source IDs always stay valid if sets change
  const resolvedLeftSourceId = useMemo(() => {
    if (leftSourceId === 'library') return 'library';
    return sets.some((s) => s.id === leftSourceId) ? leftSourceId : sets[0]?.id || 'library';
  }, [leftSourceId, sets]);

  const resolvedRightSourceId = useMemo(() => {
    if (rightSourceId === 'library') return 'library';
    return sets.some((s) => s.id === rightSourceId) ? rightSourceId : 'library';
  }, [rightSourceId, sets]);

  // Build pane display data
  const leftPaneData = useMemo(
    () =>
      buildPaneData(
        resolvedLeftSourceId,
        leftFilter,
        songs,
        sets,
        songsMap,
        assignedSongIds
      ),
    [resolvedLeftSourceId, leftFilter, songs, sets, songsMap, assignedSongIds]
  );

  const rightPaneData = useMemo(
    () =>
      buildPaneData(
        resolvedRightSourceId,
        rightFilter,
        songs,
        sets,
        songsMap,
        assignedSongIds
      ),
    [resolvedRightSourceId, rightFilter, songs, sets, songsMap, assignedSongIds]
  );

  const activeData = activePane === 'left' ? leftPaneData : rightPaneData;
  const targetData = activePane === 'left' ? rightPaneData : leftPaneData;
  const activeSourceId = activePane === 'left' ? resolvedLeftSourceId : resolvedRightSourceId;
  const targetSourceId = activePane === 'left' ? resolvedRightSourceId : resolvedLeftSourceId;
  const activeSelection = activePane === 'left' ? leftSelection : rightSelection;
  const setActiveSelection = activePane === 'left' ? setLeftSelection : setRightSelection;
  const activeFilter = activePane === 'left' ? leftFilter : rightFilter;
  const setActiveFilter = activePane === 'left' ? setLeftFilter : setRightFilter;

  // Target set song IDs lookup (for showing "in target set" badge in Library panes)
  const leftTargetSetSongIds = useMemo(() => {
    return rightPaneData.setGroup ? new Set(rightPaneData.setGroup.songIds) : undefined;
  }, [rightPaneData.setGroup]);

  const rightTargetSetSongIds = useMemo(() => {
    return leftPaneData.setGroup ? new Set(leftPaneData.setGroup.songIds) : undefined;
  }, [leftPaneData.setGroup]);

  // 1. Initial Load from IndexedDB (reconciles with sync mirror) + automatic background refresh from Google Drive
  useEffect(() => {
    let isCancelled = false;

    const loadSavedData = async () => {
      try {
        // Load saved project FIRST before awaiting songs so there is never a delay or race condition
        const savedProject = await storage.getCurrentProject();
        if (!isCancelled && savedProject) {
          const syncUpdatedAt = initialSyncProjectRef.current?.updatedAt || 0;
          const idbUpdatedAt = savedProject.updatedAt || 0;
          // Apply IndexedDB copy if there was no sync mirror or if IndexedDB is newer
          if (!initialSyncProjectRef.current || idbUpdatedAt > syncUpdatedAt) {
            setEventName(savedProject.eventName || '');
            if (savedProject.sets && savedProject.sets.length > 0) {
              setSets(savedProject.sets);
              if (!initialUiRef.current) {
                setLeftSourceId(savedProject.sets[0].id);
              }
            }
            storage.saveCurrentProjectSync(savedProject);
          }
        }
      } catch (err) {
        console.error('Failed to load project from IndexedDB:', err);
      } finally {
        if (!isCancelled) {
          hasHydratedProjectRef.current = true;
        }
      }

      try {
        const [savedSongs, savedLegend] = await Promise.all([
          storage.getSongs(),
          storage.getSingerLegend(),
        ]);

        if (isCancelled) return;

        if (savedSongs && savedSongs.length > 0) {
          const enrichedLocal = enrichSongsWithDatabase(savedSongs, undefined, savedLegend);
          setSongs(enrichedLocal);
          if (typeof navigator === 'undefined' || navigator.onLine) {
            handleSyncDatabase(true, true);
          }
        } else {
          const bundled = getBundledDatabaseSongs();
          if (bundled.length > 0) {
            setSongs(bundled);
          }
          handleSyncDatabase(true, false);
        }
      } catch (err) {
        console.error('Failed to load songs from IndexedDB:', err);
      }
    };

    loadSavedData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Auto-save current project (synchronous localStorage mirror + IndexedDB), guarded until hydration completes
  useEffect(() => {
    if (!hasHydratedProjectRef.current) return;
    const project: EventProject = {
      id: 'current-session',
      eventName,
      sets,
      updatedAt: Date.now(),
    };
    storage.saveCurrentProject(project).catch(console.error);
  }, [eventName, sets]);

  // 2b. Persist pane layout state (which sources are open in Left/Right panes)
  useEffect(() => {
    storage.saveWorkspaceUiSync({
      leftSourceId: resolvedLeftSourceId,
      rightSourceId: resolvedRightSourceId,
      activePane,
    });
  }, [resolvedLeftSourceId, resolvedRightSourceId, activePane]);

  // 2c. Synchronous safety flush on pagehide / visibilitychange (protects against Android pull-to-refresh & app kill)
  useEffect(() => {
    const flushNow = () => {
      if (!hasHydratedProjectRef.current) return;
      storage.saveCurrentProjectSync({
        id: 'current-session',
        eventName: latestProjectRef.current.eventName,
        sets: latestProjectRef.current.sets,
        updatedAt: Date.now(),
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };

    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 3. Sync Database from Backend API (/api/drive/sync)
  const handleSyncDatabase = async (force = true, silent = false) => {
    setIsSyncing(true);
    if (!silent) {
      setSyncMessage(null);
    }
    try {
      const url = force ? `/api/drive/sync?force=true&t=${Date.now()}` : '/api/drive/sync';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Chyba serveru (${res.status})`);
      }

      const data = await res.json();
      if (data.success === false) {
        const rawMsg = String(data.message || data.error || 'Synchronizace z Google Disku selhala.');
        const friendlyMsg = rawMsg.includes('invalid_grant')
          ? 'Vypršelo přihlášení ke Google Disku (invalid_grant). Obnovte GOOGLE_REFRESH_TOKEN ve Vercelu a přepněte OAuth aplikaci v Google Cloud z „Testing“ na „In production“.'
          : rawMsg;
        throw new Error(friendlyMsg);
      }

      if (data.songs && Array.isArray(data.songs) && data.songs.length > 0) {
        const liveLegend =
          Array.isArray(data.singerLegend) && data.singerLegend.length > 0
            ? data.singerLegend
            : await storage.getSingerLegend();

        const enrichedSongs = enrichSongsWithDatabase(data.songs, data.dbSongs, liveLegend);
        setSongs(enrichedSongs);
        await storage.saveSongs(enrichedSongs);
        if (Array.isArray(data.singerLegend) && data.singerLegend.length > 0) {
          await storage.saveSingerLegend(data.singerLegend);
        }

        if (!silent) {
          const sourceNote = data.source === 'google-drive' ? 'z Google Disku' : 'z centrální databáze';
          const legendNote =
            Array.isArray(data.singerLegend) && data.singerLegend.length > 0
              ? ` (legenda: ${data.singerLegend.length} barev)`
              : '';
          setSyncMessage(`Úspěšně načteno ${enrichedSongs.length} skladeb ${sourceNote}${legendNote}!`);
          setTimeout(() => setSyncMessage(null), 4000);
        }
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      const [localSongs, savedLegend] = await Promise.all([
        storage.getSongs(),
        storage.getSingerLegend(),
      ]);
      if (localSongs && localSongs.length > 0) {
        setSongs(enrichSongsWithDatabase(localSongs, undefined, savedLegend));
      } else {
        const bundled = getBundledDatabaseSongs();
        if (bundled.length > 0) {
          setSongs(bundled);
        }
      }
      if (!silent) {
        setSyncMessage(`Chyba při synchronizaci: ${err.message}`);
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Process offline export queue automatically when back online
  useEffect(() => {
    if (!isOnline) return;

    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

    const processQueue = async () => {
      try {
        const pending = await storage.getPendingUploads();
        if (!pending || pending.length === 0) return;

        let syncedCount = 0;
        for (const item of pending) {
          try {
            if (item.fileType === 'pdf') {
              await storage.removePendingUpload(item.id);
              continue;
            }

            if (item.fileType === 'osa-pdf') {
              const pdfBase64 = await blobToDataUrl(item.blobData);
              const res = await fetch('/api/drive/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: item.fileName,
                  pdfBase64,
                  pdfOnly: true,
                  eventName: item.eventName,
                }),
              });
              if (res.ok) {
                await storage.removePendingUpload(item.id);
                syncedCount++;
              }
              continue;
            }

            const mssXml = await item.blobData.text();
            const pdfBase64 = item.pdfBlobData ? await blobToDataUrl(item.pdfBlobData) : undefined;

            const res = await fetch('/api/drive/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.fileName,
                mssXml: mssXml || undefined,
                pdfBase64,
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

  // Pane Source & Set Tabs Operations
  const handleChangePaneSource = (side: PaneSide, newSourceId: string) => {
    if (side === 'left') {
      setLeftSourceId(newSourceId);
      setLeftSelection(new Set());
      lastClickedVisibleIdxRef.current.left = null;
    } else {
      setRightSourceId(newSourceId);
      setRightSelection(new Set());
      lastClickedVisibleIdxRef.current.right = null;
    }
  };

  const handleSelectSetFromTabs = (setId: string) => {
    handleChangePaneSource(activePane, setId);
  };

  const handleAddSet = () => {
    recordHistory('Přidání setlistu');
    const dynamicCount = sets.filter((s) => !s.isFixed).length;
    const newSet: SetlistGroup = {
      id: `set-${Date.now()}`,
      name: `Set ${dynamicCount + 1}`,
      songIds: [],
    };

    // Preserve custom user ordering: insert right before trailing fixed sets if any, else append
    let insertIdx = sets.length;
    while (insertIdx > 0 && sets[insertIdx - 1].isFixed) {
      insertIdx--;
    }
    const updated = [...sets.slice(0, insertIdx), newSet, ...sets.slice(insertIdx)];
    setSets(updated);

    // Open new set in the active pane if it's already showing a set,
    // or in the opposite pane if active pane is Library (so user can immediately copy from Library!)
    if (activeSourceId !== 'library') {
      handleChangePaneSource(activePane, newSet.id);
    } else if (targetSourceId !== 'library') {
      handleChangePaneSource(activePane === 'left' ? 'right' : 'left', newSet.id);
    } else {
      handleChangePaneSource('left', newSet.id);
    }
  };

  const handleDeleteSet = (id: string) => {
    if (sets.length <= 1) return;
    recordHistory('Smazání setlistu');
    const updated = sets.filter((s) => s.id !== id);
    setSets(updated);
    const fallbackId = updated[0]?.id || 'library';
    if (leftSourceId === id) {
      handleChangePaneSource('left', fallbackId);
    }
    if (rightSourceId === id) {
      handleChangePaneSource('right', fallbackId);
    }
  };

  // Multi-selection toggle (Click = toggle, Shift+Click = range select)
  const handleToggleRow = (
    side: PaneSide,
    rowKey: number,
    visibleIndex: number,
    isShiftKey: boolean
  ) => {
    setActivePane(side);
    const rows = side === 'left' ? leftPaneData.rows : rightPaneData.rows;
    const setSelection = side === 'left' ? setLeftSelection : setRightSelection;
    const prevIdx = lastClickedVisibleIdxRef.current[side];

    setSelection((prev) => {
      const next = new Set(prev);
      if (isShiftKey && prevIdx !== null && prevIdx >= 0 && prevIdx < rows.length) {
        const start = Math.min(prevIdx, visibleIndex);
        const end = Math.max(prevIdx, visibleIndex);
        for (let i = start; i <= end; i++) {
          next.add(rows[i].rowKey);
        }
      } else {
        if (next.has(rowKey)) {
          next.delete(rowKey);
        } else {
          next.add(rowKey);
        }
      }
      return next;
    });

    lastClickedVisibleIdxRef.current[side] = visibleIndex;
  };

  // Reorder via Drag & Drop inside a Set pane
  const handlePaneReorder = (side: PaneSide, oldIndex: number, newIndex: number) => {
    const paneData = side === 'left' ? leftPaneData : rightPaneData;
    const targetSet = paneData.setGroup;
    if (!targetSet || paneData.isLibrary || paneData.hasFilter) return;

    recordHistory('Změna pořadí');
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id !== targetSet.id) return s;
        const list = [...s.songIds];
        const [dragged] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, dragged);
        return { ...s, songIds: list };
      })
    );

    // Remap selected indices in that pane so selection follows the reordered items
    const remapSelection = (prev: Set<number>) => {
      if (prev.size === 0) return prev;
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx === oldIndex) {
          next.add(newIndex);
        } else if (oldIndex < newIndex && idx > oldIndex && idx <= newIndex) {
          next.add(idx - 1);
        } else if (oldIndex > newIndex && idx >= newIndex && idx < oldIndex) {
          next.add(idx + 1);
        } else {
          next.add(idx);
        }
      });
      return next;
    };

    if (side === 'left') {
      setLeftSelection(remapSelection);
      if (resolvedRightSourceId === targetSet.id) {
        setRightSelection(remapSelection);
      }
    } else {
      setRightSelection(remapSelection);
      if (resolvedLeftSourceId === targetSet.id) {
        setLeftSelection(remapSelection);
      }
    }
  };

  // Determine capabilities for the unified CommanderToolbar
  const selectedCount = activeSelection.size;
  const allVisibleSelected =
    activeData.rows.length > 0 &&
    activeData.rows.every((row) => activeSelection.has(row.rowKey));

  const sameSourceInBothPanes = activeSourceId === targetSourceId;

  const canCopy =
    selectedCount > 0 && !targetData.isLibrary && !sameSourceInBothPanes && Boolean(targetData.setGroup);

  const copyDisabledReason =
    selectedCount === 0
      ? 'Nejprve kliknutím označte jednu nebo více skladeb v aktivním okně'
      : targetData.isLibrary
      ? 'Cílový panel je Knihovna – pro kopírování vyberte v druhém okně setlist'
      : sameSourceInBothPanes
      ? 'Oba panely zobrazují stejný setlist'
      : undefined;

  const canMove =
    selectedCount > 0 &&
    !activeData.isLibrary &&
    !targetData.isLibrary &&
    !sameSourceInBothPanes &&
    Boolean(activeData.setGroup) &&
    Boolean(targetData.setGroup);

  const moveDisabledReason =
    selectedCount === 0
      ? 'Nejprve označte skladby v aktivním setlistu'
      : activeData.isLibrary
      ? 'Z Knihovny nelze přesouvat – použijte Kopírovat'
      : targetData.isLibrary
      ? 'Do Knihovny nelze přesouvat – v druhém okně zvolte cílový setlist'
      : sameSourceInBothPanes
      ? 'Oba panely zobrazují stejný setlist'
      : undefined;

  const canReorderActiveSet = !activeData.isLibrary && !activeData.hasFilter && Boolean(activeData.setGroup);

  const canMoveUp = useMemo(() => {
    if (!canReorderActiveSet || selectedCount === 0 || !activeData.setGroup) return false;
    const n = activeData.setGroup.songIds.length;
    for (let i = 1; i < n; i++) {
      if (activeSelection.has(i) && !activeSelection.has(i - 1)) return true;
    }
    return false;
  }, [canReorderActiveSet, selectedCount, activeData.setGroup, activeSelection]);

  const canMoveDown = useMemo(() => {
    if (!canReorderActiveSet || selectedCount === 0 || !activeData.setGroup) return false;
    const n = activeData.setGroup.songIds.length;
    for (let i = 0; i < n - 1; i++) {
      if (activeSelection.has(i) && !activeSelection.has(i + 1)) return true;
    }
    return false;
  }, [canReorderActiveSet, selectedCount, activeData.setGroup, activeSelection]);

  const reorderDisabledReason = activeData.isLibrary
    ? 'Pořadí lze měnit pouze v setlistech'
    : activeData.hasFilter
    ? 'Pro změnu pořadí nejprve zrušte filtr/řazení v aktivním okně'
    : selectedCount === 0
    ? 'Označte skladby pro posun nahoru nebo dolů'
    : undefined;

  const canRemove = selectedCount > 0 && !activeData.isLibrary && Boolean(activeData.setGroup);

  // Selected song for Detail (?) & Manual Pairing
  const selectedSingleSong = useMemo<Song | null>(() => {
    if (selectedCount !== 1) return null;
    const onlyKey = Array.from(activeSelection)[0];
    if (activeData.isLibrary) {
      return songsMap.get(onlyKey) || null;
    }
    const songId = activeData.setGroup?.songIds[onlyKey];
    if (songId === undefined) return null;
    return (
      songsMap.get(songId) || {
        id: songId,
        pdf_title: songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`,
        mss_title: songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`,
        textColor: '#000000',
        bgColor: '#ffffff',
        isUnmatched: songId < 0,
      }
    );
  }, [selectedCount, activeSelection, activeData.isLibrary, activeData.setGroup, songsMap]);

  const unmatchedSelectedSong =
    selectedSingleSong && (selectedSingleSong.isUnmatched || selectedSingleSong.id < 0)
      ? selectedSingleSong
      : null;

  // Commander Action Handlers
  const handleCopySelected = useCallback(() => {
    if (!canCopy || !targetData.setGroup) return;
    const targetSet = targetData.setGroup;

    let songIdsToCopy: number[] = [];
    if (activeData.isLibrary) {
      // Preserve current visible order when copying from Library
      const visibleSelected = activeData.rows
        .filter((r) => activeSelection.has(r.rowKey))
        .map((r) => r.songId);
      const visibleSet = new Set(visibleSelected);
      const hiddenSelected = Array.from(activeSelection).filter((id) => !visibleSet.has(id));
      songIdsToCopy = [...visibleSelected, ...hiddenSelected];
    } else if (activeData.setGroup) {
      const sortedIndices = Array.from(activeSelection).sort((a, b) => a - b);
      songIdsToCopy = sortedIndices
        .map((idx) => activeData.setGroup!.songIds[idx])
        .filter((id): id is number => id !== undefined);
    }

    if (songIdsToCopy.length === 0) return;

    const existing = new Set(targetSet.songIds);
    const toAppend: number[] = [];
    let skipped = 0;

    for (const id of songIdsToCopy) {
      if (!existing.has(id)) {
        existing.add(id);
        toAppend.push(id);
      } else {
        skipped++;
      }
    }

    if (toAppend.length > 0) {
      recordHistory('Kopírování skladeb');
      setSets((prevSets) =>
        prevSets.map((s) =>
          s.id === targetSet.id ? { ...s, songIds: [...s.songIds, ...toAppend] } : s
        )
      );
      setActiveSelection(new Set());
      if (skipped > 0) {
        showSuccess(
          `Zkopírováno ${formatCzechSongCount(toAppend.length)} do „${targetSet.name}“ (${skipped} již v setu).`
        );
      } else {
        showSuccess(
          `Zkopírováno ${formatCzechSongCount(toAppend.length)} do „${targetSet.name}“.`
        );
      }
    } else {
      setActiveSelection(new Set());
      showWarning(`Všechny vybrané skladby už v „${targetSet.name}“ jsou.`);
    }
  }, [
    canCopy,
    targetData.setGroup,
    activeData.isLibrary,
    activeData.rows,
    activeData.setGroup,
    activeSelection,
    setActiveSelection,
    showSuccess,
    showWarning,
  ]);

  const handleMoveSelected = useCallback(() => {
    if (!canMove || !activeData.setGroup || !targetData.setGroup) return;
    const sourceSet = activeData.setGroup;
    const targetSet = targetData.setGroup;

    const indicesToRemove = new Set(activeSelection);
    const sortedIndices = Array.from(indicesToRemove).sort((a, b) => a - b);
    const songIdsToMove = sortedIndices
      .map((idx) => sourceSet.songIds[idx])
      .filter((id): id is number => id !== undefined);

    if (songIdsToMove.length === 0) return;

    recordHistory('Přesun skladeb');
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === sourceSet.id) {
          return {
            ...s,
            songIds: s.songIds.filter((_, idx) => !indicesToRemove.has(idx)),
          };
        }
        if (s.id === targetSet.id) {
          const existing = new Set(s.songIds);
          const additions = songIdsToMove.filter((id) => {
            if (existing.has(id)) return false;
            existing.add(id);
            return true;
          });
          return { ...s, songIds: [...s.songIds, ...additions] };
        }
        return s;
      })
    );

    setActiveSelection(new Set());
    showSuccess(
      `Přesunuto ${formatCzechSongCount(songIdsToMove.length)} z „${sourceSet.name}“ do „${targetSet.name}“.`
    );
  }, [canMove, activeData.setGroup, targetData.setGroup, activeSelection, setActiveSelection, showSuccess]);

  const handleMoveSelectedUp = useCallback(() => {
    if (!canMoveUp || !activeData.setGroup) return;
    const sourceSet = activeData.setGroup;
    const list = [...sourceSet.songIds];
    const nextSel = new Set(activeSelection);

    for (let i = 1; i < list.length; i++) {
      if (nextSel.has(i) && !nextSel.has(i - 1)) {
        const temp = list[i];
        list[i] = list[i - 1];
        list[i - 1] = temp;
        nextSel.delete(i);
        nextSel.add(i - 1);
      }
    }

    recordHistory('Posun nahoru');
    setSets((prevSets) =>
      prevSets.map((s) => (s.id === sourceSet.id ? { ...s, songIds: list } : s))
    );
    setActiveSelection(nextSel);
    if (sameSourceInBothPanes) {
      if (activePane === 'left') setRightSelection(new Set());
      else setLeftSelection(new Set());
    }
  }, [canMoveUp, activeData.setGroup, activeSelection, setActiveSelection, sameSourceInBothPanes, activePane, recordHistory]);

  const handleMoveSelectedDown = useCallback(() => {
    if (!canMoveDown || !activeData.setGroup) return;
    const sourceSet = activeData.setGroup;
    const list = [...sourceSet.songIds];
    const nextSel = new Set(activeSelection);

    for (let i = list.length - 2; i >= 0; i--) {
      if (nextSel.has(i) && !nextSel.has(i + 1)) {
        const temp = list[i];
        list[i] = list[i + 1];
        list[i + 1] = temp;
        nextSel.delete(i);
        nextSel.add(i + 1);
      }
    }

    recordHistory('Posun dolů');
    setSets((prevSets) =>
      prevSets.map((s) => (s.id === sourceSet.id ? { ...s, songIds: list } : s))
    );
    setActiveSelection(nextSel);
    if (sameSourceInBothPanes) {
      if (activePane === 'left') setRightSelection(new Set());
      else setLeftSelection(new Set());
    }
  }, [canMoveDown, activeData.setGroup, activeSelection, setActiveSelection, sameSourceInBothPanes, activePane, recordHistory]);

  const handleRemoveSelected = useCallback(() => {
    if (!canRemove || !activeData.setGroup) return;
    const sourceSet = activeData.setGroup;
    const indicesToRemove = new Set(activeSelection);
    const removedCount = indicesToRemove.size;

    recordHistory('Odstranění skladeb');
    setSets((prevSets) =>
      prevSets.map((s) =>
        s.id === sourceSet.id
          ? { ...s, songIds: s.songIds.filter((_, idx) => !indicesToRemove.has(idx)) }
          : s
      )
    );
    setActiveSelection(new Set());
    if (sameSourceInBothPanes) {
      if (activePane === 'left') setRightSelection(new Set());
      else setLeftSelection(new Set());
    }
    showSuccess(`Odebráno ${formatCzechSongCount(removedCount)} z „${sourceSet.name}“.`);
  }, [canRemove, activeData.setGroup, activeSelection, setActiveSelection, sameSourceInBothPanes, activePane, showSuccess, recordHistory]);

  const handleToggleSelectAll = useCallback(() => {
    setActiveSelection(new Set(activeData.rows.map((r) => r.rowKey)));
  }, [activeData.rows, setActiveSelection]);

  const handleClearSelection = useCallback(() => {
    setActiveSelection(new Set());
  }, [setActiveSelection]);

  const handleSwapPanes = useCallback(() => {
    setLeftSourceId(resolvedRightSourceId);
    setRightSourceId(resolvedLeftSourceId);
    setLeftSelection(rightSelection);
    setRightSelection(leftSelection);
    setLeftFilter(rightFilter);
    setRightFilter(leftFilter);
    lastClickedVisibleIdxRef.current = { left: null, right: null };
  }, [
    resolvedLeftSourceId,
    resolvedRightSourceId,
    leftSelection,
    rightSelection,
    leftFilter,
    rightFilter,
  ]);

  // Add single song from SongDetailModal into target (or active) set
  const detailTargetSet = useMemo(() => {
    if (targetData.setGroup) return targetData.setGroup;
    if (activeData.setGroup) return activeData.setGroup;
    return sets[0] || DEFAULT_SETS[0];
  }, [targetData.setGroup, activeData.setGroup, sets]);

  const handleAddSongFromDetailModal = (song: Song) => {
    if (detailTargetSet.songIds.includes(song.id)) return;
    recordHistory('Přidání skladby');
    setSets((prevSets) =>
      prevSets.map((s) => {
        if (s.id === detailTargetSet.id) {
          if (s.songIds.includes(song.id)) return s;
          return { ...s, songIds: [...s.songIds, song.id] };
        }
        return s;
      })
    );
  };

  // Save updated setlist names, order, colors, or additions from SetlistManagerModal
  const handleSaveManagedSets = (updatedSets: SetlistGroup[]) => {
    if (updatedSets.length === 0) return;
    recordHistory('Úprava setlistů');
    setSets(updatedSets);

    // Clear selections on panes whose set was deleted or cleared
    const validIds = new Set(updatedSets.map((s) => s.id));
    const fallbackId = updatedSets[0].id;
    if (leftSourceId !== 'library' && !validIds.has(leftSourceId)) {
      setLeftSourceId(fallbackId);
      setLeftSelection(new Set());
    }
    if (rightSourceId !== 'library' && !validIds.has(rightSourceId)) {
      setRightSourceId(fallbackId);
      setRightSelection(new Set());
    }
    // Clean any stale indices in case a set was emptied in the manager
    setLeftSelection((prev) => {
      if (leftSourceId === 'library') return prev;
      const target = updatedSets.find((s) => s.id === leftSourceId);
      if (!target) return new Set();
      return new Set(Array.from(prev).filter((idx) => idx < target.songIds.length));
    });
    setRightSelection((prev) => {
      if (rightSourceId === 'library') return prev;
      const target = updatedSets.find((s) => s.id === rightSourceId);
      if (!target) return new Set();
      return new Set(Array.from(prev).filter((idx) => idx < target.songIds.length));
    });

    showSuccess('Změny setlistů byly uloženy.');
  };

  // Start fresh: clear main event name and create Set 1..9 + Lidovky (default songs) + Zbytek
  const handleStartFresh = () => {
    recordHistory('Začít znovu');
    const freshSets = createFreshSets();
    setEventName('');
    setSets(freshSets);
    setLeftSourceId(freshSets[0].id);
    setRightSourceId('library');
    setLeftSelection(new Set());
    setRightSelection(new Set());
    lastClickedVisibleIdxRef.current = { left: null, right: null };
    showSuccess('Nový projekt připraven (Set 1–9, Lidovky, Zbytek). Změnu lze vrátit šipkou Zpět.');
  };

  // Total Commander Keyboard Shortcuts (when no modal is open & focus not in an input)
  const anyModalOpen =
    isAdminPanelOpen ||
    isExportOpen ||
    isOsaExportOpen ||
    isImportModalOpen ||
    isDisplaySettingsOpen ||
    isSetlistManagerOpen ||
    pairingSong !== null ||
    inspectedSong !== null;

  useEffect(() => {
    if (anyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setActivePane((prev) => (prev === 'left' ? 'right' : 'left'));
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleCopySelected();
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleMoveSelected();
      } else if (e.key === 'F8' || e.key === 'Delete') {
        if (canRemove) {
          e.preventDefault();
          handleRemoveSelected();
        }
      } else if (e.key === 'Escape') {
        if (activeSelection.size > 0) {
          handleClearSelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleToggleSelectAll();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    anyModalOpen,
    handleCopySelected,
    handleMoveSelected,
    handleRemoveSelected,
    handleClearSelection,
    handleToggleSelectAll,
    handleUndo,
    handleRedo,
    canRemove,
    activeSelection.size,
  ]);

  // 5. Import Handlers for .mss and .xlsx files (100% preserved)
  const handleApplyImport = async (result: ImportResult) => {
    if ((result.sets && result.sets.length > 0) || result.eventName) {
      recordHistory('Import setlistu');
    }
    if (result.sets && result.sets.length > 0) {
      setSets(result.sets);
      setLeftSourceId(result.sets[0].id);
      setRightSourceId('library');
      setLeftSelection(new Set());
      setRightSelection(new Set());
    }

    if (result.eventName) {
      setEventName(result.eventName);
    }

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

  // 6. Manual Song Pairing handler (100% preserved)
  const handlePairSong = (tempId: number, targetMasterId: number) => {
    recordHistory('Spárování skladby');
    const targetSong = songs.find((s) => s.id === targetMasterId);

    setSets((prevSets) =>
      prevSets.map((s) => ({
        ...s,
        songIds: s.songIds.map((id) => (id === tempId ? targetMasterId : id)),
      }))
    );

    if (tempId < 0) {
      setSongs((prev) => prev.filter((s) => s.id !== tempId));
    }

    showSuccess(
      `Skladba byla úspěšně spárována s "${targetSong ? targetSong.pdf_title : `#${targetMasterId}`}".`,
      'Spárováno'
    );
  };

  // 7. Export Generator & Silent Backend Drive Export (100% preserved)
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
      setExportProgress({
        progress: 5,
        stepId: 'prep',
        stepLabel: 'Zahajuji proces exportu...',
        steps: DEFAULT_EXPORT_PROGRESS.steps.map((s) => ({ ...s, status: 'pending' })),
        logs: [`${formatTime()} Zahájeno generování exportních souborů pro: ${safeName}`],
      });

      updateStep('prep', 'in_progress', 15, 'Příprava listů a ověřování skladeb...');
      const activeSets = sets.filter((s) => s.songIds.length > 0);
      pushLog(`Načteno ${activeSets.length} listů k exportu (celkem ${totalSetSongs} zařazených skladeb).`);
      await new Promise((r) => setTimeout(r, 220));
      updateStep('prep', 'done', 25, 'Data listů připravena');

      updateStep('pdf', 'in_progress', 35, 'Generuji barevné PDF pro pódium...');
      pushLog('Vykresluji tiskové stránky s českým fontem (CzechFont) a autentickými barvami...');
      const { blob: pdfBlob, dataUrl } = await generatePdf(eventName, sets, songsMap);
      setExportedPdfBlob(pdfBlob);
      setExportedPdfDataUrl(dataUrl);
      pushLog(`✓ PDF arch vytvořen (${(pdfBlob.size / 1024).toFixed(1)} kB, A4 tabulkový formát).`);
      updateStep('pdf', 'done', 55, 'PDF arch vygenerován');
      await new Promise((r) => setTimeout(r, 200));

      updateStep('mss', 'in_progress', 65, 'Sestavuji MobileSheets XML strukturu...');
      pushLog('Generuji uzly <Setlist> a <Song> pro aplikaci MobileSheets...');
      const mssXml = generateMssXml(eventName, sets, songsMap);
      setExportedMssXml(mssXml);
      const mssSize = new Blob([mssXml]).size;
      pushLog(`✓ XML kód (.mss) zkompilován (${(mssSize / 1024).toFixed(1)} kB, UTF-8).`);
      updateStep('mss', 'done', 75, 'MobileSheets XML hotovo');
      await new Promise((r) => setTimeout(r, 200));

      if (isOnline) {
        updateStep('drive_auth', 'in_progress', 82, 'Připojuji se ke Google Disku...');
        pushLog('Ověřuji spojení se službou Google Drive API přes backend...');

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
          id: `upload-${Date.now()}-bundle`,
          eventName,
          fileName: mssFileName,
          fileType: 'bundle',
          blobData: new Blob([mssXml], { type: 'text/xml' }),
          pdfBlobData: pdfBlob,
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

  // Quick downloads (100% preserved)
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

  // 8. OSA Playlist PDF Export (exclusively to Google Drive export folder)
  const handleGenerateOsaList = async () => {
    const trimmedEvent = eventName.trim();
    if (!trimmedEvent) {
      showWarning(
        'Nejprve vyplňte název akce (pole Setlist v horní liště), aby se soubor pojmenoval „Seznam pro OSA - název akce“.',
        'Chybí název akce'
      );
      document.getElementById('eventNameInput')?.focus();
      return;
    }

    const previewRows = buildOsaSongRows(sets, songsMap);
    if (previewRows.length === 0) {
      showWarning(
        'Aktuální setlist neobsahuje žádné skladby pro vygenerování seznamu pro OSA.',
        'Prázdný setlist'
      );
      return;
    }

    const targetBaseName = buildOsaFileBaseName(trimmedEvent);
    setIsExporting(true);
    setOsaExportRows(previewRows);
    setOsaFileName(`${targetBaseName}.pdf`);
    setIsOsaExportOpen(true);
    setOsaDriveStatus({ state: 'generating' });

    try {
      const { blob, fileBaseName, fileName, rows } = await generateOsaPdf(
        trimmedEvent,
        sets,
        songsMap
      );
      setOsaExportRows(rows);
      setOsaFileName(fileName);

      if (isOnline) {
        setOsaDriveStatus({ state: 'uploading' });

        const pdfBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Nepodařilo se načíst PDF data.'));
          reader.readAsDataURL(blob);
        });

        const res = await fetch('/api/drive/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileBaseName,
            pdfBase64,
            pdfOnly: true,
            eventName: trimmedEvent,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(
            data.error ||
              data.message ||
              'Server vrátil chybu při ukládání seznamu pro OSA na Google Disk.'
          );
        }

        setOsaDriveStatus({
          state: 'success',
          message: data.message,
          updatedExisting: data.updatedExisting,
        });
        showSuccess(`Seznam „${fileName}“ byl uložen na Google Disk.`, 'OSA seznam uložen');
      } else {
        await storage.addPendingUpload({
          id: `upload-${Date.now()}-osa`,
          eventName: trimmedEvent,
          fileName: fileBaseName,
          fileType: 'osa-pdf',
          blobData: blob,
          createdAt: Date.now(),
          status: 'pending',
        });

        setOsaDriveStatus({
          state: 'offline_queued',
          message:
            'Jste offline. Seznam pro OSA byl zařazen do fronty a automaticky se uloží do složky Play listy MobileSheets_export po obnovení připojení.',
        });
      }
    } catch (err: any) {
      console.error('OSA export failed:', err);
      setOsaDriveStatus({
        state: 'error',
        message: err?.message || 'Chyba při ukládání seznamu pro OSA na Google Disk.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="tc-app-shell bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors">
      {/* Row 1: Compact Header (Logo + Setlist Name + Upravit sety + Combined Import/Export + Settings + Logout) */}
      <Header
        eventName={eventName}
        onEventNameChange={setEventName}
        role={role || 'user'}
        onLogout={logout}
        onGenerateAndSave={handleGenerateAndSave}
        onGenerateOsaList={handleGenerateOsaList}
        onQuickDownloadPdf={handleQuickDownloadPdf}
        onQuickDownloadMss={handleQuickDownloadMss}
        isExporting={isExporting}
        onDirectFileImport={handleDirectFileImport}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenDisplaySettings={() => setIsDisplaySettingsOpen(true)}
        onOpenSetlistManager={() => setIsSetlistManagerOpen(true)}
      />

      {/* Sync feedback notification banner if any */}
      {syncMessage && (
        <div className="shrink-0 bg-indigo-100 dark:bg-indigo-900/80 border-b border-indigo-200 dark:border-indigo-700/50 py-1 px-4 text-center text-xs text-indigo-800 dark:text-indigo-200 font-semibold animate-fadeIn">
          {syncMessage}
        </div>
      )}

      {/* Row 2: Horizontally Scrollable Single-Line Setlist Tabs */}
      <SetTabs
        sets={sets}
        leftSourceId={resolvedLeftSourceId}
        rightSourceId={resolvedRightSourceId}
        activePane={activePane}
        onSelectSet={handleSelectSetFromTabs}
        onAddSet={handleAddSet}
        onDeleteSet={handleDeleteSet}
      />

      {/* Row 3: Unified Total Commander Action, Search & Filter Bar (for Active Pane) */}
      <CommanderToolbar
        activePane={activePane}
        activeSourceLabel={activeData.sourceLabel}
        targetSourceLabel={targetData.sourceLabel}
        isActiveLibrary={activeData.isLibrary}
        selectedCount={selectedCount}
        visibleCount={activeData.rows.length}
        allVisibleSelected={allVisibleSelected}
        canCopy={canCopy}
        copyDisabledReason={copyDisabledReason}
        canMove={canMove}
        moveDisabledReason={moveDisabledReason}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        reorderDisabledReason={reorderDisabledReason}
        canRemove={canRemove}
        canInspect={selectedSingleSong !== null}
        unmatchedSelectedSong={unmatchedSelectedSong}
        undoCount={undoStack.length}
        redoCount={redoStack.length}
        lastUndoLabel={undoStack[undoStack.length - 1]?.label}
        lastRedoLabel={redoStack[redoStack.length - 1]?.label}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCopy={handleCopySelected}
        onMove={handleMoveSelected}
        onMoveUp={handleMoveSelectedUp}
        onMoveDown={handleMoveSelectedDown}
        onRemove={handleRemoveSelected}
        onToggleSelectAll={handleToggleSelectAll}
        onClearSelection={handleClearSelection}
        onInspectSelected={() => {
          if (selectedSingleSong) setInspectedSong(selectedSingleSong);
        }}
        onPairSelected={(song) => setPairingSong(song)}
        onSwapPanes={handleSwapPanes}
        filter={activeFilter}
        onFilterChange={setActiveFilter}
        onResetFilters={() =>
          setActiveFilter((prev) => ({
            ...DEFAULT_SONG_FILTER,
            searchQuery: prev.searchQuery,
          }))
        }
        categoryOptions={categoryOptions}
        singers={singers}
      />

      {/* Main Dual-Pane Total Commander Workspace (side-by-side on Desktop & Tablet Landscape) */}
      <main className="tc-main-area flex-1 min-h-0 max-w-[1600px] w-full mx-auto p-2 sm:p-3">
        <div className="tc-panes-grid">
          {/* LEFT COMMANDER PANE */}
          <CommanderPane
            side="left"
            isActive={activePane === 'left'}
            sourceId={resolvedLeftSourceId}
            allSets={sets}
            totalLibraryCount={songs.length}
            totalSourceCount={leftPaneData.totalCount}
            rows={leftPaneData.rows}
            selectedKeys={leftSelection}
            hasFilter={leftPaneData.hasFilter}
            canDragReorder={!leftPaneData.isLibrary && !leftPaneData.hasFilter}
            targetSetSongIds={leftTargetSetSongIds}
            targetSetName={rightPaneData.setGroup?.name}
            assignedSongIds={assignedSongIds}
            onActivate={() => setActivePane('left')}
            onChangeSource={(id) => handleChangePaneSource('left', id)}
            onToggleRow={(rowKey, visibleIndex, isShiftKey) =>
              handleToggleRow('left', rowKey, visibleIndex, isShiftKey)
            }
            onReorderSong={(oldIdx, newIdx) => handlePaneReorder('left', oldIdx, newIdx)}
            onOpenManualPair={setPairingSong}
            onClearFilter={() => setLeftFilter(DEFAULT_SONG_FILTER)}
            onSyncDatabase={() => handleSyncDatabase(true)}
          />

          {/* RIGHT COMMANDER PANE */}
          <CommanderPane
            side="right"
            isActive={activePane === 'right'}
            sourceId={resolvedRightSourceId}
            allSets={sets}
            totalLibraryCount={songs.length}
            totalSourceCount={rightPaneData.totalCount}
            rows={rightPaneData.rows}
            selectedKeys={rightSelection}
            hasFilter={rightPaneData.hasFilter}
            canDragReorder={!rightPaneData.isLibrary && !rightPaneData.hasFilter}
            targetSetSongIds={rightTargetSetSongIds}
            targetSetName={leftPaneData.setGroup?.name}
            assignedSongIds={assignedSongIds}
            onActivate={() => setActivePane('right')}
            onChangeSource={(id) => handleChangePaneSource('right', id)}
            onToggleRow={(rowKey, visibleIndex, isShiftKey) =>
              handleToggleRow('right', rowKey, visibleIndex, isShiftKey)
            }
            onReorderSong={(oldIdx, newIdx) => handlePaneReorder('right', oldIdx, newIdx)}
            onOpenManualPair={setPairingSong}
            onClearFilter={() => setRightFilter(DEFAULT_SONG_FILTER)}
            onSyncDatabase={() => handleSyncDatabase(true)}
          />
        </div>
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

      {/* OSA Export Modal (Drive-only export) */}
      <OsaExportModal
        isOpen={isOsaExportOpen}
        onClose={() => setIsOsaExportOpen(false)}
        onRetryUpload={handleGenerateOsaList}
        eventName={eventName}
        fileName={osaFileName}
        rows={osaExportRows}
        status={osaDriveStatus}
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
        role={role || 'user'}
        totalMasterSongs={songs.length}
        isSyncing={isSyncing}
        onSyncDatabase={() => handleSyncDatabase(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      {/* Song Detail (?) Modal */}
      <SongDetailModal
        song={inspectedSong}
        activeSetName={detailTargetSet.name}
        isInActiveSet={inspectedSong ? detailTargetSet.songIds.includes(inspectedSong.id) : false}
        onClose={() => setInspectedSong(null)}
        onAddSongToActiveSet={handleAddSongFromDetailModal}
      />

      {/* Setlist Manager Modal (Rename, Reorder, Color, Duplicate, Clear, Delete) */}
      <SetlistManagerModal
        isOpen={isSetlistManagerOpen}
        sets={sets}
        onClose={() => setIsSetlistManagerOpen(false)}
        onSaveSets={handleSaveManagedSets}
        onStartFresh={handleStartFresh}
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
        Načítám zabezpečení aplikace...
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
