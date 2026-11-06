import * as XLSX from 'xlsx';
import { Song } from '../types';
import { parseExcelAllStyles, CellStyleInfo } from './excelStyleParser';

interface ParsedMssItem {
  id: number;
  mss_title: string;
}

interface ParsedXlsxItem {
  id?: number;
  pdf_title?: string;
  textColor?: string;
  bgColor?: string;
  category?: string;
  raw?: any;
}

/**
 * Normalizes any color representation (hex with or without #, ARGB, or named) to #rrggbb.
 */
export function normalizeHexColor(rawColor: string | undefined | null, fallback: string): string {
  if (!rawColor) return fallback;
  let color = String(rawColor).trim().replace(/^#/, '');

  // If ARGB (8 hex chars), remove alpha prefix
  if (color.length === 8) {
    color = color.substring(2);
  }

  // If 3 hex chars, expand to 6
  if (color.length === 3) {
    color = color
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (/^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color.toLowerCase()}`;
  }

  return fallback;
}

/**
 * Parse .mss XML file
 */
export function parseMssXml(xmlText: string): ParsedMssItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const songNodes = xmlDoc.getElementsByTagName('Song');
  const songs: ParsedMssItem[] = [];

  for (let i = 0; i < songNodes.length; i++) {
    const songNode = songNodes[i];
    const titleEl = songNode.getElementsByTagName('Title')[0];
    const songIdEl = songNode.getElementsByTagName('SongId')[0];

    const title = titleEl?.textContent?.trim() || '';
    const idStr = songIdEl?.textContent?.trim() || '';
    const id = parseInt(idStr, 10);

    if (!isNaN(id) && title) {
      if (!songs.some((s) => s.id === id)) {
        songs.push({ id, mss_title: title });
      }
    }
  }

  return songs;
}

/**
 * Parse .xlsx Excel file with authentic OpenXML cell styles and background/font colors
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedXlsxItem[]> {
  // 1. Extract authentic cell styles from .xlsx ZIP archive
  let stylesInfo: Awaited<ReturnType<typeof parseExcelAllStyles>> | null = null;
  try {
    stylesInfo = await parseExcelAllStyles(buffer);
  } catch (err) {
    console.warn('Could not parse OpenXML styles from zip, falling back to plain values:', err);
  }

  // 2. Parse workbook data with SheetJS
  const workbook = XLSX.read(buffer, {
    type: 'array',
  });

  const items: ParsedXlsxItem[] = [];
  const seenIds = new Set<number>();

  for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
    const sheetName = workbook.SheetNames[sheetIdx];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const sheetStyle =
      stylesInfo?.sheets.get(sheetName) || stylesInfo?.sheetByIndex.get(sheetIdx);

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');

    // First detect header columns if row 0 has headers
    let headerRowIdx = -1;
    let colIdIdx = -1;
    let colTitleIdx = -1;
    let colTextColorIdx = -1;
    let colBgColorIdx = -1;
    let colCategoryIdx = -1;

    for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
      let isHeader = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = String(worksheet[addr]?.v || '').trim().toLowerCase();
        if (
          val === 'id' ||
          val === 'songid' ||
          val === 'song id' ||
          val === 'číslo' ||
          val === 'cislo' ||
          val === 'kód'
        ) {
          colIdIdx = c;
          isHeader = true;
        } else if (
          val.includes('název') ||
          val.includes('nazev') ||
          val.includes('title') ||
          val.includes('skladba') ||
          val.includes('píseň') ||
          val.includes('song')
        ) {
          colTitleIdx = c;
          isHeader = true;
        } else if (val.includes('text') && val.includes('barv')) {
          colTextColorIdx = c;
        } else if (val.includes('pozad') || val.includes('background') || val.includes('bg')) {
          colBgColorIdx = c;
        } else if (val.includes('kategor') || val.includes('žánr') || val.includes('zanr')) {
          colCategoryIdx = c;
        }
      }
      if (isHeader) {
        headerRowIdx = r;
        break;
      }
    }

    // Default column assumptions if headers were not explicitly labeled
    if (colIdIdx === -1) colIdIdx = 0; // Col A
    if (colTitleIdx === -1) colTitleIdx = 1; // Col B

    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : range.s.r;

    for (let r = startRow; r <= range.e.r; r++) {
      const excelRowNum = r + 1; // 1-based row number
      const rowStyle = sheetStyle?.rowColors.get(excelRowNum);

      // 1. Resolve Song ID
      let songId: number | undefined;

      // Try designated ID column
      const idAddr = XLSX.utils.encode_cell({ r, c: colIdIdx });
      const idVal = worksheet[idAddr]?.v;
      if (typeof idVal === 'number' && Number.isInteger(idVal)) {
        songId = idVal;
      } else if (idVal) {
        const parsed = parseInt(String(idVal).trim(), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          songId = parsed;
        }
      }

      // If still no ID, scan all cells in this row for a clean integer ID
      if (songId === undefined) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          if (c === colTitleIdx) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          const val = worksheet[addr]?.v;
          if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < 100000) {
            songId = val;
            break;
          }
        }
      }

      // 2. Resolve PDF Title (visual name with sax notes, etc.)
      let pdfTitle = '';
      const titleAddr = XLSX.utils.encode_cell({ r, c: colTitleIdx });
      const rawTitle = worksheet[titleAddr]?.v;
      if (rawTitle) {
        pdfTitle = String(rawTitle).trim();
      }

      // If still empty, scan row for non-numeric text
      if (!pdfTitle) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          if (c === colIdIdx) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          const val = worksheet[addr]?.v;
          if (val && typeof val === 'string' && val.trim().length > 1 && isNaN(Number(val))) {
            pdfTitle = val.trim();
            break;
          }
        }
      }

      // Skip row if completely empty
      if (songId === undefined && !pdfTitle) {
        continue;
      }

      // 3. Resolve Colors: Check cell styles from OpenXML
      let detectedBgColor: string | undefined;
      let detectedTextColor: string | undefined;

      // Check explicit color columns if present
      if (colTextColorIdx !== -1) {
        const addr = XLSX.utils.encode_cell({ r, c: colTextColorIdx });
        const val = worksheet[addr]?.v;
        if (val) detectedTextColor = String(val).trim();
      }
      if (colBgColorIdx !== -1) {
        const addr = XLSX.utils.encode_cell({ r, c: colBgColorIdx });
        const val = worksheet[addr]?.v;
        if (val) detectedBgColor = String(val).trim();
      }

      // Check OpenXML cell styles:
      // A) Check ID cell style
      const idCellStyle = sheetStyle?.cellColors.get(XLSX.utils.encode_cell({ r, c: colIdIdx }));
      if (idCellStyle?.bgColor && idCellStyle.bgColor !== '#ffffff') {
        detectedBgColor = idCellStyle.bgColor;
      }
      if (idCellStyle?.textColor) {
        detectedTextColor = idCellStyle.textColor;
      }

      // B) Check Title cell style
      const titleCellStyle = sheetStyle?.cellColors.get(XLSX.utils.encode_cell({ r, c: colTitleIdx }));
      if (titleCellStyle?.bgColor && titleCellStyle.bgColor !== '#ffffff' && !detectedBgColor) {
        detectedBgColor = titleCellStyle.bgColor;
      }
      if (titleCellStyle?.textColor && !detectedTextColor) {
        detectedTextColor = titleCellStyle.textColor;
      }

      // C) Check all other cells in this row for non-white background
      if (!detectedBgColor || detectedBgColor === '#ffffff') {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cStyle = sheetStyle?.cellColors.get(addr);
          if (cStyle?.bgColor && cStyle.bgColor !== '#ffffff') {
            detectedBgColor = cStyle.bgColor;
            break;
          }
          if (cStyle?.textColor && cStyle.textColor !== '#000000' && !detectedTextColor) {
            detectedTextColor = cStyle.textColor;
          }
        }
      }

      // D) Row-level style fallback
      if ((!detectedBgColor || detectedBgColor === '#ffffff') && rowStyle?.bgColor && rowStyle.bgColor !== '#ffffff') {
        detectedBgColor = rowStyle.bgColor;
      }
      if (!detectedTextColor && rowStyle?.textColor) {
        detectedTextColor = rowStyle.textColor;
      }

      // E) Sheet tab color fallback
      if ((!detectedBgColor || detectedBgColor === '#ffffff') && sheetStyle?.tabColor) {
        detectedBgColor = sheetStyle.tabColor;
      }

      // F) Lidovky sheet fallback (standard yellow #fff2cc as in PDF template)
      if ((!detectedBgColor || detectedBgColor === '#ffffff') && sheetName.toLowerCase().includes('lidovk')) {
        detectedBgColor = '#fff2cc';
      }

      // 4. Resolve Category
      let category = '';
      if (colCategoryIdx !== -1) {
        const addr = XLSX.utils.encode_cell({ r, c: colCategoryIdx });
        category = String(worksheet[addr]?.v || '').trim();
      }
      if (!category) {
        category = sheetName;
      }

      // Final normalized colors
      const finalBgColor = normalizeHexColor(detectedBgColor, '#ffffff');
      const finalTextColor = normalizeHexColor(detectedTextColor, '#000000');

      if (songId !== undefined) {
        if (!seenIds.has(songId)) {
          seenIds.add(songId);
          items.push({
            id: songId,
            pdf_title: pdfTitle || `Skladba ${songId}`,
            textColor: finalTextColor,
            bgColor: finalBgColor,
            category,
          });
        }
      } else if (pdfTitle) {
        items.push({
          id: undefined,
          pdf_title: pdfTitle,
          textColor: finalTextColor,
          bgColor: finalBgColor,
          category,
        });
      }
    }
  }

  return items;
}

/**
 * Pairs songs from MSS (ID + clean Title) with XLSX (ID + visual PDF title + colors).
 * Exact requirements:
 * id: (Integer)
 * mss_title: (Čistý název pro XML export, načteno z MSS)
 * pdf_title: (Název s poznámkami pro tisk, načteno z XLSX, např. "Modrá - Žlutej pes - ALT Sax")
 * textColor: (HEX kód barvy textu z XLSX buňky)
 * bgColor: (HEX kód barvy pozadí z XLSX buňky)
 */
export function pairMssAndXlsx(mssList: ParsedMssItem[], xlsxList: ParsedXlsxItem[]): Song[] {
  const result: Song[] = [];
  const xlsxById = new Map<number, ParsedXlsxItem>();
  const xlsxByTitle = new Map<string, ParsedXlsxItem>();

  for (const item of xlsxList) {
    if (item.id !== undefined) {
      xlsxById.set(item.id, item);
    }
    if (item.pdf_title) {
      const normalizedTitle = item.pdf_title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      xlsxByTitle.set(normalizedTitle, item);
    }
  }

  // First pair all MSS songs
  const matchedXlsxIds = new Set<number>();

  for (const mss of mssList) {
    let matchedXlsx = xlsxById.get(mss.id);

    // If no direct ID match, try title matching
    if (!matchedXlsx) {
      const normalizedMssTitle = mss.mss_title.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [normTitle, item] of xlsxByTitle.entries()) {
        if (normTitle.includes(normalizedMssTitle) || normalizedMssTitle.includes(normTitle)) {
          matchedXlsx = item;
          break;
        }
      }
    }

    if (matchedXlsx && matchedXlsx.id !== undefined) {
      matchedXlsxIds.add(matchedXlsx.id);
    }

    const pdfTitle = matchedXlsx?.pdf_title || mss.mss_title;
    const textColor = normalizeHexColor(matchedXlsx?.textColor, '#000000');
    const bgColor = normalizeHexColor(matchedXlsx?.bgColor, '#ffffff');

    result.push({
      id: mss.id,
      mss_title: mss.mss_title,
      pdf_title: pdfTitle,
      textColor,
      bgColor,
      category: matchedXlsx?.category,
    });
  }

  // Include any extra songs found in XLSX that weren't in MSS
  for (const item of xlsxList) {
    if (item.id !== undefined && !matchedXlsxIds.has(item.id) && !result.some((s) => s.id === item.id)) {
      result.push({
        id: item.id,
        mss_title: item.pdf_title?.split('-')[0]?.trim() || `Song ${item.id}`,
        pdf_title: item.pdf_title || `Song ${item.id}`,
        textColor: normalizeHexColor(item.textColor, '#000000'),
        bgColor: normalizeHexColor(item.bgColor, '#ffffff'),
        category: item.category,
      });
    }
  }

  // Sort by id ascending
  result.sort((a, b) => a.id - b.id);
  return result;
}
