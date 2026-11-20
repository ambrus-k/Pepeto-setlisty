/**
 * Google Drive Server Service
 * ----------------------------------------------------------------------------
 * VŠECHNA KOMUNIKACE S GOOGLE DRIVE PROBÍHÁ POUZE ZDE NA BACKENDU!
 *
 * POSTUP PRO MAJITELE KAPELY - VYTVOŘENÍ SERVICE ACCOUNTU V GOOGLE CLOUD:
 * 1. Otevřete Google Cloud Console (https://console.cloud.google.com).
 * 2. Vytvořte nový projekt (např. "MobileSheets-Setlist-Studio").
 * 3. V menu "APIs & Services > Library" vyhledejte a povolte "Google Drive API".
 * 4. V menu "IAM & Admin > Service Accounts" klikněte na "+ Create Service Account".
 *    Zadejte jméno (např. "setlist-bot") a klikněte na "Create and Continue" -> "Done".
 * 5. Rozklikněte vytvořený účet, přejděte do záložky "Keys > Add Key > Create new key"
 *    a zvolte JSON. Soubor se stáhne do vašeho počítače.
 * 6. Z JSON souboru zkopírujte:
 *    - client_email -> GOOGLE_CLIENT_EMAIL v souboru .env
 *    - private_key  -> GOOGLE_PRIVATE_KEY v souboru .env
 * 7. DŮLEŽITÉ: Na svém Google Disku nasdílejte složku s daty (DRIVE_DATA_FOLDER_ID)
 *    a exportní složku (DRIVE_EXPORT_FOLDER_ID) na e-mail servisního účtu s právy "Editor"!
 * ----------------------------------------------------------------------------
 */

import { JWT, OAuth2Client } from 'google-auth-library';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import type {
  Song,
  AdminLogEntry,
  ServerDriveStatus,
  PepetoSingerLegendItem,
} from '../types/index.ts';
import {
  parseMssXml,
  parseXlsxWithLegend,
  pairMssAndXlsx,
  normalizeLegendSingerName,
  normalizeHexColor,
} from './parser.ts';
import { parseExcelAllStyles } from './excelStyleParser.ts';

// In-memory admin logs (last 50 events)
const adminLogs: AdminLogEntry[] = [
  {
    id: `log-${Date.now()}-init`,
    timestamp: Date.now(),
    type: 'info',
    action: 'SERVER_BOOT',
    details: 'Backend Google Drive & Setlist Studio služba nastartována.',
  },
];

function addLog(type: AdminLogEntry['type'], action: string, details: string) {
  const entry: AdminLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    type,
    action,
    details,
  };
  adminLogs.unshift(entry);
  if (adminLogs.length > 60) {
    adminLogs.pop();
  }
}

export function getAdminLogs(): AdminLogEntry[] {
  return [...adminLogs];
}

// In-memory songs & legend cache
let cachedSongs: Song[] = [];
let cachedDbSongs: Song[] = [];
let cachedLegend: PepetoSingerLegendItem[] = [];
let lastSyncedAt: number | undefined;
let lastExportedAt: number | undefined;
export let lastParsedXlsx: any[] = [];
export let lastParsedLegend: PepetoSingerLegendItem[] = [];

// Persisted folder settings file (use /tmp on Vercel read-only filesystem)
const SETTINGS_FILE = process.env.VERCEL
  ? path.join('/tmp', '.drive-settings.json')
  : path.resolve(process.cwd(), '.drive-settings.json');

function loadPersistedFolderSettings(): { dataFolderId?: string; exportFolderId?: string } {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read persisted folder settings:', e);
  }
  return {};
}

function savePersistedFolderSettings(settings: { dataFolderId?: string; exportFolderId?: string }) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to write persisted folder settings:', e);
  }
}

// Permanent default Google Drive folder IDs for Pepeto band
export const PERMANENT_DATA_FOLDER_ID = '1pZuDqPX6OVbGoYdfOg_p3DqJ0cEhAiq2';
export const PERMANENT_EXPORT_FOLDER_ID = '1gvZxnQDDdQtIMGO7-ai877tdZcYysfs-';

// Default OAuth2 credentials read from environment variables (.env / Vercel Environment Variables)
export const PERMANENT_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const PERMANENT_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const PERMANENT_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
export const PERMANENT_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';

/**
 * Extracts a Google Drive Folder ID from a raw ID or full URL
 */
export function extractFolderId(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  return trimmed;
}

/**
 * Returns current active folder IDs (persisted in JSON, from .env, or permanent defaults)
 * Always guarantees valid permanent IDs for Vercel and Android deployments.
 */
export function getActiveFolderIds(): { dataFolderId: string; exportFolderId: string } {
  const persisted = loadPersistedFolderSettings();
  const data = persisted.dataFolderId || (process.env.DRIVE_DATA_FOLDER_ID || process.env.GOOGLE_DRIVE_DATA_FOLDER_ID || PERMANENT_DATA_FOLDER_ID).trim();
  const exportF = persisted.exportFolderId || (process.env.DRIVE_EXPORT_FOLDER_ID || process.env.GOOGLE_DRIVE_EXPORT_FOLDER_ID || PERMANENT_EXPORT_FOLDER_ID).trim();
  return {
    dataFolderId: extractFolderId(data) || PERMANENT_DATA_FOLDER_ID,
    exportFolderId: extractFolderId(exportF) || PERMANENT_EXPORT_FOLDER_ID,
  };
}

