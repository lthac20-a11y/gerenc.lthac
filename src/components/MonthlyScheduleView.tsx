import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Plus, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  ShieldAlert, 
  Repeat, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  User, 
  Printer, 
  FileText, 
  ExternalLink,
  ChevronDown,
  Layers,
  CalendarDays,
  Grid3X3,
  Sparkles
} from 'lucide-react';
import { Member, LeagueConfig, ShiftRecord, RoleInLeague } from '../types/league';
import { 
  getCurrentYear, 
  getCurrentMonthIndex, 
  formatMonthKey, 
  formatFullMonthYear, 
  parseMonthKey, 
  getDaysInMonth, 
  getMonthColumnsForYear, 
  getQuartersForYear,
  SHORT_MONTH_NAMES,
  FULL_MONTH_NAMES 
} from '../utils/dateUtils';
import { 
  checkCertificateEligibility, 
  calculateActiveTime, 
  calculateReplacementDeadline,
  syncMemberReplacementsDeadlines,
  parseDateToShiftParts
} from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';
import { CustomDatePicker } from './CustomDatePicker';

interface MonthlyScheduleViewProps {
  members: Member[];
  config?: LeagueConfig;
  onSelectMember: (member: Member) => void;
  onUpdateMember?: (updated: Member) => void;
  onOpenAddShift: () => void;
  onOpenCertificateModal?: (member: Member) => void;
}

type ViewMode = 'monthly' | 'quarterly' | 'annual';

function parseShiftDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d).getTime();
    }
  }
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      return new Date(y, m, d).getTime();
    } else if (parts.length === 2) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = getCurrentYear();
      return new Date(y, m, d).getTime();
    }
  }
  return 0;
}

