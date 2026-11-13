import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ArrowUp,
  ArrowDown,
  X,
  Music,
  Clock,
  Trash2,
  MoveRight,
  GripVertical,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { SetlistGroup, Song } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';

interface ActiveSetColumnProps {
  activeSet: SetlistGroup;
  songsMap: Map<number, Song>;
  allSets: SetlistGroup[];
  onMoveSongUp: (index: number) => void;
  onMoveSongDown: (index: number) => void;
  onRemoveSong: (index: number) => void;
  onMoveSongToSet: (fromIndex: number, targetSetId: string) => void;
  onClearSet: () => void;
  onReorderSong: (dragIndex: number, hoverIndex: number) => void;
  onOpenManualPair?: (song: Song) => void;
}

interface MoveMenuState {
  itemId: string;
  index: number;
  top: number;
  right: number;
  openUpward: boolean;
}

interface SortableRowProps {
  itemId: string;
  songId: number;
  index: number;
  song?: Song;
  songCount: number;
  hasOtherSets: boolean;
  isMoveMenuOpen: boolean;
  onMoveSongUp: (index: number) => void;
  onMoveSongDown: (index: number) => void;
  onRemoveSong: (index: number) => void;
  onOpenMoveMenu: (state: MoveMenuState) => void;
  onCloseMoveMenu: () => void;
  onOpenManualPair?: (song: Song) => void;
  otherSetsCount: number;
}