/**
 * Saves updated folder IDs configured in the Admin UI
 */
export function saveFolderSettings(dataFolderInput: string, exportFolderInput: string): { dataFolderId: string; exportFolderId: string } {
  const cleanData = extractFolderId(dataFolderInput) || PERMANENT_DATA_FOLDER_ID;
  const cleanExport = extractFolderId(exportFolderInput) || PERMANENT_EXPORT_FOLDER_ID;
  savePersistedFolderSettings({ dataFolderId: cleanData, exportFolderId: cleanExport });
  addLog('info', 'FOLDERS_UPDATED', `Složky Disku aktualizovány v nastavení: Data=${cleanData}, Export=${cleanExport}`);
  return { dataFolderId: cleanData, exportFolderId: cleanExport };
}

// Žádná vzorová / demo data. Skladby se načítají výhradně synchronizací ze souboru .mss na Google Disku.

/**
 * Creates an authorized OAuth2Client or JWT client for Google Drive API
 * Priority: OAuth2 (Client ID, Secret, Refresh Token) saves files directly to user's Drive without quota issues.
 * Fallback: Service Account JWT (Client Email, Private Key).
 */
export function getGoogleAuthClient(): OAuth2Client | JWT | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || PERMANENT_CLIENT_ID).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || PERMANENT_CLIENT_SECRET).trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || PERMANENT_REFRESH_TOKEN).trim();

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new OAuth2Client(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return oauth2Client;
    } catch (err) {
      console.warn('Could not initialize Google OAuth2 Client:', err);
    }
  }

  const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || PERMANENT_CLIENT_EMAIL).trim();
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').trim();

  // Validate that clientEmail is valid and privateKey is an authentic PEM private key
  if (
    !clientEmail ||
    !clientEmail.includes('@') ||
    !privateKey ||
    privateKey.length < 100 ||
    !privateKey.includes('PRIVATE KEY')
  ) {
    return null;
  }

  // Handle wrapping quotes
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  // Handle escaped newlines in .env
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  } catch (err) {
    console.warn('Could not initialize Google Service Account JWT:', err);
    return null;
  }
}

/**
 * Gets a fresh access token from the authorized client (OAuth2 or Service Account)
 */
export async function getDriveAccessToken(): Promise<string> {
  const auth = getGoogleAuthClient();
  if (!auth) {
    throw new Error(
      'Google Drive přihlášení není nakonfigurováno. Nastavte OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) nebo Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) v .env.'
    );
  }
  const tokenResponse = await auth.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Nepodařilo se získat přístupový token pro Google Drive.');
  }
  return token;
}

// Backward-compatible alias for existing callers
async function getServiceAccountAccessToken(): Promise<string> {
  return getDriveAccessToken();
}

/**
 * Searches files on Google Drive using Service Account token
 */
async function searchDrive(query: string, token: string): Promise<any[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime)');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    let cleanMsg = errText;
    try {
      const errObj = JSON.parse(errText);
      if (errObj.error?.message?.includes('Google Drive API has not been used')) {
        const link = errObj.error.message.match(/https:\/\/[^\s]+/)?.[0] || 'https://console.cloud.google.com';
        cleanMsg = `V Google Cloud projektu není aktivováno Google Drive API. Povolte ho kliknutím na: ${link}`;
      } else if (errObj.error?.message) {
        cleanMsg = errObj.error.message;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(`Google Drive API (${res.status}): ${cleanMsg}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Downloads binary content from Google Drive
 */
async function downloadFileFromDrive(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Chyba stahování souboru ${fileId} (${res.status}): ${await res.text()}`);
  }

  return await res.arrayBuffer();
}

/**
 * Parse Excel file using ExcelJS + OpenXML theme/indexed color resolver on the server.
 * Extracts:
 * - songs (id, pdf_title, textColor, bgColor strictly from the number cell, category, isPrimarySheet)
 * - dynamic color legend from the "Legenda:" section below the song list
 */
