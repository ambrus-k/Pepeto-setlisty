import * as XLSX from 'xlsx';
import { Song, SetlistGroup } from '../types';
import {
  cleanSongTitle,
  calculateTitleSimilarity,
  extractTitleVariants,
  cleanDisplayTitle,
  normalizeHexColor,
} from './parser';
import { parseExcelAllStyles } from './excelStyleParser';

export interface UnmatchedSongItem {
  tempId: number;
  originalTitle: string;
  setName: string;
  setIndex: number;
}

export interface ImportResult {
  success: boolean;
  fileType: 'mss' | 'xlsx';
  fileName: string;
  eventName: string;
  sets: SetlistGroup[];
  newSongs: Song[];
  totalSongs: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedList: UnmatchedSongItem[];
  warnings: string[];
}

// Known Czech Lidovky aliases in Pepeto repertoire (Excel visual name <-> Master MSS name)
const LIDOVKY_ALIASES: Record<number, { mssAlias: string; visualAlias: string }> = {
  501: { mssAlias: 'jetelíček u vody', visualAlias: 'jetelíček u vody' },
  502: { mssAlias: 'škodovka', visualAlias: 'škoda lásky' },
  503: { mssAlias: 'sova', visualAlias: 'sova' },
  504: { mssAlias: 'od tábora až k nám', visualAlias: 'od tábora' },
  505: { mssAlias: 'na břehu blanice', visualAlias: 'na břehu blanice' },
  506: { mssAlias: 'letěla husa', visualAlias: 'letěla husička' },
  507: { mssAlias: 'seděla pod borovic', visualAlias: 'seděla pod borovicí' },
  508: { mssAlias: 'včera jsem tě čeka', visualAlias: 'včera jsem tě čekal' },
  509: { mssAlias: 'co jste hasiči', visualAlias: 'co jste hasiči' },
  510: { mssAlias: 'sokolíci', visualAlias: 'sokolíci' },
  511: { mssAlias: 'nemelem', visualAlias: 'nemelem' },
  512: { mssAlias: 'šel dráteník', visualAlias: 'šel dráteník' },
  513: { mssAlias: 'chasa mladá', visualAlias: 'chasa mladá' },
  514: { mssAlias: 'zajíc', visualAlias: 'já jsem ten zajíček' },
  515: { mssAlias: 'slepice kropenatá', visualAlias: 'slepice kropenatá' },
  516: { mssAlias: 'když jsem šel včer', visualAlias: 'když jsem šel včera' },
  517: { mssAlias: 'hezky od podlahy', visualAlias: 'hezky od podlahy' },
  518: { mssAlias: 'moje česká vlast', visualAlias: 'moje česká vlast' },
  519: { mssAlias: 'ten večer', visualAlias: 'ten večer májový' },
  520: { mssAlias: 'u studánky + vezmi', visualAlias: 'u studánky' },
  521: { mssAlias: 'když jsem šel od v', visualAlias: 'když jsem šel od vás' },
  522: { mssAlias: 'na pankráci', visualAlias: 'na pankráci' },
  523: { mssAlias: 'včera jsem byl', visualAlias: 'včera jsem byl u muziky' },
  524: { mssAlias: 'na louce sedlák se', visualAlias: 'na louce sedlák' },
  525: { mssAlias: 'malý hošík', visualAlias: 'malý hošík' },
  526: { mssAlias: 'garnizon', visualAlias: 'garnizon' },
  527: { mssAlias: 'cikánka', visualAlias: 'cikánka' },
  528: { mssAlias: 'čtyři páry', visualAlias: 'čtyři páry' },
  550: { mssAlias: 'country směs', visualAlias: 'country směs' },
};

/**
 * Cleans an imported song title specifically removing extra instrumentation suffixes:
 * - Redundant trailing ellipsis ("...")
 * - Saxophone annotations ("- ALT Sax", "- TENOR Sax", "alt sax", "alto sax")
 * - Instrument tags (" - Guitar", "_kyt", " text", "_alt", "_tenor", "_vocal")
 * - Extra punctuation and duplicate whitespace
 */
