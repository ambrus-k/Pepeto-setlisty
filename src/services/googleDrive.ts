import { DriveFolderInfo, DriveFileInfo, DriveSettings } from '../types';

export const DEFAULT_FOLDER_DATA = 'Playlists Mobile Sheets Data';
export const DEFAULT_FOLDER_EXPORT = 'Playlists Mobile Sheets Export';
export const DEFAULT_FILE_MSS = 'PEPETO_KOMPLET_SETLIST.mss';
export const DEFAULT_FILE_XLSX = 'PEPETA_KOMPLET.xlsx';

// Backward compatibility exports
export const FOLDER_DATA = DEFAULT_FOLDER_DATA;
export const FOLDER_EXPORT = DEFAULT_FOLDER_EXPORT;
export const FILE_MSS_DEFAULT = DEFAULT_FILE_MSS;
export const FILE_XLSX_DEFAULT = DEFAULT_FILE_XLSX;

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  shared?: boolean;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

/**
 * Extracts a Google Drive Folder ID from a raw ID or full URL
 */
export function extractFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Check if it's a URL like https://drive.google.com/drive/folders/1abc123...
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Check if it's a URL with id= parameter
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  // Check if it looks like a clean ID (alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

/**
 * Searches files/folders with a query, supporting shared items and all drives.
 */