export async function parseXlsxWithExcelJsAndLegend(buffer: ArrayBuffer): Promise<{
  items: any[];
  legend: PepetoSingerLegendItem[];
}> {
  try {
    const workbook = new ExcelJS.Workbook();
    const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    await workbook.xlsx.load(nodeBuf as any);

    // Also parse OpenXML styles/themes so Theme colors (+tint) and Indexed colors resolve accurately
    let openXmlStyles: Awaited<ReturnType<typeof parseExcelAllStyles>> | null = null;
    try {
      const arrayBuf = nodeBuf.buffer.slice(
        nodeBuf.byteOffset,
        nodeBuf.byteOffset + nodeBuf.byteLength
      ) as ArrayBuffer;
      openXmlStyles = await parseExcelAllStyles(arrayBuf);
    } catch (oxmlErr) {
      console.warn('OpenXML theme/style supplement failed, using ExcelJS ARGB only:', oxmlErr);
    }

    const items: any[] = [];
    const legend: PepetoSingerLegendItem[] = [];
    const seenLegendColors = new Set<string>();

    // Primární obarvený list "Seznam - vybarvený" má absolutní přednost!
    // Pokud existuje, nečteme pracovní/neobarvené listy (např. "Seznam komplet" s vizuálním žlutým pruhováním sloupců).
    // Pracovní / vyškrtané listy ("Seznam komplet - vyškrtané", "Seznam k odstranění") se vždy přeskakují.
    const hasPrimaryColoredSheet = workbook.worksheets.some((ws) =>
      (ws.name || '').toLowerCase().includes('vybarven')
    );

    const sortedSheets = [...workbook.worksheets]
      .filter((ws) => {
        const name = ws.name || '';
        if (/odstran|vyškrt/i.test(name)) {
          addLog('info', 'SHEET_SKIP', `Přeskakuji neaktivní/vyškrtaný list "${name}"`);
          return false;
        }
        if (hasPrimaryColoredSheet && !name.toLowerCase().includes('vybarven')) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aIsVybarven = (a.name || '').toLowerCase().includes('vybarven');
        const bIsVybarven = (b.name || '').toLowerCase().includes('vybarven');
        if (aIsVybarven && !bIsVybarven) return -1;
        if (!aIsVybarven && bIsVybarven) return 1;
        return 0;
      });

    const seenPrimaryIds = new Set<number>();

    const extractCellText = (cell: ExcelJS.Cell): string => {
      const v: any = cell.value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && Array.isArray(v.richText)) {
        return v.richText.map((p: any) => p.text || '').join('').trim();
      }
      if (typeof v === 'object' && v.result !== undefined) {
        return String(v.result).trim();
      }
      if (typeof v === 'object' && v.text !== undefined) {
        return String(v.text).trim();
      }
      return String(v).trim();
    };

    for (const worksheet of sortedSheets) {
      const sheetName = worksheet.name || '';
      const isPrimarySheet = sheetName.toLowerCase().includes('vybarven');
      const oxmlSheet = openXmlStyles?.sheets.get(sheetName);

      const resolveCellBgHex = (cell: ExcelJS.Cell): string => {
        // 1. Check ExcelJS direct ARGB fill (only when pattern is active, not 'none')
        if (cell.fill && typeof cell.fill === 'object') {
          const fill: any = cell.fill;
          const pattern = String(fill.pattern || '').toLowerCase();
          if (pattern && pattern !== 'none') {
            const fg = fill.fgColor;
            if (fg?.argb && typeof fg.argb === 'string') {
              let hex = fg.argb.trim();
              if (hex.length === 8) hex = hex.substring(2);
              if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                const lower = hex.toLowerCase();
                return lower === '000000' ? '#ffffff' : `#${lower}`;
              }
            }
          }
        }

        // 2. Fallback to OpenXML resolved color (handles Theme + Tint + Indexed colors)
        const oxmlBg = oxmlSheet?.cellColors.get(cell.address.toUpperCase())?.bgColor;
        if (oxmlBg) {
          const norm = normalizeHexColor(oxmlBg, '#ffffff');
          if (norm !== '#000000') return norm;
        }

        return '#ffffff';
      };

      const r1Values: any[] = [];
      worksheet.getRow(1).eachCell((c, n) => r1Values.push({ col: n, val: c.value }));
      addLog('info', 'SHEET_COLS', `Sheet "${sheetName}": rows=${worksheet.rowCount}, row1=${JSON.stringify(r1Values.slice(0, 8))}`);

      // Multi-column layout detection for non-primary sheets; primary sheet uses columns A (ID) & B (Title)
      let colPairs: { colId: number; colTitle: number }[] = [];
      if (isPrimarySheet && (worksheet.columnCount || 2) <= 3) {
        colPairs = [{ colId: 1, colTitle: 2 }];
      } else {
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          const val = String(cell.value || '').trim().toLowerCase();
          if (['id', 'číslo', 'cislo', 'kód', 'kod', 'songid'].includes(val)) {
            colPairs.push({ colId: colNumber, colTitle: colNumber + 1 });
          }
        });

        if (colPairs.length <= 1) {
          colPairs = [];
          const maxCol = Math.max(worksheet.columnCount || 2, 2);
          for (let c = 1; c < maxCol; c += 2) {
            colPairs.push({ colId: c, colTitle: c + 1 });
          }
        }
      }

      let inLegendSection = false;
      const totalRows = worksheet.rowCount || 0;

      for (let rowNumber = 1; rowNumber <= totalRows; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        // Check for "Legenda:" section header anywhere in the first pair
        const firstIdText = extractCellText(row.getCell(colPairs[0].colId));
        const firstTitleText = extractCellText(row.getCell(colPairs[0].colTitle));
        if (/^legenda\s*:?$/i.test(firstTitleText) || /^legenda\s*:?$/i.test(firstIdText)) {
          inLegendSection = true;
          continue;
        }

        if (inLegendSection) {
          // Parse legend entries: color swatch is in colId (A), description is in colTitle (B)
          if (!firstTitleText && !firstIdText) continue;
          const label = firstTitleText || firstIdText;
          const swatchCell = row.getCell(colPairs[0].colId);
          const titleCell = row.getCell(colPairs[0].colTitle);
          let swatchColor = resolveCellBgHex(swatchCell);
          // If swatch cell wasn't colored, check if user colored the label cell instead
          if (swatchColor === '#ffffff') {
            const altColor = resolveCellBgHex(titleCell);
            if (altColor !== '#ffffff') {
              swatchColor = altColor;
            }
          }

          const normalizedColor = normalizeHexColor(swatchColor, '#ffffff');
          if (!seenLegendColors.has(normalizedColor)) {
            seenLegendColors.add(normalizedColor);
            legend.push({
              bgColor: normalizedColor,
              singer: normalizeLegendSingerName(label),
              description: label,
            });
          }
          continue;
        }

        // Check all column pairs in this row
        for (const pair of colPairs) {
          const idCell = row.getCell(pair.colId);
          const titleCell = row.getCell(pair.colTitle);

          let idVal: number | undefined;
          const rawId: any = idCell.value;
          if (typeof rawId === 'number' && !isNaN(rawId)) {
            idVal = Math.round(rawId);
          } else if (rawId !== null && rawId !== undefined) {
            const idStr = extractCellText(idCell);
            if (/^\d{1,4}$/.test(idStr)) {
              const parsed = parseInt(idStr, 10);
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 5000) idVal = parsed;
            }
          }

          const pdfTitle = extractCellText(titleCell);

          if (!pdfTitle && idVal === undefined) {
            continue;
          }

          // Ensure numberCell points to the cell with the song number
          let numberCell = idCell;
          if (idVal === undefined && typeof titleCell.value === 'number') {
            idVal = Math.round(titleCell.value);
            numberCell = titleCell;
          }

          // Guard against legend rows placed without a "Legenda:" header
          if (
            idVal === undefined &&
            pdfTitle &&
            /^(legenda\b|n?běžně|instrument[aá]lk|lidovk|zp[ií]v[aá]\s+|duet\b)/i.test(pdfTitle)
          ) {
            const swatchColor = normalizeHexColor(resolveCellBgHex(idCell), '#ffffff');
            if (!seenLegendColors.has(swatchColor)) {
              seenLegendColors.add(swatchColor);
              legend.push({
                bgColor: swatchColor,
                singer: normalizeLegendSingerName(pdfTitle),
                description: pdfTitle,
              });
            }
            continue;
          }

          // ZÁSADNÍ PRAVIDLO: Barvu skladby určuje VÝHRADNĚ barva výplně u ČÍSLA (numberCell),
          // NIKOLIV barva pod názvem skladby (titleCell)!
          let bgColor = resolveCellBgHex(numberCell);

          if (bgColor === '#ffffff' && sheetName.toLowerCase().includes('lidovk')) {
            bgColor = '#ffffcc';
          }

          const finalBgColor = normalizeHexColor(bgColor, '#ffffff');
          const finalTextColor = '#000000'; // Purely black text, colored solely by cell background

          if (idVal !== undefined) {
            if (isPrimarySheet) {
              seenPrimaryIds.add(idVal);
            } else if (seenPrimaryIds.has(idVal)) {
              continue; // Do not allow secondary uncolored/draft sheets to pollute or collide
            }
          }

          items.push({
            id: idVal,
            pdf_title: pdfTitle || (idVal !== undefined ? `Skladba ${idVal}` : ''),
            textColor: finalTextColor,
            bgColor: finalBgColor,
            category: sheetName || undefined,
            isPrimarySheet,
          });
        }
      }
    }

    if (items.length > 0) {
      return { items, legend };
    }
  } catch (excelErr) {
    console.warn('ExcelJS parsing fallback to OpenXML:', excelErr);
  }

  // Fallback to our OpenXML styles parser
  return await parseXlsxWithLegend(buffer);
}

