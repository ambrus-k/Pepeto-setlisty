import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Scissors,
  ArrowUp,
  ArrowDown,
  Trash2,
  Search,
  Filter,
  X,
  CheckSquare,
  Square,
  HelpCircle,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Mic,
  Music2,
  Gauge,
  Globe,
  Sparkles,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Song } from '../types';
import { PaneSide } from './SetTabs';
import {
  SongFilterState,
  DEFAULT_SONG_FILTER,
  ENERGY_PRESETS,
  ENERGY_LEVELS,
  TEMPO_OPTIONS,
  DANCEABILITY_OPTIONS,
  LANGUAGE_OPTIONS,
  SaxFilterKey,
  SortOption,
  CategoryFilterKey,
  countActiveFilters,
} from '../utils/songFilters';

interface CommanderToolbarProps {
  activePane: PaneSide;
  activeSourceLabel: string;
  targetSourceLabel: string;
  isActiveLibrary: boolean;
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  canCopy: boolean;
  copyDisabledReason?: string;
  canMove: boolean;
  moveDisabledReason?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderDisabledReason?: string;
  canRemove: boolean;
  canInspect: boolean;
  unmatchedSelectedSong: Song | null;

  // Actions
  onCopy: () => void;
  onMove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onInspectSelected: () => void;
  onPairSelected: (song: Song) => void;
  onSwapPanes: () => void;

  // Search & Filter (for active pane)
  filter: SongFilterState;
  onFilterChange: (updater: (prev: SongFilterState) => SongFilterState) => void;
  onResetFilters: () => void;
  categoryOptions: { key: CategoryFilterKey; label: string; count: number }[];
  singers: string[];
}

