import React, { useState, useEffect } from 'react';
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
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  Copy,
  Eraser,
  Check,
  ListOrdered,
  Clock,
  Music,
  RotateCcw,
} from 'lucide-react';
import { SetlistGroup } from '../types';

interface SetlistManagerModalProps {
  isOpen: boolean;
  sets: SetlistGroup[];
  onClose: () => void;
  onSaveSets: (updatedSets: SetlistGroup[]) => void;
  onStartFresh: () => void;
}

const COLOR_PRESETS: { value: string | undefined; label: string; swatch: string }[] = [
  { value: undefined, label: 'Výchozí', swatch: '#6366f1' },
  { value: '#fef08a', label: 'Žlutá', swatch: '#fef08a' },
  { value: '#bae6fd', label: 'Modrá', swatch: '#bae6fd' },
  { value: '#bbf7d0', label: 'Zelená', swatch: '#bbf7d0' },
  { value: '#fecdd3', label: 'Růžová', swatch: '#fecdd3' },
  { value: '#fed7aa', label: 'Oranžová', swatch: '#fed7aa' },
  { value: '#ddd6fe', label: 'Fialová', swatch: '#ddd6fe' },
  { value: '#cbd5e1', label: 'Šedá', swatch: '#cbd5e1' },
];

interface SortableSetItemProps {
  set: SetlistGroup;
  index: number;
  totalCount: number;
  isColorOpen: boolean;
  onToggleColorPicker: () => void;
  onRename: (name: string) => void;
  onChangeColor: (color: string | undefined) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onClearSongs: () => void;
  onDelete: () => void;
  autoFocus?: boolean;
}

