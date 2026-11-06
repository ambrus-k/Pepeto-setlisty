import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  // Separate dynamic sets from the two fixed sets at the end
  const dynamicSets = sets.filter((s) => !s.isFixed);
  const fixedSets = sets.filter((s) => s.isFixed);

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          {/* Dynamic sets: Set 1, Set 2, Set 3... */}
          {dynamicSets.map((set) => {
            const isActive = set.id === activeSetId;
            const songCount = set.songIds.length;
            const customColor = set.color;

            return (
              <div key={set.id} className="relative group flex items-center">
                <button
                  onClick={() => onSelectSet(set.id)}
                  style={
                    customColor
                      ? isActive
                        ? { backgroundColor: customColor, color: '#000000', borderColor: customColor }
                        : { borderColor: `${customColor}80` }
                      : undefined
                  }
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all border ${
                    isActive
                      ? customColor
                        ? 'shadow-md font-bold'
                        : 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                  }`}
                >
                  {customColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: customColor }}
                    />
                  )}
                  <span>{set.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      isActive
                        ? customColor
                          ? 'bg-black/20 text-black'
                          : 'bg-indigo-800/80 text-indigo-100'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {songCount}
                  </span>
                </button>

                {/* Allow deleting dynamic sets beyond Set 1 if empty or with click */}
                {dynamicSets.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSet(set.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-rose-400 ml-0.5 rounded"
                    title={`Smazat ${set.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* [+ Přidat set] button */}
          <button
            onClick={onAddSet}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-indigo-950/40 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-300 hover:text-indigo-300 transition"
            title="Přidat další set (např. Set 3)"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Přidat set</span>
          </button>
        </div>

        {/* Fixed sets at end: [Lidovky] (Yellow as in PDF), [Zbytek] */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
          {fixedSets.map((set) => {
            const isActive = set.id === activeSetId;
            const songCount = set.songIds.length;
            const isLidovky = set.name.toLowerCase().includes('lidovk');
            const color = set.color || (isLidovky ? '#fef08a' : '#cbd5e1');

            return (
              <button
                key={set.id}
                onClick={() => onSelectSet(set.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all border ${
                  isActive
                    ? isLidovky
                      ? 'bg-amber-300 border-amber-400 text-amber-950 shadow-md shadow-amber-300/30 font-bold'
                      : 'bg-slate-700 border-slate-600 text-white shadow-md shadow-slate-700/30'
                    : isLidovky
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:bg-amber-900/50'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/30 shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{set.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    isActive
                      ? isLidovky
                        ? 'bg-amber-950/20 text-amber-950'
                        : 'bg-black/30 text-white'
                      : isLidovky
                      ? 'bg-amber-900/80 text-amber-200'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {songCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