export const CommanderToolbar: React.FC<CommanderToolbarProps> = ({
  activePane,
  activeSourceLabel,
  targetSourceLabel,
  isActiveLibrary,
  selectedCount,
  visibleCount,
  allVisibleSelected,
  canCopy,
  copyDisabledReason,
  canMove,
  moveDisabledReason,
  canMoveUp,
  canMoveDown,
  reorderDisabledReason,
  canRemove,
  canInspect,
  unmatchedSelectedSong,
  onCopy,
  onMove,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleSelectAll,
  onClearSelection,
  onInspectSelected,
  onPairSelected,
  onSwapPanes,
  filter,
  onFilterChange,
  onResetFilters,
  categoryOptions,
  singers,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filtersContainerRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = countActiveFilters(filter);
  const isEnergyFilterActive = filter.energyMin !== null || filter.energyMax !== null;
  const isGoingRight = activePane === 'left';

  useEffect(() => {
    if (!isFiltersOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filtersContainerRef.current &&
        !filtersContainerRef.current.contains(e.target as Node)
      ) {
        setIsFiltersOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFiltersOpen]);

  const handleEnergyMinChange = (value: string) => {
    onFilterChange((prev) => {
      if (!value) return { ...prev, energyMin: null };
      const nextMin = Number(value);
      return {
        ...prev,
        energyMin: nextMin,
        energyMax: prev.energyMax !== null && nextMin > prev.energyMax ? nextMin : prev.energyMax,
      };
    });
  };

  const handleEnergyMaxChange = (value: string) => {
    onFilterChange((prev) => {
      if (!value) return { ...prev, energyMax: null };
      const nextMax = Number(value);
      return {
        ...prev,
        energyMax: nextMax,
        energyMin: prev.energyMin !== null && nextMax < prev.energyMin ? nextMax : prev.energyMin,
      };
    });
  };

  const handleEnergyPresetClick = (min: number, max: number) => {
    onFilterChange((prev) => {
      if (prev.energyMin === min && prev.energyMax === max) {
        return { ...prev, energyMin: null, energyMax: null };
      }
      return { ...prev, energyMin: min, energyMax: max };
    });
  };

  return (
    <div
      ref={filtersContainerRef}
      className="relative shrink-0 bg-slate-100/90 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-4 py-1 transition-colors z-20"
    >
      {/* Single Compact Editing Row — guaranteed 1 line on Android tablet landscape & desktop */}
      <div className="max-w-[1600px] mx-auto flex flex-nowrap items-center justify-between gap-1.5 overflow-x-auto horizontal-scroll-row">
        {/* LEFT GROUP: Compact Icon-Only Total Commander Editing Buttons */}
        <div className="flex flex-nowrap items-center gap-1 shrink-0">
          {/* COPY (F5) — Classic Windows Copy icon + direction arrow */}
          <button
            type="button"
            onClick={onCopy}
            disabled={!canCopy}
            className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-bold transition cursor-pointer active:scale-95 border shrink-0 ${
              canCopy
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-xs shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/70 opacity-60 cursor-not-allowed'
            }`}
            title={
              canCopy
                ? `Kopírovat vybrané (${selectedCount}) do: ${targetSourceLabel} (F5)`
                : copyDisabledReason || 'Kopírovat vybrané do druhého okna (F5)'
            }
            aria-label="Kopírovat"
          >
            {!isGoingRight && <ArrowLeft className="w-3 h-3 shrink-0" />}
            <Copy className="w-3.5 h-3.5 shrink-0" />
            {selectedCount > 0 && canCopy && (
              <span className="rounded bg-white/25 px-1 text-[0.625rem] font-mono leading-tight">
                {selectedCount}
              </span>
            )}
            {isGoingRight && <ArrowRight className="w-3 h-3 shrink-0" />}
          </button>

          {/* MOVE (F6) — Classic Windows Cut/Move Scissors icon + direction arrow */}
          <button
            type="button"
            onClick={onMove}
            disabled={!canMove}
            className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-bold transition cursor-pointer active:scale-95 border shrink-0 ${
              canMove
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-xs'
                : 'bg-white dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/70 opacity-60 cursor-not-allowed'
            }`}
            title={
              canMove
                ? `Přesunout vybrané (${selectedCount}) do: ${targetSourceLabel} (F6)`
                : moveDisabledReason || 'Přesunout vybrané do druhého setlistu (F6)'
            }
            aria-label="Přesunout"
          >
            {!isGoingRight && <ArrowLeft className="w-3 h-3 shrink-0" />}
            <Scissors className="w-3.5 h-3.5 shrink-0" />
            {isGoingRight && <ArrowRight className="w-3 h-3 shrink-0" />}
          </button>

          {/* Reorder Up & Down */}
          <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 overflow-hidden shadow-2xs shrink-0">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer border-r border-slate-200 dark:border-slate-700"
              title={
                canMoveUp
                  ? 'Posunout označené nahoru'
                  : reorderDisabledReason || 'Posunout označené nahoru'
              }
              aria-label="Posunout nahoru"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title={
                canMoveDown
                  ? 'Posunout označené dolů'
                  : reorderDisabledReason || 'Posunout označené dolů'
              }
              aria-label="Posunout dolů"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* REMOVE (F8 / Del) — Trash icon ONLY */}
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 transition cursor-pointer active:scale-95 border shrink-0 ${
              canRemove
                ? 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border-rose-300 dark:border-rose-600/60'
                : 'bg-white dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/70 opacity-60 cursor-not-allowed'
            }`}
            title={
              canRemove
                ? `Odstranit vybrané (${selectedCount}) ze setlistu (Del / F8)`
                : isActiveLibrary
                ? 'Z Knihovny nelze skladby odstraňovat'
                : 'Odstranit označené skladby ze setu'
            }
            aria-label="Odstranit"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* SELECT ALL / CLEAR SELECTION — Compact icon + count */}
          <button
            type="button"
            onClick={selectedCount > 0 && allVisibleSelected ? onClearSelection : onToggleSelectAll}
            disabled={visibleCount === 0}
            className={`inline-flex items-center gap-1 rounded-lg p-1.5 text-xs font-semibold transition cursor-pointer border shrink-0 ${
              selectedCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-600/60 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2'
                : 'bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            } disabled:opacity-40 disabled:pointer-events-none`}
            title={
              selectedCount > 0 && allVisibleSelected
                ? 'Zrušit označení v aktivním okně (Esc)'
                : 'Označit všechny zobrazené skladby v aktivním okně (Ctrl+A)'
            }
            aria-label="Označit vše"
          >
            {allVisibleSelected && visibleCount > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {selectedCount > 0 && (
              <span className="font-mono text-[0.6875rem] font-bold leading-none">
                {selectedCount}
              </span>
            )}
          </button>

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
              title="Zrušit výběr (Esc)"
              aria-label="Zrušit výběr"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* SONG DETAIL (?) — Question mark icon ONLY */}
          <button
            type="button"
            onClick={onInspectSelected}
            disabled={!canInspect}
            className="inline-flex items-center justify-center rounded-lg p-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer shrink-0"
            title={
              canInspect
                ? 'Zobrazit detail a metadata vybrané skladby'
                : 'Označte 1 skladbu pro zobrazení detailu'
            }
            aria-label="Detail skladby"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          </button>

          {/* MANUAL PAIR (only shown when selected song is unmatched) */}
          {unmatchedSelectedSong && (
            <button
              type="button"
              onClick={() => onPairSelected(unmatchedSelectedSong)}
              className="inline-flex items-center gap-1 rounded-lg p-1.5 sm:px-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white shadow-xs transition cursor-pointer shrink-0"
              title="Ručně spárovat nenalezenou skladbu s databází"
              aria-label="Spárovat skladbu"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* SWAP PANES */}
          <button
            type="button"
            onClick={onSwapPanes}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
            title="Prohodit obsah levého a pravého okna"
            aria-label="Prohodit okna"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* RIGHT GROUP: Compact Search Input + Icon-Only Filter Button */}
        <div className="flex flex-nowrap items-center gap-1 flex-1 min-w-[8.5rem] max-w-sm justify-end">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[6.5rem]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filter.searchQuery}
              onChange={(e) =>
                onFilterChange((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder={`Hledat (${activeSourceLabel})...`}
              className="w-full pl-7 pr-6 py-1 rounded-lg bg-white dark:bg-slate-800/95 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
            {filter.searchQuery && (
              <button
                type="button"
                onClick={() => onFilterChange((prev) => ({ ...prev, searchQuery: '' }))}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                title="Vymazat hledání"
                aria-label="Vymazat hledání"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Reset X when filters active & panel closed */}
          {activeFilterCount > 0 && !isFiltersOpen && (
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-lg p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-700/50 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition cursor-pointer shrink-0"
              title="Zrušit všechny aktivní filtry aktivního okna"
              aria-label="Zrušit filtry"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Filters Toggle — Filter icon ONLY (+ tiny active count pill when > 0) */}
          <button
            type="button"
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            aria-expanded={isFiltersOpen}
            aria-label="Filtry a řazení"
            className={`relative inline-flex items-center gap-1 rounded-lg p-1.5 text-xs font-semibold transition cursor-pointer border shrink-0 ${
              activeFilterCount > 0 || isFiltersOpen
                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border-indigo-400 dark:border-indigo-500/60'
                : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={`Filtry a řazení pro aktivní okno (${activeSourceLabel})`}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-indigo-600 text-white text-[0.625rem] font-bold px-1 leading-tight">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FLOATING UNIFIED INTELLIGENT FILTERS & SORTING PANEL */}
      {isFiltersOpen && (
        <div className="max-w-[1600px] mx-auto relative">
          <div className="mt-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3 shadow-2xl max-h-[65vh] overflow-y-auto overscroll-contain animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Filtry a řazení
                </span>
                <span className="rounded-md bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-700/60 px-2 py-0.5 text-[0.6875rem] font-bold text-indigo-700 dark:text-indigo-200">
                  {activePane === 'left' ? 'Levé okno' : 'Pravé okno'}: {activeSourceLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Zrušit vše ({activeFilterCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Zavřít filtry"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Kategorie & typ */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Kategorie &amp; typ
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((opt) => {
                  const isActive = filter.selectedCategory === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        onFilterChange((prev) => ({ ...prev, selectedCategory: opt.key }))
                      }
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
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={filter.filterUnassigned}
                    onChange={(e) =>
                      onFilterChange((prev) => ({
                        ...prev,
                        filterUnassigned: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    Pouze nepoužité v setech
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={filter.onlyCommonlyPlayed}
                    onChange={(e) =>
                      onFilterChange((prev) => ({
                        ...prev,
                        onlyCommonlyPlayed: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    Pouze běžně hrané
                  </span>
                </label>
              </div>

              {/* Řazení */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="tcSortSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Řazení skladeb</span>
                </label>
                <select
                  id="tcSortSelect"
                  value={filter.sortBy}
                  onChange={(e) =>
                    onFilterChange((prev) => ({
                      ...prev,
                      sortBy: e.target.value as SortOption,
                    }))
                  }
                  className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">
                    {isActiveLibrary ? 'Výchozí (#ID)' : 'Pořadí v setlistu'}
                  </option>
                  <option value="title_asc">Název (A–Z)</option>
                  <option value="energy_desc">Energie (nejvyšší → nejnižší)</option>
                  <option value="energy_asc">Energie (nejnižší → nejvyšší)</option>
                  <option value="bpm_desc">Tempo BPM (nejrychlejší → nejpomalejší)</option>
                  <option value="bpm_asc">Tempo BPM (nejpomalejší → nejrychlejší)</option>
                </select>
              </div>

              {/* Zpěvák */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="tcSingerSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <Mic className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Zpěvák</span>
                </label>
                <select
                  id="tcSingerSelect"
                  value={filter.selectedSinger}
                  onChange={(e) =>
                    onFilterChange((prev) => ({ ...prev, selectedSinger: e.target.value }))
                  }
                  className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Všichni zpěváci</option>
                  {singers.map((singer) => (
                    <option key={singer} value={singer}>
                      {singer}
                    </option>
                  ))}
                </select>
              </div>

              {/* Saxofon */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="tcSaxSelect"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <Music2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Saxofon</span>
                </label>
                <select
                  id="tcSaxSelect"
                  value={filter.selectedSax}
                  onChange={(e) =>
                    onFilterChange((prev) => ({
                      ...prev,
                      selectedSax: e.target.value as SaxFilterKey,
                    }))
                  }
                  className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Vše (se saxem i bez)</option>
                  <option value="ALT Sax">ALT Sax</option>
                  <option value="TENOR Sax">TENOR Sax</option>
                  <option value="none">Bez saxofonu</option>
                </select>
              </div>
            </div>

            {/* 3. Tempo, Tanečnost, Jazyk */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Gauge className="w-3.5 h-3.5 text-sky-500" />
                  <span>Tempo:</span>
                </span>
                {TEMPO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onFilterChange((prev) => ({ ...prev, selectedTempo: opt.value }))
                    }
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      filter.selectedTempo === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tanečnost:</span>
                </span>
                {DANCEABILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onFilterChange((prev) => ({ ...prev, selectedDanceability: opt.value }))
                    }
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      filter.selectedDanceability === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Globe className="w-3.5 h-3.5 text-violet-500" />
                  <span>Jazyk:</span>
                </span>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onFilterChange((prev) => ({ ...prev, selectedLanguage: opt.value }))
                    }
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      filter.selectedLanguage === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Energie (1–10) */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 mr-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Energie (1–10):</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onFilterChange((prev) => ({ ...prev, energyMin: null, energyMax: null }))
                  }
                  className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                    !isEnergyFilterActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Vše
                </button>

                {ENERGY_PRESETS.map((preset) => {
                  const isActive =
                    filter.energyMin === preset.min && filter.energyMax === preset.max;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleEnergyPresetClick(preset.min, preset.max)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? preset.activeClass
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <div className="flex items-center gap-1 ml-auto">
                  <select
                    aria-label="Minimální energie"
                    value={filter.energyMin ?? ''}
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
                    value={filter.energyMax ?? ''}
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { DEFAULT_SONG_FILTER };
