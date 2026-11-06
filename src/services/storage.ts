import localforage from 'localforage';
import { Song, EventProject, PendingUpload } from '../types';

// Configure localforage instance for MobileSheets Setlist Studio
const store = localforage.createInstance({
  name: 'MobileSheetsSetlistStudio',
  storeName: 'setlist_store',
  description: 'Offline database for band repertoire and setlists',
});

const KEYS = {
  MASTER_SONGS: 'master_songs_db',
  CURRENT_PROJECT: 'current_active_project',
  SAVED_PROJECTS: 'saved_projects_list',
  PENDING_UPLOADS: 'pending_drive_uploads',
  SETTINGS: 'app_settings',
};

export const storage = {
  // Master songs library
  async saveSongs(songs: Song[]): Promise<void> {
    await store.setItem(KEYS.MASTER_SONGS, songs);
  },

  async getSongs(): Promise<Song[] | null> {
    return await store.getItem<Song[]>(KEYS.MASTER_SONGS);
  },

  // Active event project
  async saveCurrentProject(project: EventProject): Promise<void> {
    await store.setItem(KEYS.CURRENT_PROJECT, project);
  },

  async getCurrentProject(): Promise<EventProject | null> {
    return await store.getItem<EventProject>(KEYS.CURRENT_PROJECT);
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
    dataFolderName: string;
    dataFolderId?: string;
    exportFolderName: string;
    exportFolderId?: string;
    mssFileName?: string;
    xlsxFileName?: string;
  }> {
    const saved = await store.getItem<any>(KEYS.SETTINGS);
    return {
      dataFolderName: saved?.dataFolderName || 'Playlists Mobile Sheets Data',
      dataFolderId: saved?.dataFolderId || '',
      exportFolderName: saved?.exportFolderName || 'Playlists Mobile Sheets Export',
      exportFolderId: saved?.exportFolderId || '',
      mssFileName: saved?.mssFileName || 'PEPETO_KOMPLET_SETLIST.mss',
      xlsxFileName: saved?.xlsxFileName || 'PEPETA_KOMPLET.xlsx',
    };
  },

  async saveDriveSettings(settings: {
    dataFolderName: string;
    dataFolderId?: string;
    exportFolderName: string;
    exportFolderId?: string;
    mssFileName?: string;
    xlsxFileName?: string;
  }): Promise<void> {
    await store.setItem(KEYS.SETTINGS, settings);
  },
};
