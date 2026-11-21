import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check,
  Clock,
  Filter,
  GripVertical,
  HardDrive,
  Music,
  Zap,
  AlertTriangle,
  Library,
  ListMusic,
  X,
} from 'lucide-react';
import { SetlistGroup, Song } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';
import { PaneSide } from './SetTabs';

export interface PaneDisplayRow {
  rowKey: number; // song.id for Library, originalIndex for Set
  songId: number;
  song?: Song;
  originalIndex?: number; // present only for Set rows
}

interface CommanderPaneProps {
  side: PaneSide;
  isActive: boolean;
  sourceId: string; // 'library' | set.id
  allSets: SetlistGroup[];
  totalLibraryCount: number;
  totalSourceCount: number;
  rows: PaneDisplayRow[];
  selectedKeys: Set<number>;
  hasFilter: boolean;
  canDragReorder: boolean;
  targetSetSongIds?: Set<number>;
  targetSetName?: string;
  assignedSongIds: Map<number, string>;

  onActivate: () => void;
  onChangeSource: (newSourceId: string) => void;
  onToggleRow: (rowKey: number, visibleIndex: number, isShiftKey: boolean) => void;
  onReorderSong?: (oldIndex: number, newIndex: number) => void;
  onOpenManualPair?: (song: Song) => void;
  onClearFilter?: () => void;
  onSyncDatabase?: () => void;
}

const SAX_REGEX = /(\s*[-–—]?\s*(?:ALT|TENOR|SOPR[AÁ]N|BARYTON)\s*Sax.*)/i;

function renderHighlightedTitle(title: string, textColor: string) {
  if (!SAX_REGEX.test(title)) {
    return <span style={{ color: textColor }}>{title}</span>;
  }

  const parts = title.split(SAX_REGEX);
  return (
    <span>
      {parts.map((part, idx) =>
        SAX_REGEX.test(part) ? (
          <span key={idx} className="font-bold text-rose-600">
            {part}
          </span>
        ) : (
          <span key={idx} style={{ color: textColor }}>
            {part}
          </span>
        )
      )}
    </span>
  );
}

interface SongRowCardProps {
  row: PaneDisplayRow;
  visibleIndex: number;
  isLibrary: boolean;
  isSelected: boolean;
  isActivePane: boolean;
  canDrag: boolean;
  inTargetSet: boolean;
  targetSetName?: string;
  assignedInSetName?: string;
  onToggle: (rowKey: number, visibleIndex: number, isShiftKey: boolean) => void;
  onOpenManualPair?: (song: Song) => void;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  isDragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

const SongRowContent: React.FC<SongRowCardProps> = ({
  row,
  visibleIndex,
  isLibrary,
  isSelected,
  isActivePane,
  canDrag,
  inTargetSet,
  targetSetName,
  assignedInSetName,
  onToggle,
  onOpenManualPair,
  dragAttributes,
  dragListeners,
  isDragging,
  setNodeRef,
  style,
}) => {
  const { rowKey, songId, song, originalIndex } = row;
  const isUnmatched = Boolean(song?.isUnmatched || songId < 0);
  const title = song
    ? cleanTitleForPdf(song.pdf_title, song.id)
    : songId < 0
    ? 'Neznámá skladba'
    : `Skladba #${songId}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        onToggle(rowKey, visibleIndex, e.shiftKey);
      }}
      role="option"
      aria-selected={isSelected}
      className={`group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 transition-colors select-none cursor-pointer border-l-[3px] ${
        isDragging
          ? 'opacity-75 scale-[1.01] bg-indigo-100 dark:bg-indigo-950/80 shadow-lg z-30 ring-1 ring-indigo-500 border-l-indigo-600'
          : isSelected
          ? isActivePane
            ? 'bg-indigo-100/90 dark:bg-indigo-900/45 border-l-indigo-600 dark:border-l-indigo-400'
            : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-l-indigo-400/70'
          : isUnmatched
          ? 'bg-amber-50/80 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/35 border-l-amber-500'
          : 'border-l-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70'
      }`}
    >
      {/* Selection Checkbox Indicator */}
      <div
        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
          isSelected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
        }`}
        aria-hidden="true"
      >
        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
      </div>

