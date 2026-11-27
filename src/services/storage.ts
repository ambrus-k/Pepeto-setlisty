import localforage from 'localforage';
import type { Song, EventProject, PendingUpload, PepetoSingerLegendItem } from '../types/index.ts';

// Configure localforage instance for MobileSheets Setlist Studio
const store = localforage.createInstance({
  name: 'MobileSheetsSetlistStudio',
  storeName: 'setlist_store',
  description: 'Offline database for band repertoire and setlists',
});

const KEYS = {
  MASTER_SONGS: 'master_songs_db',
  SINGER_LEGEND: 'singer_legend_db',
  CURRENT_PROJECT: 'current_active_project',
  SAVED_PROJECTS: 'saved_projects_list',
  PENDING_UPLOADS: 'pending_drive_uploads',
  SETTINGS: 'app_settings',
};

const LOCAL_PROJECT_MIRROR_KEY = 'pepeto_current_project_v1';
const LOCAL_WORKSPACE_UI_KEY = 'pepeto_workspace_ui_v1';

export interface WorkspaceUiState {
  leftSourceId: string;
  rightSourceId: string;
  activePane: 'left' | 'right';
}

export const PERMANENT_ROOT_FOLDER_ID = '148l9d_0G8INqEVa6RZa_Lo8vyH5RrUqJ';
export const PERMANENT_DATA_FOLDER_ID = '1pZuDqPX6OVbGoYdfOg_p3DqJ0cEhAiq2';
export const PERMANENT_OSA_FOLDER_ID = '1t-ZPYsLBE8RxsOk4hA8H8x0mmPyfyyR6';
export const PERMANENT_EXPORT_FOLDER_ID = PERMANENT_ROOT_FOLDER_ID;

function isValidProject(obj: unknown): obj is EventProject {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Partial<EventProject>;
  return Array.isArray(candidate.sets) && candidate.sets.length > 0;
}