export function cleanExcelTitle(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // 1. Remove trailing ellipsis e.g. "Shrek - It Is You ... - ALT Sax" -> "Shrek - It Is You"
  str = str.replace(/\s*\.{2,}\s*/g, ' ');

  // 2. Remove saxophone annotations
  str = str.replace(/[-_–—/]?\s*(?:alt|tenor|alto|sopran|bariton)?\s*(?:sax|saxophone|saxofon)[a-z0-9]*/gi, ' ');

  // 3. Remove common instrument & format suffixes
  str = str.replace(/[-_–—/]?\s*(?:electric\s*guitar|guitar|kytara|akustika|basa|bass|bicí|drums|klávesy|keys|vocal|vokál|vok|text)\b[a-z0-9]*/gi, ' ');
  str = str.replace(/_\w+/g, ' ');

  // 4. Collapse spaces
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Helper to get XML tag content case-insensitively
 */
function getTagText(parent: any, tagName: string): string {
  if (!parent) return '';
  const exact = parent.getElementsByTagName ? parent.getElementsByTagName(tagName)[0] : null;
  if (exact && exact.textContent) return exact.textContent.trim();

  // Case-insensitive search through children
  if (parent.children) {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.tagName && child.tagName.toLowerCase() === tagName.toLowerCase()) {
        return child.textContent?.trim() || '';
      }
    }
  }
  return '';
}

/**
 * Matches a song (from ID and/or title) against the master song catalog.
 */
export function matchSongToMaster(
  rawId: number | undefined,
  rawTitle: string,
  masterSongs: Song[]
): {
  matchedSong?: Song;
  confidence: number;
  matchType: 'exact_id' | 'id_plus_title' | 'alias' | 'fuzzy_title' | 'none';
} {
  const cleanedInput = cleanSongTitle(cleanExcelTitle(rawTitle));
  const variants = extractTitleVariants(cleanExcelTitle(rawTitle));

  // 1. Check direct ID match if rawId is present
  if (rawId !== undefined && rawId > 0) {
    const idCandidate = masterSongs.find((s) => s.id === rawId);
    if (idCandidate) {
      // Check Lidovky alias dictionary
      const lidovkyInfo = LIDOVKY_ALIASES[rawId];
      if (lidovkyInfo) {
        return { matchedSong: idCandidate, confidence: 1.0, matchType: 'alias' };
      }

      // Check title similarity with ID candidate
      const cleanMss = cleanSongTitle(idCandidate.mss_title);
      const cleanPdf = cleanSongTitle(idCandidate.pdf_title);
      const sim = Math.max(
        calculateTitleSimilarity(cleanedInput, cleanMss),
        calculateTitleSimilarity(cleanedInput, cleanPdf)
      );

      // If ID matches and title has reasonable similarity (or no conflict), accept!
      if (sim >= 0.20 || !cleanedInput) {
        return {
          matchedSong: idCandidate,
          confidence: 1.0,
          matchType: sim > 0.6 ? 'id_plus_title' : 'exact_id',
        };
      }
    }
  }

  // 2. High-confidence fuzzy title matching across the entire master database
  if (cleanedInput && masterSongs.length > 0) {
    let bestCandidate: Song | undefined;
    let highestScore = 0;

    for (const master of masterSongs) {
      const cleanMss = cleanSongTitle(master.mss_title);
      const cleanPdf = cleanSongTitle(master.pdf_title);
      const masterVariants = extractTitleVariants(master.mss_title);

      let score = Math.max(
        calculateTitleSimilarity(cleanedInput, cleanMss),
        calculateTitleSimilarity(cleanedInput, cleanPdf)
      );

      // Check title variants (e.g. segments around hyphens)
      for (const vIn of variants) {
        for (const vM of masterVariants) {
          const vScore = calculateTitleSimilarity(vIn, vM);
          if (vScore > score) {
            score = vScore;
          }
        }
      }

      // Check Lidovky aliases
      if (LIDOVKY_ALIASES[master.id]) {
        const visualClean = cleanSongTitle(LIDOVKY_ALIASES[master.id].visualAlias);
        const aliasSim = calculateTitleSimilarity(cleanedInput, visualClean);
        if (aliasSim > score) score = aliasSim;
      }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = master;
      }
    }

    if (bestCandidate && highestScore >= 0.70) {
      return {
        matchedSong: bestCandidate,
        confidence: highestScore,
        matchType: 'fuzzy_title',
      };
    }
  }

  return { confidence: 0, matchType: 'none' };
}

