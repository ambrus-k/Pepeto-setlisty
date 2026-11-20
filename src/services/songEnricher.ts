import bundledDbRaw from '../data/pepeto-songs-app-db.json';
import type { PepetoSingerLegendItem, PepetoSongDatabase, Song } from '../types/index.ts';
import {
  extractSaxTag,
  isNotCommonlyPlayedLabel,
  matchColorToLegend,
  normalizeHexColor,
} from './parser.ts';

const bundledDb = bundledDbRaw as unknown as PepetoSongDatabase;
const GENERIC_SHEET_CATEGORY_RE = /^(seznam\b|list\s*\d+|sheet\s*\d+)/i;

function normalizeTitle(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\d{1,4}\s*[-–—.]?\s*/, '')
    .replace(/\s*[-–—]?\s*(?:alt|tenor|sopran|baryton)\s*sax.*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildLookupMaps(dbSongs: Song[]) {
  const byId = new Map<number, Song>();
  const byMssTitle = new Map<string, Song>();
  const byCleanTitle = new Map<string, Song>();

  for (const entry of dbSongs) {
    if (typeof entry.id === 'number' && !byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
    if (entry.mss_title) {
      const key = entry.mss_title.trim().toLowerCase();
      if (!byMssTitle.has(key)) byMssTitle.set(key, entry);
    }
    const cleanKey = normalizeTitle(entry.cleanTitle || entry.pdf_title || entry.mss_title);
    if (cleanKey && !byCleanTitle.has(cleanKey)) {
      byCleanTitle.set(cleanKey, entry);
    }
  }

  return { byId, byMssTitle, byCleanTitle };
}

function findBestMatch(song: Song, maps: ReturnType<typeof buildLookupMaps>): Song | undefined {
  if (typeof song.id === 'number') {
    const byId = maps.byId.get(song.id);
    if (byId) return byId;
  }

  if (song.mss_title) {
    const byMss = maps.byMssTitle.get(song.mss_title.trim().toLowerCase());
    if (byMss) return byMss;
  }

  const normalized = normalizeTitle(song.cleanTitle || song.pdf_title || song.mss_title);
  if (normalized) {
    return maps.byCleanTitle.get(normalized);
  }

  return undefined;
}

/**
 * Merges live Drive/MSS/XLSX song records with rich metadata from the secondary database.
 * - Live Drive fields (id, mss_title, pdf_title, textColor, bgColor) stay authoritative.
 * - Singer & commonly-played status are dynamically derived from the song's live Excel bgColor
 *   against the live Excel legend (or bundled legend fallback), so any recoloring in Excel
 *   immediately updates badges and filters.
 * - Rich musical categories from the metadata DB are preserved (never replaced by Excel sheet names).
 */
export function enrichSongsWithDatabase(
  incomingSongs: Song[],
  externalDbSongs?: Song[],
  liveLegend?: PepetoSingerLegendItem[] | null
): Song[] {
  const bundledMaps = buildLookupMaps(bundledDb.songs || []);
  const externalMaps =
    externalDbSongs && externalDbSongs.length > 0
      ? buildLookupMaps(externalDbSongs)
      : null;

  const activeLegend =
    liveLegend && liveLegend.length > 0 ? liveLegend : bundledDb.singerLegend || [];

  return incomingSongs.map((song) => {
    const dbMatch =
      (externalMaps ? findBestMatch(song, externalMaps) : undefined) ||
      findBestMatch(song, bundledMaps);

    const liveBgColor = normalizeHexColor(song.bgColor || dbMatch?.bgColor, '#ffffff');
    const isUtility =
      song.isPlayableSong === false ||
      dbMatch?.isPlayableSong === false ||
      /^0+\s+seznam$/i.test((song.mss_title || '').trim()) ||
      song.id === 998 ||
      song.id === 999;

    const legendMatch = !isUtility ? matchColorToLegend(liveBgColor, activeLegend) : undefined;
    const liveSax =
      extractSaxTag(song.pdf_title) ||
      extractSaxTag(song.mss_title) ||
      song.pepeto?.sax ||
      dbMatch?.pepeto?.sax ||
      null;

    // Prefer rich musical category from DB over generic Excel sheet names ("Seznam - vybarvený")
    const incomingCat =
      song.category && !GENERIC_SHEET_CATEGORY_RE.test(song.category.trim())
        ? song.category
        : undefined;
    const resolvedCategory =
      dbMatch?.category ||
      incomingCat ||
      (legendMatch?.singer.toLowerCase().includes('lidovk') ? 'Lidovky' : undefined);

    const resolvedSinger = isUtility
      ? null
      : legendMatch?.singer || song.pepeto?.singer || dbMatch?.pepeto?.singer || null;

    const resolvedCommonlyPlayed = isUtility
      ? false
      : legendMatch
      ? !isNotCommonlyPlayedLabel(legendMatch.description || legendMatch.singer)
      : song.pepeto?.isCommonlyPlayed ?? dbMatch?.pepeto?.isCommonlyPlayed ?? true;

    const mergedPepeto = {
      ...(dbMatch?.pepeto || {}),
      ...(song.pepeto || {}),
      bgColor: liveBgColor,
      singer: resolvedSinger,
      isCommonlyPlayed: resolvedCommonlyPlayed,
      sax: liveSax,
    };

    if (!dbMatch) {
      return {
        ...song,
        bgColor: liveBgColor,
        category: resolvedCategory,
        isPlayableSong: !isUtility,
        pepeto: mergedPepeto,
      };
    }

    return {
      ...dbMatch,
      ...song,
      bgColor: liveBgColor,
      category: resolvedCategory,
      artist: song.artist || dbMatch.artist,
      note: song.note || dbMatch.note,
      fileName: song.fileName || dbMatch.mss_fileName || dbMatch.fileName,
      mss_fileName: song.mss_fileName || song.fileName || dbMatch.mss_fileName,
      mss_songId: song.mss_songId !== undefined ? song.mss_songId : dbMatch.mss_songId,
      isPlayableSong: !isUtility,
      pepeto: mergedPepeto,
    };
  });
}

export function getBundledDatabaseSongs(): Song[] {
  return bundledDb.songs || [];
}

export function getSingerLegend(): PepetoSingerLegendItem[] {
  return bundledDb.singerLegend || [];
}

export function hasRichMetadata(song: Song): boolean {
  return Boolean(
    song.aiDescription ||
      song.bpm ||
      song.energy ||
      song.tempoCategory ||
      (song.genres && song.genres.length > 0) ||
      (song.setlistRoles && song.setlistRoles.length > 0)
  );
}
