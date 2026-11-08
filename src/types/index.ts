export interface Song {
  id: number;
  mss_title: string;
  pdf_title: string;
  textColor: string;
  bgColor: string;
  category?: string;
  artist?: string;
  note?: string;
}

export interface SetlistGroup {
  id: string;
  name: string;
  isFixed?: boolean;
  songIds: number[];
  color?: string; // HEX color from Excel sheet tab or custom
}

export interface EventProject {
  id: string;
  eventName: string;
  eventDate?: string;
  notes?: string;
  sets: SetlistGroup[];
  updatedAt: number;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  isShared?: boolean;
  ownerEmail?: string;
  ownerName?: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

export interface PendingUpload {
  id: string;
  eventName: string;
  fileName: string;
  fileType: 'pdf' | 'mss';
  blobData: Blob;
  createdAt: number;
  status: 'pending' | 'uploading' | 'failed' | 'synced';
  error?: string;
}

export type UserRole = 'user' | 'admin';

export interface AdminLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  action: string;
  details: string;
}

export interface ServerDriveStatus {
  serviceAccountConfigured: boolean;
  authMode?: 'oauth2' | 'service_account' | 'none';
  clientEmail?: string;
  projectId?: string;
  dataFolderId?: string;
  exportFolderId?: string;
  hasCachedData: boolean;
  totalCachedSongs: number;
  lastSyncedAt?: number;
  lastExportedAt?: number;
}

export interface DriveSettings {
  dataFolderName: string;
  dataFolderId?: string;
  exportFolderName: string;
  exportFolderId?: string;
  mssFileName?: string;
  xlsxFileName?: string;
}