/**
 * Parses MobileSheets (.mss) XML file with full support for any number of <Setlist> and <Song> nodes.
 */
export function importMssText(
  xmlText: string,
  masterSongs: Song[],
  defaultFileName: string = 'Importovaný setlist'
): ImportResult {
  let parser: any;
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    parser = new window.DOMParser();
  } else {
    try {
      const { DOMParser: XmlDomParser } = require('@xmldom/xmldom');
      parser = new XmlDomParser();
    } catch {
      throw new Error('Nativní DOMParser není v tomto prostředí dostupný.');
    }
  }

  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error(`Chyba syntaxe XML: ${parserError.textContent?.trim() || 'Neplatný soubor .mss'}`);
  }

  // Find all <Setlist> nodes (case-insensitive)
  let setlistNodes = Array.from(xmlDoc.getElementsByTagName('Setlist'));
  if (setlistNodes.length === 0) {
    setlistNodes = Array.from(xmlDoc.getElementsByTagName('setlist'));
  }
  if (setlistNodes.length === 0 && xmlDoc.documentElement.tagName.toLowerCase() === 'setlist') {
    setlistNodes = [xmlDoc.documentElement];
  }

  if (setlistNodes.length === 0) {
    throw new Error('V souboru .mss nebyl nalezen žádný uzel <Setlist>.');
  }

  let eventNameCandidate = '';
  const newSets: SetlistGroup[] = [];
  const newSongs: Song[] = [];
  const unmatchedList: UnmatchedSongItem[] = [];
  const warnings: string[] = [];

  let tempIdCounter = -1001;
  let totalSongsCount = 0;
  let matchedCount = 0;

  setlistNodes.forEach((setNode: any, setIdx: number) => {
    const rawSetName = getTagText(setNode, 'Name') || `Set ${setIdx + 1}`;

    // Detect overall event name from set name pattern, e.g. "01 Oleško 22.08.2026 - Set 1"
    if (!eventNameCandidate) {
      const eventMatch = rawSetName.match(/^\d{1,3}\s+(.*?)(?:\s*-\s*(?:Set\s*\d+|List\s*\d+|Lidovky|Zbytek))?$/i);
      if (eventMatch && eventMatch[1] && eventMatch[1].trim().length > 2) {
        eventNameCandidate = eventMatch[1].trim();
      }
    }

    // Clean set name
    let cleanSetName = rawSetName.trim();
    // If set name is formatted like "01 Oleško 22.08.2026 - Set 1", extract "Set 1"
    const dashParts = cleanSetName.split(/\s*-\s*/);
    if (dashParts.length > 1) {
      cleanSetName = dashParts[dashParts.length - 1].trim();
    } else {
      // Remove leading number like "01 "
      cleanSetName = cleanSetName.replace(/^\d{1,3}\s+/, '').trim() || cleanSetName;
    }

    const isLidovky = cleanSetName.toLowerCase().includes('lidovk');
    const isZbytek = cleanSetName.toLowerCase().includes('zbytek');
    const isFixed = isLidovky || isZbytek;
    const color = isLidovky ? '#fef08a' : isZbytek ? '#cbd5e1' : undefined;

    // Find all <Song> nodes inside this <Setlist>
    let songNodes = setNode.getElementsByTagName
      ? Array.from(setNode.getElementsByTagName('Song'))
      : [];
    if (songNodes.length === 0 && setNode.getElementsByTagName) {
      songNodes = Array.from(setNode.getElementsByTagName('song'));
    }

    const setSongIds: number[] = [];

    songNodes.forEach((songNode: any) => {
      totalSongsCount++;

      const title = getTagText(songNode, 'Title');
      const songIdStr = getTagText(songNode, 'SongId');
      const fileName = getTagText(songNode, 'FileName');
      const fileTypeStr = getTagText(songNode, 'FileType');

      const parsedId = songIdStr ? parseInt(songIdStr, 10) : undefined;
      const validId = parsedId !== undefined && !isNaN(parsedId) && parsedId >= 0 ? parsedId : undefined;

      // Match against master songs
      const match = matchSongToMaster(validId, title, masterSongs);

      if (match.matchedSong) {
        matchedCount++;
        // If MSS title has saxophone markers (e.g. _alt, _tenor), preserve them in pdf_title
        const hasSax = /(_alt|_tenor|alt\s*sax|tenor\s*sax)/i.test(title);
        if (hasSax && title && !/(sax|alt|tenor)/i.test(match.matchedSong.pdf_title)) {
          const updatedSong = { ...match.matchedSong, pdf_title: title };
          if (!newSongs.some((s) => s.id === updatedSong.id)) {
            newSongs.push(updatedSong);
          }
        }
        setSongIds.push(match.matchedSong.id);
      } else {
        // Song is not in the master list -> create temporary song
        const finalId = validId !== undefined ? validId : tempIdCounter--;
        const tempSong: Song = {
          id: finalId,
          mss_title: title || `Skladba #${finalId}`,
          pdf_title: title || `Skladba #${finalId}`,
          textColor: '#000000',
          bgColor: isLidovky ? '#ffffcc' : '#ffffff',
          isUnmatched: true,
          originalImportTitle: title,
          fileName: fileName || (title ? `${title}.pdf` : undefined),
          fileType: fileTypeStr ? parseInt(fileTypeStr, 10) : 1,
        };

        newSongs.push(tempSong);
        setSongIds.push(finalId);
        unmatchedList.push({
          tempId: finalId,
          originalTitle: title || `Skladba #${finalId}`,
          setName: cleanSetName,
          setIndex: setIdx,
        });
      }
    });

    newSets.push({
      id: `set-${Date.now()}-${setIdx}-${Math.random().toString(36).substring(2, 5)}`,
      name: cleanSetName,
      isFixed,
      color,
      songIds: setSongIds,
    });
  });

  // Ensure fixed sets (Lidovky & Zbytek) exist if they weren't in the import
  const hasLidovky = newSets.some((s) => s.name.toLowerCase().includes('lidovk'));
  const hasZbytek = newSets.some((s) => s.name.toLowerCase().includes('zbytek'));

  if (!hasLidovky) {
    newSets.push({
      id: `set-lidovky-${Date.now()}`,
      name: 'Lidovky',
      isFixed: true,
      color: '#fef08a',
      songIds: [],
    });
  }

  if (!hasZbytek) {
    newSets.push({
      id: `set-zbytek-${Date.now()}`,
      name: 'Zbytek',
      isFixed: true,
      color: '#cbd5e1',
      songIds: [],
    });
  }

  const cleanEventName =
    eventNameCandidate ||
    defaultFileName.replace(/\.(mss|xml)$/i, '').trim() ||
    'Importovaný setlist';

  return {
    success: true,
    fileType: 'mss',
    fileName: defaultFileName,
    eventName: cleanEventName,
    sets: newSets,
    newSongs,
    totalSongs: totalSongsCount,
    matchedCount,
    unmatchedCount: unmatchedList.length,
    unmatchedList,
    warnings,
  };
}