const SortableSetRow: React.FC<SortableSetItemProps> = ({
  set,
  index,
  totalCount,
  isColorOpen,
  onToggleColorPicker,
  onRename,
  onChangeColor,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onClearSongs,
  onDelete,
  autoFocus,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: set.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const songCount = set.songIds.length;
  const minutes = Math.round(songCount * 3.75);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition-colors ${
        isDragging
          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 shadow-lg z-30 opacity-90'
          : 'bg-slate-50/90 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 sm:p-2.5">
        {/* Drag Handle + Position Number */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            {...attributes}
            {...listeners}
            style={{ touchAction: 'none' }}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Uchopte a táhněte pro změnu pořadí setlistů"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <span className="w-5 text-right font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
            {index + 1}.
          </span>

          {/* Color Dot Picker Trigger */}
          <button
            type="button"
            onClick={onToggleColorPicker}
            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
              isColorOpen
                ? 'ring-2 ring-indigo-500 border-indigo-500'
                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
            }`}
            style={{ backgroundColor: set.color || '#6366f1' }}
            title="Změnit barvu štítku setlistu"
            aria-label={`Barva setlistu ${set.name}`}
          >
            {!set.color && (
              <span className="w-2 h-2 rounded-full bg-white/80" />
            )}
          </button>
        </div>

        {/* Editable Name Input */}
        <div className="flex-1 min-w-[10rem] flex items-center gap-2">
          <input
            type="text"
            value={set.name}
            autoFocus={autoFocus}
            onChange={(e) => onRename(e.target.value)}
            placeholder={`Set ${index + 1}`}
            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
        </div>

        {/* Song Count & Playtime Pill */}
        <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
          <span className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
            <Music className="w-3 h-3 text-indigo-500" />
            <span>{songCount}</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{minutes}m</span>
          </span>
        </div>

        {/* Action Buttons: Up, Down, Duplicate, Clear, Delete */}
        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            title="Posunout setlist nahoru"
            aria-label="Posunout nahoru"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            title="Posunout setlist dolů"
            aria-label="Posunout dolů"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
            title="Duplikovat setlist včetně jeho skladeb"
            aria-label="Duplikovat setlist"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClearSongs}
            disabled={songCount === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            title="Vyprázdnit všechny skladby v tomto setlistu"
            aria-label="Vyprázdnit setlist"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={totalCount <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            title="Smazat celý setlist"
            aria-label="Smazat setlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Inline Color Palette */}
      {isColorOpen && (
        <div className="px-3 pb-2.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/70 flex flex-wrap items-center gap-1.5 animate-fadeIn">
          <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Barva štítku:
          </span>
          {COLOR_PRESETS.map((preset) => {
            const isSelected = set.color === preset.value;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChangeColor(preset.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] font-semibold border transition cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/25 shrink-0"
                  style={{ backgroundColor: preset.swatch }}
                />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SetlistManagerModal: React.FC<SetlistManagerModalProps> = ({
  isOpen,
  sets,
  onClose,
  onSaveSets,
  onStartFresh,
}) => {
  const [draftSets, setDraftSets] = useState<SetlistGroup[]>([]);
  const [openColorId, setOpenColorId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftSets(sets.map((s) => ({ ...s, songIds: [...s.songIds] })));
      setOpenColorId(null);
      setNewlyAddedId(null);
      setIsConfirmingReset(false);
    }
  }, [isOpen, sets]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!isOpen) return null;

  const totalSongs = draftSets.reduce((sum, s) => sum + s.songIds.length, 0);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraftSets((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === String(active.id));
      const newIndex = prev.findIndex((s) => s.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const handleRename = (id: string, name: string) => {
    setDraftSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleChangeColor = (id: string, color: string | undefined) => {
    setDraftSets((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    setOpenColorId(null);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draftSets.length) return;
    setDraftSets((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleDuplicate = (index: number) => {
    const source = draftSets[index];
    if (!source) return;
    const copyId = `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone: SetlistGroup = {
      id: copyId,
      name: `${source.name.trim() || 'Set'} (kopie)`,
      songIds: [...source.songIds],
      color: source.color,
      isFixed: false,
    };
    setDraftSets((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
    setNewlyAddedId(copyId);
  };

  const handleClearSongs = (id: string) => {
    setDraftSets((prev) => prev.map((s) => (s.id === id ? { ...s, songIds: [] } : s)));
  };

  const handleDelete = (id: string) => {
    if (draftSets.length <= 1) return;
    setDraftSets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSet = () => {
    const newId = `set-${Date.now()}`;
    const nextNumber = draftSets.length + 1;
    const newSet: SetlistGroup = {
      id: newId,
      name: `Set ${nextNumber}`,
      songIds: [],
      isFixed: false,
    };
    setDraftSets((prev) => [...prev, newSet]);
    setNewlyAddedId(newId);
  };

  const handleSave = () => {
    const sanitized = draftSets.map((s, idx) => ({
      ...s,
      name: s.name.trim() || `Set ${idx + 1}`,
    }));
    onSaveSets(sanitized);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 dark:bg-black/80 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setlist-manager-title"
    >
      <div
        className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="setlist-manager-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight"
              >
                Správa a řazení setlistů
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Přejmenujte listy, změňte jejich pořadí, barvu nebo přidejte nové ({draftSets.length} listů · {totalSongs} skladeb)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Zavřít (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Editable List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2 overscroll-contain">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={draftSets.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {draftSets.map((set, idx) => (
                <SortableSetRow
                  key={set.id}
                  set={set}
                  index={idx}
                  totalCount={draftSets.length}
                  isColorOpen={openColorId === set.id}
                  onToggleColorPicker={() =>
                    setOpenColorId((prev) => (prev === set.id ? null : set.id))
                  }
                  onRename={(name) => handleRename(set.id, name)}
                  onChangeColor={(color) => handleChangeColor(set.id, color)}
                  onMoveUp={() => handleMove(idx, -1)}
                  onMoveDown={() => handleMove(idx, 1)}
                  onDuplicate={() => handleDuplicate(idx)}
                  onClearSongs={() => handleClearSongs(set.id)}
                  onDelete={() => handleDelete(set.id)}
                  autoFocus={newlyAddedId === set.id}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {isConfirmingReset && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/70 px-3 py-2 animate-fadeIn">
              <div className="text-xs text-rose-800 dark:text-rose-200">
                <strong className="font-bold">Začít od nuly?</strong> Vytvoří se prázdné{' '}
                <span className="font-semibold">Set 1–9, Lidovky (výchozí písně), Zbytek</span> a smaže se název akce.
              </div>
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(false)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingReset(false);
                    onStartFresh();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ano, začít znovu</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddSet}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-400 dark:border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-200 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Přidat nový setlist</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmingReset((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer active:scale-95 ${
                  isConfirmingReset
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'border-rose-300 dark:border-rose-700/70 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                }`}
                title="Vymazat název setlistu a vytvořit prázdné Set 1–9, Lidovky (výchozí písně) a Zbytek"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Začít znovu</span>
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Uložit změny</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
