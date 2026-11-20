import * as XLSX from 'xlsx';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import type { PepetoSingerLegendItem, Song } from '../types/index.ts';
import { parseExcelAllStyles } from './excelStyleParser.ts';

export interface ParsedMssItem {
  id: number;
  mss_songId: number | null;
  mss_title: string;
  fileName?: string;
  fileType?: number;
}

export interface ParsedXlsxItem {
  id?: number;
  pdf_title?: string;
  textColor?: string;
  bgColor?: string;
  category?: string;
  isPrimarySheet?: boolean;
  raw?: any;
}

const GENERIC_SHEET_CATEGORY_RE = /^(seznam\b|list\s*\d+|sheet\s*\d+)/i;

/**
 * Strips leading "Zpívá " prefix from Czech Excel legend descriptions while keeping
 * categories like "Instrumentálky", "Lidovky", "Duet" intact.
 */
export function normalizeLegendSingerName(rawLabel: string): string {
  const cleaned = String(rawLabel || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Neurčeno';
  const stripped = cleaned.replace(/^zp[ií]v[aá]\s+/i, '').trim();
  return stripped || cleaned;
}

/**
 * Detects whether a legend description explicitly means "not commonly played / unassigned".
 */
export function isNotCommonlyPlayedLabel(label?: string | null): boolean {
  if (!label) return false;
  return /(n?běžně\s+se\s+nehraj|nehraje\s+se|neurčeno|rezervn[ií]|archiv)/i.test(label);
}

/**
 * Extracts normalized saxophone tag from a song title (e.g. "ALT Sax", "TENOR Sax").
 */
export function extractSaxTag(title?: string | null): string | null {
  if (!title) return null;
  if (/(?:^|[\s\-–—_/])(?:alt|alto)\s*sax\b|[\-_]alt\b/i.test(title)) return 'ALT Sax';
  if (/(?:^|[\s\-–—_/])tenor\s*sax\b|[\-_]tenor\b/i.test(title)) return 'TENOR Sax';
  if (/(?:^|[\s\-–—_/])sopr[aá]n\s*sax\b/i.test(title)) return 'SOPRÁN Sax';
  if (/(?:^|[\s\-–—_/])bar[yi]ton\s*sax\b/i.test(title)) return 'BARYTON Sax';
  return null;
}

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Matches a cell background hex color against the Excel legend (exact match first,
 * then small RGB distance fallback for minor Excel theme/tint rounding).
 */
export function matchColorToLegend(
  bgColor: string | undefined | null,
  legend?: PepetoSingerLegendItem[] | null
): PepetoSingerLegendItem | undefined {
  if (!legend || legend.length === 0) return undefined;
  const normalized = normalizeHexColor(bgColor, '#ffffff').toLowerCase();

  const exact = legend.find(
    (entry) => normalizeHexColor(entry.bgColor, '#ffffff').toLowerCase() === normalized
  );
  if (exact) return exact;

  const targetRgb = hexToRgbTuple(normalized);
  if (!targetRgb) return undefined;

  let bestEntry: PepetoSingerLegendItem | undefined;
  let bestDist = Infinity;

  for (const entry of legend) {
    const entryHex = normalizeHexColor(entry.bgColor, '#ffffff').toLowerCase();
    const rgb = hexToRgbTuple(entryHex);
    if (!rgb) continue;
    const dist = Math.hypot(
      targetRgb[0] - rgb[0],
      targetRgb[1] - rgb[1],
      targetRgb[2] - rgb[2]
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestEntry = entry;
    }
  }

  return bestDist <= 28 ? bestEntry : undefined;
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

function getDOMParser(): any {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    return new window.DOMParser();
  }
  return new XmlDomParser();
}

/**
 * Parse .mss XML file (preserving songs even when <SongId> is omitted in MobileSheets)
 */
export function parseMssXml(xmlText: string): ParsedMssItem[] {
  const rawEntries: Array<{
    explicitId: number | null;
    title: string;
    fileName?: string;
    fileType?: number;
  }> = [];

  try {
    const parser = getDOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const songNodes = xmlDoc.getElementsByTagName('Song');

    for (let i = 0; i < songNodes.length; i++) {
      const songNode = songNodes[i];
      const titleEl = songNode.getElementsByTagName('Title')[0];
      const songIdEl = songNode.getElementsByTagName('SongId')[0];
      const fileNameEl = songNode.getElementsByTagName('FileName')[0];
      const fileTypeEl = songNode.getElementsByTagName('FileType')[0];

      const title = titleEl?.textContent?.trim() || '';
      const idStr = songIdEl?.textContent?.trim() || '';
      const parsedId = idStr ? parseInt(idStr, 10) : NaN;
      const fileName = fileNameEl?.textContent ?? undefined;
      const parsedFileType = fileTypeEl?.textContent?.trim()
        ? parseInt(fileTypeEl.textContent.trim(), 10)
        : undefined;

      if (title) {
        rawEntries.push({
          explicitId: !isNaN(parsedId) ? parsedId : null,
          title,
          fileName: fileName && fileName.length > 0 ? fileName : undefined,
          fileType: parsedFileType !== undefined && !isNaN(parsedFileType) ? parsedFileType : undefined,
        });
      }
    }
  } catch (err) {
    console.warn('DOMParser failed on MSS XML, falling back to regex parser:', err);
  }

  // Regex fallback if DOMParser produced 0 items or failed
  if (rawEntries.length === 0) {
    const songRegex = /<Song>([\s\S]*?)<\/Song>/gi;
    let match: RegExpExecArray | null;
    while ((match = songRegex.exec(xmlText)) !== null) {
      const inner = match[1];
      const titleMatch = inner.match(/<Title>([\s\S]*?)<\/Title>/i);
      const idMatch = inner.match(/<SongId>([\s\S]*?)<\/SongId>/i);
      const fileNameMatch = inner.match(/<FileName>([\s\S]*?)<\/FileName>/i);
      const fileTypeMatch = inner.match(/<FileType>([\s\S]*?)<\/FileType>/i);

      if (titleMatch) {
        const title = titleMatch[1].trim();
        const parsedId = idMatch ? parseInt(idMatch[1].trim(), 10) : NaN;
        const parsedFileType = fileTypeMatch ? parseInt(fileTypeMatch[1].trim(), 10) : undefined;
        if (title) {
          rawEntries.push({
            explicitId: !isNaN(parsedId) ? parsedId : null,
            title,
            fileName: fileNameMatch?.[1] || undefined,
            fileType: parsedFileType !== undefined && !isNaN(parsedFileType) ? parsedFileType : undefined,
          });
        }
      }
    }
  }

  // Reserve all explicit <SongId> values first so fallback IDs never collide
  const usedIds = new Set<number>();
  for (const entry of rawEntries) {
    if (entry.explicitId !== null) {
      usedIds.add(entry.explicitId);
    }
  }

  const songs: ParsedMssItem[] = [];
  const emittedIds = new Set<number>();
  let nextFallbackId = 1001;

  for (const entry of rawEntries) {
    let resolvedId: number;
    if (entry.explicitId !== null) {
      resolvedId = entry.explicitId;
    } else {
      // Try extracting leading catalog number from title (e.g. "216 My Way" -> 216)
      const prefixMatch = entry.title.match(/^0*(\d{1,4})\s+/);
      const prefixNum = prefixMatch ? parseInt(prefixMatch[1], 10) : NaN;
      if (!isNaN(prefixNum) && prefixNum > 0 && !usedIds.has(prefixNum)) {
        resolvedId = prefixNum;
      } else {
        while (usedIds.has(nextFallbackId)) {
          nextFallbackId++;
        }
        resolvedId = nextFallbackId++;
      }
      usedIds.add(resolvedId);
    }

    if (!emittedIds.has(resolvedId)) {
      emittedIds.add(resolvedId);
      songs.push({
        id: resolvedId,
        mss_songId: entry.explicitId,
        mss_title: entry.title,
        fileName: entry.fileName,
        fileType: entry.fileType,
      });
    }
  }

  return songs;
}

/**
 * Parse .xlsx Excel file with authentic OpenXML cell styles, background colors (strictly under song number),
 * and color legend defined below the song list.
 */
export async function parseXlsxWithLegend(buffer: ArrayBuffer): Promise<{
  items: ParsedXlsxItem[];
  legend: PepetoSingerLegendItem[];
}> {
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
  const legend: PepetoSingerLegendItem[] = [];
  const seenIds = new Set<number>();
  const seenLegendColors = new Set<string>();

  const hasPrimarySheet = workbook.SheetNames.some((n) => n.toLowerCase().includes('vybarven'));
  const sheetsToRead = workbook.SheetNames.map((name, idx) => ({ name, idx }))
    .filter(({ name }) => {
      if (/odstran|vyškrt/i.test(name)) return false;
      if (hasPrimarySheet) return name.toLowerCase().includes('vybarven');
      return true;
    });

  for (const { name: sheetName, idx: sheetIdx } of sheetsToRead) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const isPrimarySheet = sheetName.toLowerCase().includes('vybarven');
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
    let inLegendSection = false;

    for (let r = startRow; r <= range.e.r; r++) {
      const idAddr = XLSX.utils.encode_cell({ r, c: colIdIdx });
      const titleAddr = XLSX.utils.encode_cell({ r, c: colTitleIdx });
      const idVal = worksheet[idAddr]?.v;
      const rawTitle = worksheet[titleAddr]?.v;
      const titleStr = rawTitle !== undefined && rawTitle !== null ? String(rawTitle).trim() : '';

      // Detect "Legenda:" header below the song list
      if (/^legenda\s*:?$/i.test(titleStr) || /^legenda\s*:?$/i.test(String(idVal || '').trim())) {
        inLegendSection = true;
        continue;
      }

      if (inLegendSection) {
        if (!titleStr) continue;
        const swatchStyle = sheetStyle?.cellColors.get(idAddr);
        const bgColor = normalizeHexColor(swatchStyle?.bgColor, '#ffffff');
        if (!seenLegendColors.has(bgColor)) {
          seenLegendColors.add(bgColor);
          legend.push({
            bgColor,
            singer: normalizeLegendSingerName(titleStr),
            description: titleStr,
          });
        }
        continue;
      }

      // 1. Resolve Song ID
      let songId: number | undefined;

      if (typeof idVal === 'number' && Number.isInteger(idVal)) {
        songId = idVal;
      } else if (idVal !== undefined && idVal !== null && String(idVal).trim() !== '') {
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
      let pdfTitle = titleStr;

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

      // Guard: rows without a song ID matching legend labels should be treated as legend, never as songs
      if (
        songId === undefined &&
        /^(legenda\b|n?běžně|instrument[aá]lk|lidovk|zp[ií]v[aá]\s+|duet\b)/i.test(pdfTitle)
      ) {
        const swatchStyle = sheetStyle?.cellColors.get(idAddr);
        const bgColor = normalizeHexColor(swatchStyle?.bgColor, '#ffffff');
        if (!seenLegendColors.has(bgColor)) {
          seenLegendColors.add(bgColor);
          legend.push({
            bgColor,
            singer: normalizeLegendSingerName(pdfTitle),
            description: pdfTitle,
          });
        }
        continue;
      }

      // 3. Resolve Colors: Strictly from the cell under the song number (colIdIdx)
      let detectedBgColor: string | undefined;
      let detectedTextColor: string | undefined;

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

      // Barvu skladby určuje VÝHRADNĚ barva výplně u čísla (idCellStyle), NIKOLIV pod názvem skladby!
      const idCellStyle = sheetStyle?.cellColors.get(idAddr);
      if (idCellStyle?.bgColor && idCellStyle.bgColor !== '#ffffff') {
        detectedBgColor = idCellStyle.bgColor;
      }
      if (idCellStyle?.textColor) {
        detectedTextColor = idCellStyle.textColor;
      }

      if ((!detectedBgColor || detectedBgColor === '#ffffff') && sheetName.toLowerCase().includes('lidovk')) {
        detectedBgColor = '#ffffcc';
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
            isPrimarySheet,
          });
        }
      } else if (pdfTitle) {
        items.push({
          id: undefined,
          pdf_title: pdfTitle,
          textColor: finalTextColor,
          bgColor: finalBgColor,
          category,
          isPrimarySheet,
        });
      }
    }
  }

  return { items, legend };
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedXlsxItem[]> {
  const { items } = await parseXlsxWithLegend(buffer);
  return items;
}

