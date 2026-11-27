export type EventYearSource = 'calendar' | 'eventName' | 'fileName' | 'currentYearFallback';

export interface ExtractedDateInfo {
  isoDate?: string;
  year?: number;
  matchedText?: string;
}

export interface EventYearResolution {
  year: number;
  source: EventYearSource;
  targetFolderName: string;
  isoDate?: string;
  czechDate?: string;
  calendarYear?: number;
  nameYear?: number;
  hasYearMismatch: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number): string | undefined {
  if (!isValidCalendarYmd(year, month, day)) return undefined;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Validates whether a string is a real YYYY-MM-DD calendar date.
 */
export function isValidIsoDate(iso?: string): boolean {
  if (!iso || typeof iso !== 'string') return false;
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return isValidCalendarYmd(year, month, day);
}

/**
 * Converts YYYY-MM-DD -> DD.MM.YYYY (e.g. "2027-01-03" -> "03.01.2027").
 */
export function formatCzechDate(iso?: string): string {
  if (!isValidIsoDate(iso)) return '';
  const [year, month, day] = iso!.trim().split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Converts YYYY-MM-DD -> D. M. YYYY (e.g. "2027-01-03" -> "3. 1. 2027").
 */
export function formatCzechDateShort(iso?: string): string {
  if (!isValidIsoDate(iso)) return '';
  const [year, month, day] = iso!.trim().split('-');
  return `${parseInt(day, 10)}. ${parseInt(month, 10)}. ${year}`;
}

/**
 * Scans text for all valid calendar dates (Czech DMY, ISO YMD, slash/dash DMY, short 2-digit year).
 */
function findAllCalendarDatesInText(text: string): Array<{ isoDate: string; year: number; matchedText: string }> {
  const results: Array<{ isoDate: string; year: number; matchedText: string }> = [];

  // 1. Czech full date: 3. 1. 2027 or 03.01.2027
  const czechFullRe = /(?:^|[^\d])((\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2}))(?!\d)/g;
  for (const m of text.matchAll(czechFullRe)) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    const year = parseInt(m[4], 10);
    const isoDate = toIsoDate(year, month, day);
    if (isoDate) {
      results.push({ isoDate, year, matchedText: m[1] });
    }
  }

  // 2. ISO date: 2027-01-03, 2027/01/03, 2027.01.03
  const isoRe = /(?:^|[^\d])((20\d{2})[-/.](\d{1,2})[-/.](\d{1,2}))(?!\d)/g;
  for (const m of text.matchAll(isoRe)) {
    const year = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    const day = parseInt(m[4], 10);
    const isoDate = toIsoDate(year, month, day);
    if (isoDate) {
      results.push({ isoDate, year, matchedText: m[1] });
    }
  }

  // 3. Slash/dash DMY: 03/01/2027, 3-1-2027
  const dmySlashRe = /(?:^|[^\d])((\d{1,2})[/-](\d{1,2})[/-](20\d{2}))(?!\d)/g;
  for (const m of text.matchAll(dmySlashRe)) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    const year = parseInt(m[4], 10);
    const isoDate = toIsoDate(year, month, day);
    if (isoDate) {
      results.push({ isoDate, year, matchedText: m[1] });
    }
  }

  // 4. Short Czech year: 3.1.27 or 03. 01. 27 (years 20..99 -> 2020..2099)
  const shortCzechRe = /(?:^|[^\d])((\d{1,2})\.\s*(\d{1,2})\.\s*([2-9]\d))(?!\d)/g;
  for (const m of text.matchAll(shortCzechRe)) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    const year = 2000 + parseInt(m[4], 10);
    const isoDate = toIsoDate(year, month, day);
    if (isoDate) {
      results.push({ isoDate, year, matchedText: m[1] });
    }
  }

  return results;
}

/**
 * Extracts date and/or year information from free-form text (event name or filename).
 */
