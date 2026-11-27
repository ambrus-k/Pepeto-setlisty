import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatCzechDate, isValidIsoDate } from '../utils/eventMetadata';

interface EventDatePickerProps {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  title?: string;
  ariaLabel?: string;
  hasWarning?: boolean;
  size?: 'compact' | 'md';
  className?: string;
}

const CZECH_MONTHS = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
];

const CZECH_WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export const EventDatePicker: React.FC<EventDatePickerProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Datum',
  title,
  ariaLabel = 'Datum akce',
  hasWarning = false,
  size = 'compact',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const initialYm = useMemo(() => {
    if (isValidIsoDate(value)) {
      const [y, m] = value.split('-').map((p) => parseInt(p, 10));
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialYm.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYm.month);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = () => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 264; // 16.5rem
    const popoverHeight = 310;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= popoverHeight + 8 || spaceBelow >= rect.top
        ? Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - popoverHeight - 8))
        : Math.max(8, rect.top - popoverHeight - 6);
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - popoverWidth - 8)
    );
    setPopoverCoords({ top, left });
  };

  const handleToggle = () => {
    if (!isOpen) {
      setViewYear(initialYm.year);
      setViewMonth(initialYm.month);
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const jsDay = firstOfMonth.getDay(); // 0 (Sun) .. 6 (Sat)
    const mondayOffset = (jsDay + 6) % 7; // 0 (Mon) .. 6 (Sun)
    const gridStartDay = 1 - mondayOffset;

    const cells: Array<{
      iso: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
    }> = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(viewYear, viewMonth, gridStartDay + i);
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const colIdx = i % 7;
      cells.push({
        iso,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === viewMonth && d.getFullYear() === viewYear,
        isWeekend: colIdx === 5 || colIdx === 6,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const yearOptions = useMemo(() => {
    const minYear = Math.min(2024, viewYear);
    const maxYear = Math.max(2032, viewYear);
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(y);
    }
    return years;
  }, [viewYear]);

  const todayIso = getTodayIso();
  const displayLabel = isValidIsoDate(value) ? formatCzechDate(value) : '';

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
  };

  const sizeClasses =
    size === 'compact'
      ? 'px-2 py-1 text-xs sm:text-sm'
      : 'px-3 py-2 text-xs sm:text-sm';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={handleToggle}
        title={title}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${sizeClasses} ${
          hasWarning
            ? 'border-amber-400 dark:border-amber-500/80 text-amber-800 dark:text-amber-200'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/30 text-slate-900 dark:text-white'
            : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
        } ${className}`}
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className={`tabular-nums ${displayLabel ? '' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
          {displayLabel || placeholder}
        </span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Výběr data akce"
            style={{ top: popoverCoords.top, left: popoverCoords.left }}
            className="fixed z-[80] w-[16.5rem] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2.5 text-slate-900 dark:text-slate-100 animate-fadeIn select-none"
          >
            {/* Header: Month & Year Navigation */}
            <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Předchozí měsíc"
                aria-label="Předchozí měsíc"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                  aria-label="Měsíc"
                  className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {CZECH_MONTHS.map((mName, idx) => (
                    <option key={mName} value={idx}>
                      {mName}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                  aria-label="Rok"
                  className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Další měsíc"
                aria-label="Další měsíc"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday Header (Po .. Ne) */}
            <div className="grid grid-cols-7 gap-0.5 mb-1 text-center">
              {CZECH_WEEKDAYS.map((dayLabel, idx) => (
                <div
                  key={dayLabel}
                  className={`text-[0.65rem] font-bold uppercase py-0.5 ${
                    idx >= 5
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {dayLabel}
                </div>
              ))}
            </div>

            {/* 6x7 Clickable Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((cell) => {
                const isSelected = value === cell.iso;
                const isToday = todayIso === cell.iso;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => handleSelectDay(cell.iso)}
                    className={`h-7 w-full rounded-lg text-xs flex items-center justify-center transition cursor-pointer tabular-nums ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : isToday
                        ? 'ring-1 ring-indigo-500 text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                        : cell.isCurrentMonth
                        ? cell.isWeekend
                          ? 'text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-400 dark:text-slate-600 opacity-50 hover:opacity-80 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 text-[0.6875rem]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectDay(todayIso)}
                  className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 font-bold transition cursor-pointer"
                >
                  Dnes
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold transition cursor-pointer"
                    title="Vymazat vybrané datum"
                  >
                    <X className="w-3 h-3" />
                    <span>Vymazat</span>
                  </button>
                )}
              </div>

              <span className="text-[0.65rem] font-mono text-slate-400 dark:text-slate-500">
                Playlisty {viewYear}
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