      {/* Drag handle for Set pane when unfiltered & default sort */}
      {!isLibrary && canDrag && (
        <div
          {...dragAttributes}
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: 'none' }}
          className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700/60 shrink-0"
          title="Uchopte a táhněte pro změnu pořadí"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Set Position Number */}
      {!isLibrary && typeof originalIndex === 'number' && (
        <span className="w-5 shrink-0 text-right font-mono text-[0.6875rem] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
          {originalIndex + 1}.
        </span>
      )}

      {/* Main Song Pill with Authentic Excel Colors */}
      <div
        className={`flex-1 min-w-0 rounded px-2 py-1 shadow-2xs flex items-center justify-between gap-1.5 transition ${
          isSelected
            ? 'ring-2 ring-indigo-500/80 border border-indigo-600/50'
            : isUnmatched
            ? 'border border-amber-500/80 ring-1 ring-amber-500/50'
            : 'border border-black/15 group-hover:brightness-[1.03]'
        }`}
        style={{
          backgroundColor: isUnmatched ? '#fef3c7' : song ? song.bgColor || '#ffffff' : '#ffffff',
          color: isUnmatched ? '#78350f' : song ? song.textColor || '#000000' : '#000000',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-bold text-[0.6875rem] sm:text-xs shrink-0 opacity-75">
            {songId < 0 ? '?' : `#${song ? song.id : songId}`}
          </span>
          <div className="font-bold text-xs sm:text-sm truncate tracking-tight">
            {renderHighlightedTitle(
              title,
              isUnmatched ? '#78350f' : song ? song.textColor || '#000000' : '#000000'
            )}
          </div>
        </div>

        {/* Compact inline metadata badges */}
        <div className="flex items-center gap-1 shrink-0">
          {isUnmatched ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenManualPair?.(
                  song || {
                    id: songId,
                    pdf_title: title,
                    mss_title: title,
                    textColor: '#000000',
                    bgColor: '#ffffff',
                    isUnmatched: true,
                  }
                );
              }}
              className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[0.625rem] px-1.5 py-0.5 shadow-xs transition active:scale-95 cursor-pointer"
              title="Skladba nebyla nalezena v databázi – klikněte pro ruční spárování"
            >
              <AlertTriangle className="w-3 h-3 text-amber-200" />
              <span>Spárovat</span>
            </button>
          ) : (
            song && (
              <>
                {typeof song.energy === 'number' && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[0.625rem] font-bold px-1 py-0.5 rounded shrink-0 tabular-nums"
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
                {song.pepeto?.singer &&
                  song.pepeto.singer !== 'Běžně se nehraje / Neurčeno' && (
                    <span
                      className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded shrink-0 hidden xl:inline"
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
                    className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded shrink-0 hidden lg:inline"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      color: song.textColor || '#000000',
                    }}
                    title={`Saxofon: ${song.pepeto.sax}`}
                  >
                    {song.pepeto.sax}
                  </span>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Lightweight read-only assignment badge in Library view */}
      {isLibrary && (inTargetSet || assignedInSetName) && (
        <div className="shrink-0">
          {inTargetSet ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/70 text-emerald-700 dark:text-emerald-300 text-[0.625rem] font-bold px-1.5 py-0.5"
              title={targetSetName ? `Již obsaženo v cílovém setu (${targetSetName})` : 'Již v cílovém setu'}
            >
              <Check className="w-2.5 h-2.5" />
              <span className="hidden sm:inline max-w-[4.5rem] truncate">
                {targetSetName || 'V cíli'}
              </span>
            </span>
          ) : assignedInSetName ? (
            <span
              className="inline-block rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[0.625rem] font-medium px-1.5 py-0.5 max-w-[4.5rem] truncate"
              title={`Zařazeno v: ${assignedInSetName}`}
            >
              {assignedInSetName}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface SortablePaneRowProps extends Omit<SongRowCardProps, 'dragAttributes' | 'dragListeners' | 'isDragging' | 'setNodeRef' | 'style'> {
  sortableId: string;
}

const SortablePaneRow: React.FC<SortablePaneRowProps> = ({ sortableId, ...props }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SongRowContent
      {...props}
      setNodeRef={setNodeRef}
      style={style}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
};

export const CommanderPane: React.FC<CommanderPaneProps> = ({
  side,
  isActive,
  sourceId,
  allSets,
  totalLibraryCount,
  totalSourceCount,
  rows,
  selectedKeys,
  hasFilter,
  canDragReorder,
  targetSetSongIds,
  targetSetName,
  assignedSongIds,
  onActivate,
  onChangeSource,
  onToggleRow,
  onReorderSong,
  onOpenManualPair,
  onClearFilter,
  onSyncDatabase,
}) => {
  const isLibrary = sourceId === 'library';
  const totalMinutes = !isLibrary ? Math.round(totalSourceCount * 3.75) : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortableIds = rows.map((r) => `pane-${side}-${r.songId}-${r.rowKey}`);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorderSong || !canDragReorder) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderSong(oldIndex, newIndex);
      }
    }
  };

  return (
    <section
      onMouseDown={onActivate}
      onTouchStart={onActivate}
      className={`flex flex-col h-full min-h-[18rem] md:min-h-0 rounded-xl bg-white dark:bg-slate-900 overflow-hidden transition-all border-2 ${
        isActive
          ? 'border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/10'
          : 'border-slate-200 dark:border-slate-800 shadow-xs'
      }`}
      aria-label={side === 'left' ? 'Levý panel' : 'Pravý panel'}
    >
      {/* Pane Header: Side Badge + Source Dropdown (Knihovna + All Sets) + Compact Stats */}
      <div
        className={`shrink-0 px-2.5 py-2 border-b flex items-center justify-between gap-2 transition-colors ${
          isActive
            ? 'bg-indigo-600 dark:bg-indigo-950/90 border-indigo-500 dark:border-indigo-700/80 text-white'
            : 'bg-slate-100/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* L / P Badge */}
          <span
            className={`w-6 h-6 rounded-md flex items-center justify-center text-[0.6875rem] font-extrabold shrink-0 ${
              isActive
                ? 'bg-white text-indigo-700 dark:bg-indigo-500 dark:text-white shadow-2xs'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title={
              isActive
                ? `${side === 'left' ? 'Levé' : 'Pravé'} okno (AKTIVNÍ)`
                : `${side === 'left' ? 'Levé' : 'Pravé'} okno (Cílové)`
            }
          >
            {side === 'left' ? 'L' : 'P'}
          </span>

          {isLibrary ? (
            <Library className="w-3.5 h-3.5 shrink-0 opacity-80 hidden sm:block" />
          ) : (
            <ListMusic className="w-3.5 h-3.5 shrink-0 opacity-80 hidden sm:block" />
          )}

          {/* Total Commander Source Selector Dropdown */}
          <select
            aria-label={side === 'left' ? 'Zdroj levého okna' : 'Zdroj pravého okna'}
            value={sourceId}
            onChange={(e) => {
              onActivate();
              onChangeSource(e.target.value);
            }}
            className={`flex-1 min-w-0 max-w-xs rounded-lg px-2 py-1 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 cursor-pointer transition truncate ${
              isActive
                ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25 focus:ring-white/60 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white'
                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
            }`}
          >
            <option value="library">
              Knihovna skladeb ({totalLibraryCount})
            </option>
            <optgroup label="Setlisty">
              {allSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} ({set.songIds.length})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Compact Right Stats */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasFilter && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold ${
                isActive
                  ? 'bg-amber-300 text-amber-950'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
              }`}
              title="V tomto okně je aktivní vyhledávání nebo filtr"
            >
              <Filter className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Filtr</span>
            </span>
          )}

          {selectedKeys.size > 0 && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums ${
                isActive
                  ? 'bg-white text-indigo-700 dark:bg-indigo-500 dark:text-white'
                  : 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-200'
              }`}
            >
              {selectedKeys.size} vybr.
            </span>
          )}

          <span
            className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-mono font-bold tabular-nums ${
              isActive
                ? 'bg-black/20 text-white'
                : 'bg-slate-200/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300'
            }`}
            title={
              hasFilter
                ? `Zobrazeno ${rows.length} z ${totalSourceCount} skladeb`
                : `Počet skladeb: ${totalSourceCount}`
            }
          >
            {hasFilter ? `${rows.length}/${totalSourceCount}` : totalSourceCount}
          </span>

          {!isLibrary && (
            <span
              className={`hidden sm:inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold tabular-nums ${
                isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
              }`}
              title={`Odhadovaný čas hraní: cca ${totalMinutes} minut`}
            >
              <Clock className="w-3 h-3" />
              <span>{totalMinutes}m</span>
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Song List Body */}
      <div
        role="listbox"
        aria-multiselectable="true"
        className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200/75 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60"
      >
        {isLibrary && totalLibraryCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center p-6 text-slate-500 dark:text-slate-400">
            <HardDrive className="w-9 h-9 text-indigo-500 dark:text-indigo-400 mb-3" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Knihovna je zatím prázdná
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-4">
              Načtěte repertoár kapely z centrální Google Drive databáze.
            </p>
            {onSyncDatabase && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSyncDatabase();
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                <span>Načíst databázi z Google Disku</span>
              </button>
            )}
          </div>
        ) : totalSourceCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center p-6 text-slate-500">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2.5">
              <Music className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Set je zatím prázdný
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
              Označte jednu nebo více skladeb v druhém okně a klikněte nahoře na{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">Kopírovat</strong>.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-slate-500 dark:text-slate-400">
            <p className="text-sm font-medium">
              Nenalezena žádná skladba odpovídající filtru.
            </p>
            {onClearFilter && hasFilter && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilter();
                }}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Zrušit filtr v tomto okně</span>
              </button>
            )}
          </div>
        ) : !isLibrary && canDragReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {rows.map((row, visibleIndex) => (
                <SortablePaneRow
                  key={sortableIds[visibleIndex]}
                  sortableId={sortableIds[visibleIndex]}
                  row={row}
                  visibleIndex={visibleIndex}
                  isLibrary={false}
                  isSelected={selectedKeys.has(row.rowKey)}
                  isActivePane={isActive}
                  canDrag={true}
                  inTargetSet={false}
                  onToggle={onToggleRow}
                  onOpenManualPair={onOpenManualPair}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          rows.map((row, visibleIndex) => (
            <SongRowContent
              key={`${side}-${row.songId}-${row.rowKey}`}
              row={row}
              visibleIndex={visibleIndex}
              isLibrary={isLibrary}
              isSelected={selectedKeys.has(row.rowKey)}
              isActivePane={isActive}
              canDrag={false}
              inTargetSet={Boolean(targetSetSongIds && targetSetSongIds.has(row.songId))}
              targetSetName={targetSetName}
              assignedInSetName={assignedSongIds.get(row.songId)}
              onToggle={onToggleRow}
              onOpenManualPair={onOpenManualPair}
            />
          ))
        )}
      </div>
    </section>
  );
};
