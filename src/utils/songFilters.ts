import { Song } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';

export const ENERGY_PRESETS = [
  { label: '1–3 Klidná', min: 1, max: 3, activeClass: 'bg-emerald-600 text-white' },
  { label: '4–5 Střední', min: 4, max: 5, activeClass: 'bg-sky-600 text-white' },
  { label: '6–7 Rytmická', min: 6, max: 7, activeClass: 'bg-amber-600 text-white' },
  { label: '8–10 Rychlá', min: 8, max: 10, activeClass: 'bg-rose-600 text-white' },
] as const;

export const ENERGY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type CategoryFilterKey =
  | 'all'
  | 'filmova'
  | 'lidovky'
  | 'seznam_utility'
  | string;

export type TempoFilterKey = 'all' | 'pomala' | 'stredni' | 'rychla' | 'promenliva';
export type DanceabilityFilterKey = 'all' | 'vysoka' | 'stredni' | 'nizka';
export type SaxFilterKey = 'all' | 'ALT Sax' | 'TENOR Sax' | 'none';
export type LanguageFilterKey = 'all' | 'cs' | 'sk' | 'en' | 'instrumental' | 'other';
export type SortOption =
  | 'default'
  | 'title_asc'
  | 'energy_desc'
  | 'energy_asc'
  | 'bpm_desc'
  | 'bpm_asc';

export interface SongFilterState {
  searchQuery: string;
  selectedCategory: CategoryFilterKey;
  filterUnassigned: boolean;
  onlyCommonlyPlayed: boolean;
  selectedSinger: string;
  selectedSax: SaxFilterKey;
  selectedTempo: TempoFilterKey;
  selectedDanceability: DanceabilityFilterKey;
  selectedLanguage: LanguageFilterKey;
  energyMin: number | null;
  energyMax: number | null;
  sortBy: SortOption;
}

export const DEFAULT_SONG_FILTER: SongFilterState = {
  searchQuery: '',
  selectedCategory: 'all',
  filterUnassigned: false,
  onlyCommonlyPlayed: false,
  selectedSinger: 'all',
  selectedSax: 'all',
  selectedTempo: 'all',
  selectedDanceability: 'all',
  selectedLanguage: 'all',
  energyMin: null,
  energyMax: null,
  sortBy: 'default',
};

export const TEMPO_OPTIONS: { value: TempoFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'pomala', label: 'Pomalá' },
  { value: 'stredni', label: 'Střední' },
  { value: 'rychla', label: 'Rychlá' },
  { value: 'promenliva', label: 'Proměnlivá' },
];

export const DANCEABILITY_OPTIONS: { value: DanceabilityFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'vysoka', label: 'Vysoká' },
  { value: 'stredni', label: 'Střední' },
  { value: 'nizka', label: 'Nízká' },
];

export const LANGUAGE_OPTIONS: { value: LanguageFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'cs', label: 'Česky' },
  { value: 'sk', label: 'Slovensky' },
  { value: 'en', label: 'Anglicky' },
  { value: 'instrumental', label: 'Instrumentální' },
  { value: 'other', label: 'Ostatní' },
];

export function isUtilityOrIndexSong(song: Song): boolean {
  const cat = (song.category || '').toLowerCase();
  const title = (song.pdf_title || '').toLowerCase();
  return (
    song.isPlayableSong === false ||
    cat.includes('utility') ||
    cat.includes('index') ||
    title.includes('interní seznam') ||
    /^0+\s+seznam/i.test(song.pdf_title || '')
  );
}

export function isFilmSong(song: Song): boolean {
  const cat = (song.category || '').toLowerCase();
  const type = (song.songType || '').toLowerCase();
  return (
    cat.includes('filmov') ||
    cat.includes('pohádk') ||
    cat.includes('muzikál') ||
    type.includes('filmov') ||
    type.includes('pohádk') ||
    type.includes('muzikál')
  );
}