function groupShiftsByMonth(shifts: ShiftRecord[]): Array<{
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  latestTimestamp: number;
  shifts: ShiftRecord[];
}> {
  const groupsMap = new Map<string, { monthLabel: string; totalHours: number; latestTimestamp: number; shifts: ShiftRecord[] }>();

  shifts.forEach(shift => {
    const parts = parseDateToShiftParts(shift.date, shift.monthKey);
    const mKey = parts.monthKey || shift.monthKey || 'out/26';
    const { monthIndex, year } = parseMonthKey(mKey);
    const monthLabel = formatFullMonthYear(monthIndex, year).toUpperCase();
    const ts = parseShiftDateToTimestamp(shift.date);

    if (!groupsMap.has(mKey)) {
      groupsMap.set(mKey, {
        monthLabel,
        totalHours: 0,
        latestTimestamp: ts,
        shifts: []
      });
    }

    const group = groupsMap.get(mKey)!;
    group.shifts.push(shift);
    group.totalHours += (shift.hours || 0);
    if (ts > group.latestTimestamp) {
      group.latestTimestamp = ts;
    }
  });

  groupsMap.forEach(group => {
    group.shifts.sort((a, b) => parseShiftDateToTimestamp(b.date) - parseShiftDateToTimestamp(a.date));
  });

  return Array.from(groupsMap.entries()).map(([monthKey, val]) => ({
    monthKey,
    ...val
  })).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

export const MonthlyScheduleView: React.FC<MonthlyScheduleViewProps> = ({
  members,
  config = {
    leagueName: 'Liga do Trauma Hospital Angelina Caron',
    leagueAcronym: 'LTHAC',
    minHoursForCertificate: 150,
  } as LeagueConfig,
  onSelectMember,
  onUpdateMember,
  onOpenAddShift,
  onOpenCertificateModal,
}) => {
  const { isCoordination } = useAuth();
  
  // Navigation & View Mode State
  const [selectedYear, setSelectedYear] = useState<number>(() => getCurrentYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => getCurrentMonthIndex());
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Ligante' | 'Coordenação'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_shifts' | 'with_rep' | 'with_adv'>('all');

  // Slide-over Drawer State
  const [drawerMember, setDrawerMember] = useState<Member | null>(null);

  // Active Month calculation
  const activeMonthKey = formatMonthKey(selectedMonthIndex, selectedYear);
  const activeMonthFormatted = formatFullMonthYear(selectedMonthIndex, selectedYear);

  // Active Quarter calculation
  const currentQuarters = useMemo(() => getQuartersForYear(selectedYear), [selectedYear]);
  const currentQuarter = currentQuarters[Math.floor(selectedMonthIndex / 3)];

  // Quick Direct Add Shift Modal State
  const [directAddModal, setDirectAddModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    monthKey: string;
    date: string;
  }>({
    isOpen: false,
    member: null,
    monthKey: activeMonthKey,
    date: `${new Date().getDate().toString().padStart(2, '0')}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
  });

  const [directShiftHours, setDirectShiftHours] = useState<number>(12);
  const [directShiftStatus, setDirectShiftStatus] = useState<'concluido' | 'falta_justificada' | 'falta_injustificada'>('concluido');
  const [directShiftDescription, setDirectShiftDescription] = useState<string>('Plantão Pronto Socorro');

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (viewMode === 'quarterly') {
      const qIndex = Math.floor(selectedMonthIndex / 3);
      if (qIndex > 0) {
        setSelectedMonthIndex((qIndex - 1) * 3);
      } else {
        setSelectedYear(prev => prev - 1);
        setSelectedMonthIndex(9); // Q4
      }
    } else {
      if (selectedMonthIndex > 0) {
        setSelectedMonthIndex(prev => prev - 1);
      } else {
        setSelectedYear(prev => prev - 1);
        setSelectedMonthIndex(11);
      }
    }
  };

  const handleNextMonth = () => {
    if (viewMode === 'quarterly') {
      const qIndex = Math.floor(selectedMonthIndex / 3);
      if (qIndex < 3) {
        setSelectedMonthIndex((qIndex + 1) * 3);
      } else {
        setSelectedYear(prev => prev + 1);
        setSelectedMonthIndex(0); // Q1
      }
    } else {
      if (selectedMonthIndex < 11) {
        setSelectedMonthIndex(prev => prev + 1);
      } else {
        setSelectedYear(prev => prev + 1);
        setSelectedMonthIndex(0);
      }
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // 1. Search filter
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Role filter
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;

      // 3. Status filter
      if (statusFilter === 'with_shifts') {
        const hasShiftsInMonth = m.shifts.some(s => s.monthKey === activeMonthKey);
        if (!hasShiftsInMonth) return false;
      } else if (statusFilter === 'with_rep') {
        const hasPendingRep = m.replacements.some(r => !r.completed);
        if (!hasPendingRep) return false;
      } else if (statusFilter === 'with_adv') {
        const hasActiveAdv = m.warnings.some(w => w.active);
        if (!hasActiveAdv) return false;
      }

      return true;
    });
  }, [members, searchTerm, roleFilter, statusFilter, activeMonthKey]);

  // Compute Columns to Display according to ViewMode
  const displayedMonths = useMemo(() => {
    if (viewMode === 'monthly') {
      return [activeMonthKey];
    }
    if (viewMode === 'quarterly') {
      return currentQuarter.months;
    }
    return getMonthColumnsForYear(selectedYear); // Annual
  }, [viewMode, activeMonthKey, currentQuarter, selectedYear]);

  // Quick statistics for current period
  const periodStats = useMemo(() => {
    let totalShifts = 0;
    let totalHours = 0;
    let membersWithShifts = 0;

    members.forEach(m => {
      const shiftsInPeriod = m.shifts.filter(s => displayedMonths.includes(s.monthKey || activeMonthKey));
      if (shiftsInPeriod.length > 0) {
        membersWithShifts++;
        totalShifts += shiftsInPeriod.length;
        shiftsInPeriod.forEach(s => {
          if (!s.isExcused && s.shiftStatus !== 'falta_justificada' && s.shiftStatus !== 'falta_injustificada') {
            totalHours += s.hours || 12;
          }
        });
      }
    });

    return {
      totalShifts,
      totalHours,
      membersWithShifts,
      activeMembersCount: members.length,
      occupancyRate: members.length > 0 ? Math.round((membersWithShifts / members.length) * 100) : 0,
    };
  }, [members, displayedMonths, activeMonthKey]);

  // Handler: Open Direct Add Shift
  const handleOpenDirectAdd = (e: React.MouseEvent, member: Member, monthKey: string) => {
    e.stopPropagation();
    setDirectAddModal({
      isOpen: true,
      member,
      monthKey,
      date: '02/10',
    });
    setDirectShiftHours(12);
    setDirectShiftStatus('concluido');
    setDirectShiftDescription('Plantão Pronto Socorro');
  };

  // Handler: Save Direct Shift
  const handleSaveDirectShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAddModal.member || !onUpdateMember) return;

    const targetMember = directAddModal.member;
    const shiftDate = directAddModal.date;
    const shiftMonth = directAddModal.monthKey;

    if (directShiftStatus === 'concluido') {
      const newShift: ShiftRecord = {
        id: `s-${Date.now()}`,
        date: shiftDate,
        monthKey: shiftMonth,
        hours: Number(directShiftHours),
        type: 'plantao',
        shiftStatus: 'concluido',
        description: directShiftDescription || 'Plantão Concluído',
      };

      onUpdateMember({
        ...targetMember,
        shifts: [newShift, ...targetMember.shifts],
        accumulatedHours: targetMember.accumulatedHours + Number(directShiftHours),
        hoursUpdated: true,
      });

    } else if (directShiftStatus === 'falta_justificada') {
      const absenceId = `ab-fj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;

      const currentAbsInMonth = [...targetMember.justifiedAbsences, ...targetMember.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === shiftMonth).length + 1;
      const deadlineText = calculateReplacementDeadline(shiftMonth, currentAbsInMonth);

      const newAbsence = {
        id: absenceId,
        date: shiftDate,
        monthKey: shiftMonth,
        type: 'justificada' as const,
        reason: `Falta justificada no plantão de ${shiftDate} (${shiftMonth})`,
        requiresReplacement: true,
        shiftId,
        replacementId,
      };

      const newReplacement = {
        id: replacementId,
        memberId: targetMember.id,
        absenceId,
        shiftId,
        scheduledDate: 'A definir',
        scheduledHours: Number(directShiftHours),
        completed: false,
        deadlineMonth: shiftMonth,
        deadlineDescription: deadlineText,
        missedShiftDate: `${shiftDate} (${shiftMonth})`,
        notes: `Falta Justificada em ${shiftDate} (${shiftMonth}) — sem advertência, requer reposição. Prazo: ${deadlineText}`,
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: shiftDate,
        monthKey: shiftMonth,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_justificada',
        description: 'Falta Justificada (sem advertência, requer reposição)',
        absenceId,
        replacementId,
      };

      onUpdateMember({
        ...targetMember,
        shifts: [newShift, ...targetMember.shifts],
        justifiedAbsences: [newAbsence, ...targetMember.justifiedAbsences],
        replacements: syncMemberReplacementsDeadlines([newReplacement, ...targetMember.replacements]),
      });

    } else if (directShiftStatus === 'falta_injustificada') {
      const absenceId = `ab-fnj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;
      const warningId = `w-${Date.now()}`;

      const currentAbsInMonth = [...targetMember.justifiedAbsences, ...targetMember.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === shiftMonth).length + 1;
      const deadlineText = calculateReplacementDeadline(shiftMonth, currentAbsInMonth);

      const newWarning = {
        id: warningId,
        date: shiftDate,
        reason: `Advertência automática por falta não justificada no plantão de ${shiftDate} (${shiftMonth})`,
        severity: 'moderada' as const,
        active: true,
      };

      const newAbsence = {
        id: absenceId,
        date: shiftDate,
        monthKey: shiftMonth,
        type: 'injustificada' as const,
        reason: `Falta não justificada no plantão de ${shiftDate} (${shiftMonth})`,
        requiresReplacement: true,
        shiftId,
        replacementId,
        warningId,
      };

      const newReplacement = {
        id: replacementId,
        memberId: targetMember.id,
        absenceId,
        shiftId,
        scheduledDate: 'A definir',
        scheduledHours: Number(directShiftHours),
        completed: false,
        deadlineMonth: shiftMonth,
        deadlineDescription: deadlineText,
        missedShiftDate: `${shiftDate} (${shiftMonth})`,
        notes: `Falta Não Justificada em ${shiftDate} (${shiftMonth}) — gerou 1 ADV e requer reposição. Prazo: ${deadlineText}`,
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: shiftDate,
        monthKey: shiftMonth,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_injustificada',
        description: 'Falta Não Justificada (Gerou 1 ADV e 1 Reposição)',
        absenceId,
        replacementId,
      };

      onUpdateMember({
        ...targetMember,
        shifts: [newShift, ...targetMember.shifts],
        warnings: [newWarning, ...targetMember.warnings],
        unjustifiedAbsences: [newAbsence, ...targetMember.unjustifiedAbsences],
        replacements: syncMemberReplacementsDeadlines([newReplacement, ...targetMember.replacements]),
      });
    }

    setDirectAddModal({ isOpen: false, member: null, monthKey: 'out/26', date: '02/10' });
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full">
      {/* 1. TOP TOOLBAR & CONTROLS COMPACTO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm">
        {/* Header Row: Ícone + Título + Badge de Membros */}
        <div className="flex items-center justify-between gap-2 flex-nowrap whitespace-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight font-display truncate">
              Lançamento & Prontuário de Plantões
            </h2>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-950 text-slate-300 border border-slate-800 font-mono shrink-0">
            {members.length} membros
          </span>
        </div>

        {/* Subtítulo Curto e Direto */}
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          Registro rápido de plantões, faltas (FJ/FNJ) e acesso direto à ficha individual dos ligantes.
        </p>

        {/* Input de Pesquisa Rápida por Nome */}
        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por nome do integrante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-8.5 pr-7 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. MOBILE VIEW: RESPONSIVE MEMBER SHIFT CARDS (< 768px) */}
      <div className="block md:hidden space-y-2 mb-16">
        {filteredMembers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
            <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300 text-sm">Nenhum ligante encontrado</p>
            <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca ou filtros superiores</p>
          </div>
        ) : (
          filteredMembers.map(member => {
            const activeWarnings = member.warnings.filter(w => w.active).length;
            const pendingRep = member.replacements.filter(r => !r.completed).length;
            const shiftsInCurrentMonth = member.shifts.filter(s => (s.monthKey || 'out/26') === activeMonthKey);

            return (
              <div
                key={member.id}
                className="bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 shadow-xs space-y-3"
              >
                {/* Header: Avatar, Name, Subtitle, Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div 
                    onClick={() => setDrawerMember(member)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-white text-xs font-bold shrink-0 font-display">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white text-xs sm:text-sm truncate hover:text-emerald-400 transition-colors block font-display">
                        {member.name}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        Adm: <span className="text-slate-300">{member.entryDate}</span> • <strong className="text-emerald-400 font-bold">{member.accumulatedHours}h</strong>
                      </p>
                    </div>
                  </div>

                  {/* Counters - Flex items-center gap-1.5 shrink-0 */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {activeWarnings > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap" title="Advertências">
                        {activeWarnings} ADV
                      </span>
                    )}
                    {pendingRep > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap" title="Reposições Pendentes">
                        {pendingRep} REP
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Direct Add Shift (Coordination) + Open Profile in same line */}
                <div className="flex items-center gap-2 pt-1 mt-3 border-t border-slate-800/60 pt-2.5">
                  {isCoordination && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenDirectAdd(e, member, activeMonthKey)}
                      className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer active:scale-98 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lançar Plantão</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawerMember(member)}
                    className="min-h-[34px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shrink-0"
                    title="Ver histórico e ficha"
                  >
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ficha</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. MAIN SPREADSHEET TABLE WITH STICKY COLUMNS & HEADERS (DESKTOP >= 768px) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative mb-16">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pb-16">
          <table className="w-full text-left border-collapse min-w-[950px]">
            {/* Sticky Top Header */}
            <thead className="sticky top-0 z-20 bg-slate-950 shadow-md">
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                
                {/* Fixed Left Columns (Header) */}
                <th className="py-3 px-3.5 sticky left-0 bg-slate-950 z-25 min-w-[200px] border-r border-slate-800">
                  <span>Membro da Liga</span>
                </th>

                <th className="py-3 px-3 text-center min-w-[85px] bg-slate-950/95 border-r border-slate-800/80">
                  Admissão
                </th>

                <th className="py-3 px-3 text-center min-w-[75px] bg-slate-950/95 border-r border-slate-800/80">
                  Horas
                </th>

                <th className="py-3 px-2.5 text-center min-w-[50px] bg-slate-950/95 border-r border-slate-800/80" title="Advertências Disciplinares">
                  ADV
                </th>

                <th className="py-3 px-2.5 text-center min-w-[50px] bg-slate-950/95 border-r border-slate-800/80" title="Reposições Pendentes">
                  REP
                </th>

                {/* Dynamic Months / Days Columns */}
                {displayedMonths.map(month => {
                  const { monthIndex, year } = parseMonthKey(month);
                  const label = formatFullMonthYear(monthIndex, year);
                  return (
                    <th 
                      key={month} 
                      className={`py-3 px-3 text-center border-l border-slate-800/80 ${
                        month === activeMonthKey 
                          ? 'bg-slate-900/90 text-emerald-400 font-bold' 
                          : 'bg-slate-950/80 text-slate-300'
                      }`}
                      style={{ minWidth: viewMode === 'monthly' ? '320px' : '150px' }}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{label}</span>
                        {month === activeMonthKey && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5 + displayedMonths.length} className="py-12 text-center text-slate-400">
                    <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Nenhum ligante encontrado com os filtros selecionados</p>
                    <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca por nome ou redefinir os filtros superiores</p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map(member => {
                  const activeWarnings = member.warnings.filter(w => w.active).length;
                  const pendingRep = member.replacements.filter(r => !r.completed).length;

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setDrawerMember(member)}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    >
                      {/* 1. FIXED LEFT COLUMN: Member Name */}
                      <td className="py-3 px-3.5 sticky left-0 bg-slate-900 group-hover:bg-slate-850 transition-colors z-10 border-r border-slate-800 min-w-[200px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
                            {member.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors break-words">
                            {member.name}
                          </span>
                        </div>
                      </td>

                      {/* 2. Entry Date */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-300 border-r border-slate-800/60">
                        {member.entryDate}
                      </td>

                      {/* 3. Accumulated Hours (Compact Pill) */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-800/60 font-mono">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20 text-xs">
                          {member.accumulatedHours}h
                        </span>
                      </td>

                      {/* 4. Advertências (ADV) */}
                      <td className="py-2.5 px-2.5 text-center font-mono border-r border-slate-800/60">
                        {activeWarnings > 0 ? (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                            {activeWarnings}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* 5. Reposições Pendentes (REP) */}
                      <td className="py-2.5 px-2.5 text-center font-mono border-r border-slate-800/60">
                        {pendingRep > 0 ? (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                            {pendingRep}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* 6. MONTHLY CELLS (NO '//' TEXT - CLEAN & DYNAMIC) */}
                      {displayedMonths.map(month => {
                        const shiftsInMonth = member.shifts.filter(s => (s.monthKey || 'out/26') === month);
                        const repInMonth = member.replacements.filter(r => (r.deadlineMonth || 'out/26') === month || r.missedShiftDate?.includes(month));

                        return (
                          <td
                            key={month}
                            className={`py-2 px-2.5 border-l border-slate-800/60 align-middle relative group/cell transition-colors ${
                              month === activeMonthKey ? 'bg-slate-900/30' : ''
                            }`}
                          >
                            {shiftsInMonth.length === 0 ? (
                              /* Clean Empty Cell with Subtle Hover + Action */
                              <div className="h-8 flex items-center justify-center">
                                {isCoordination && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenDirectAdd(e, member, month)}
                                    className="opacity-0 group-hover/cell:opacity-100 transition-opacity px-2 py-1 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                                    title={`Adicionar plantão para ${member.name} em ${formatFullMonthYear(parseMonthKey(month).monthIndex, parseMonthKey(month).year)}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Lançar</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              /* Render Shift Badges with Rich Interactive Tooltips */
                              <div className="flex flex-wrap gap-1.5 justify-center">
                                {shiftsInMonth.map(shift => {
                                  const isUnjustified = shift.shiftStatus === 'falta_injustificada';
                                  const isJustified = shift.shiftStatus === 'falta_justificada';

                                  let badgeClasses = 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 hover:border-emerald-500';
                                  let labelText = `${shift.date} • ${shift.hours || 12}h`;

                                  if (isUnjustified) {
                                    badgeClasses = 'bg-rose-950/80 text-rose-300 border-rose-700/70 hover:border-rose-500';
                                    labelText = `${shift.date} • F.N.J`;
                                  } else if (isJustified) {
                                    badgeClasses = 'bg-blue-950/80 text-blue-300 border-blue-700/70 hover:border-blue-500';
                                    labelText = `${shift.date} • F.J`;
                                  }

                                  return (
                                    <div key={shift.id} className="relative group/badge inline-block">
                                      <span
                                        className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 font-semibold whitespace-nowrap shadow-xs cursor-pointer transition-all ${badgeClasses}`}
                                      >
                                        {labelText}
                                      </span>

                                      {/* Rich Hover Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/badge:block z-50 w-56 p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-left pointer-events-none">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                          <span className="font-bold text-white text-xs font-mono">{shift.date} ({shift.monthKey})</span>
                                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                            isUnjustified ? 'bg-rose-500/20 text-rose-300' :
                                            isJustified ? 'bg-blue-500/20 text-blue-300' :
                                            'bg-emerald-500/20 text-emerald-300'
                                          }`}>
                                            {isUnjustified ? 'Falta Não Justificada' : isJustified ? 'Falta Justificada' : 'Concluído'}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 mt-1.5 font-sans">
                                          {shift.description || 'Plantão de escala hospitalar'}
                                        </p>
                                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400">
                                          <span>Carga: <strong className="text-white font-mono">{shift.hours || 12}h</strong></span>
                                          <span className="text-emerald-400">Clique p/ detalhes</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Quick Add Extra Shift Button on hover */}
                                {isCoordination && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenDirectAdd(e, member, month)}
                                    className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-1 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-md border border-slate-700 text-[10px] cursor-pointer"
                                    title="Adicionar outro plantão"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SLIDE-OVER DRAWER (PAINEL LATERAL DE DETALHES DO LIGANTE) */}
      {drawerMember && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/80 relative shrink-0">
              <button
                type="button"
                onClick={() => setDrawerMember(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar painel"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 pr-8">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-teal-500/20 shrink-0 font-display">
                  {drawerMember.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight break-words font-display">
                    {drawerMember.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Admissão: {drawerMember.entryDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bars: 1. Hours Progress & 2. Tenure Progress (Espaçamento reduzido) */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-400">Progresso de Horas ({config.minHoursForCertificate}h):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {drawerMember.accumulatedHours}h / {config.minHoursForCertificate}h ({Math.min(100, Math.round((drawerMember.accumulatedHours / config.minHoursForCertificate) * 100))}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (drawerMember.accumulatedHours / config.minHoursForCertificate) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Progress bar towards 1 Year */}
                {(() => {
                  const activeTime = calculateActiveTime(drawerMember.entryDate);
                  const tenureDaysPercent = Math.min(100, Math.round((activeTime.totalDays / 365) * 100));
                  const isOneYear = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;

                  return (
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-slate-400">Tempo de Admissão (1 ano):</span>
                        <span className="font-mono font-bold text-blue-400">
                          {isOneYear ? '1 ano completo ✓' : `${activeTime.formatted} (${tenureDaysPercent}%)`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                        <div 
                          className="h-full rounded-full transition-all duration-300 bg-blue-500"
                          style={{ width: `${tenureDaysPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-4 text-xs text-slate-300">
              
              {/* Indicadores Compactos (Faixa Compacta 4 colunas / 2 colunas com FJ e FNJ lado a lado) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Horas</span>
                  <span className="text-sm font-bold text-white font-mono">{drawerMember.accumulatedHours}h</span>
                </div>

                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Plantões</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{drawerMember.shifts.length}</span>
                </div>

                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Faltas</span>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold mt-0.5">
                    <span className="text-blue-400">{drawerMember.justifiedAbsences.length} FJ</span>
                    <span className="text-slate-600">|</span>
                    <span className={drawerMember.unjustifiedAbsences.length > 0 ? 'text-rose-400' : 'text-slate-400'}>
                      {drawerMember.unjustifiedAbsences.length} FNJ
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Advertências</span>
                  <span className={`text-sm font-bold font-mono block mt-0.5 ${
                    drawerMember.warnings.filter(w => w.active).length > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {drawerMember.warnings.filter(w => w.active).length} ADV
                  </span>
                </div>
              </div>

              {/* Pending Replacements Notice (Moved above shift history with mt-4 mb-5) */}
              {drawerMember.replacements.filter(r => !r.completed).length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-1 text-xs text-amber-200 mt-4 mb-5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Reposições Pendentes ({drawerMember.replacements.filter(r => !r.completed).length})</span>
                  </div>
                  {drawerMember.replacements.filter(r => !r.completed).map(rep => (
                    <p key={rep.id} className="text-[11px] text-slate-300 pl-5">
                      • Origem: {rep.missedShiftDate || 'Escala'} — Prazo: <strong>{rep.deadlineDescription || 'Mês seguinte'}</strong>
                    </p>
                  ))}
                </div>
              )}

              {/* Histórico de Plantões Agrupado por Mês */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    Histórico de Plantões ({drawerMember.shifts.length})
                  </h4>
                </div>

                {drawerMember.shifts.length === 0 ? (
                  <p className="text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-lg text-xs">
                    Nenhum plantão individual registrado.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {groupShiftsByMonth(drawerMember.shifts).map(group => (
                      <div key={group.monthKey} className="space-y-1">
                        {/* Linha Divisória Horizontal Sutil com Mês e Subtotal */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 before:flex-1 before:border-t before:border-slate-800 after:flex-1 after:border-t after:border-slate-800 my-2">
                          <span className="font-mono font-semibold tracking-wider text-slate-300">
                            {group.monthLabel} • {group.totalHours}h ({group.shifts.length} {group.shifts.length === 1 ? 'plantão' : 'plantões'})
                          </span>
                        </div>

                        {/* Plantões em Linha Única Super Compacta */}
                        {group.shifts.map(shift => {
                          const parts = parseDateToShiftParts(shift.date, shift.monthKey);
                          const displayDate = parts.dayMonth || shift.date;
                          const statusLabel = shift.shiftStatus === 'falta_injustificada' 
                            ? 'F.N.J' 
                            : shift.shiftStatus === 'falta_justificada' 
                            ? 'F.J' 
                            : 'Concluído';
                          const statusStyle = shift.shiftStatus === 'falta_injustificada'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : shift.shiftStatus === 'falta_justificada'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                          const typeLabel = shift.type === 'reposicao' ? 'Reposição' : 'Plantão';

                          return (
                            <div 
                              key={shift.id}
                              className="py-1.5 px-2.5 bg-slate-800/40 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs hover:bg-slate-800/60 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-white font-mono text-xs shrink-0">{displayDate}</span>
                                <span className="text-slate-400 text-xs truncate max-w-[140px] sm:max-w-[180px]">{typeLabel}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusStyle}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-emerald-400 text-xs shrink-0 ml-2">
                                {shift.hours}h
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const m = drawerMember;
                    setDrawerMember(null);
                    onSelectMember(m);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Ficha Completa</span>
                </button>

                {onOpenCertificateModal && isCoordination && (
                  <button
                    type="button"
                    onClick={() => {
                      const m = drawerMember;
                      setDrawerMember(null);
                      onOpenCertificateModal(m);
                    }}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                    title="Emitir / Ver Certificado"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DIRECT QUICK ADD SHIFT MODAL (Triggered when clicking '+' on any empty cell) */}
      {directAddModal.isOpen && directAddModal.member && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Lançar Plantão na Escala</h3>
                  <p className="text-[11px] text-slate-400">{directAddModal.member.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectAddModal({ isOpen: false, member: null, monthKey: 'out/26', date: '02/10' })}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDirectShift} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <CustomDatePicker
                    label="Data do Plantão"
                    required
                    value={directAddModal.date}
                    onChange={val => {
                      const parts = val.includes('-') ? val.split('-') : val.split('/');
                      if (parts.length === 3) {
                        if (val.includes('-')) {
                          const [y, m, d] = parts;
                          const mIdx = parseInt(m, 10) - 1;
                          const monthKey = formatMonthKey(mIdx, parseInt(y, 10));
                          setDirectAddModal(prev => ({ ...prev, date: `${d}/${m}`, monthKey }));
                        } else {
                          const [d, m, y] = parts;
                          const mIdx = parseInt(m, 10) - 1;
                          const monthKey = formatMonthKey(mIdx, parseInt(y, 10));
                          setDirectAddModal(prev => ({ ...prev, date: `${d}/${m}`, monthKey }));
                        }
                      } else {
                        setDirectAddModal(prev => ({ ...prev, date: val }));
                      }
                    }}
                    format="BR"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Mês da Escala</label>
                  <select
                    value={directAddModal.monthKey}
                    onChange={e => setDirectAddModal(prev => ({ ...prev, monthKey: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                  >
                    {getMonthColumnsForYear(selectedYear).map((m: string) => {
                      const { monthIndex, year } = parseMonthKey(m);
                      return (
                        <option key={m} value={m}>{formatFullMonthYear(monthIndex, year)}</option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Status *</label>
                  <select
                    value={directShiftStatus}
                    onChange={e => setDirectShiftStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold"
                  >
                    <option value="concluido">Plantão Concluído</option>
                    <option value="falta_justificada">Falta Justificada</option>
                    <option value="falta_injustificada">Falta Não Justificada</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Carga Horária</label>
                  <select
                    value={directShiftHours}
                    onChange={e => setDirectShiftHours(Number(e.target.value))}
                    disabled={directShiftStatus !== 'concluido'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono disabled:opacity-50"
                  >
                    <option value={12}>12 horas (Padrão)</option>
                    <option value={6}>6 horas</option>
                    <option value={4}>4 horas</option>
                    <option value={24}>24 horas (Duplo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Descrição / Setor</label>
                <input
                  type="text"
                  value={directShiftDescription}
                  onChange={e => setDirectShiftDescription(e.target.value)}
                  placeholder="Ex: Pronto Socorro Cirúrgico"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDirectAddModal({ isOpen: false, member: null, monthKey: 'out/26', date: '02/10' })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  Salvar Plantão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