export function extractDateInfoFromText(text?: string): ExtractedDateInfo {
  if (!text || typeof text !== 'string') return {};
  const trimmed = text.trim();
  if (!trimmed) return {};

  const fullDates = findAllCalendarDatesInText(trimmed);
  if (fullDates.length > 0) {
    return fullDates[0];
  }

  // 5. Standalone 4-digit year (2020..2099)
  const yearMatch = trimmed.match(/(?:^|[^\d])(20[2-9]\d)(?:$|[^\d])/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return { year, matchedText: yearMatch[1] };
  }

  return {};
}

/**
 * Splits an imported event name / file stem into a clean event title + optional ISO date.
 */
export function splitEventNameAndDate(rawName: string): { eventName: string; eventDate?: string } {
  const trimmed = (rawName || '')
    .trim()
    .replace(/\.(mss|pdf|xlsx|xls|xml)$/i, '')
    .trim();
  if (!trimmed) {
    return { eventName: '' };
  }

  const info = extractDateInfoFromText(trimmed);
  if (!info.isoDate || !info.matchedText) {
    return { eventName: trimmed };
  }

  const withoutDate = trimmed
    .replace(info.matchedText, ' ')
    .replace(/[-–—]\s*[-–—]+/g, ' - ')
    .replace(/^[\s\-–—_.,:;]+/, '')
    .replace(/[\s\-–—_.,:;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    eventName: withoutDate || trimmed,
    eventDate: info.isoDate,
  };
}

/**
 * Returns true if text already contains the same calendar date in any supported format.
 */
export function textContainsSameDate(text: string, isoDate: string): boolean {
  if (!text || !isValidIsoDate(isoDate)) return false;
  const normalizedTarget = isoDate.trim();
  const candidates = findAllCalendarDatesInText(text);
  return candidates.some((c) => c.isoDate === normalizedTarget);
}

/**
 * Composes a clean file/setlist base name combining event name and optional calendar date.
 */
export function composeEventFileBaseName(
  eventName: string,
  eventDate?: string,
  fallbackName = 'Setlist'
): string {
  const cleaned = (eventName || '')
    .trim()
    .replace(/\.(mss|pdf|xlsx|xls)$/i, '')
    .trim();

  if (isValidIsoDate(eventDate)) {
    const czechDate = formatCzechDate(eventDate);
    if (!cleaned) {
      return `${fallbackName} ${czechDate}`;
    }
    if (textContainsSameDate(cleaned, eventDate!)) {
      return cleaned;
    }
    return `${cleaned} ${czechDate}`;
  }

  return cleaned || fallbackName;
}

/**
 * Resolves the target export year and structured folder name from calendar date, event name, or filename.
 */
export function resolveEventYear(params: {
  eventDate?: string;
  eventName?: string;
  fileName?: string;
  referenceDate?: Date;
}): EventYearResolution {
  const { eventDate, eventName, fileName, referenceDate } = params;

  const hasValidCalendar = isValidIsoDate(eventDate);
  const calendarYear = hasValidCalendar ? parseInt(eventDate!.trim().slice(0, 4), 10) : undefined;
  const nameInfo = extractDateInfoFromText(eventName);
  const fileInfo = extractDateInfoFromText(fileName);

  let year: number;
  let source: EventYearSource;
  let isoDate: string | undefined;

  if (hasValidCalendar && calendarYear !== undefined) {
    year = calendarYear;
    source = 'calendar';
    isoDate = eventDate!.trim();
  } else if (nameInfo.year !== undefined) {
    year = nameInfo.year;
    source = 'eventName';
    isoDate = nameInfo.isoDate;
  } else if (fileInfo.year !== undefined) {
    year = fileInfo.year;
    source = 'fileName';
    isoDate = fileInfo.isoDate;
  } else {
    year = (referenceDate || new Date()).getFullYear();
    source = 'currentYearFallback';
  }

  const czechDate = isoDate ? formatCzechDate(isoDate) : undefined;
  const hasYearMismatch = Boolean(
    calendarYear !== undefined &&
      nameInfo.year !== undefined &&
      calendarYear !== nameInfo.year
  );

  return {
    year,
    source,
    targetFolderName: `Playlisty ${year}`,
    isoDate,
    czechDate,
    calendarYear,
    nameYear: nameInfo.year,
    hasYearMismatch,
  };
}