/**
 * Backward-compatible wrapper returning parsed XLSX song rows
 */
export async function parseXlsxWithExcelJs(buffer: ArrayBuffer): Promise<any[]> {
  const { items } = await parseXlsxWithExcelJsAndLegend(buffer);
  return items;
}

/**
 * Tests connection to Google Drive and inspects configured folders
 */
export async function testDriveConnection(): Promise<{
  authOk: boolean;
  authMode?: 'oauth2' | 'service_account' | 'none';
  clientEmail?: string;
  projectId?: string;
  apiEnabled: boolean;
  activationUrl?: string;
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
  exportFolder: {
    configured: boolean;
    folderId: string;
    accessible: boolean;
    folderName?: string;
    error?: string;
  };
  overallStatus: 'OK' | 'API_DISABLED' | 'AUTH_ERROR' | 'FOLDER_NOT_SHARED' | 'FILES_MISSING';
  message: string;
}> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || PERMANENT_CLIENT_ID).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || PERMANENT_CLIENT_SECRET).trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || PERMANENT_REFRESH_TOKEN).trim();
  const isOAuth2 = Boolean(clientId && clientSecret && refreshToken);

  const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || PERMANENT_CLIENT_EMAIL).trim();
  const projectId = (process.env.GOOGLE_PROJECT_ID || 'pepeto-setlists').trim();
  const auth = getGoogleAuthClient();

  const authMode: 'oauth2' | 'service_account' | 'none' = isOAuth2
    ? 'oauth2'
    : auth
    ? 'service_account'
    : 'none';

  if (!auth) {
    return {
      authOk: false,
      authMode: 'none',
      clientEmail: clientEmail || undefined,
      projectId: projectId || undefined,
      apiEnabled: false,
      dataFolder: { configured: false, folderId: '', accessible: false, hasMssFile: false, hasXlsxFile: false },
      exportFolder: { configured: false, folderId: '', accessible: false },
      overallStatus: 'AUTH_ERROR',
      message: 'Google Drive credentials chybí v .env. Nastavte OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) nebo Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY).',
    };
  }

  let token = '';
  try {
    token = await getDriveAccessToken();
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('Google Drive API') && msg.includes('has not been used')) {
      const match = msg.match(/https:\/\/[^\s]+/);
      return {
        authOk: true,
        clientEmail,
        projectId,
        apiEnabled: false,
        activationUrl: match ? match[0] : `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId || '219849626989'}`,
        dataFolder: { configured: false, folderId: '', accessible: false, hasMssFile: false, hasXlsxFile: false },
        exportFolder: { configured: false, folderId: '', accessible: false },
        overallStatus: 'API_DISABLED',
        message: 'V Google Cloud projektu není aktivováno Google Drive API. Povolte ho kliknutím na aktivační odkaz.',
      };
    }
    return {
      authOk: false,
      clientEmail,
      projectId,
      apiEnabled: false,
      dataFolder: { configured: false, folderId: '', accessible: false, hasMssFile: false, hasXlsxFile: false },
      exportFolder: { configured: false, folderId: '', accessible: false },
      overallStatus: 'AUTH_ERROR',
      message: `Chyba ověření servisního účtu: ${msg}`,
    };
  }

  // Auth & API are OK, now check folders
  const { dataFolderId, exportFolderId } = getActiveFolderIds();

  // 1. Inspect Data Folder
  let dataAccessible = false;
  let dataFolderName = '';
  let dataError = '';
  let hasMss = false;
  let hasXlsx = false;
  let mssName = '';
  let xlsxName = '';

  if (dataFolderId) {
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${dataFolderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        dataAccessible = true;
        dataFolderName = json.name;

        // List files in data folder
        const files = await searchDrive(`'${dataFolderId}' in parents and trashed = false`, token);
        const mss = files.find((f) => f.name.toLowerCase().endsWith('.mss'));
        const xlsx = files.find((f) => f.name.toLowerCase().endsWith('.xlsx'));
        if (mss) {
          hasMss = true;
          mssName = mss.name;
        }
        if (xlsx) {
          hasXlsx = true;
          xlsxName = xlsx.name;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        dataError = errJson.error?.message || `Složka nedostupná (${res.status})`;
      }
    } catch (e: any) {
      dataError = e.message;
    }
  }

  // 2. Inspect Export Folder
  let exportAccessible = false;
  let exportFolderName = '';
  let exportError = '';

  if (exportFolderId) {
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${exportFolderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        exportAccessible = true;
        exportFolderName = json.name;
      } else {
        const errJson = await res.json().catch(() => ({}));
        exportError = errJson.error?.message || `Složka nedostupná (${res.status})`;
      }
    } catch (e: any) {
      exportError = e.message;
    }
  }

  let overallStatus: 'OK' | 'API_DISABLED' | 'AUTH_ERROR' | 'FOLDER_NOT_SHARED' | 'FILES_MISSING' = 'OK';
  let message = 'Spojení s Google Diskem i složkami je plně funkční!';
  let apiEnabled = true;
  let activationUrl: string | undefined;

  const combinedError = `${dataError} ${exportError}`;
  if (combinedError.includes('Google Drive API has not been used') || combinedError.includes('is disabled')) {
    apiEnabled = false;
    overallStatus = 'API_DISABLED';
    const match = combinedError.match(/https:\/\/[^\s]+/);
    activationUrl = match ? match[0] : `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId || '219849626989'}`;
    message = 'V Google Cloud projektu dosud NENÍ AKTIVOVÁNO Google Drive API. Klikněte na odkaz a povolte ho (tlačítko Enable).';
  } else if (!dataAccessible || !exportAccessible) {
    overallStatus = 'FOLDER_NOT_SHARED';
    message = `Servisní účet nemá přístup ke složce. Otevřete Google Disk a nasdílejte složku na e-mail: ${clientEmail} (role Editor).`;
  } else if (!hasMss || !hasXlsx) {
    overallStatus = 'FILES_MISSING';
    const missing = [];
    if (!hasMss) missing.push('.mss soubor');
    if (!hasXlsx) missing.push('.xlsx soubor');
    message = `Složka "${dataFolderName}" je přístupná, ale chybí v ní: ${missing.join(', ')}.`;
  }

  return {
    authOk: true,
    authMode,
    clientEmail,
    projectId,
    apiEnabled,
    activationUrl,
    dataFolder: {
      configured: !!dataFolderId,
      folderId: dataFolderId,
      accessible: dataAccessible,
      folderName: dataFolderName,
      hasMssFile: hasMss,
      hasXlsxFile: hasXlsx,
      mssFileName: mssName,
      xlsxFileName: xlsxName,
      error: dataError,
    },
    exportFolder: {
      configured: !!exportFolderId,
      folderId: exportFolderId,
      accessible: exportAccessible,
      folderName: exportFolderName,
      error: exportError,
    },
    overallStatus,
    message,
  };
}

