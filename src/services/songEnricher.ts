import bundledDbRaw from '../data/pepeto-songs-app-db.json';
import { PepetoSingerLegendItem, PepetoSongDatabase, Song } from '../types';

const bundledDb = bundledDbRaw as unknown as PepetoSongDatabase;

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
 * Live Drive fields (id, mss_title, pdf_title, textColor, bgColor) stay authoritative.
 */
export function enrichSongsWithDatabase(
  incomingSongs: Song[],
  externalDbSongs?: Song[]
): Song[] {
  const bundledMaps = buildLookupMaps(bundledDb.songs || []);
  const externalMaps =
    externalDbSongs && externalDbSongs.length > 0
      ? buildLookupMaps(externalDbSongs)
      : null;

  return incomingSongs.map((song) => {
    const dbMatch =
      (externalMaps ? findBestMatch(song, externalMaps) : undefined) ||
      findBestMatch(song, bundledMaps);

    if (!dbMatch) {
      return song;
    }

    return {
      ...dbMatch,
      ...song,
      // Keep live category/artist/note if non-empty, otherwise inherit from rich DB
      category: song.category || dbMatch.category,
      artist: song.artist || dbMatch.artist,
      note: song.note || dbMatch.note,
      // Preserve live Drive bgColor as authoritative for singer display while retaining nested pepeto metadata
      pepeto: dbMatch.pepeto
        ? {
            ...dbMatch.pepeto,
            bgColor: song.bgColor || dbMatch.pepeto.bgColor,
          }
        : undefined,
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
