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
  ChevronDown,
  Layers,
  CalendarDays,
  Grid3X3,
  Sparkles,
  Pencil
} from 'lucide-react';
import { Member, LeagueConfig, ShiftRecord, RoleInLeague } from '../types/league';
import { 
  getCurrentYear, 
  getCurrentMonthIndex, 
  formatMonthKey, 
  formatFullMonthYear, 
  formatShortMonthYear,
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
  parseDateToShiftParts,
  updateOrAddMemberShift,
  deleteMemberShift
} from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';
import { MemberDetailModal } from './MemberDetailModal';
import { ShiftModal, ShiftModalData } from './ShiftModal';

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

/**
 * Verifica estritamente se um plantão pertence a um mês de referência (ex: 'nov/26'),
 * extraindo o mês real da string da data (01 a 12, onde Outubro = 10 e Novembro = 11)
 * para evitar qualquer erro de índice zero do JS e garantir que plantões de outros meses
 * (como 02/10) nunca apareçam no mês incorreto.
 */
function isShiftInMonthKey(shift: ShiftRecord, targetMonthKey: string): boolean {
  if (!targetMonthKey) return false;
  const { monthIndex, year } = parseMonthKey(targetMonthKey);
  const targetMonthReal = monthIndex + 1; // 1 = Jan ... 10 = Out, 11 = Nov, 12 = Dez

  const isAbsence = shift.shiftStatus === 'falta_justificada' || 
                    shift.shiftStatus === 'falta_injustificada' || 
                    shift.description?.toLowerCase().includes('falta') ||
                    shift.hours === 0;

  // 1. Faltas (FJ / FNJ) sem dia específico: vinculam-se ao Mês da Escala registrado
  if (isAbsence) {
    if (shift.monthKey) {
      const parsed = parseMonthKey(shift.monthKey);
      return parsed.monthIndex === monthIndex && parsed.year === year;
    }
    const cleanDate = (shift.date || '').toLowerCase();
    const fullMonthName = FULL_MONTH_NAMES[monthIndex]?.toLowerCase();
    const shortMonthName = SHORT_MONTH_NAMES[monthIndex]?.toLowerCase();
    if ((fullMonthName && cleanDate.includes(fullMonthName)) || (shortMonthName && cleanDate.includes(shortMonthName))) {
      return true;
    }
  }

  // 2. Plantões concluídos com data específica: extrai o mês real da string
  const rawDate = (shift.date || '').trim();

  // Formato ISO: YYYY-MM-DD
  if (rawDate.includes('-')) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(m)) {
        const yMatches = !isNaN(y) ? y === year : true;
        return m === targetMonthReal && yMatches;
      }
    }
  }

  // Formato BR: DD/MM ou DD/MM/AAAA
  if (rawDate.includes('/')) {
    const parts = rawDate.split('/');
    if (parts.length >= 2) {
      const m = parseInt(parts[1].trim(), 10);
      if (!isNaN(m)) {
        let yMatches = true;
        if (parts.length >= 3 && parts[2].trim()) {
          const rawY = parts[2].trim();
          const parsedY = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
          if (!isNaN(parsedY)) {
            yMatches = parsedY === year;
          }
        }
        return m === targetMonthReal && yMatches;
      }
    }
  }

  // 3. Fallback: chave do mês gravada
  if (shift.monthKey) {
    const parsed = parseMonthKey(shift.monthKey);
    return parsed.monthIndex === monthIndex && parsed.year === year;
  }

  return false;
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

  // Unified Shift Modal State (for Direct Add & Individual Shift Edit/Delete)
  const [shiftModalState, setShiftModalState] = useState<{
    isOpen: boolean;
    member: Member | null;
    editingShift: ShiftRecord | null;
    monthKey: string;
    date?: string;
  }>({
    isOpen: false,
    member: null,
    editingShift: null,
    monthKey: activeMonthKey,
    date: undefined,
  });

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

  // Filtered members list (exclui integrantes em baixa das escalas ativas)
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // 0. Excluir integrantes em baixa das escalas ativas da Planilha
      if (m.isBaixa || m.status === 'baixa') return false;

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
    const activeMembers = members.filter(m => !m.isBaixa && m.status !== 'baixa');

    activeMembers.forEach(m => {
      const shiftsInPeriod = m.shifts.filter(s => displayedMonths.some(dm => isShiftInMonthKey(s, dm)));
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
      activeMembersCount: activeMembers.length,
      occupancyRate: activeMembers.length > 0 ? Math.round((membersWithShifts / activeMembers.length) * 100) : 0,
    };
  }, [members, displayedMonths, activeMonthKey]);

  // Handler: Open Direct Add Shift
  const handleOpenDirectAdd = (e: React.MouseEvent, member: Member, monthKey: string) => {
    e.stopPropagation();
    const { monthIndex, year } = parseMonthKey(monthKey);
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(new Date().getDate()).padStart(2, '0');
    setShiftModalState({
      isOpen: true,
      member,
      editingShift: null,
      monthKey,
      date: `${dd}/${mm}/${year}`,
    });
  };

  // Handler: Open Edit Shift Modal
  const handleOpenEditShift = (member: Member, shift: ShiftRecord) => {
    setShiftModalState({
      isOpen: true,
      member,
      editingShift: shift,
      monthKey: shift.monthKey || activeMonthKey,
      date: shift.date,
    });
  };

  // Handler: Save Shift Modal (Add or Edit)
  const handleSaveShiftModal = (shiftData: ShiftModalData, isEditing: boolean) => {
    if (!shiftModalState.member || !onUpdateMember) return;
    const updated = updateOrAddMemberShift(
      shiftModalState.member,
      shiftData,
      isEditing ? (shiftModalState.editingShift?.id || shiftData.id) : undefined
    );
    onUpdateMember(updated);
    if (drawerMember?.id === updated.id) {
      setDrawerMember(updated);
    }
    setShiftModalState({
      isOpen: false,
      member: null,
      editingShift: null,
      monthKey: activeMonthKey,
      date: undefined,
    });
  };

  // Handler: Delete Shift Modal
  const handleDeleteShiftModal = (shiftId: string) => {
    if (!shiftModalState.member || !onUpdateMember) return;
    const updated = deleteMemberShift(shiftModalState.member, shiftId);
    onUpdateMember(updated);
    if (drawerMember?.id === updated.id) {
      setDrawerMember(updated);
    }
    setShiftModalState({
      isOpen: false,
      member: null,
      editingShift: null,
      monthKey: activeMonthKey,
      date: undefined,
    });
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
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight font-display truncate">
              Controle de Plantões
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

        {/* Menu Superior de Seleção de Mês (< Mês / Ano >) */}
        <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 mt-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center gap-2 px-2 min-w-0">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-white font-display tracking-wide capitalize truncate">
              {activeMonthFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Input de Pesquisa Rápida por Nome */}
        <div className="relative mt-2.5">
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
      <div className="block md:hidden space-y-2.5 pb-24">
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

            // Filtro de plantões do integrante para o mês selecionado
            const monthlyShifts = member.shifts
              .filter(s => isShiftInMonthKey(s, activeMonthKey))
              .sort((a, b) => parseShiftDateToTimestamp(a.date) - parseShiftDateToTimestamp(b.date));

            return (
              <div
                key={member.id}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 pt-3 pb-3 shadow-xs flex flex-col justify-between gap-2.5 transition-colors"
              >
                {/* Linha Superior: Avatar, Nome do integrante, metadados (Adm: DD/MM/AAAA • Xh) e badges à direita (ADV / REP) */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div 
                    onClick={() => setDrawerMember(member)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-white text-xs font-bold shrink-0 font-display">
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

                  {/* Badges à direita (ADV / REP) */}
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

                {/* Linha de Ação: + Lançamento */}
                {isCoordination && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={(e) => handleOpenDirectAdd(e, member, activeMonthKey)}
                      className="w-full h-8 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer active:scale-98 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lançamento</span>
                    </button>
                  </div>
                )}

                {/* Listagem de Plantões Realizados no Mês Selecionado */}
                <div className="pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Plantões no Mês ({monthlyShifts.length})
                    </span>
                  </div>

                  {monthlyShifts.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic py-1">
                      Nenhum plantão registrado neste mês.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {monthlyShifts.map((shift) => {
                        const isAbsence = shift.shiftStatus === 'falta_injustificada' || 
                                          shift.shiftStatus === 'falta_justificada' || 
                                          shift.description?.toLowerCase().includes('falta') ||
                                          shift.hours === 0;

                        const shiftMonthKey = shift.monthKey || parseDateToShiftParts(shift.date, shift.monthKey).monthKey || activeMonthKey;
                        const { monthIndex, year } = parseMonthKey(shiftMonthKey);
                        const scaleMonthLabel = formatFullMonthYear(monthIndex, year);

                        const displayDate = isAbsence
                          ? scaleMonthLabel
                          : (shift.date.length > 5 && shift.date.includes('/') ? shift.date.slice(0, 5) : shift.date);

                        return (
                          <div
                            key={shift.id}
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-950/40 border border-slate-800/40 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                              <span className={`font-mono font-semibold shrink-0 ${isAbsence ? 'text-amber-300/90' : 'text-slate-200'}`}>
                                {displayDate}
                              </span>
                              <span className="text-slate-400 font-medium shrink-0">
                                {isAbsence ? 'Escala' : (shift.type === 'reposicao' ? 'Reposição' : 'Plantão')}
                              </span>
                              {shift.shiftStatus === 'falta_injustificada' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25 whitespace-nowrap">
                                  Falta Não Just.
                                </span>
                              ) : shift.shiftStatus === 'falta_justificada' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 whitespace-nowrap">
                                  Falta Justificada
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                  Concluído
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className={`font-mono font-bold ${
                                shift.hours > 0 ? 'text-emerald-400' : 'text-slate-500'
                              }`}>
                                {shift.hours > 0 ? `+${shift.hours}h` : '0h'}
                              </span>
                              {isCoordination && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditShift(member, shift);
                                  }}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
                                  title="Editar registro"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. MAIN SPREADSHEET TABLE WITH STICKY COLUMNS & HEADERS (DESKTOP >= 768px) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative pb-20">
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
                        const shiftsInMonth = member.shifts.filter(s => isShiftInMonthKey(s, month));
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
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isCoordination) {
                                            handleOpenEditShift(member, shift);
                                          } else {
                                            setDrawerMember(member);
                                          }
                                        }}
                                        className={`text-[11px] font-mono px-2 py-1 rounded-lg border inline-flex items-center gap-1.5 font-semibold whitespace-nowrap shadow-xs cursor-pointer transition-all ${badgeClasses}`}
                                        title={isCoordination ? "Clique para editar ou excluir registro" : undefined}
                                      >
                                        <span>{labelText}</span>
                                        {isCoordination && (
                                          <Pencil className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                                        )}
                                      </button>

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

      {/* 3. SLIDE-OVER DRAWER (PAINEL LATERAL DE DETALHES DO LIGANTE - COMPONENTE UNIFICADO) */}
      {drawerMember && (
        <MemberDetailModal
          member={drawerMember}
          config={config}
          onClose={() => setDrawerMember(null)}
          onOpenCertificateModal={onOpenCertificateModal}
          onUpdateMember={onUpdateMember}
        />
      )}

      {/* 4. UNIFIED SHIFT MODAL (Direct Add & Edit/Delete) */}
      {shiftModalState.isOpen && shiftModalState.member && (
        <ShiftModal
          isOpen={shiftModalState.isOpen}
          member={shiftModalState.member}
          editingShift={shiftModalState.editingShift}
          initialMonthKey={shiftModalState.monthKey}
          initialDate={shiftModalState.date}
          onClose={() => setShiftModalState(prev => ({ ...prev, isOpen: false, member: null, editingShift: null }))}
          onSave={handleSaveShiftModal}
          onDelete={handleDeleteShiftModal}
        />
      )}
    </div>
  );
};