/**
 * Synchronizes repertoire from Google Drive (.mss + .xlsx with legend)
 */
export async function syncMasterSongsFromDrive(forceRefresh = false): Promise<{
  success: boolean;
  count: number;
  songs: Song[];
  dbSongs?: Song[];
  singerLegend?: PepetoSingerLegendItem[];
  syncedAt: number;
  source: 'google-drive' | 'cached' | 'fallback';
  message?: string;
}> {
  // If we already have cached songs and force is not set, return cached
  if (!forceRefresh && cachedSongs.length > 0 && lastSyncedAt) {
    return {
      success: true,
      count: cachedSongs.length,
      songs: cachedSongs,
      dbSongs: cachedDbSongs.length > 0 ? cachedDbSongs : undefined,
      singerLegend: cachedLegend.length > 0 ? cachedLegend : undefined,
      syncedAt: lastSyncedAt,
      source: 'cached',
    };
  }

  const auth = getGoogleAuthClient();
  const { dataFolderId } = getActiveFolderIds();

  // If Service Account is not set up, return clear message and zero songs
  if (!auth) {
    addLog('warning', 'SYNC_CONFIG_MISSING', 'Google Service Account credentials chybí v .env. Vložte GOOGLE_CLIENT_EMAIL a GOOGLE_PRIVATE_KEY.');
    return {
      success: false,
      count: 0,
      songs: [],
      syncedAt: 0,
      source: 'google-drive',
      message: 'Google Service Account není nakonfigurován. Vložte přihlašovací údaje k servisnímu účtu.',
    };
  }

  try {
    addLog('info', 'SYNC_START', 'Zahajuji synchronizaci z Google Disku přes Service Account...');
    const token = await getServiceAccountAccessToken();

    // 1. Locate Data Folder or files
    let folderQuery = '';
    if (dataFolderId) {
      folderQuery = `'${dataFolderId}' in parents and trashed = false`;
    } else {
      folderQuery = `trashed = false`;
    }

    // 2. Search for MSS and XLSX files
    let files: any[] = [];
    try {
      files = await searchDrive(folderQuery, token);
    } catch (searchErr: any) {
      // If searching with specific parent failed, fallback to name search
      console.warn('Parent query failed, trying global search:', searchErr);
    }

    let mssFile = files.find((f) => {
      const n = f.name.toLowerCase();
      return n === 'pepeto_komplet_setlist.mss' || n.endsWith('.mss');
    });

    let xlsxFile = files.find((f) => {
      const n = f.name.toLowerCase();
      return n === 'pepeta_komplet.xlsx' || n.endsWith('.xlsx');
    });

    // If not found in parent folder, try universal name search
    if (!mssFile) {
      const globalMss = await searchDrive("name contains 'PEPETO_KOMPLET' and trashed = false", token);
      mssFile = globalMss.find((f) => f.name.toLowerCase().endsWith('.mss')) || globalMss[0];
    }
    if (!xlsxFile) {
      const globalXlsx = await searchDrive("name contains 'PEPETA_KOMPLET' and trashed = false", token);
      xlsxFile = globalXlsx.find((f) => f.name.toLowerCase().endsWith('.xlsx')) || globalXlsx[0];
    }

    if (!mssFile || !xlsxFile) {
      const missing = [];
      if (!mssFile) missing.push('PEPETO_KOMPLET_SETLIST.mss');
      if (!xlsxFile) missing.push('PEPETA_KOMPLET.xlsx');
      const errStr = `Na Google Disku ve složce chybí požadované soubory: ${missing.join(', ')}`;
      addLog('error', 'SYNC_FILES_MISSING', errStr);
      throw new Error(errStr);
    }

    addLog('info', 'SYNC_DOWNLOADING', `Stahuji soubory: ${mssFile.name} (${mssFile.id}) a ${xlsxFile.name} (${xlsxFile.id})`);

    // 3. Download both files
    const [mssBuffer, xlsxBuffer] = await Promise.all([
      downloadFileFromDrive(mssFile.id, token),
      downloadFileFromDrive(xlsxFile.id, token),
    ]);

    // 3b. Optionally download rich metadata DB JSON if present in the Data folder
    const dbJsonFile =
      files.find((f) => f.name.toLowerCase() === 'pepeto-songs-app-db.json') ||
      files.find((f) => f.name.toLowerCase() === 'pepeto-songs-database.json');

    let driveDbSongs: Song[] = [];
    if (dbJsonFile) {
      try {
        const dbBuffer = await downloadFileFromDrive(dbJsonFile.id, token);
        const dbParsed = JSON.parse(new TextDecoder('utf-8').decode(dbBuffer));
        if (Array.isArray(dbParsed?.songs)) {
          driveDbSongs = dbParsed.songs;
          addLog('info', 'SYNC_DB_JSON', `Načtena rozšířená databáze z Google Disku (${dbJsonFile.name}: ${driveDbSongs.length} záznamů).`);
        }
      } catch (dbErr: any) {
        console.warn('Optional Drive DB JSON parse failed:', dbErr?.message);
      }
    }

    // 4. Parse MSS (XML) and XLSX (ExcelJS + OpenXML with colors & dynamic legend)
    const mssText = new TextDecoder('utf-8').decode(mssBuffer);
    const parsedMss = parseMssXml(mssText);
    const { items: parsedXlsx, legend: parsedLegend } = await parseXlsxWithExcelJsAndLegend(xlsxBuffer);

    lastParsedXlsx = parsedXlsx;
    lastParsedLegend = parsedLegend;
    const coloredInXlsx = parsedXlsx.filter((x) => x.bgColor && x.bgColor !== '#ffffff');
    addLog('info', 'XLSX_STATS', `XLSX celkem skladeb: ${parsedXlsx.length}, obarvených: ${coloredInXlsx.length}, bílé: ${parsedXlsx.length - coloredInXlsx.length}`);
    if (parsedLegend.length > 0) {
      addLog(
        'info',
        'XLSX_LEGEND',
        `Načtena legenda z Excelu (${parsedLegend.length} barev): ${parsedLegend.map((l) => `${l.bgColor}=${l.singer}`).join(', ')}`
      );
    }

    // 5. Pair them using authoritative colors & parsed legend from Excel
    const paired = pairMssAndXlsx(parsedMss, parsedXlsx, parsedLegend);

    if (paired.length === 0) {
      throw new Error('Při parsování souborů .mss a .xlsx nebyly nalezeny žádné skladby.');
    }

    cachedSongs = paired;
    if (parsedLegend.length > 0) {
      cachedLegend = parsedLegend;
    }
    if (driveDbSongs.length > 0) {
      cachedDbSongs = driveDbSongs;
    }
    lastSyncedAt = Date.now();

    addLog('success', 'SYNC_SUCCESS', `Úspěšně spárováno a načteno ${paired.length} skladeb z Google Disku (${parsedLegend.length} barev v legendě)!`);

    return {
      success: true,
      count: paired.length,
      songs: paired,
      dbSongs: driveDbSongs.length > 0 ? driveDbSongs : undefined,
      singerLegend: parsedLegend.length > 0 ? parsedLegend : undefined,
      syncedAt: lastSyncedAt,
      source: 'google-drive',
      message: `Úspěšně synchronizováno ${paired.length} skladeb z Google Disku.`,
    };
  } catch (err: any) {
    addLog('error', 'SYNC_ERROR', `Chyba při synchronizaci: ${err.message}`);
    if (cachedSongs.length > 0) {
      return {
        success: true,
        count: cachedSongs.length,
        songs: cachedSongs,
        dbSongs: cachedDbSongs.length > 0 ? cachedDbSongs : undefined,
        singerLegend: cachedLegend.length > 0 ? cachedLegend : undefined,
        syncedAt: lastSyncedAt || Date.now(),
        source: 'cached',
        message: `Synchronizace selhala (${err.message}), použita stávající cache (${cachedSongs.length} skladeb).`,
      };
    }

    return {
      success: false,
      count: 0,
      songs: [],
      syncedAt: 0,
      source: 'google-drive',
      message: `Chyba při stahování z Google Disku: ${err.message}`,
    };
  }
}

