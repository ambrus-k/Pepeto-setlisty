import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Check, Filter, HardDrive, HelpCircle, Zap } from 'lucide-react';
import { Song, SetlistGroup } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';

const ENERGY_PRESETS = [
  { label: '1–3 Klidná', min: 1, max: 3, activeClass: 'bg-emerald-600 text-white' },
  { label: '4–5 Střední', min: 4, max: 5, activeClass: 'bg-sky-600 text-white' },
  { label: '6–7 Rytmická', min: 6, max: 7, activeClass: 'bg-amber-600 text-white' },
  { label: '8–10 Rychlá', min: 8, max: 10, activeClass: 'bg-rose-600 text-white' },
] as const;

const ENERGY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [energyMin, setEnergyMin] = useState<number | null>(null);
  const [energyMax, setEnergyMax] = useState<number | null>(null);

  const isEnergyFilterActive = energyMin !== null || energyMax !== null;

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

  // Extract distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const song of songs) {
      if (song.category) set.add(song.category);
    }
    return Array.from(set).sort();
  }, [songs]);

  // Filter songs based on search, category, and unassigned status
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return songs.filter((song) => {
      // Unassigned filter
      if (filterUnassigned && assignedSongIds.has(song.id)) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && song.category !== selectedCategory) {
        return false;
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
      const idMatch = String(song.id).includes(q);
      const catMatch = song.category?.toLowerCase().includes(q) || false;
      const artistMatch = song.artist?.toLowerCase().includes(q) || false;
      const singerMatch = song.pepeto?.singer?.toLowerCase().includes(q) || false;
      const saxMatch = song.pepeto?.sax?.toLowerCase().includes(q) || false;
      const tempoMatch = song.tempoCategory?.toLowerCase().includes(q) || false;
      const genreMatch = song.genres?.some((g) => g.toLowerCase().includes(q)) || false;
      const moodMatch = song.mood?.some((m) => m.toLowerCase().includes(q)) || false;
      const danceMatch = song.danceStyles?.some((d) => d.toLowerCase().includes(q)) || false;

      return (
        titleMatch ||
        mssMatch ||
        idMatch ||
        catMatch ||
        artistMatch ||
        singerMatch ||
        saxMatch ||
        tempoMatch ||
        genreMatch ||
        moodMatch ||
        danceMatch
      );
    });
  }, [songs, searchQuery, selectedCategory, filterUnassigned, assignedSongIds, isEnergyFilterActive, energyMin, energyMax]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl overflow-hidden transition-colors">
      {/* Header & Search */}
      <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 space-y-3">
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
            <button
              onClick={() => setFilterUnassigned(!filterUnassigned)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                filterUnassigned
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Zobrazit pouze skladby, které zatím nejsou v žádném setu"
            >
              <Filter className="w-3 h-3" />
              <span>Pouze nepoužité</span>
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
            placeholder="Hledat skladbu, tóninu, nástroj, ID..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills (if more than 1) */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Vše ({songs.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Energy Filter (1–10) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 mr-0.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Energie:</span>
          </span>

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
              className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
              className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Do</option>
              {ENERGY_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            {isEnergyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setEnergyMin(null);
                  setEnergyMax(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Zrušit filtr energie"
                aria-label="Zrušit filtr energie"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
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
                    {song.category && (
                      <span
                        className="text-[0.625rem] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 hidden md:inline"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          color: song.textColor || '#000000',
                        }}
                      >
                        {song.category}
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
