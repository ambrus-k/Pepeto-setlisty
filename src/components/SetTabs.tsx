import React from 'react';
import { Plus, X } from 'lucide-react';
import { SetlistGroup } from '../types';

interface SetTabsProps {
  sets: SetlistGroup[];
  activeSetId: string;
  onSelectSet: (id: string) => void;
  onAddSet: () => void;
  onDeleteSet: (id: string) => void;
}

export const SetTabs: React.FC<SetTabsProps> = ({
  sets,
  activeSetId,
  onSelectSet,
  onAddSet,
  onDeleteSet,
}) => {
  // Separate dynamic sets from fixed sets
  const dynamicSets = sets.filter((s) => !s.isFixed);
  const fixedSets = sets.filter((s) => s.isFixed);

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 sm:px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-1 sm:gap-1.5">
        {/* Dynamic sets: List 1, List 2, List 3... */}
        {dynamicSets.map((set) => {
          const isActive = set.id === activeSetId;
          const songCount = set.songIds.length;
          const customColor = set.color;

          return (
            <div
              key={set.id}
              onClick={() => onSelectSet(set.id)}
              onMouseDown={(e) => {
                // Middle click (scroll wheel click) closes the tab like in browser
                if (e.button === 1 && dynamicSets.length > 1) {
                  e.preventDefault();
                  onDeleteSet(set.id);
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1 && dynamicSets.length > 1) {
                  e.preventDefault();
                  onDeleteSet(set.id);
                }
              }}
              style={
                customColor
                  ? isActive
                    ? { backgroundColor: customColor, color: '#000000', borderColor: customColor }
                    : { borderColor: `${customColor}60` }
                  : undefined
              }
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer select-none border shrink-0 ${
                isActive
                  ? customColor
                    ? 'shadow-sm font-bold ring-1 ring-black/20'
                    : 'bg-indigo-600 border-indigo-500 text-white shadow-sm font-bold shadow-indigo-600/30'
                  : 'bg-slate-800/90 border-slate-700/80 text-slate-300 hover:bg-slate-700/90 hover:text-white hover:border-slate-600'
              }`}
              title={`${set.name} (${songCount} skladeb)\n• Klikněte pro výběr\n• Klikněte kolečkem myši pro zavření listu`}
            >
              {customColor && (
                <span
                  className="w-2 h-2 rounded-full border border-black/25 shrink-0"
                  style={{ backgroundColor: customColor }}
                />
              )}

              <span className="truncate max-w-[120px]">{set.name}</span>

              {/* Compact song count badge */}
              <span
                className={`rounded-md px-1 py-0.2 text-[10px] font-mono font-bold leading-tight ${
                  isActive
                    ? customColor
                      ? 'bg-black/20 text-black'
                      : 'bg-indigo-800/90 text-indigo-100'
                    : 'bg-slate-900/80 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {songCount}
              </span>

              {/* Browser tab style close cross */}
              {dynamicSets.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSet(set.id);
                  }}
                  className={`-mr-1 ml-0.5 p-0.5 rounded transition ${
                    isActive
                      ? customColor
                        ? 'text-black/60 hover:text-black hover:bg-black/15'
                        : 'text-indigo-200 hover:text-white hover:bg-indigo-700'
                      : 'text-slate-400 hover:text-rose-400 hover:bg-slate-700'
                  }`}
                  title={`Zavřít ${set.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* [+ Přidat list] button - compact */}
        <button
          onClick={onAddSet}
          className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-indigo-950/40 px-2 py-1 text-xs font-semibold text-slate-400 hover:text-indigo-300 transition cursor-pointer shrink-0"
          title="Přidat další list do setlistu"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Přidat list</span>
        </button>

        {/* Divider before fixed sets */}
        {fixedSets.length > 0 && <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />}

        {/* Fixed sets: [Lidovky], [Zbytek] */}
        {fixedSets.map((set) => {
          const isActive = set.id === activeSetId;
          const songCount = set.songIds.length;
          const isLidovky = set.name.toLowerCase().includes('lidovk');
          const color = set.color || (isLidovky ? '#fef08a' : '#cbd5e1');

          return (
            <div
              key={set.id}
              onClick={() => onSelectSet(set.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer select-none border shrink-0 ${
                isActive
                  ? isLidovky
                    ? 'bg-amber-300 border-amber-400 text-amber-950 shadow-sm font-bold'
                    : 'bg-slate-700 border-slate-600 text-white shadow-sm font-bold'
                  : isLidovky
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200 hover:bg-amber-900/50'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700/90 hover:text-white'
              }`}
              title={`${set.name} (${songCount} skladeb)`}
            >
              <span
                className="w-2 h-2 rounded-full border border-black/30 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>{set.name}</span>
              <span
                className={`rounded-md px-1 py-0.2 text-[10px] font-mono font-bold leading-tight ${
                  isActive
                    ? isLidovky
                      ? 'bg-amber-950/20 text-amber-950'
                      : 'bg-black/30 text-white'
                    : isLidovky
                    ? 'bg-amber-900/60 text-amber-200'
                    : 'bg-slate-900/80 text-slate-400'
                }`}
              >
                {songCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