/**
 * Uploads an exported MSS XML string (and optional PDF) to the configured Google Drive Export folder
 */
export async function exportToGoogleDrive(
  fileName: string,
  mssXml: string,
  pdfBase64?: string
): Promise<{
  success: boolean;
  mssFileId?: string;
  pdfFileId?: string;
  fileName: string;
  folderId?: string;
  message?: string;
}> {
  const auth = getGoogleAuthClient();
  const { exportFolderId } = getActiveFolderIds();

  const safeFileName = fileName.trim().replace(/\.mss$/i, '') || 'Setlist';
  const mssTargetName = `${safeFileName}.mss`;
  const pdfTargetName = `${safeFileName}.pdf`;

  if (!auth) {
    addLog('warning', 'EXPORT_LOCAL_ONLY', `Export "${mssTargetName}" dokončen lokálně. Pro uložení na Google Disk nastavte servisní účet v .env.`);
    lastExportedAt = Date.now();
    return {
      success: true,
      fileName: mssTargetName,
      message: 'Export připraven k lokálnímu stažení (přidejte servisní účet do .env pro trvalý automatický upload na Google Disk).',
    };
  }

  try {
    addLog('info', 'EXPORT_START', `Ukládám soubor ${mssTargetName} do exportní složky na Google Disk...`);
    const token = await getServiceAccountAccessToken();

    // 1. Resolve target folder
    let targetFolderId = exportFolderId;
    if (!targetFolderId) {
      // Search "Playlists Mobile Sheets Export"
      const found = await searchDrive("name = 'Playlists Mobile Sheets Export' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", token);
      if (found.length > 0) {
        targetFolderId = found[0].id;
      }
    }

    if (!targetFolderId) {
      throw new Error('Exportní složka není na Google Disku specifikována (nastavte DRIVE_EXPORT_FOLDER_ID v Nastavení nebo .env).');
    }

    // 2. Check if file with same name already exists in target folder
    const existing = await searchDrive(`'${targetFolderId}' in parents and name = '${mssTargetName.replace(/'/g, "\\'")}' and trashed = false`, token);
    const existingMssId = existing.length > 0 ? existing[0].id : null;

    // 3. Upload or update MSS XML file
    const mssBoundary = '-------MssBoundary' + Math.random().toString(36).substring(2);
    const mssMetadata = existingMssId ? { name: mssTargetName } : { name: mssTargetName, parents: [targetFolderId] };

    const mssBody =
      `--${mssBoundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(mssMetadata)}\r\n` +
      `--${mssBoundary}\r\n` +
      `Content-Type: text/xml; charset=UTF-8\r\n\r\n` +
      `${mssXml}\r\n` +
      `--${mssBoundary}--`;

    const mssEndpoint = existingMssId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingMssId}?uploadType=multipart&supportsAllDrives=true`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

    const mssRes = await fetch(mssEndpoint, {
      method: existingMssId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${mssBoundary}`,
      },
      body: mssBody,
    });

    if (!mssRes.ok) {
      const errText = await mssRes.text();
      throw new Error(`Chyba při nahrávání MSS na Disk (${mssRes.status}): ${errText}`);
    }

    const mssResult = await mssRes.json();
    let pdfFileId: string | undefined;

    // 4. If PDF Base64 is also supplied, upload PDF file too
    if (pdfBase64) {
      try {
        const existingPdf = await searchDrive(`'${targetFolderId}' in parents and name = '${pdfTargetName.replace(/'/g, "\\'")}' and trashed = false`, token);
        const existingPdfId = existingPdf.length > 0 ? existingPdf[0].id : null;

        const pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
        const pdfMetadata = existingPdfId ? { name: pdfTargetName } : { name: pdfTargetName, parents: [targetFolderId] };

        const pdfBoundary = '-------PdfBoundary' + Math.random().toString(36).substring(2);
        const metaPart = Buffer.from(`--${pdfBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(pdfMetadata)}\r\n--${pdfBoundary}\r\nContent-Type: application/pdf\r\n\r\n`);
        const closePart = Buffer.from(`\r\n--${pdfBoundary}--`);

        const multipartPdf = Buffer.concat([metaPart, pdfBuffer, closePart]);

        const pdfEndpoint = existingPdfId
          ? `https://www.googleapis.com/upload/drive/v3/files/${existingPdfId}?uploadType=multipart&supportsAllDrives=true`
          : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

        const pdfRes = await fetch(pdfEndpoint, {
          method: existingPdfId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${pdfBoundary}`,
          },
          body: multipartPdf,
        });

        if (pdfRes.ok) {
          const pdfJson = await pdfRes.json();
          pdfFileId = pdfJson.id;
        }
      } catch (pdfErr) {
        console.warn('PDF upload warning:', pdfErr);
      }
    }

    lastExportedAt = Date.now();
    addLog('success', 'EXPORT_SUCCESS', `Soubor "${mssTargetName}" byl úspěšně uložen na Google Disk do cílové složky.`);

    return {
      success: true,
      mssFileId: mssResult.id,
      pdfFileId,
      fileName: mssTargetName,
      folderId: targetFolderId,
      message: `Setlist "${mssTargetName}" byl úspěšně uložen na Google Disk!`,
    };
  } catch (err: any) {
    addLog('error', 'EXPORT_ERROR', `Chyba při exportu na Disk: ${err.message}`);
    return {
      success: false,
      fileName: mssTargetName,
      message: `Chyba při ukládání na Google Disk: ${err.message}`,
    };
  }
}

/**
 * Returns current status of server-side Google Drive configuration
 */
export function getServerDriveStatus(): ServerDriveStatus {
  const clientId = (process.env.GOOGLE_CLIENT_ID || PERMANENT_CLIENT_ID).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || PERMANENT_CLIENT_SECRET).trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || PERMANENT_REFRESH_TOKEN).trim();
  const oauth2Configured = Boolean(clientId && clientSecret && refreshToken);

  const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || PERMANENT_CLIENT_EMAIL).trim();
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  const serviceAccountConfigured = Boolean(clientEmail && privateKey);

  const authMode: 'oauth2' | 'service_account' | 'none' = oauth2Configured
    ? 'oauth2'
    : serviceAccountConfigured
    ? 'service_account'
    : 'none';

  const projectId = (process.env.GOOGLE_PROJECT_ID || 'pepeto-setlists').trim();
  const { dataFolderId, exportFolderId } = getActiveFolderIds();

  return {
    serviceAccountConfigured: serviceAccountConfigured || oauth2Configured,
    authMode,
    clientEmail: clientEmail
      ? `${clientEmail.substring(0, 10)}...${clientEmail.slice(-15)}`
      : oauth2Configured
      ? 'OAuth2 (Účet majitele)'
      : undefined,
    projectId: projectId || undefined,
    dataFolderId: dataFolderId || undefined,
    exportFolderId: exportFolderId || undefined,
    hasCachedData: cachedSongs.length > 0,
    totalCachedSongs: cachedSongs.length,
    lastSyncedAt,
    lastExportedAt,
  };
}