async function searchDrive(
  query: string,
  token: string,
  pageSize: number = 100
): Promise<DriveFileItem[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime, shared, owners, shortcutDetails)');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gdrive_access_token');
    }
    throw new Error('Přihlášení k Disku Google vypršelo. Prosím přihlaste se znovu.');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chyba Disku Google (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Gets a folder by its Google Drive ID
 */
export async function getFolderById(folderId: string, token: string): Promise<DriveFolderInfo | null> {
  const cleanId = extractFolderId(folderId) || folderId.trim();
  if (!cleanId) return null;

  try {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${cleanId}`);
    url.searchParams.set('fields', 'id,name,mimeType,trashed,shared,owners,shortcutDetails');
    url.searchParams.set('supportsAllDrives', 'true');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.trashed) return null;

    // Handle shortcut to folder
    if (data.mimeType === 'application/vnd.google-apps.shortcut' && data.shortcutDetails?.targetId) {
      const target = await getFolderById(data.shortcutDetails.targetId, token);
      if (target) {
        return {
          ...target,
          name: data.name || target.name,
          isShared: true,
        };
      }
    }

    if (data.mimeType !== 'application/vnd.google-apps.folder') return null;

    return {
      id: data.id,
      name: data.name,
      isShared: data.shared || false,
      ownerEmail: data.owners?.[0]?.emailAddress,
      ownerName: data.owners?.[0]?.displayName,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Searches for an existing folder by exact or partial name
 */
export async function findFolderByName(folderName: string, token: string): Promise<DriveFolderInfo | null> {
  const safeName = folderName.trim().replace(/'/g, "\\'");
  if (!safeName) return null;

  try {
    const query = `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await searchDrive(query, token, 5);
    if (list.length > 0) {
      return {
        id: list[0].id,
        name: list[0].name,
        isShared: list[0].shared || false,
        ownerEmail: list[0].owners?.[0]?.emailAddress,
        ownerName: list[0].owners?.[0]?.displayName,
      };
    }
  } catch (err) {
    console.warn('findFolderByName error:', err);
  }
  return null;
}

/**
 * Finds a folder by name or creates it in the user's Drive root
 */
export async function findOrCreateFolder(folderName: string, token: string): Promise<DriveFolderInfo> {
  const safeName = folderName.trim() || DEFAULT_FOLDER_DATA;
  const existing = await findFolderByName(safeName, token);
  if (existing) {
    return existing;
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chyba při vytváření složky ${safeName}: ${err}`);
  }

  const created = await res.json();
  return { id: created.id, name: created.name };
}

/**
 * Universal folder resolver: accepts URL, ID, or name, and returns folder info
 */
export async function resolveFolder(input: string, token: string): Promise<DriveFolderInfo | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Try resolving as URL or ID
  const directId = extractFolderId(trimmed);
  if (directId) {
    const byId = await getFolderById(directId, token);
    if (byId) return byId;
  } else if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    const byId = await getFolderById(trimmed, token);
    if (byId) return byId;
  }

  // 2. Try resolving by Name
  const byName = await findFolderByName(trimmed, token);
  if (byName) return byName;

  return null;
}

/**
 * Lists all folders available in user's Google Drive (including shared folders from other accounts)
 */
export async function listAvailableFolders(token: string, nameFilter?: string): Promise<DriveFolderInfo[]> {
  const map = new Map<string, DriveFolderInfo>();

  try {
    // 1. Primary query: all accessible folders
    let q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (nameFilter && nameFilter.trim()) {
      const safe = nameFilter.trim().replace(/'/g, "\\'");
      q += ` and name contains '${safe}'`;
    }
    const files = await searchDrive(q, token, 100);
    for (const f of files) {
      map.set(f.id, {
        id: f.id,
        name: f.name,
        isShared: f.shared || false,
        ownerEmail: f.owners?.[0]?.emailAddress,
        ownerName: f.owners?.[0]?.displayName,
      });
    }

    // 2. Also ensure shared folders from other accounts are included
    try {
      let qShared = `sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      if (nameFilter && nameFilter.trim()) {
        const safe = nameFilter.trim().replace(/'/g, "\\'");
        qShared += ` and name contains '${safe}'`;
      }
      const sharedFiles = await searchDrive(qShared, token, 100);
      for (const f of sharedFiles) {
        if (!map.has(f.id)) {
          map.set(f.id, {
            id: f.id,
            name: f.name,
            isShared: true,
            ownerEmail: f.owners?.[0]?.emailAddress,
            ownerName: f.owners?.[0]?.displayName,
          });
        }
      }
    } catch (e) {
      // Ignored if unsupported
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Failed to list folders:', err);
    throw err;
  }
}

/**
 * Lists files in a specific folder
 */
export async function listFilesInFolder(folderId: string, token: string): Promise<DriveFileInfo[]> {
  const cleanId = extractFolderId(folderId) || folderId;
  const query = `'${cleanId}' in parents and trashed = false`;
  const files = await searchDrive(query, token, 100);
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Downloads file binary content from Google Drive
 */
export async function downloadDriveFile(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Nepodařilo se stáhnout soubor (${res.status}): ${await res.text()}`);
  }

  return await res.arrayBuffer();
}

/**
 * Uploads a file (multipart) to target folder
 */
export async function uploadFileToFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  content: Blob | string,
  token: string,
  confirmOverwrite?: (fileName: string) => Promise<boolean>
): Promise<{ id: string; name: string }> {
  const cleanFolderId = extractFolderId(folderId) || folderId;

  // Check if file with same name already exists in target folder
  const query = `'${cleanFolderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`;
  const existing = await searchDrive(query, token);

  let existingId: string | null = null;
  if (existing.length > 0) {
    if (confirmOverwrite) {
      const allowed = await confirmOverwrite(fileName);
      if (!allowed) {
        throw new Error(`Přepsání souboru ${fileName} bylo zrušeno.`);
      }
    }
    existingId = existing[0].id;
  }

  const fileBlob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

  // Multipart upload
  const metadata = existingId
    ? { name: fileName }
    : { name: fileName, parents: [cleanFolderId] };

  const boundary = '-------SetlistStudioBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;

  const metaBlob = new Blob([metadataPart]);
  const mediaHeaderBlob = new Blob([mediaHeader]);
  const closeBlob = new Blob([closeDelimiter]);

  const multipartBody = new Blob([metaBlob, mediaHeaderBlob, fileBlob, closeBlob]);

  const endpoint = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chyba při nahrávání ${fileName}: ${err}`);
  }

  const data = await res.json();
  return { id: data.id, name: data.name };
}

/**
 * Inspects both Google Drive folders based on user settings or defaults
 */
export async function getDriveFoldersStatus(
  token: string,
  settings?: DriveSettings
): Promise<{
  dataFolder: DriveFolderInfo | null;
  exportFolder: DriveFolderInfo | null;
  dataFiles: DriveFileInfo[];
  exportFiles: DriveFileInfo[];
  allMssFiles: DriveFileInfo[];
  allXlsxFiles: DriveFileInfo[];
  hasMssFile: boolean;
  hasXlsxFile: boolean;
  mssFile: DriveFileInfo | null;
  xlsxFile: DriveFileInfo | null;
  dataFolderName: string;
  exportFolderName: string;
}> {
  const targetDataName = settings?.dataFolderName || DEFAULT_FOLDER_DATA;
  const targetExportName = settings?.exportFolderName || DEFAULT_FOLDER_EXPORT;
  const customDataId = settings?.dataFolderId ? extractFolderId(settings.dataFolderId) : '';
  const customExportId = settings?.exportFolderId ? extractFolderId(settings.exportFolderId) : '';

  let dataFolder: DriveFolderInfo | null = null;
  let exportFolder: DriveFolderInfo | null = null;

  // 1. Resolve Data Folder
  if (customDataId) {
    dataFolder = await getFolderById(customDataId, token);
  }
  if (!dataFolder && targetDataName) {
    dataFolder = await findFolderByName(targetDataName, token);
  }

  // 2. Resolve Export Folder
  if (customExportId) {
    exportFolder = await getFolderById(customExportId, token);
  }
  if (!exportFolder && targetExportName) {
    exportFolder = await findFolderByName(targetExportName, token);
  }

  // 3. Inspect Data Folder contents - automatically detect MSS and XLSX files
  let dataFiles: DriveFileInfo[] = [];
  let allMssFiles: DriveFileInfo[] = [];
  let allXlsxFiles: DriveFileInfo[] = [];
  let mssFile: DriveFileInfo | null = null;
  let xlsxFile: DriveFileInfo | null = null;

  if (dataFolder) {
    try {
      dataFiles = await listFilesInFolder(dataFolder.id, token);

      // Detect all MSS files (.mss extension or containing mss)
      allMssFiles = dataFiles.filter((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.mss') || lower.includes('.mss') || lower.includes('mss');
      });

      // Detect all XLSX files (.xlsx, .xls extension or containing xlsx/xls)
      allXlsxFiles = dataFiles.filter((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.includes('xlsx') || lower.includes('xls');
      });

      if (allMssFiles.length > 0) {
        mssFile = allMssFiles[0];
      }
      if (allXlsxFiles.length > 0) {
        xlsxFile = allXlsxFiles[0];
      }
    } catch (e) {
      console.warn('Failed to list files in dataFolder:', e);
    }
  }

  // 4. Inspect Export Folder contents
  let exportFiles: DriveFileInfo[] = [];
  if (exportFolder) {
    try {
      exportFiles = await listFilesInFolder(exportFolder.id, token);
    } catch (e) {
      console.warn('Failed to list files in exportFolder:', e);
    }
  }

  return {
    dataFolder,
    exportFolder,
    dataFiles,
    exportFiles,
    allMssFiles,
    allXlsxFiles,
    hasMssFile: !!mssFile,
    hasXlsxFile: !!xlsxFile,
    mssFile,
    xlsxFile,
    dataFolderName: dataFolder?.name || targetDataName,
    exportFolderName: exportFolder?.name || targetExportName,
  };
}