export function isLidovkaSong(song: Song): boolean {
  const cat = (song.category || '').toLowerCase();
  const singer = (song.pepeto?.singer || '').toLowerCase();
  return cat.includes('lidovk') || singer.includes('lidovk');
}

export function countActiveFilters(filter: SongFilterState): number {
  const isEnergyActive = filter.energyMin !== null || filter.energyMax !== null;
  return (
    (filter.selectedCategory !== 'all' ? 1 : 0) +
    (filter.filterUnassigned ? 1 : 0) +
    (filter.onlyCommonlyPlayed ? 1 : 0) +
    (filter.selectedSinger !== 'all' ? 1 : 0) +
    (filter.selectedSax !== 'all' ? 1 : 0) +
    (filter.selectedTempo !== 'all' ? 1 : 0) +
    (filter.selectedDanceability !== 'all' ? 1 : 0) +
    (filter.selectedLanguage !== 'all' ? 1 : 0) +
    (isEnergyActive ? 1 : 0) +
    (filter.sortBy !== 'default' ? 1 : 0)
  );
}

export function hasAnySearchOrFilter(filter: SongFilterState): boolean {
  return filter.searchQuery.trim().length > 0 || countActiveFilters(filter) > 0;
}

export function extractSingers(songs: Song[]): string[] {
  const set = new Set<string>();
  for (const song of songs) {
    if (song.pepeto?.singer) {
      set.add(song.pepeto.singer);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
}

export function buildCategoryOptions(
  songs: Song[]
): { key: CategoryFilterKey; label: string; count: number }[] {
  const exactCounts = new Map<string, number>();
  let filmCount = 0;
  let lidovkyCount = 0;
  let utilityCount = 0;

  for (const song of songs) {
    if (song.category) {
      exactCounts.set(song.category, (exactCounts.get(song.category) || 0) + 1);
    }
    if (isFilmSong(song)) filmCount++;
    if (isLidovkaSong(song)) lidovkyCount++;
    if (isUtilityOrIndexSong(song)) utilityCount++;
  }

  const options: { key: CategoryFilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Vše', count: songs.length },
    { key: 'filmova', label: 'Filmová', count: filmCount },
    { key: 'lidovky', label: 'Lidovky', count: lidovkyCount },
    { key: 'seznam_utility', label: 'Seznam / Utility', count: utilityCount },
  ];

  const otherCategories = Array.from(exactCounts.keys())
    .filter(
      (cat) =>
        cat !== 'Filmová, pohádková & muzikálová' &&
        cat !== 'Utility / Index'
    )
    .sort((a, b) => a.localeCompare(b, 'cs'));

  for (const cat of otherCategories) {
    options.push({
      key: cat,
      label: cat,
      count: exactCounts.get(cat) || 0,
    });
  }

  return options.filter((opt) => opt.key === 'all' || opt.count > 0);
}

export function matchesSongFilter(
  song: Song | undefined,
  songId: number,
  filter: SongFilterState,
  assignedSongIds: Map<number, string>
): boolean {
  const q = filter.searchQuery.trim().toLowerCase();
  const isEnergyFilterActive = filter.energyMin !== null || filter.energyMax !== null;

  if (!song) {
    // Unknown / placeholder song in a set
    if (countActiveFilters(filter) > 0) return false;
    if (!q) return true;
    return String(songId).includes(q) || `skladba #${songId}`.includes(q);
  }

  if (filter.filterUnassigned && assignedSongIds.has(song.id)) {
    return false;
  }

  if (filter.onlyCommonlyPlayed && !song.pepeto?.isCommonlyPlayed) {
    return false;
  }

  if (filter.selectedCategory !== 'all') {
    if (filter.selectedCategory === 'filmova') {
      if (!isFilmSong(song)) return false;
    } else if (filter.selectedCategory === 'lidovky') {
      if (!isLidovkaSong(song)) return false;
    } else if (filter.selectedCategory === 'seznam_utility') {
      if (!isUtilityOrIndexSong(song)) return false;
    } else if (song.category !== filter.selectedCategory) {
      return false;
    }
  }

  if (filter.selectedSinger !== 'all' && song.pepeto?.singer !== filter.selectedSinger) {
    return false;
  }

  if (filter.selectedSax !== 'all') {
    if (filter.selectedSax === 'none') {
      if (song.pepeto?.sax) return false;
    } else if (song.pepeto?.sax !== filter.selectedSax) {
      return false;
    }
  }

  if (filter.selectedTempo !== 'all' && song.tempoCategory !== filter.selectedTempo) {
    return false;
  }

  if (filter.selectedDanceability !== 'all' && song.danceability !== filter.selectedDanceability) {
    return false;
  }

  if (filter.selectedLanguage !== 'all') {
    if (filter.selectedLanguage === 'other') {
      if (!song.language || ['cs', 'sk', 'en', 'instrumental'].includes(song.language)) {
        return false;
      }
    } else if (song.language !== filter.selectedLanguage) {
      return false;
    }
  }

  if (isEnergyFilterActive) {
    if (typeof song.energy !== 'number') {
      return false;
    }
    const min = filter.energyMin ?? 1;
    const max = filter.energyMax ?? 10;
    if (song.energy < min || song.energy > max) {
      return false;
    }
  }

  if (!q) return true;

  const titleMatch = song.pdf_title.toLowerCase().includes(q);
  const mssMatch = song.mss_title.toLowerCase().includes(q);
  const cleanMatch = song.cleanTitle?.toLowerCase().includes(q) || false;
  const idMatch = String(song.id).includes(q);
  const catMatch = song.category?.toLowerCase().includes(q) || false;
  const typeMatch = song.songType?.toLowerCase().includes(q) || false;
  const artistMatch =
    (song.artist?.toLowerCase().includes(q) || false) ||
    (song.originalArtist?.toLowerCase().includes(q) || false);
  const singerMatch = song.pepeto?.singer?.toLowerCase().includes(q) || false;
  const saxMatch = song.pepeto?.sax?.toLowerCase().includes(q) || false;
  const tempoMatch = song.tempoCategory?.toLowerCase().includes(q) || false;
  const genreMatch = song.genres?.some((g) => g.toLowerCase().includes(q)) || false;
  const moodMatch = song.mood?.some((m) => m.toLowerCase().includes(q)) || false;
  const danceMatch = song.danceStyles?.some((d) => d.toLowerCase().includes(q)) || false;
  const roleMatch = song.setlistRoles?.some((r) => r.toLowerCase().includes(q)) || false;

  return (
    titleMatch ||
    mssMatch ||
    cleanMatch ||
    idMatch ||
    catMatch ||
    typeMatch ||
    artistMatch ||
    singerMatch ||
    saxMatch ||
    tempoMatch ||
    genreMatch ||
    moodMatch ||
    danceMatch ||
    roleMatch
  );
}

export function compareSongsBySort(
  a: Song | undefined,
  aId: number,
  b: Song | undefined,
  bId: number,
  sortBy: SortOption
): number {
  if (sortBy === 'default') return 0;

  if (sortBy === 'title_asc') {
    const titleA = a ? cleanTitleForPdf(a.pdf_title, a.id) : `Skladba #${aId}`;
    const titleB = b ? cleanTitleForPdf(b.pdf_title, b.id) : `Skladba #${bId}`;
    return titleA.localeCompare(titleB, 'cs');
  }
  if (sortBy === 'energy_desc') {
    return (b?.energy ?? -1) - (a?.energy ?? -1);
  }
  if (sortBy === 'energy_asc') {
    return (a?.energy ?? 99) - (b?.energy ?? 99);
  }
  if (sortBy === 'bpm_desc') {
    return (b?.bpm ?? -1) - (a?.bpm ?? -1);
  }
  if (sortBy === 'bpm_asc') {
    return (a?.bpm ?? 999) - (b?.bpm ?? 999);
  }
  return 0;
}