/**
 * Parses Excel (.xlsx) file with full variability handling:
 * - Iterates over all sheets (skips catalog / index sheet)
 * - Reads data from row 0 without table header (header: 1)
 * - Robust cleaning of song titles (removes sax notes, guitar suffixes)
 * - Matches with master songs and flags unmatched songs with temporary IDs
 */
export async function importXlsxBuffer(
  buffer: ArrayBuffer,
  masterSongs: Song[],
  defaultFileName: string = 'Oleško 22.08.2026.xlsx'
): Promise<ImportResult> {
  // 1. Read workbook with SheetJS
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel soubor neobsahuje žádné listy.');
  }

  // 2. Optional: parse OpenXML cell background styles if available
  let stylesInfo: Awaited<ReturnType<typeof parseExcelAllStyles>> | null = null;
  try {
    stylesInfo = await parseExcelAllStyles(buffer);
  } catch (styleErr) {
    console.warn('Could not parse OpenXML styles during setlist import:', styleErr);
  }

  const newSets: SetlistGroup[] = [];
  const newSongs: Song[] = [];
  const unmatchedList: UnmatchedSongItem[] = [];
  const warnings: string[] = [];

  let tempIdCounter = -2001;
  let totalSongsCount = 0;
  let matchedCount = 0;

  // Filter sheets: skip catalog/index sheets if there is more than 1 sheet
  const sheetsToProcess = workbook.SheetNames.filter((sheetName) => {
    if (workbook.SheetNames.length === 1) return true;
    const isCatalog = /^(seznam\s*komplet|seznam\s*-\s*vybarven[yý]|seznam|komplet|rejst[rř][ií]k|v[sš]e|index|reperto[aá]r|katalog)$/i.test(
      sheetName.trim()
    );
    return !isCatalog;
  });

  if (sheetsToProcess.length === 0) {
    throw new Error('Všechny listy v souboru byly vyhodnoceny jako seznamy repertoáru. Nebyly nalezeny sety.');
  }

  sheetsToProcess.forEach((sheetName, sheetIdx) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const sheetStyle =
      stylesInfo?.sheets.get(sheetName) || stylesInfo?.sheetByIndex.get(sheetIdx);

    const isLidovky = sheetName.toLowerCase().includes('lidovk');
    const isZbytek = sheetName.toLowerCase().includes('zbytek');
    const isFixed = isLidovky || isZbytek;
    const color = isLidovky
      ? '#fef08a'
      : isZbytek
      ? '#cbd5e1'
      : sheetStyle?.tabColor || undefined;

    // ČTENÍ BEZ HLAVIČKY: data začínají rovnou na prvním řádku!
    // sheet_to_json s header: 1 produkuje pole polí (any[][]), takže se 1. řádek neztratí
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    const setSongIds: number[] = [];

    rawRows.forEach((row, rowIdx) => {
      if (!Array.isArray(row) || row.length === 0) return;

      // Ignore empty row (all cells empty)
      const hasContent = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (!hasContent) return;

      // Extract ID and Title from the row
      let rawId: number | undefined;
      let rawTitle = '';

      const cell0 = row[0];
      const cell1 = row[1];

      // Case A: Col 0 is number, Col 1 is Title (standard Oleško format: [44, "Baroko"])
      if (typeof cell0 === 'number' && Number.isInteger(cell0) && cell0 > 0) {
        rawId = cell0;
        rawTitle = String(cell1 || '').trim();
      } else if (cell0 && !isNaN(parseInt(String(cell0).trim(), 10)) && /^\d+$/.test(String(cell0).trim())) {
        rawId = parseInt(String(cell0).trim(), 10);
        rawTitle = String(cell1 || '').trim();
      } else if (typeof cell1 === 'number' && Number.isInteger(cell1) && cell1 > 0) {
        // Inverted: Col 1 is ID, Col 0 is Title
        rawId = cell1;
        rawTitle = String(cell0 || '').trim();
      } else if (typeof cell0 === 'string' && cell0.trim()) {
        const str0 = cell0.trim();
        // Check if Col 0 starts with ID like "44 Baroko" or "304 - Moje milá"
        const prefixMatch = str0.match(/^(\d{1,4})\s*[-–._\s]\s*(.*)$/);
        if (prefixMatch) {
          rawId = parseInt(prefixMatch[1], 10);
          rawTitle = prefixMatch[2].trim();
        } else {
          rawTitle = str0;
        }
      }

      // If title is still empty, scan row cells for text
      if (!rawTitle) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (val && isNaN(Number(val)) && val.length > 1) {
            rawTitle = val;
            break;
          }
        }
      }

      // Skip row if it has no meaningful title or is identical to sheet name header
      if (!rawTitle) return;
      if (rawId === undefined && rawTitle.toLowerCase() === sheetName.toLowerCase()) {
        return; // Header label row, skip
      }

      totalSongsCount++;

      // ROBUST PÁROVÁNÍ PROTI MASTER DATABÁZI
      const match = matchSongToMaster(rawId, rawTitle, masterSongs);

      if (match.matchedSong) {
        matchedCount++;
        // If rawTitle in Excel contains saxophone info (e.g. "- ALT Sax", "- TENOR Sax"),
        // preserve it in matchedSong.pdf_title so it generates into the PDF!
        const hasSax = /(sax|alt|tenor|sopran|bariton)/i.test(rawTitle);
        if (hasSax && rawTitle) {
          const updatedSong = { ...match.matchedSong, pdf_title: rawTitle };
          if (!newSongs.some((s) => s.id === updatedSong.id)) {
            newSongs.push(updatedSong);
          }
        }
        setSongIds.push(match.matchedSong.id);
      } else {
        // Skladba se nepodařila 100% napárovat -> dočasné ID & označení isUnmatched
        const tempId = rawId !== undefined && rawId > 0 ? rawId : tempIdCounter--;

        // Check if this cell had authentic background color from Excel
        const excelRowNum = rowIdx + 1;
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
        const cellColor = sheetStyle?.cellColors.get(cellAddress)?.bgColor;
        const fallbackBg = isLidovky ? '#ffffcc' : cellColor || '#ffffff';

        const tempSong: Song = {
          id: tempId,
          mss_title: rawTitle,
          pdf_title: rawTitle,
          textColor: '#000000',
          bgColor: normalizeHexColor(fallbackBg, '#ffffff'),
          isUnmatched: true,
          originalImportTitle: rawTitle,
          fileName: `${rawTitle}.pdf`,
          fileType: 1,
        };

        newSongs.push(tempSong);
        setSongIds.push(tempId);
        unmatchedList.push({
          tempId,
          originalTitle: rawTitle,
          setName: sheetName,
          setIndex: sheetIdx,
        });
      }
    });

    newSets.push({
      id: `set-${Date.now()}-${sheetIdx}-${Math.random().toString(36).substring(2, 5)}`,
      name: sheetName,
      isFixed,
      color,
      songIds: setSongIds,
    });
  });

  // Ensure fixed sets (Lidovky & Zbytek) exist if they were not present in the sheets
  const hasLidovky = newSets.some((s) => s.name.toLowerCase().includes('lidovk'));
  const hasZbytek = newSets.some((s) => s.name.toLowerCase().includes('zbytek'));

  if (!hasLidovky) {
    newSets.push({
      id: `set-lidovky-${Date.now()}`,
      name: 'Lidovky',
      isFixed: true,
      color: '#fef08a',
      songIds: [],
    });
  }

  if (!hasZbytek) {
    newSets.push({
      id: `set-zbytek-${Date.now()}`,
      name: 'Zbytek',
      isFixed: true,
      color: '#cbd5e1',
      songIds: [],
    });
  }

  // Event name from filename (e.g. "Oleško 22.08.2026.xlsx" -> "Oleško 22.08.2026")
  const cleanEventName = defaultFileName.replace(/\.(xlsx|xls)$/i, '').trim() || 'Oleško 22.08.2026';

  return {
    success: true,
    fileType: 'xlsx',
    fileName: defaultFileName,
    eventName: cleanEventName,
    sets: newSets,
    newSongs,
    totalSongs: totalSongsCount,
    matchedCount,
    unmatchedCount: unmatchedList.length,
    unmatchedList,
    warnings,
  };
}
