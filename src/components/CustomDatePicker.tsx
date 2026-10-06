import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {label && (
        <label className="text-slate-300 font-semibold block uppercase text-[10px] mb-1">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-left font-mono text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
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

      {/* Pop-up Calendar Dropdown Overlay */}
      {isOpen && (
        <div className="absolute left-0 mt-2 z-50 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl shadow-black/80 w-72 sm:w-80 space-y-3 animate-fadeIn">
          {/* Header Navigation */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-xs font-bold text-white font-display tracking-tight flex items-center gap-1">
              <span>{MONTH_NAMES[viewMonth]}</span>
              <span className="text-emerald-400 font-mono">{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map(w => (
              <span key={w} className="text-[10px] font-bold text-slate-500 font-mono tracking-wider">
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
                    className="h-8 flex items-center justify-center text-[11px] text-slate-700 font-mono select-none"
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
                  className={`h-8 w-8 mx-auto flex items-center justify-center text-xs font-mono rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/60 ring-2 ring-emerald-400'
                      : isToday
                      ? 'border border-emerald-500/80 text-emerald-300 font-bold bg-emerald-950/30 hover:bg-slate-800'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-mono"
            >
              <Check className="w-3 h-3" />
              <span>Hoje</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
