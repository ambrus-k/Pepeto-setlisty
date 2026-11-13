import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Plus,
  Check,
  Filter,
  HardDrive,
  HelpCircle,
  Zap,
  ChevronDown,
  ArrowUpDown,
  Mic,
  Music2,
  Gauge,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Song, SetlistGroup } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';

const ENERGY_PRESETS = [
  { label: '1–3 Klidná', min: 1, max: 3, activeClass: 'bg-emerald-600 text-white' },
  { label: '4–5 Střední', min: 4, max: 5, activeClass: 'bg-sky-600 text-white' },
  { label: '6–7 Rytmická', min: 6, max: 7, activeClass: 'bg-amber-600 text-white' },
  { label: '8–10 Rychlá', min: 8, max: 10, activeClass: 'bg-rose-600 text-white' },
] as const;

const ENERGY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type CategoryFilterKey =
  | 'all'
  | 'filmova'
  | 'lidovky'
  | 'seznam_utility'
  | string;

type TempoFilterKey = 'all' | 'pomala' | 'stredni' | 'rychla' | 'promenliva';
type DanceabilityFilterKey = 'all' | 'vysoka' | 'stredni' | 'nizka';
type SaxFilterKey = 'all' | 'ALT Sax' | 'TENOR Sax' | 'none';
type LanguageFilterKey = 'all' | 'cs' | 'sk' | 'en' | 'instrumental' | 'other';
type SortOption =
  | 'default'
  | 'title_asc'
  | 'energy_desc'
  | 'energy_asc'
  | 'bpm_desc'
  | 'bpm_asc';

const TEMPO_OPTIONS: { value: TempoFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'pomala', label: 'Pomalá' },
  { value: 'stredni', label: 'Střední' },
  { value: 'rychla', label: 'Rychlá' },
  { value: 'promenliva', label: 'Proměnlivá' },
];

const DANCEABILITY_OPTIONS: { value: DanceabilityFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'vysoka', label: 'Vysoká' },
  { value: 'stredni', label: 'Střední' },
  { value: 'nizka', label: 'Nízká' },
];

const LANGUAGE_OPTIONS: { value: LanguageFilterKey; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'cs', label: 'Česky' },
  { value: 'sk', label: 'Slovensky' },
  { value: 'en', label: 'Anglicky' },
  { value: 'instrumental', label: 'Instrumentální' },
  { value: 'other', label: 'Ostatní' },
];