/**
/**
 * Cleans a song title for similarity comparison:
 * - Strips leading track/index numbers (e.g. "103 Alenka v říši divů", "01  Bilitis", "501  Jetelíček")
 * - Strips saxophone annotations ("alt sax", "tenor sax", "alto sax", etc.) as per instructions:
 *   "Pokud je někde napsáno tenor sax nebo alto sax, nesmí to určovat možnosti obarvení té skladby"
 * - Strips instrument & suffix tags ("_kyt", "electric guitar", "vocal", "text", etc.)
 * - Strips diacritics / accents (č -> c, ř -> r, á -> a)
 * - Lowercases and removes extra punctuation / spaces
 */
export function cleanSongTitle(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // 1. Remove leading track / ID number (e.g., "103 Alenka", "001 Bilitis", "501  Jetelíček")
  str = str.replace(/^\s*\d+[\s\.\-_:]+/, '');

  // 2. Remove saxophone annotations (case-insensitive)
  str = str.replace(/[-_–—/]?\s*(?:alt|tenor|alto|sopran|bariton)?\s*(?:sax|saxophone|saxofon)[a-z0-9]*/gi, ' ');
  str = str.replace(/\b(?:alt|tenor|alto|sopran|bariton)?\s*sax\b/gi, ' ');

  // 3. Remove instrument & suffix annotations
  str = str.replace(/[-_–—/]?\s*(?:electric\s*guitar|guitar|kytara|akustika|basa|bass|bicí|drums|klávesy|keys|vocal|vokál|vok)\b[a-z0-9]*/gi, ' ');
  str = str.replace(/_\w+/g, ' '); // e.g. _kyt, _alt, _vocal
  str = str.replace(/\b(?:kyt|guitar|vocal|text|kytara|akordy)\b/gi, ' ');

  // 4. Remove diacritics
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 5. Lowercase and replace non-alphanumeric with spaces
  str = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  // 6. Collapse multiple whitespace
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Calculates similarity between two cleaned song titles (0.0 to 1.0)
 * Handles substring inclusion, token overlap, and character bigrams.
 */
export function calculateTitleSimilarity(cleanA: string, cleanB: string): number {
  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 1.0;

  // 1. Direct substring inclusion (e.g. "alenka v risi divu" in "karel zich alenka v risi divu")
  if (cleanA.length >= 3 && cleanB.length >= 3) {
    if (cleanB.includes(cleanA)) {
      return 0.88 + 0.1 * (cleanA.length / cleanB.length);
    }
    if (cleanA.includes(cleanB)) {
      return 0.88 + 0.1 * (cleanB.length / cleanA.length);
    }
  }

  // 2. Token overlap (words with length >= 2)
  const tokensA = cleanA.split(' ').filter((w) => w.length >= 2);
  const tokensB = cleanB.split(' ').filter((w) => w.length >= 2);

  if (tokensA.length > 0 && tokensB.length > 0) {
    const commonTokens = tokensA.filter((w) => tokensB.includes(w));
    // If all words of the shorter title are contained in the longer title
    if (commonTokens.length === tokensA.length && tokensA.length >= 1) {
      return 0.92;
    }
    if (commonTokens.length === tokensB.length && tokensB.length >= 1) {
      return 0.92;
    }

    const tokenDice = (2 * commonTokens.length) / (tokensA.length + tokensB.length);
    if (tokenDice >= 0.5) {
      return 0.65 + 0.3 * tokenDice;
    }
  }

  // 3. Character bigram Dice coefficient (handles typos, small spelling variations)
  const bigramsA = new Set<string>();
  for (let i = 0; i < cleanA.length - 1; i++) {
    bigramsA.add(cleanA.slice(i, i + 2));
  }
  const bigramsB = new Set<string>();
  for (let i = 0; i < cleanB.length - 1; i++) {
    bigramsB.add(cleanB.slice(i, i + 2));
  }

  let commonBigrams = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) commonBigrams++;
  }

  const bigramScore = (2 * commonBigrams) / (bigramsA.size + bigramsB.size);
  return bigramScore;
}

