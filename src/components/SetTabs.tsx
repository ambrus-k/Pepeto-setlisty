import React from 'react';
import { Plus, X } from 'lucide-react';
import { SetlistGroup } from '../types';

export type PaneSide = 'left' | 'right';

interface SetTabsProps {
  sets: SetlistGroup[];
  leftSourceId: string;
  rightSourceId: string;
  activePane: PaneSide;
  onSelectSet: (id: string) => void;
  onAddSet: () => void;
  onDeleteSet: (id: string) => void;
}

export const SetTabs: React.FC<SetTabsProps> = ({
  sets,
  leftSourceId,
  rightSourceId,
  activePane,
  onSelectSet,
  onAddSet,
  onDeleteSet,
}) => {
  const activeSourceId = activePane === 'left' ? leftSourceId : rightSourceId;
  const canCloseDynamic = sets.length > 1;

  const renderPaneBadges = (setId: string, isActive: boolean, isLightActive: boolean) => {
    const inLeft = leftSourceId === setId;
    const inRight = rightSourceId === setId;
    if (!inLeft && !inRight) return null;

    const badgeClass = (isOwnActivePane: boolean) =>
      isOwnActivePane
        ? isLightActive
          ? 'bg-black/25 text-black'
          : 'bg-white/25 text-white'
        : isActive
        ? isLightActive
          ? 'bg-black/15 text-black/80'
          : 'bg-white/15 text-white/85'
        : 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-200';

    return (
      <span className="inline-flex items-center gap-0.5 shrink-0">
        {inLeft && (
          <span
            className={`px-1 rounded text-[0.5625rem] font-extrabold leading-tight ${badgeClass(
              activePane === 'left'
            )}`}
            title="Otevřeno v levém okně"
          >
            L
          </span>
        )}
        {inRight && (
          <span
            className={`px-1 rounded text-[0.5625rem] font-extrabold leading-tight ${badgeClass(
              activePane === 'right'
            )}`}
            title="Otevřeno v pravém okně"
          >
            P
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-4 py-1 transition-colors">
      <div className="max-w-[1600px] mx-auto flex flex-nowrap items-center gap-1.5 overflow-x-auto horizontal-scroll-row whitespace-nowrap py-0.5">
        {/* All sets rendered in exact user-defined order */}
        {sets.map((set) => {
          const isActive = set.id === activeSourceId;
          const isOpenInOther =
            !isActive && (set.id === leftSourceId || set.id === rightSourceId);
          const songCount = set.songIds.length;
          const customColor = set.color;
          const isLidovky = set.isFixed && set.name.toLowerCase().includes('lidovk');
          const effectiveColor = customColor || (isLidovky ? '#fef08a' : undefined);
          const isLightActive = Boolean(effectiveColor);
          const showCloseBtn = !set.isFixed && canCloseDynamic;

          return (
            <div
              key={set.id}
              onClick={() => onSelectSet(set.id)}
              onMouseDown={(e) => {
                if (e.button === 1 && showCloseBtn) {
                  e.preventDefault();
                  onDeleteSet(set.id);
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1 && showCloseBtn) {
                  e.preventDefault();
                  onDeleteSet(set.id);
                }
              }}
              style={
                effectiveColor
                  ? isActive
                    ? {
                        backgroundColor: effectiveColor,
                        color: '#000000',
                        borderColor: effectiveColor,
                      }
                    : { borderColor: `${effectiveColor}99` }
                  : undefined
              }
              className={`group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer select-none border shrink-0 ${
                isActive
                  ? effectiveColor
                    ? 'shadow-sm font-bold ring-1 ring-black/20'
                    : 'bg-indigo-600 border-indigo-500 text-white shadow-sm font-bold shadow-indigo-600/25'
                  : isOpenInOther
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                  : isLidovky
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  : 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/90 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={`${set.name} (${songCount} skladeb)\n• Kliknutím otevřete v aktivním (${
                activePane === 'left' ? 'levém' : 'pravém'
              }) okně`}
            >
              {effectiveColor && (
                <span
                  className="w-2 h-2 rounded-full border border-black/25 shrink-0"
                  style={{ backgroundColor: effectiveColor }}
                />
              )}

              <span className="truncate max-w-[9rem]">{set.name}</span>

              <span
                className={`rounded-md px-1 py-0.2 text-[0.625rem] font-mono font-bold leading-tight ${
                  isActive
                    ? isLightActive
                      ? 'bg-black/20 text-black'
                      : 'bg-indigo-800/90 text-indigo-100'
                    : 'bg-slate-200 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                }`}
              >
                {songCount}
              </span>

              {renderPaneBadges(set.id, isActive, isLightActive)}

              {showCloseBtn && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSet(set.id);
                  }}
                  className={`-mr-1 ml-0.5 p-0.5 rounded transition cursor-pointer ${
                    isActive
                      ? isLightActive
                        ? 'text-black/60 hover:text-black hover:bg-black/15'
                        : 'text-indigo-200 hover:text-white hover:bg-indigo-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-300/70 dark:hover:bg-slate-700'
                  }`}
                  title={`Zavřít ${set.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* [+ Přidat list] button */}
        <button
          type="button"
          onClick={onAddSet}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition cursor-pointer shrink-0"
          title="Přidat další list do setlistu"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Přidat list</span>
        </button>
      </div>
    </div>
  );
};