function isUtilityOrIndexSong(song: Song): boolean {
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

function isFilmSong(song: Song): boolean {
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

function isLidovkaSong(song: Song): boolean {
  const cat = (song.category || '').toLowerCase();
  const singer = (song.pepeto?.singer || '').toLowerCase();
  return cat.includes('lidovk') || singer === 'lidovka';
}

interface LibraryColumnProps {
  songs: Song[];
  activeSet: SetlistGroup;
  allSets: SetlistGroup[];
  onAddSongToActiveSet: (song: Song) => void;
  onInspectSong: (song: Song) => void;
  onSyncDatabase?: () => void;
}

/**
 * Highlights saxophone annotations in red if present
 */
function renderHighlightedTitle(title: string, textColor: string) {
  const saxRegex = /(\s*[-–—]?\s*(?:ALT|TENOR|SOPR[AÁ]N|BARYTON)\s*Sax.*)/i;
  const match = title.match(saxRegex);
  if (!match) {
    return <span style={{ color: textColor }}>{title}</span>;
  }

  const parts = title.split(saxRegex);
  return (
    <span>
      {parts.map((part, idx) => {
        if (saxRegex.test(part)) {
          return (
            <span key={idx} className="font-bold text-rose-600">
              {part}
            </span>
          );
        }
        return (
          <span key={idx} style={{ color: textColor }}>
            {part}
          </span>
        );
      })}
    </span>
  );
}

export const LibraryColumn: React.FC<LibraryColumnProps> = ({
  songs,
  activeSet,
  allSets,
  onAddSongToActiveSet,
  onInspectSong,
  onSyncDatabase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [onlyCommonlyPlayed, setOnlyCommonlyPlayed] = useState(false);
  const [selectedSinger, setSelectedSinger] = useState<string>('all');
  const [selectedSax, setSelectedSax] = useState<SaxFilterKey>('all');
  const [selectedTempo, setSelectedTempo] = useState<TempoFilterKey>('all');
  const [selectedDanceability, setSelectedDanceability] = useState<DanceabilityFilterKey>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageFilterKey>('all');
  const [energyMin, setEnergyMin] = useState<number | null>(null);
  const [energyMax, setEnergyMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const isEnergyFilterActive = energyMin !== null || energyMax !== null;
  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (filterUnassigned ? 1 : 0) +
    (onlyCommonlyPlayed ? 1 : 0) +
    (selectedSinger !== 'all' ? 1 : 0) +
    (selectedSax !== 'all' ? 1 : 0) +
    (selectedTempo !== 'all' ? 1 : 0) +
    (selectedDanceability !== 'all' ? 1 : 0) +
    (selectedLanguage !== 'all' ? 1 : 0) +
    (isEnergyFilterActive ? 1 : 0) +
    (sortBy !== 'default' ? 1 : 0);

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setFilterUnassigned(false);
    setOnlyCommonlyPlayed(false);
    setSelectedSinger('all');
    setSelectedSax('all');
    setSelectedTempo('all');
    setSelectedDanceability('all');
    setSelectedLanguage('all');
    setEnergyMin(null);
    setEnergyMax(null);
    setSortBy('default');
  };

  const handleEnergyMinChange = (value: string) => {
    if (!value) {
      setEnergyMin(null);
      return;
    }
    const nextMin = Number(value);
    setEnergyMin(nextMin);
    if (energyMax !== null && nextMin > energyMax) {
      setEnergyMax(nextMin);
    }
  };

  const handleEnergyMaxChange = (value: string) => {
    if (!value) {
      setEnergyMax(null);
      return;
    }
    const nextMax = Number(value);
    setEnergyMax(nextMax);
    if (energyMin !== null && nextMax < energyMin) {
      setEnergyMin(nextMax);
    }
  };

  const handleEnergyPresetClick = (min: number, max: number) => {
    if (energyMin === min && energyMax === max) {
      setEnergyMin(null);
      setEnergyMax(null);
    } else {
      setEnergyMin(min);
      setEnergyMax(max);
    }
  };

  // Set of all song IDs assigned anywhere across all sets
  const assignedSongIds = useMemo(() => {
    const map = new Map<number, string>(); // songId -> setName
    for (const set of allSets) {
      for (const id of set.songIds) {
        if (!map.has(id)) {
          map.set(id, set.name);
        }
      }
    }
    return map;
  }, [allSets]);

  // Set of song IDs in the CURRENT active set
  const activeSetSongIds = useMemo(() => {
    return new Set(activeSet.songIds);
  }, [activeSet.songIds]);

  // Extract distinct singers from pepeto.singer
  const singers = useMemo(() => {
    const set = new Set<string>();
    for (const song of songs) {
      if (song.pepeto?.singer) {
        set.add(song.pepeto.singer);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [songs]);

  // Build smart category options with counts
  const categoryOptions = useMemo(() => {
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
  }, [songs]);

  // Filter & sort songs based on all criteria
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = songs.filter((song) => {
      // Unassigned filter
      if (filterUnassigned && assignedSongIds.has(song.id)) {
        return false;
      }

      // Commonly played filter
      if (onlyCommonlyPlayed && !song.pepeto?.isCommonlyPlayed) {
        return false;
      }

      // Category / smart group filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'filmova') {
          if (!isFilmSong(song)) return false;
        } else if (selectedCategory === 'lidovky') {
          if (!isLidovkaSong(song)) return false;
        } else if (selectedCategory === 'seznam_utility') {
          if (!isUtilityOrIndexSong(song)) return false;
        } else if (song.category !== selectedCategory) {
          return false;
        }
      }

      // Singer filter
      if (selectedSinger !== 'all' && song.pepeto?.singer !== selectedSinger) {
        return false;
      }

      // Sax filter
      if (selectedSax !== 'all') {
        if (selectedSax === 'none') {
          if (song.pepeto?.sax) return false;
        } else if (song.pepeto?.sax !== selectedSax) {
          return false;
        }
      }

      // Tempo filter
      if (selectedTempo !== 'all' && song.tempoCategory !== selectedTempo) {
        return false;
      }

      // Danceability filter
      if (selectedDanceability !== 'all' && song.danceability !== selectedDanceability) {
        return false;
      }

      // Language filter
      if (selectedLanguage !== 'all') {
        if (selectedLanguage === 'other') {
          if (!song.language || ['cs', 'sk', 'en', 'instrumental'].includes(song.language)) {
            return false;
          }
        } else if (song.language !== selectedLanguage) {
          return false;
        }
      }

      // Energy filter (1–10)
      if (isEnergyFilterActive) {
        if (typeof song.energy !== 'number') {
          return false;
        }
        const min = energyMin ?? 1;
        const max = energyMax ?? 10;
        if (song.energy < min || song.energy > max) {
          return false;
        }
      }

      // Search query
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
    });

    if (sortBy === 'default') {
      return matched;
    }

    return [...matched].sort((a, b) => {
      if (sortBy === 'title_asc') {
        return cleanTitleForPdf(a.pdf_title, a.id).localeCompare(
          cleanTitleForPdf(b.pdf_title, b.id),
          'cs'
        );
      }
      if (sortBy === 'energy_desc') {
        return (b.energy ?? -1) - (a.energy ?? -1);
      }
      if (sortBy === 'energy_asc') {
        return (a.energy ?? 99) - (b.energy ?? 99);
      }
      if (sortBy === 'bpm_desc') {
        return (b.bpm ?? -1) - (a.bpm ?? -1);
      }
      if (sortBy === 'bpm_asc') {
        return (a.bpm ?? 999) - (b.bpm ?? 999);
      }
      return 0;
    });
  }, [
    songs,
    searchQuery,
    selectedCategory,
    filterUnassigned,
    onlyCommonlyPlayed,
    selectedSinger,
    selectedSax,
    selectedTempo,
    selectedDanceability,
    selectedLanguage,
    assignedSongIds,
    isEnergyFilterActive,
    energyMin,
    energyMax,
    sortBy,
  ]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl overflow-hidden transition-colors">
      {/* Header & Search */}
      <div className="p-3 sm:p-4 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Knihovna skladeb</span>
            </h2>
            <span className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-2 py-0.5">
              {filteredSongs.length} / {songs.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {activeFilterCount > 0 && !isFiltersOpen && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1 cursor-pointer"
                title="Zrušit všechny aktivní filtry"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Zrušit</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFiltersOpen((prev) => !prev)}
              aria-expanded={isFiltersOpen}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                activeFilterCount > 0 || isFiltersOpen
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Otevřít inteligentní filtry a třídění hudby"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Setlisty</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-indigo-600 text-white text-[0.625rem] font-bold px-1.5 py-0.2 leading-tight">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat skladbu, interpreta, žánr, saxofon, ID..."
            className="w-full pl-9 pr-9 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Unified Intelligent Filters & Sorting Panel */}
        {isFiltersOpen && (
          <div className="rounded-xl bg-white dark:bg-slate-800/75 border border-slate-200 dark:border-slate-700/80 p-3 space-y-3 shadow-xs max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filtry a třídění hudby
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Zrušit vše ({activeFilterCount})</span>
                </button>
              )}
            </div>

            {/* 1. Filtry (Kategorie a skupiny podle databáze) */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Filtry (kategorie &amp; typ)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((opt) => {
                  const isActive = selectedCategory === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSelectedCategory(opt.key)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label} ({opt.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Rychlé přepínače & Řazení */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={filterUnassigned}
                    onChange={(e) => setFilterUnassigned(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    Pouze nepoužité v setech
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={onlyCommonlyPlayed}
                    onChange={(e) => setOnlyCommonlyPlayed(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    Pouze běžně hrané
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="librarySortSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Řazení skladeb</span>
                </label>
                <select
                  id="librarySortSelect"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">Výchozí (#ID)</option>
                  <option value="title_asc">Název (A–Z)</option>
                  <option value="energy_desc">Energie (nejvyšší → nejnižší)</option>
                  <option value="energy_asc">Energie (nejnižší → nejvyšší)</option>
                  <option value="bpm_desc">Tempo BPM (nejrychlejší → nejpomalejší)</option>
                  <option value="bpm_asc">Tempo BPM (nejpomalejší → nejrychlejší)</option>
                </select>
              </div>
            </div>

            {/* 3. Zpěvák & Saxofon */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="singerFilterSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <Mic className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Zpěvák</span>
                </label>
                <select
                  id="singerFilterSelect"
                  value={selectedSinger}
                  onChange={(e) => setSelectedSinger(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Všichni zpěváci</option>
                  {singers.map((singer) => (
                    <option key={singer} value={singer}>
                      {singer}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="saxFilterSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <Music2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Saxofon</span>
                </label>
                <select
                  id="saxFilterSelect"
                  value={selectedSax}
                  onChange={(e) => setSelectedSax(e.target.value as SaxFilterKey)}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Vše (se saxem i bez)</option>
                  <option value="ALT Sax">ALT Sax</option>
                  <option value="TENOR Sax">TENOR Sax</option>
                  <option value="none">Bez saxofonu</option>
                </select>
              </div>
            </div>

            {/* 4. Tempo, Tanečnost, Jazyk */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Gauge className="w-3.5 h-3.5 text-sky-500" />
                  <span>Tempo:</span>
                </span>
                {TEMPO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedTempo(opt.value)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      selectedTempo === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tanečnost:</span>
                </span>
                {DANCEABILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDanceability(opt.value)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      selectedDanceability === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Globe className="w-3.5 h-3.5 text-violet-500" />
                  <span>Jazyk:</span>
                </span>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedLanguage(opt.value)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      selectedLanguage === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Energie (1–10) */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Energie (1–10)</span>
                </span>
                {isEnergyFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setEnergyMin(null);
                      setEnergyMax(null);
                    }}
                    className="text-[0.6875rem] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    Resetovat energii
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEnergyMin(null);
                    setEnergyMax(null);
                  }}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                    !isEnergyFilterActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Vše
                </button>

                {ENERGY_PRESETS.map((preset) => {
                  const isActive = energyMin === preset.min && energyMax === preset.max;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleEnergyPresetClick(preset.min, preset.max)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? preset.activeClass
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <div className="flex items-center gap-1 ml-auto">
                  <select
                    aria-label="Minimální energie"
                    value={energyMin ?? ''}
                    onChange={(e) => handleEnergyMinChange(e.target.value)}
                    className="rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Od</option>
                    {ENERGY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400">–</span>
                  <select
                    aria-label="Maximální energie"
                    value={energyMax ?? ''}
                    onChange={(e) => handleEnergyMaxChange(e.target.value)}
                    className="rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Do</option>
                    {ENERGY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Song List - High Density with Hairline Dividers */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80 dark:divide-slate-800/80 bg-white dark:bg-slate-900/50">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-slate-500 dark:text-slate-400">
            <HardDrive className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mb-3" />
            <p className="text-base font-bold text-slate-900 dark:text-white">Knihovna je zatím prázdná</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
              Načtěte repertoár kapely z centrální Google Drive databáze (soubory PEPETO_KOMPLET_SETLIST.mss a PEPETA_KOMPLET.xlsx).
            </p>
            {onSyncDatabase && (
              <button
                onClick={onSyncDatabase}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 shadow-md transition active:scale-95"
              >
                <HardDrive className="w-4 h-4" />
                <span>Načíst databázi z Google Disku</span>
              </button>
            )}
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenalezena žádná skladba odpovídající filtru.
          </div>
        ) : (
          filteredSongs.map((song) => {
            const inActiveSet = activeSetSongIds.has(song.id);
            const assignedInSetName = assignedSongIds.get(song.id);

            return (
              <div
                key={song.id}
                onClick={() => onAddSongToActiveSet(song)}
                className={`group flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1 cursor-pointer transition select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 active:bg-slate-200 dark:active:bg-slate-800 ${
                  inActiveSet ? 'bg-indigo-50/70 dark:bg-indigo-950/20' : ''
                }`}
                title="Kliknutím přidat do aktivního setu"
              >
                {/* Main Song Pill with authentic HEX textColor & bgColor from Excel */}
                <div
                  className="flex-1 min-w-0 rounded px-2.5 py-1 shadow-xs border border-black/15 flex items-center justify-between gap-2 transition group-hover:brightness-105"
                  style={{
                    backgroundColor: song.bgColor || '#ffffff',
                    color: song.textColor || '#000000',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-xs shrink-0 opacity-75">
                      #{song.id}
                    </span>
                    <span className="font-bold text-xs sm:text-sm truncate tracking-tight">
                      {renderHighlightedTitle(cleanTitleForPdf(song.pdf_title, song.id), song.textColor || '#000000')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {typeof song.energy === 'number' && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[0.625rem] font-bold px-1.5 py-0.5 rounded shrink-0 tabular-nums"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          color: song.textColor || '#000000',
                        }}
                        title={`Energie: ${song.energy} / 10`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {song.energy}
                      </span>
                    )}
                    {song.pepeto?.singer && song.pepeto.singer !== 'Běžně se nehraje / Neurčeno' && (
                      <span
                        className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded shrink-0 hidden sm:inline"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          color: song.textColor || '#000000',
                        }}
                        title={`Zpívá: ${song.pepeto.singer}`}
                      >
                        {song.pepeto.singer}
                      </span>
                    )}
                    {song.pepeto?.sax && (
                      <span
                        className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded shrink-0 hidden sm:inline"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          color: song.textColor || '#000000',
                        }}
                        title={`Saxofon: ${song.pepeto.sax}`}
                      >
                        {song.pepeto.sax}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge & Quick Add button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {inActiveSet ? (
                    <span className="flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/90 border border-indigo-300 dark:border-indigo-700/80 text-indigo-700 dark:text-indigo-300 text-[0.625rem] font-bold px-1.5 py-0.5">
                      <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span className="hidden sm:inline">V setu</span>
                    </span>
                  ) : assignedInSetName ? (
                    <span className="rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[0.625rem] font-medium px-1.5 py-0.5">
                      {assignedInSetName}
                    </span>
                  ) : null}

                  {/* Compact Song Detail (?) Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onInspectSong(song);
                    }}
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/80 text-slate-600 dark:text-slate-200 flex items-center justify-center transition shadow-xs hover:scale-105 cursor-pointer"
                    title="Zobrazit detail a metadata skladby"
                    aria-label={`Zobrazit detail skladby ${song.pdf_title}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>

                  {/* Compact Quick Add Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSongToActiveSet(song);
                    }}
                    className="w-6 h-6 rounded bg-indigo-600/70 group-hover:bg-indigo-600 text-white flex items-center justify-center transition shadow-xs group-hover:scale-105"
                    title={`Přidat do ${activeSet.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
