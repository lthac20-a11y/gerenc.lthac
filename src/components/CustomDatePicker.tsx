import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

export interface CustomDatePickerProps {
  value: string; // ISO 'YYYY-MM-DD' or BR 'DD/MM/YYYY'
  onChange: (formattedValue: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  format?: 'ISO' | 'BR'; // 'ISO' returns YYYY-MM-DD, 'BR' returns DD/MM/YYYY
  disabled?: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Selecione a data',
  required = false,
  className = '',
  format,
  disabled = false,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Robust mobile/touch detection
  const checkIsMobileOrTouch = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isTouch = 
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isSmallOrMediumScreen = window.innerWidth < 1024;
    return isTouch || isSmallOrMediumScreen;
  }, []);

  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobileOrTouch());
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Detect output format if not explicitly provided
  const targetFormat: 'ISO' | 'BR' = format || (value && value.includes('/') ? 'BR' : 'ISO');

  // Parse value into Date
  const parseValueToDate = (valStr: string): Date => {
    if (!valStr) return new Date();
    if (valStr.includes('-')) {
      const parts = valStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day);
        }
      }
    } else if (valStr.includes('/')) {
      const parts = valStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day);
        }
      } else if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = new Date().getFullYear();
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day);
        }
      }
    }
    return new Date();
  };

  const selectedDate = parseValueToDate(value);

  // State for popup navigation month/year
  const [viewYear, setViewYear] = useState<number>(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => selectedDate.getMonth());

  // Keep view in sync when value changes externally
  useEffect(() => {
    const d = parseValueToDate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  // Recalculate popup position on screen
  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const isMobileMode = checkIsMobileOrTouch();
    setIsMobile(isMobileMode);

    if (isMobileMode || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 380;
    const margin = 16;

    // Horizontal positioning: align with trigger left, but shift left if overflowing right
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - margin) {
      left = rect.right - popoverWidth;
    }
    // Clamp to screen edges
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    // Vertical positioning: check space below vs above
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top = rect.bottom + 6;

    if (spaceBelow < popoverHeight && spaceAbove >= popoverHeight) {
      // Open upwards cleanly if more room above
      top = rect.top - popoverHeight - 6;
    } else if (spaceBelow < popoverHeight) {
      // Clamp to bottom of viewport to avoid off-screen cutoff
      top = Math.max(margin, window.innerHeight - popoverHeight - margin);
    }

    // Safety clamp
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

    setCoords({ top, left });
  }, [checkIsMobileOrTouch]);

  // Update position on open, scroll, resize & handle click outside
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  // Format date for display button (e.g. 05/10/2026)
  const formatDisplay = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format Date object to output string (ISO or BR)
  const formatDateToOutput = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    if (targetFormat === 'BR') {
      return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`;
  };

  const handleSelectDay = (dayNum: number, isCurrentMonth: boolean, monthOffset: number = 0) => {
    if (!isCurrentMonth) return;
    const targetDate = new Date(viewYear, viewMonth + monthOffset, dayNum);
    onChange(formatDateToOutput(targetDate));
    setIsOpen(false);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(formatDateToOutput(today));
    setIsOpen(false);
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const isTodayMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
  const isSelectedMonth = selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth;

  // Build grid cells
  const gridCells: { day: number; currentMonth: boolean; isPrev?: boolean; isNext?: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    gridCells.push({ day: daysInPrevMonth - i, currentMonth: false, isPrev: true });
  }

  // Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    gridCells.push({ day, currentMonth: true });
  }

  // Next month leading days to complete 35 or 42 grid cells
  const totalCellsSoFar = gridCells.length;
  const totalGridCells = totalCellsSoFar > 35 ? 42 : 35;
  for (let day = 1; day <= totalGridCells - totalCellsSoFar; day++) {
    gridCells.push({ day, currentMonth: false, isNext: true });
  }

  // Common Calendar Content JSX
  const calendarContent = (
    <div className="space-y-3.5">
      {/* Header Navigation with Year selection */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
          title="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-xs sm:text-sm font-bold text-white font-display tracking-tight flex items-center gap-1.5">
          <span className="text-slate-100">{MONTH_NAMES[viewMonth]}</span>
          <select
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="bg-slate-800 hover:bg-slate-750 text-emerald-400 font-mono font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {[...Array(13)].map((_, idx) => {
              const yr = 2020 + idx;
              return (
                <option key={yr} value={yr} className="bg-slate-900 text-white">
                  {yr}
                </option>
              );
            })}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
          title="Próximo mês"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map(w => (
          <span key={w} className="text-[10px] font-bold text-slate-400 font-mono tracking-wider py-0.5">
            {w}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {gridCells.map((cell, idx) => {
          if (!cell.currentMonth) {
            return (
              <span
                key={`empty-${idx}`}
                className="h-8 sm:h-9 flex items-center justify-center text-[11px] text-slate-600 font-mono select-none"
              >
                {cell.day}
              </span>
            );
          }

          const isSelected =
            isSelectedMonth &&
            selectedDate.getDate() === cell.day;

          const isToday =
            isTodayMonth &&
            today.getDate() === cell.day;

          return (
            <button
              key={`day-${cell.day}`}
              type="button"
              onClick={() => handleSelectDay(cell.day, true)}
              className={`h-8 sm:h-9 w-8 sm:w-9 mx-auto flex items-center justify-center text-xs font-mono rounded-xl transition-all cursor-pointer min-h-[34px] min-w-[34px] active:scale-95 ${
                isSelected
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/60 ring-2 ring-emerald-400'
                  : isToday
                  ? 'border border-emerald-500/80 text-emerald-300 font-bold bg-emerald-950/40 hover:bg-slate-800'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer Action Bar */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
        <button
          type="button"
          onClick={handleSelectToday}
          className="px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 font-mono min-h-[38px] active:scale-95"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Hoje</span>
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer min-h-[38px] active:scale-95"
        >
          Fechar
        </button>
      </div>
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="text-slate-300 font-semibold block uppercase text-[10px] mb-1">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
          }
        }}
        className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-left font-mono text-xs flex items-center justify-between gap-2 transition-all cursor-pointer min-h-[40px] ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-lg shadow-emerald-950/40'
            : 'border-slate-700/80 hover:border-slate-600 text-slate-200 hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className={value ? 'text-white font-semibold' : 'text-slate-400 font-normal'}>
            {value ? formatDisplay(selectedDate) : placeholder}
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans border border-slate-700 shrink-0">
          Alterar
        </span>
      </button>

      {/* Pop-up Calendar via React Portal to prevent container clipping & overlapping */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          /* Mobile / Touch View: Centered dialog modal with dark backdrop (cannot be clipped by parent containers, zero overlapping) */
          <div 
            className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
            onClick={() => setIsOpen(false)}
          >
            <div
              ref={popupRef}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/95 w-full max-w-[340px] space-y-3.5 animate-scaleUp max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs sm:text-sm font-bold text-white font-display flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  {label || 'Selecionar Data'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[36px] min-w-[36px] p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-center transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {calendarContent}
            </div>
          </div>
        ) : (
          /* Desktop Mouse View: Fixed floating popover with click-catcher backdrop & full viewport clamping */
          <>
            {/* Click-catcher backdrop */}
            <div 
              className="fixed inset-0 z-[999998] bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={popupRef}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                zIndex: 999999,
              }}
              className="w-[320px] max-h-[calc(100vh-2rem)] overflow-y-auto bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl shadow-black/85 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                  {label || 'Selecionar Data'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {calendarContent}
            </div>
          </>
        ),
        document.body
      )}
    </div>
  );
};