/**
 * Pairs songs from MSS (ID + clean Title) with XLSX (ID + visual PDF title + colors).
 * Rules:
 * - MSS is the authoritative source for songs and IDs.
 * - XLSX is used strictly to color songs based on title similarity and cell background colors.
 * - Instrument tags ("tenor sax", "alto sax", etc.) are stripped so they don't block matching.
 * - Text color is always high-contrast #000000; only cell background colors are applied.
 */
/**
 * Strips leading ID numbers (e.g. "002 ", "502  ") and extensions (.xml, .pdf) from MSS titles
 */
export function cleanDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let str = rawTitle.trim();
  str = str.replace(/\.(xml|pdf|mss)$/i, '');
  str = str.replace(/^\d{1,4}\s*[-–._]?\s*/, '');
  return str.trim() || rawTitle.trim();
}

/**
 * Extracts candidate variants of a song title (full string + isolated core song title parts around dashes/hyphens).
 * When titles contain dashes ('-', '–', '—', '/'), evaluates both full string and isolated core title segments.
 */
export function extractTitleVariants(rawTitle: string): string[] {
  if (!rawTitle) return [];
  const variants = new Set<string>();

  // 1. Full cleaned title
  const fullClean = cleanSongTitle(rawTitle);
  if (fullClean) variants.add(fullClean);

  // 2. Cleaned display title (without track/index prefix)
  const displayClean = cleanSongTitle(cleanDisplayTitle(rawTitle));
  if (displayClean) variants.add(displayClean);

  // 3. Isolated segments split by dashes or slashes (e.g. "310 - Zatancuj si so mnou", "Moje milá - Marek Ztracený")
  const segments = rawTitle.split(/[-–—/]/);
  if (segments.length > 1) {
    for (const seg of segments) {
      const segClean = cleanSongTitle(seg);
      if (segClean && segClean.length >= 3 && !/^\d+$/.test(segClean)) {
        variants.add(segClean);
      }
      const segDisplay = cleanSongTitle(cleanDisplayTitle(seg));
      if (segDisplay && segDisplay.length >= 3 && !/^\d+$/.test(segDisplay)) {
        variants.add(segDisplay);
      }
    }
  }

  return Array.from(variants);
}