const SortableSongRow: React.FC<SortableRowProps> = ({
  itemId,
  songId,
  index,
  song,
  songCount,
  hasOtherSets,
  isMoveMenuOpen,
  onMoveSongUp,
  onMoveSongDown,
  onRemoveSong,
  onOpenMoveMenu,
  onCloseMoveMenu,
  onOpenManualPair,
  otherSetsCount,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isUnmatched = Boolean(song?.isUnmatched || songId < 0);
  const title = song
    ? cleanTitleForPdf(song.pdf_title, song.id)
    : (songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`);
  const saxRegex = /(\s*[-–—]?\s*(?:ALT|TENOR|SOPR[AÁ]N|BARYTON)\s*Sax.*)/i;

  const handleToggleMoveMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isMoveMenuOpen) {
      onCloseMoveMenu();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight = Math.min(240, otherSetsCount * 36 + 36);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    onOpenMoveMenu({
      itemId,
      index,
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
      openUpward,
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 transition-colors select-none ${
        isDragging
          ? 'opacity-70 scale-[1.01] bg-indigo-100 dark:bg-indigo-950/70 shadow-lg z-30 ring-1 ring-indigo-500 rounded'
          : isUnmatched
          ? 'bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-950/30'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
      }`}
    >
      {/* Touch-optimized Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700/50"
        title="Uchopte a táhněte pro změnu pořadí"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Song number in set */}
      <span className="w-5 shrink-0 text-right font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
        {index + 1}.
      </span>

      {/* Main Song Pill with authentic colors from Excel or warning highlight if unmatched */}
      <div
        className={`flex-1 min-w-0 rounded px-2.5 py-1 shadow-xs flex items-center justify-between gap-2 transition ${
          isUnmatched
            ? 'border border-amber-500/80 ring-1 ring-amber-500/60 shadow-amber-950/30'
            : 'border border-black/15'
        }`}
        style={{
          backgroundColor: isUnmatched ? '#fef3c7' : (song ? song.bgColor : '#ffffff'),
          color: isUnmatched ? '#78350f' : (song ? song.textColor : '#000000'),
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-xs shrink-0 opacity-75">
            {songId < 0 ? '?' : `#${song ? song.id : songId}`}
          </span>
          <div className="font-bold text-xs sm:text-sm truncate tracking-tight">
            {!saxRegex.test(title) ? (
              title
            ) : (
              <span>
                {title.split(saxRegex).map((part, idx) =>
                  saxRegex.test(part) ? (
                    <span key={idx} className="font-bold text-rose-600">
                      {part}
                    </span>
                  ) : (
                    <span key={idx}>{part}</span>
                  )
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Unmatched warning badge with pairing trigger */}
          {isUnmatched ? (
            <button
              type="button"
              onClick={() =>
                onOpenManualPair?.(
                  song || {
                    id: songId,
                    pdf_title: title,
                    mss_title: title,
                    textColor: '#000000',
                    bgColor: '#ffffff',
                    isUnmatched: true,
                  }
                )
              }
              className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[0.625rem] px-2 py-0.5 shadow-sm transition active:scale-95 cursor-pointer"
              title="Skladba nebyla 100% nalezena v databázi – klikněte pro ruční spárování"
            >
              <AlertTriangle className="w-3 h-3 text-amber-200" />
              <span>Spárovat</span>
            </button>
          ) : (
            song && (
              <>
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
              </>
            )
          )}
        </div>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Move Up */}
        <button
          type="button"
          onClick={() => onMoveSongUp(index)}
          disabled={index === 0}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
          title="Posunout nahoru"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Move Down */}
        <button
          type="button"
          onClick={() => onMoveSongDown(index)}
          disabled={index === songCount - 1}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
          title="Posunout dolů"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        {/* Move to another set */}
        {hasOtherSets && (
          <button
            type="button"
            onClick={handleToggleMoveMenu}
            aria-expanded={isMoveMenuOpen}
            aria-haspopup="menu"
            className={`p-1 rounded transition cursor-pointer ${
              isMoveMenuOpen
                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Přesunout do jiného setu"
          >
            <MoveRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove */}
        <button
          type="button"
          onClick={() => onRemoveSong(index)}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer"
          title="Odstranit ze setu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ActiveSetColumn: React.FC<ActiveSetColumnProps> = ({
  activeSet,
  songsMap,
  allSets,
  onMoveSongUp,
  onMoveSongDown,
  onRemoveSong,
  onMoveSongToSet,
  onClearSet,
  onReorderSong,
  onOpenManualPair,
}) => {
  const songCount = activeSet.songIds.length;
  const totalMinutes = Math.round(songCount * 3.75);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [moveMenu, setMoveMenu] = useState<MoveMenuState | null>(null);
  const otherSets = allSets.filter((s) => s.id !== activeSet.id);

  useEffect(() => {
    setIsConfirmingClear(false);
    setMoveMenu(null);
  }, [activeSet.id, songCount]);

  useEffect(() => {
    if (!moveMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoveMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveMenu]);

  // Setup touch and pointer sensors for mobile, tablet, and desktop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // allows clicking without accidental drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold for touch on tablets prevents scroll jitter
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Item keys for dnd-kit
  const items = activeSet.songIds.map((id, index) => `item-${id}-${index}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderSong(oldIndex, newIndex);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>{activeSet.name}</span>
            </h2>
            <span className="rounded-lg bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs px-2 py-0.5">
              {songCount} skladeb
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Čas hraní cca: {totalMinutes > 0 ? `${totalMinutes} min` : '0 min'}</span>
          </div>
        </div>

        {songCount > 0 && (
          isConfirmingClear ? (
            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/90 border border-rose-300 dark:border-rose-500/60 rounded-xl p-1 animate-fadeIn shadow-lg">
              <span className="text-[0.6875rem] text-rose-700 dark:text-rose-200 font-bold pl-1.5 whitespace-nowrap">
                Vysypat set?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearSet();
                  setIsConfirmingClear(false);
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
              >
                Ano
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg transition cursor-pointer"
              >
                Zrušit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 bg-slate-100 dark:bg-slate-800/70 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-200 px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
              title="Vyprázdnit tento set"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Vysypat set</span>
            </button>
          )
        )}
      </div>

      {/* Song List in Set with Touch-Optimized SortableContext */}
      <div
        onScroll={() => {
          if (moveMenu) setMoveMenu(null);
        }}
        className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200/80 dark:divide-slate-800/80 bg-white dark:bg-slate-900/50"
      >
        {songCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Music className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set je zatím prázdný</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Kliknutím na skladby v pravém sloupci (Knihovna) je sem okamžitě přidáte.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {activeSet.songIds.map((songId, index) => {
                const song = songsMap.get(songId);
                const itemId = items[index];

                return (
                  <SortableSongRow
                    key={itemId}
                    itemId={itemId}
                    songId={songId}
                    index={index}
                    song={song}
                    songCount={songCount}
                    hasOtherSets={otherSets.length > 0}
                    otherSetsCount={otherSets.length}
                    isMoveMenuOpen={moveMenu?.itemId === itemId}
                    onMoveSongUp={onMoveSongUp}
                    onMoveSongDown={onMoveSongDown}
                    onRemoveSong={onRemoveSong}
                    onOpenMoveMenu={setMoveMenu}
                    onCloseMoveMenu={() => setMoveMenu(null)}
                    onOpenManualPair={onOpenManualPair}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Portal menu for moving song to another set (works on touch/Android & never clipped by overflow) */}
      {moveMenu &&
        otherSets.length > 0 &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-50"
              onClick={() => setMoveMenu(null)}
            />
            <div
              role="menu"
              style={{
                position: 'fixed',
                right: moveMenu.right,
                ...(moveMenu.openUpward
                  ? { bottom: window.innerHeight - moveMenu.top }
                  : { top: moveMenu.top }),
              }}
              className="z-50 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 min-w-[8.5rem] max-h-60 overflow-y-auto animate-fadeIn"
            >
              <span className="text-[0.625rem] uppercase font-bold text-slate-500 dark:text-slate-400 px-3 py-1">
                Přesunout do:
              </span>
              {otherSets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onMoveSongToSet(moveMenu.index, s.id);
                    setMoveMenu(null);
                  }}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white active:bg-indigo-700 active:text-white transition cursor-pointer"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
