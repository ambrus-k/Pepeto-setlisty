import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  X,
  Music,
  Clock,
  Trash2,
  MoveRight,
  GripVertical,
} from 'lucide-react';
import { SetlistGroup, Song } from '../types';

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
}

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
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const songCount = activeSet.songIds.length;
  // Estimate ~3.5 minutes per song + 30s transition
  const totalMinutes = Math.round(songCount * 3.75);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderSong(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>{activeSet.name}</span>
            </h2>
            <span className="rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-bold text-xs px-2 py-0.5">
              {songCount} skladeb
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Čas hraní cca: {totalMinutes > 0 ? `${totalMinutes} min` : '0 min'}</span>
          </div>
        </div>

        {songCount > 0 && (
          <button
            onClick={onClearSet}
            className="flex items-center gap-1 rounded-lg border border-slate-700 hover:border-rose-500/50 bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 px-2.5 py-1 text-xs transition"
            title="Vyprázdnit tento set"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vysypat set</span>
          </button>
        )}
      </div>

      {/* Song List in Set */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        {songCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Music className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">Set je zatím prázdný</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Kliknutím na skladby v pravém sloupci (Knihovna) je sem okamžitě přidáte.
            </p>
          </div>
        ) : (
          activeSet.songIds.map((songId, index) => {
            const song = songsMap.get(songId);
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;

            return (
              <div
                key={`${songId}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-2 rounded-xl p-2.5 border transition-all ${
                  isDragging
                    ? 'opacity-40 scale-95 border-indigo-500 bg-indigo-950/20'
                    : isOver
                    ? 'border-indigo-400 bg-slate-800/90'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 shadow-sm'
                }`}
              >
                {/* Drag handle */}
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5"
                  title="Přetažením změňte pořadí"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Song number in set */}
                <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-slate-400">
                  {index + 1}.
                </span>

                {/* Main Song Pill with exact colors from XLSX */}
                <div
                  className="flex-1 min-w-0 rounded-lg px-3 py-1.5 shadow-sm border border-black/20 flex flex-col justify-center"
                  style={{
                    backgroundColor: song ? song.bgColor : '#ffffff',
                    color: song ? song.textColor : '#000000',
                  }}
                >
                  <div className="font-bold text-sm truncate tracking-tight">
                    {(() => {
                      const title = song ? song.pdf_title : `Skladba #${songId}`;
                      const saxRegex = /(-?\s*(?:ALT|TENOR)\s*Sax\w*)/i;
                      if (!saxRegex.test(title)) return title;
                      const parts = title.split(saxRegex);
                      return (
                        <span>
                          {parts.map((part, idx) =>
                            saxRegex.test(part) ? (
                              <span key={idx} className="font-bold text-rose-600">
                                {part}
                              </span>
                            ) : (
                              <span key={idx}>{part}</span>
                            )
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  <div
                    className="flex items-center gap-2 text-[11px] font-medium truncate mt-0.5 opacity-85"
                    style={{ color: song ? song.textColor : '#000000' }}
                  >
                    <span className="font-mono font-bold">ID: {song ? song.id : songId}</span>
                    {song?.mss_title && (
                      <>
                        <span>•</span>
                        <span className="truncate">XML: {song.mss_title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Reorder and Action controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Move Up */}
                  <button
                    onClick={() => onMoveSongUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition"
                    title="Posunout nahoru"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={() => onMoveSongDown(index)}
                    disabled={index === songCount - 1}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition"
                    title="Posunout dolů"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Move to another set dropdown */}
                  {allSets.length > 1 && (
                    <div className="relative group/set">
                      <button
                        className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-700 transition"
                        title="Přesunout do jiného setu"
                      >
                        <MoveRight className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 hidden group-hover/set:flex flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-20 min-w-[120px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1">
                          Přesunout do:
                        </span>
                        {allSets
                          .filter((s) => s.id !== activeSet.id)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => onMoveSongToSet(index, s.id)}
                              className="px-3 py-1 text-left text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition"
                            >
                              {s.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Remove (Křížek) */}
                  <button
                    onClick={() => onRemoveSong(index)}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition ml-0.5"
                    title="Odstranit ze setu"
                  >
                    <X className="w-4 h-4" />
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