export const storage = {
  // Master songs library
  async saveSongs(songs: Song[]): Promise<void> {
    await store.setItem(KEYS.MASTER_SONGS, songs);
  },

  async getSongs(): Promise<Song[] | null> {
    return await store.getItem<Song[]>(KEYS.MASTER_SONGS);
  },

  // Dynamic color -> singer legend parsed from Excel
  async saveSingerLegend(legend: PepetoSingerLegendItem[]): Promise<void> {
    await store.setItem(KEYS.SINGER_LEGEND, legend);
  },

  async getSingerLegend(): Promise<PepetoSingerLegendItem[] | null> {
    return await store.getItem<PepetoSingerLegendItem[]>(KEYS.SINGER_LEGEND);
  },

  // Synchronous mirror in localStorage (survives instant Android pull-to-refresh & prevents mount race)
  getCurrentProjectSync(): EventProject | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(LOCAL_PROJECT_MIRROR_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidProject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  saveCurrentProjectSync(project: EventProject): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(LOCAL_PROJECT_MIRROR_KEY, JSON.stringify(project));
    } catch (err) {
      console.warn('Failed to write sync project mirror to localStorage:', err);
    }
  },

  // Active event project (dual-layer: synchronous localStorage + durable IndexedDB)
  async saveCurrentProject(project: EventProject): Promise<void> {
    this.saveCurrentProjectSync(project);
    await store.setItem(KEYS.CURRENT_PROJECT, project);
  },

  async getCurrentProject(): Promise<EventProject | null> {
    const syncProject = this.getCurrentProjectSync();
    let idbProject: EventProject | null = null;
    try {
      const rawIdb = await store.getItem<EventProject>(KEYS.CURRENT_PROJECT);
      if (isValidProject(rawIdb)) {
        idbProject = rawIdb;
      }
    } catch (err) {
      console.warn('Failed to read current project from IndexedDB:', err);
    }

    if (syncProject && idbProject) {
      return (syncProject.updatedAt || 0) >= (idbProject.updatedAt || 0)
        ? syncProject
        : idbProject;
    }
    return syncProject || idbProject;
  },

  // Workspace pane UI state (which sources are open in Left/Right panes)
  getWorkspaceUiSync(): WorkspaceUiState | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(LOCAL_WORKSPACE_UI_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.leftSourceId === 'string' &&
        typeof parsed.rightSourceId === 'string' &&
        (parsed.activePane === 'left' || parsed.activePane === 'right')
      ) {
        return parsed as WorkspaceUiState;
      }
      return null;
    } catch {
      return null;
    }
  },

  saveWorkspaceUiSync(ui: WorkspaceUiState): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(LOCAL_WORKSPACE_UI_KEY, JSON.stringify(ui));
    } catch {
      // ignore storage quota errors for UI preferences
    }
  },

  // Saved projects archive
  async getSavedProjects(): Promise<EventProject[]> {
    const projects = await store.getItem<EventProject[]>(KEYS.SAVED_PROJECTS);
    return projects || [];
  },

  async saveProjectToArchive(project: EventProject): Promise<void> {
    const list = (await this.getSavedProjects()).filter((p) => p.id !== project.id);
    list.unshift(project);
    await store.setItem(KEYS.SAVED_PROJECTS, list);
  },

  // Offline upload queue
  async getPendingUploads(): Promise<PendingUpload[]> {
    const queue = await store.getItem<PendingUpload[]>(KEYS.PENDING_UPLOADS);
    return queue || [];
  },

  async addPendingUpload(upload: PendingUpload): Promise<void> {
    const queue = await this.getPendingUploads();
    queue.push(upload);
    await store.setItem(KEYS.PENDING_UPLOADS, queue);
  },

  async removePendingUpload(id: string): Promise<void> {
    const queue = await this.getPendingUploads();
    const updated = queue.filter((item) => item.id !== id);
    await store.setItem(KEYS.PENDING_UPLOADS, updated);
  },

  async clearPendingUploads(): Promise<void> {
    await store.removeItem(KEYS.PENDING_UPLOADS);
  },

  // Drive folder & file configuration
  async getDriveSettings(): Promise<{
    rootFolderName: string;
    rootFolderId: string;
    dataFolderName: string;
    dataFolderId?: string;
    osaFolderName: string;
    osaFolderId: string;
    exportFolderName: string;
    exportFolderId?: string;
    mssFileName?: string;
    xlsxFileName?: string;
  }> {
    const saved = await store.getItem<any>(KEYS.SETTINGS);
    return {
      rootFolderName: saved?.rootFolderName || 'Playlisty',
      rootFolderId: saved?.rootFolderId || PERMANENT_ROOT_FOLDER_ID,
      dataFolderName: saved?.dataFolderName || 'Play listy MobileSheets_data',
      dataFolderId: saved?.dataFolderId || PERMANENT_DATA_FOLDER_ID,
      osaFolderName: saved?.osaFolderName || 'Osa seznam',
      osaFolderId: saved?.osaFolderId || PERMANENT_OSA_FOLDER_ID,
      exportFolderName: saved?.exportFolderName || 'Playlisty',
      exportFolderId: saved?.exportFolderId || PERMANENT_ROOT_FOLDER_ID,
      mssFileName: saved?.mssFileName || 'PEPETO_KOMPLET_SETLIST.mss',
      xlsxFileName: saved?.xlsxFileName || 'PEPETA_KOMPLET.xlsx',
    };
  },

  async saveDriveSettings(settings: {
    rootFolderName?: string;
    rootFolderId?: string;
    dataFolderName: string;
    dataFolderId?: string;
    osaFolderName?: string;
    osaFolderId?: string;
    exportFolderName?: string;
    exportFolderId?: string;
    mssFileName?: string;
    xlsxFileName?: string;
  }): Promise<void> {
    await store.setItem(KEYS.SETTINGS, settings);
  },
};
