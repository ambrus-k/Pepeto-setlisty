import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Check, Filter, HardDrive } from 'lucide-react';
import { Song, SetlistGroup } from '../types';

interface LibraryColumnProps {
  songs: Song[];
  activeSet: SetlistGroup;
  allSets: SetlistGroup[];
  onAddSongToActiveSet: (song: Song) => void;
  onSyncDatabase?: () => void;
}

/**
 * Highlights saxophone annotations in red if present
 */
function renderHighlightedTitle(title: string, textColor: string) {
  const saxRegex = /(-?\s*(?:ALT|TENOR)\s*Sax\w*)/i;
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
  onSyncDatabase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);

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

      // Search query
      if (!q) return true;

      const titleMatch = song.pdf_title.toLowerCase().includes(q);
      const mssMatch = song.mss_title.toLowerCase().includes(q);
      const idMatch = String(song.id).includes(q);
      const catMatch = song.category?.toLowerCase().includes(q) || false;

      return titleMatch || mssMatch || idMatch || catMatch;
    });
  }, [songs, searchQuery, selectedCategory, filterUnassigned, assignedSongIds]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header & Search */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Knihovna skladeb</span>
            </h2>
            <span className="rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs px-2 py-0.5">
              {filteredSongs.length} / {songs.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterUnassigned(!filterUnassigned)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 ${
                filterUnassigned
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-slate-200'
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
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              Vše ({songs.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Song List - High Density with Hairline Dividers */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 bg-slate-900/50">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-slate-400">
            <HardDrive className="w-10 h-10 text-indigo-400 mb-3" />
            <p className="text-base font-bold text-white">Knihovna je zatím prázdná</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
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
                className={`group flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1 cursor-pointer transition select-none hover:bg-slate-800/80 active:bg-slate-800 ${
                  inActiveSet ? 'bg-indigo-950/20' : ''
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
                      {renderHighlightedTitle(song.pdf_title, song.textColor || '#000000')}
                    </span>
                  </div>

                  {song.category && (
                    <span
                      className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 hidden md:inline"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        color: song.textColor || '#000000',
                      }}
                    >
                      {song.category}
                    </span>
                  )}
                </div>

                {/* Status Badge & Quick Add button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {inActiveSet ? (
                    <span className="flex items-center gap-1 rounded bg-indigo-950/90 border border-indigo-700/80 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5">
                      <Check className="w-3 h-3 text-indigo-400" />
                      <span className="hidden sm:inline">V setu</span>
                    </span>
                  ) : assignedInSetName ? (
                    <span className="rounded bg-slate-800/90 border border-slate-700 text-slate-400 text-[10px] font-medium px-1.5 py-0.5">
                      {assignedInSetName}
                    </span>
                  ) : null}

                  {/* Compact Quick Add Button */}
                  <button
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