/**
 * Pairs songs from MSS (ID + clean Title) with XLSX (ID + visual PDF title + colors + legend).
 * Rules:
 * - MSS (Pepeto komplet setlist.mss) is the authoritative baseline for song names and IDs.
 * - XLSX ("Seznam - vybarvený") is authoritative for song background colors (from the number cell)
 *   and color legend (below the song list).
 * - Fuzzy matching checks both the full string and isolated song segments for dashed titles.
 * - MobileSheets compatibility: MSS title and fileName are strictly preserved.
 * - Text color is always high-contrast #000000; only cell background colors are applied.
 */
export function pairMssAndXlsx(
  mssList: ParsedMssItem[],
  xlsxList: ParsedXlsxItem[],
  singerLegend?: PepetoSingerLegendItem[]
): Song[] {
  const result: Song[] = [];

  // Pre-clean all XLSX items with their full and isolated title variants
  const preparedXlsx = xlsxList.map((item) => {
    const rawTitle = item.pdf_title || '';
    const cleanTitle = cleanSongTitle(rawTitle);
    const titleVariants = extractTitleVariants(rawTitle);
    const isVybarveny = Boolean(
      item.isPrimarySheet || (item.category && item.category.toLowerCase().includes('vybarven'))
    );
    const hasColor = Boolean(
      item.bgColor &&
      item.bgColor.toLowerCase() !== '#ffffff' &&
      item.bgColor.toLowerCase() !== '#000000'
    );
    return {
      item,
      rawTitle,
      cleanTitle,
      titleVariants,
      hasColor,
      isVybarveny,
      id: item.id,
      bgColor: item.bgColor,
      pdfTitle: item.pdf_title,
      category: item.category,
    };
  });

  for (const mss of mssList) {
    const rawMssTitle = mss.mss_title;
    const cleanMss = cleanSongTitle(rawMssTitle);
    const mssVariants = extractTitleVariants(rawMssTitle);

    // 1. Find matching candidate in XLSX with strict collision protection
    let bestCandidate: (typeof preparedXlsx)[0] | null = null;
    let highestScore = 0;

    for (const cand of preparedXlsx) {
      let score = 0;

      // Check ID match
      const idMatches = cand.id !== undefined && cand.id === mss.id;

      // Title similarity: evaluate full string similarity
      let titleSim = calculateTitleSimilarity(cleanMss, cand.cleanTitle);

      // Enhanced fuzzy matching for dashed titles: compare across full strings AND isolated core song title segments
      if (titleSim < 0.95 && (mssVariants.length > 1 || cand.titleVariants.length > 1)) {
        for (const vMss of mssVariants) {
          for (const vCand of cand.titleVariants) {
            const sim = calculateTitleSimilarity(vMss, vCand);
            if (sim > titleSim) {
              titleSim = sim;
              if (titleSim >= 0.95) break;
            }
          }
          if (titleSim >= 0.95) break;
        }
      }

      if (idMatches) {
        if (cand.isVybarveny) {
          // On the primary authoritative colored sheet ("Seznam - vybarvený"), song numbers are unique
          // and directly correspond to the catalog numbers (including CZ/EN translations like
          // #120 Something Stupid/Sladké hlouposti, #295 Dlouhá bílá noc/Strangers in the Night,
          // #296 Where Do I Begin/Love Story).
          score = 2.0 + titleSim;
        } else {
          // Secondary sheets can have local numbering collisions (e.g. Lidovky 2 vs song 2),
          // so require title agreement there.
          const isKnownEquivalent =
            mss.id === 120 || mss.id === 145 || mss.id === 295 || mss.id === 296 || mss.id === 311;
          if (titleSim >= 0.20 || isKnownEquivalent) {
            score = 1.0 + titleSim;
          } else {
            score = 0;
          }
        }
      } else if (titleSim >= 0.70) {
        // High title similarity match without exact ID (e.g. MSS #135 "136 Kdybych já byl kovářem" <-> Excel #136)
        score = titleSim;
      }

      // Priority boost for the official colored sheet "Seznam - vybarvený"
      if (cand.isVybarveny && score > 0) {
        score += 0.50;
      }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = cand;
      }
    }

    // Determine final background color strictly from the matched Excel number cell
    let finalBgColor = '#ffffff';
    let finalCategory: string | undefined = undefined;

    if (bestCandidate && highestScore >= 0.50) {
      if (bestCandidate.bgColor && bestCandidate.bgColor.toLowerCase() !== '#ffffff') {
        finalBgColor = normalizeHexColor(bestCandidate.bgColor, '#ffffff');
      }
      // Do not overwrite musical category with generic Excel sheet names like "Seznam - vybarvený"
      if (bestCandidate.category && !GENERIC_SHEET_CATEGORY_RE.test(bestCandidate.category.trim())) {
        finalCategory = bestCandidate.category;
      }
    }

    // Fallback: Czech lidovky (500-series 501..528 and 550) are yellow #ffffcc
    if (finalBgColor === '#ffffff') {
      const isLidovky =
        (finalCategory && finalCategory.toLowerCase().includes('lidovk')) ||
        mss.mss_title.toLowerCase().includes('lidovk') ||
        (mss.id >= 500 && mss.id < 600);
      if (isLidovky) {
        finalBgColor = '#ffffcc';
        if (!finalCategory) finalCategory = 'Lidovky';
      }
    }

    const authoritativeMssTitle = mss.mss_title;
    const authoritativePdfTitle = bestCandidate?.pdfTitle || authoritativeMssTitle;
    const isUtility =
      /^0+\s+seznam$/i.test(authoritativeMssTitle.trim()) ||
      mss.id === 998 ||
      mss.id === 999;

    const legendMatch = !isUtility ? matchColorToLegend(finalBgColor, singerLegend) : undefined;
    const detectedSax = extractSaxTag(authoritativePdfTitle) || extractSaxTag(authoritativeMssTitle);

    result.push({
      id: mss.id,
      mss_songId: mss.mss_songId,
      mss_title: authoritativeMssTitle,
      mss_fileName: mss.fileName || `${authoritativeMssTitle}.pdf`,
      fileName: mss.fileName || `${authoritativeMssTitle}.pdf`,
      fileType: mss.fileType !== undefined ? mss.fileType : 1,
      pdf_title: authoritativePdfTitle,
      textColor: '#000000', // Vždy vysoce kontrastní černá
      bgColor: finalBgColor,
      category: finalCategory,
      isPlayableSong: !isUtility,
      pepeto: legendMatch
        ? {
            singer: legendMatch.singer,
            bgColor: finalBgColor,
            isCommonlyPlayed: !isNotCommonlyPlayedLabel(legendMatch.description || legendMatch.singer),
            sax: detectedSax,
          }
        : undefined,
    });
  }

  // Sort strictly by song ID ascending
  result.sort((a, b) => a.id - b.id);
  return result;
}
