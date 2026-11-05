import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Award, 
  Repeat, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown,
  TrendingUp,
  Users,
  Pencil,
  X,
  UserMinus,
  CreditCard,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { Member, LeagueConfig, RoleInLeague, MemberStatus } from '../types/league';
import { 
  checkCertificateEligibility, 
  calculateActiveTime,
  isMemberEligibleForCertificate 
} from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';
import { CustomDatePicker } from './CustomDatePicker';
import { ModalPortal } from './ModalPortal';

interface MembersViewProps {
  members: Member[];
  config: LeagueConfig;
  onSelectMember: (member: Member) => void;
  onOpenAddMember: () => void;
  onOpenCertificateModal: (member: Member) => void;
  onUpdateMember?: (updated: Member) => void;
  onOpenSettings?: () => void;
  onOpenAddShiftForMember?: (memberId: string) => void;
  onOpenAddReplacementForMember?: (memberId: string) => void;
  onOpenAddWarningForMember?: (memberId: string) => void;
  onRequestDeleteMember?: (memberId: string) => void;
}

const isMemberBaixa = (m: Member) => Boolean(m.isBaixa || m.status === 'baixa');

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  config,
  onSelectMember,
  onOpenAddMember,
  onUpdateMember,
  onOpenSettings,
}) => {
  const { isCoordination } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'name' | 'hours-desc' | 'hours-asc' | 'date-desc' | 'adv'>('hours-desc');
  const [isBaixasOpen, setIsBaixasOpen] = useState(false);

  // State for direct member edit modal
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<RoleInLeague>('Ligante');
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editHours, setEditHours] = useState(0);
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<MemberStatus>('ativo');

  // Separate active and baixa members
  const activeMembers = useMemo(() => members.filter(m => !isMemberBaixa(m)), [members]);
  const baixaMembers = useMemo(() => members.filter(m => isMemberBaixa(m)), [members]);

  // Compute certificate eligibility map for active members
  const eligibilitiesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof checkCertificateEligibility>>();
    activeMembers.forEach(m => {
      map.set(m.id, checkCertificateEligibility(m, config));
    });
    return map;
  }, [activeMembers, config]);

  // Filter active members
  const filteredActiveMembers = useMemo(() => {
    return activeMembers.filter(member => {
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'aptos') {
        return isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);
      }
      if (filterType === 'ligantes') {
        return !config.leadershipBoard?.some(l => l.name.toLowerCase().trim() === member.name.toLowerCase().trim());
      }
      if (filterType === 'coordenacao') {
        return config.leadershipBoard?.some(l => l.name.toLowerCase().trim() === member.name.toLowerCase().trim());
      }
      if (filterType === 'reposicoes') {
        return member.replacements.some(r => !r.completed);
      }
      if (filterType === 'advertencias') {
        return member.warnings.some(w => w.active);
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'hours-desc') return b.accumulatedHours - a.accumulatedHours;
      if (sortBy === 'hours-asc') return a.accumulatedHours - b.accumulatedHours;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'adv') {
        return (b.warnings.filter(w => w.active).length) - (a.warnings.filter(w => w.active).length);
      }
      return 0;
    });
  }, [activeMembers, searchTerm, filterType, sortBy, config]);

  // Filter baixa members
  const filteredBaixaMembers = useMemo(() => {
    return baixaMembers.filter(member => {
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [baixaMembers, searchTerm]);

  // Statistics for top ribbon based on active members
  const totalHours = activeMembers.reduce((acc, m) => acc + (m.accumulatedHours || 0), 0);
  const eligibleCount = activeMembers.filter(m => isMemberEligibleForCertificate(m, config.minHoursForCertificate || 150)).length;
  const pendingReplacementsCount = activeMembers.filter(m => m.replacements.some(r => !r.completed)).length;

  return (
    <div className="min-h-screen flex flex-col justify-between space-y-4 sm:space-y-6 w-full max-w-full pb-16">
      {/* Top Header & Quick Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm relative">
        {/* Top Header Row: Title + Add Member Button */}
        <div className="flex items-center justify-between gap-2.5 flex-nowrap whitespace-nowrap">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-display shrink-0">
            Integrantes
          </h2>

          {/* Add Member Button (Coordination Only) */}
          {isCoordination && (
            <button
              type="button"
              onClick={onOpenAddMember}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar</span>
            </button>
          )}
        </div>

        {/* Faixa Única (1 Linha) com 4 métricas compactas */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Total</span>
            <span className="text-xs font-bold text-white font-mono">{activeMembers.length}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Horas</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{totalHours}h</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Aptos</span>
            <span className="text-xs font-bold text-white font-mono">{eligibleCount}/{activeMembers.length}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Repos.</span>
            <span className="text-xs font-bold text-amber-400 font-mono">{pendingReplacementsCount}</span>
          </div>
        </div>
      </div>

      {/* Search, Filters & Sort Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-2xl w-full max-w-full shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
          
          {/* Search + Sort group for tablet/mobile (or Left Search on >= xl) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Campo de Busca Compacto */}
            <div className="relative flex-1 min-w-[150px] max-w-full xl:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[36px] h-9 pl-9 pr-8 py-1 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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

            {/* Sort Dropdown no Mobile/Tablet (< xl): fica ao lado da busca sem criar linha improdutiva */}
            <div className="flex xl:hidden items-center gap-1 bg-slate-950 border border-slate-700/80 px-2 py-1 rounded-xl text-xs text-slate-200 shrink-0 min-h-[36px] h-9">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="hours-desc" className="bg-slate-900">Maior carga</option>
                <option value="hours-asc" className="bg-slate-900">Menor carga</option>
                <option value="name" className="bg-slate-900">A-Z</option>
                <option value="adv" className="bg-slate-900">Mais ADV</option>
              </select>
            </div>
          </div>

          {/* Botões de Filtro Ajustados */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full xl:w-auto flex-nowrap shrink-0">
            {[
              { id: 'todos', label: 'Todos', count: activeMembers.length },
              { id: 'aptos', label: 'Aptos', count: eligibleCount },
              { id: 'reposicoes', label: 'Reposição', count: pendingReplacementsCount },
              { id: 'advertencias', label: 'Com ADV', count: activeMembers.filter(m => m.warnings.some(w => w.active)).length },
              ...(isCoordination 
                ? [
                    { id: 'ligantes', label: 'Ligantes', count: activeMembers.filter(m => !config.leadershipBoard?.some(l => l.name.toLowerCase().trim() === m.name.toLowerCase().trim())).length },
                    { id: 'coordenacao', label: 'Coordenação', count: activeMembers.filter(m => config.leadershipBoard?.some(l => l.name.toLowerCase().trim() === m.name.toLowerCase().trim())).length }
                  ]
                : []
              )
            ].map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-1 cursor-pointer shrink-0 active:scale-[0.98] ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[11px] font-mono tabular-nums ${isActive ? 'text-emerald-200 font-bold' : 'text-slate-400'}`}>
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown no Desktop (visível apenas em telas >= xl ao lado dos filtros) */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs text-slate-200 shrink-0 min-h-[36px] h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="hours-desc" className="bg-slate-900">Maior carga horária</option>
              <option value="hours-asc" className="bg-slate-900">Menor carga horária</option>
              <option value="name" className="bg-slate-900">Ordem alfabética (A-Z)</option>
              <option value="adv" className="bg-slate-900">Mais advertências</option>
            </select>
          </div>

        </div>
      </div>

      {/* MOBILE MEMBER CARDS (< 768px) - ULTRA COMPACT HIGH DENSITY VIEW */}
      <div key={`mobile-${filterType}`} className="block md:hidden space-y-2 sm:space-y-2.5 animate-fadeSlideUp">
        {filteredActiveMembers.length === 0 ? (
          <div className="p-6 text-center text-slate-300 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl">
            Nenhum integrante ativo encontrado com os filtros selecionados.
          </div>
        ) : (
          filteredActiveMembers.map((member) => {
            const activeTime = calculateActiveTime(member.entryDate);
            const activeWarnings = member.warnings.filter(w => w.active).length;
            const fjCount = member.justifiedAbsences.length;
            const fnjCount = member.unjustifiedAbsences.length;
            const pendingRep = member.replacements.filter(r => !r.completed).length;
            const progressPercent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
            const isGoalMet = member.accumulatedHours >= config.minHoursForCertificate;
            const isApto = isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);

            // Cálculo do tempo de permanência e meta para estar Apto
            const requiredMonths = config.minActiveMonthsForCertificate || 12;
            const timePercent = Math.min(100, Math.round((activeTime.totalMonths / requiredMonths) * 100));
            const isTimeMet = activeTime.totalMonths >= requiredMonths || activeTime.totalDays >= 365;

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember(member)}
                className="bg-slate-900 border border-slate-800/90 hover:border-emerald-500/40 rounded-xl p-2.5 sm:p-3 shadow-xs transition-all cursor-pointer active:scale-[0.99] space-y-2"
              >
                {/* Linha 1: Avatar (w-7 h-7) + Nome Completo com truncate + Badge Apto */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Avatar 28x28px */}
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-white shrink-0 font-display">
                      {member.name.charAt(0)}
                    </div>

                    {/* Nome Completo com truncate para máximo aproveitamento horizontal */}
                    <span className="font-bold text-white text-xs sm:text-sm truncate flex-1 min-w-0 font-display">
                      {member.name}
                    </span>
                  </div>

                  {/* Badge "✓ Apto" alinhada à direita */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isApto ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Apto ✓</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-slate-950 text-slate-500 border border-slate-800 shrink-0">
                        Não Apto
                      </span>
                    )}
                  </div>
                </div>

                {/* Duas Barras de Progresso Empilhadas (Horas + Tempo de Permanência) */}
                <div className="space-y-1.5 pt-0.5">
                  {/* Bloco 1 (Horas): Texto compacto + barra de horas (h-1.5) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                      <span className="text-slate-400 font-sans text-[11px]">Horas</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isGoalMet ? 'text-emerald-400' : 'text-white'}`}>
                          {member.accumulatedHours}h / {config.minHoursForCertificate}h
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className={`font-bold ${isGoalMet ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {progressPercent}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isGoalMet ? 'bg-emerald-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Bloco 2 (Tempo): Tempo atual + meta e porcentagem + barra de tempo (h-1.5) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                      <span className="text-slate-400 font-sans text-[11px] truncate">{activeTime.formatted}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-blue-400">
                          Meta: {requiredMonths >= 12 ? '1 ano' : `${requiredMonths}m`}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="font-bold text-blue-400">
                          {timePercent}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out bg-blue-500"
                        style={{ width: `${timePercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Linha 3: Grade de Contadores Compacta (FJ, FNJ, ADV, REP em 4 colunas horizontais) */}
                <div className="grid grid-cols-4 gap-1 text-center font-mono py-1">
                  <div className={`py-1 px-1 rounded-md border text-xs flex items-center justify-center gap-1 ${
                    fjCount > 0 ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-bold' : 'bg-slate-950/60 text-slate-500 border-slate-800/80'
                  }`}>
                    <span className="text-[10px] font-sans font-medium text-slate-400">FJ</span>
                    <span>{fjCount}</span>
                  </div>

                  <div className={`py-1 px-1 rounded-md border text-xs flex items-center justify-center gap-1 ${
                    fnjCount > 0 ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold' : 'bg-slate-950/60 text-slate-500 border-slate-800/80'
                  }`}>
                    <span className="text-[10px] font-sans font-medium text-slate-400">FNJ</span>
                    <span>{fnjCount}</span>
                  </div>

                  <div className={`py-1 px-1 rounded-md border text-xs flex items-center justify-center gap-1 ${
                    activeWarnings > 0 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' : 'bg-slate-950/60 text-slate-500 border-slate-800/80'
                  }`}>
                    <span className="text-[10px] font-sans font-medium text-slate-400">ADV</span>
                    <span>{activeWarnings}</span>
                  </div>

                  <div className={`py-1 px-1 rounded-md border text-xs flex items-center justify-center gap-1 ${
                    pendingRep > 0 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold' : 'bg-slate-950/60 text-slate-500 border-slate-800/80'
                  }`}>
                    <span className="text-[10px] font-sans font-medium text-slate-400">REP</span>
                    <span>{pendingRep}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Seção Baixas Mobile */}
        {baixaMembers.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2.5">
            <div 
              onClick={() => setIsBaixasOpen(!isBaixasOpen)}
              className="flex items-center justify-between pb-1 cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">
                  <UserMinus className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-display group-hover:text-white transition-colors">
                  Baixas ({filteredBaixaMembers.length})
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Inativação reversível</span>
                <div className="p-1 text-slate-400 group-hover:text-white rounded-md shrink-0">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isBaixasOpen ? 'rotate-180 text-rose-400' : 'text-slate-400'}`} />
                </div>
              </div>
            </div>

            <div className={`grid transition-[grid-template-rows,opacity] duration-250 ease-in-out ${isBaixasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden space-y-2.5">
                {filteredBaixaMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 text-center">
                    Nenhum integrante em baixa encontrado na busca.
                  </p>
                ) : (
              filteredBaixaMembers.map((member) => {
                const isApto = isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);
                const isCertEmitted = Boolean(member.certificateEmitted);
                const isBadgeCollected = Boolean(member.badgeCollected);

                return (
                  <div
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                    className="opacity-90 bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 sm:p-3 shadow-xs transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center font-bold text-xs text-slate-400 shrink-0 font-display">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-300 text-xs sm:text-sm truncate flex-1 min-w-0 font-display line-through decoration-slate-600">
                          {member.name}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                        <UserMinus className="w-2.5 h-2.5 text-rose-400" />
                        <span>Baixa</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Admissão: {member.entryDate}</span>
                      <span className="text-emerald-400/90 font-bold">{member.accumulatedHours}h registradas</span>
                    </div>

                    {/* Controles de Saída / Encerramento */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px]" onClick={e => e.stopPropagation()}>
                      {/* Aptidão */}
                      <div className="flex items-center justify-center p-1 rounded-lg bg-slate-950 border border-slate-800/80">
                        {isApto ? (
                          <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Apto
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium text-[10px] flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Inapto
                          </span>
                        )}
                      </div>

                      {/* Certificado */}
                      <button
                        type="button"
                        disabled={!isCoordination || !onUpdateMember}
                        onClick={() => {
                          if (onUpdateMember) {
                            onUpdateMember({
                              ...member,
                              certificateEmitted: !member.certificateEmitted,
                            });
                          }
                        }}
                        className={`p-1 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isCertEmitted
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                        title="Alternar emissão de certificado"
                      >
                        <Award className="w-3 h-3 shrink-0" />
                        <span className="truncate">{isCertEmitted ? 'Certificado ✓' : 'Cert. Pend.'}</span>
                      </button>

                      {/* Crachá */}
                      <button
                        type="button"
                        disabled={!isCoordination || !onUpdateMember}
                        onClick={() => {
                          if (onUpdateMember) {
                            const nextCollected = !member.badgeCollected;
                            onUpdateMember({
                              ...member,
                              badgeCollected: nextCollected,
                              badgeCollectedDate: nextCollected ? new Date().toISOString().split('T')[0] : undefined,
                            });
                          }
                        }}
                        className={`p-1 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isBadgeCollected
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                        title="Alternar devolução de crachá"
                      >
                        <CreditCard className="w-3 h-3 shrink-0" />
                        <span className="truncate">{isBadgeCollected ? 'Crachá ✓' : 'Crachá Pend.'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SPREADSHEET TABLE (DESKTOP VIEW >= 768px) */}
      <div key={`desktop-${filterType}`} className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg animate-fadeSlideUp">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1060px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <th className="py-4 px-5 text-left w-[24%]">Integrante</th>
                <th className="py-4 px-4 text-left w-[14%]">Admissão & Tempo</th>
                <th className="py-4 px-4 text-left w-[18%]">Carga Horária</th>
                <th className="py-4 px-4 text-center w-[11%]">Faltas (FJ/FNJ)</th>
                <th className="py-4 px-3 text-center w-[6%]">ADV</th>
                <th className="py-4 px-4 text-center w-[10%]">Reposições</th>
                <th className="py-4 px-4 text-center w-[13%]">Certificação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-sm">
              {filteredActiveMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-300 text-base">
                    Nenhum integrante ativo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredActiveMembers.map((member, index) => {
                  const activeTime = calculateActiveTime(member.entryDate);
                  const activeWarnings = member.warnings.filter(w => w.active).length;
                  const fjCount = member.justifiedAbsences.length;
                  const fnjCount = member.unjustifiedAbsences.length;
                  const pendingRep = member.replacements.filter(r => !r.completed).length;
                  const progressPercent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
                  const isGoalMet = member.accumulatedHours >= config.minHoursForCertificate;
                  const isOneYear = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;
                  const isApto = isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);

                  return (
                    <tr 
                      key={member.id} 
                      onClick={() => onSelectMember(member)}
                      className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    >
                      {/* 1. Integrante (Nome + Cargo bem visíveis) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white group-hover:border-emerald-500/60 flex items-center justify-center font-bold text-xs shrink-0 transition-colors font-display">
                            {member.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm sm:text-base break-words font-display">
                              {member.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-mono">
                              <span>#{index + 1}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Admissão & Tempo Ativo */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-white text-sm font-semibold tabular-nums">
                            {member.entryDate}
                          </span>
                          <span className={`text-xs font-medium mt-1 ${isOneYear ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {activeTime.formatted} {isOneYear && '✓'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Carga Horária (Números Grandes e Barra Limpa) */}
                      <td className="py-4 px-4">
                        <div className="w-full max-w-[210px]">
                          <div className="flex items-baseline justify-between mb-1.5">
                            <div className="flex items-baseline gap-1 font-mono tabular-nums">
                              <span className={`text-base font-extrabold ${isGoalMet ? 'text-emerald-400' : 'text-white'}`}>
                                {member.accumulatedHours}h
                              </span>
                              <span className="text-xs text-slate-400">
                                / {config.minHoursForCertificate}h
                              </span>
                            </div>
                            <span className={`text-xs font-mono font-bold tabular-nums ${isGoalMet ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {progressPercent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                isGoalMet ? 'bg-emerald-500' : 'bg-teal-400'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 4. Faltas (FJ / FNJ) Lado a Lado com Alto Contraste */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 font-mono text-xs sm:text-sm tabular-nums">
                          <span 
                            title={`${fjCount} falta(s) justificada(s)`}
                            className={`px-2.5 py-1 rounded-lg font-bold ${
                              fjCount > 0 
                                 ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40' 
                                : 'bg-slate-950 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {fjCount} FJ
                          </span>
                          <span 
                            title={`${fnjCount} falta(s) não justificada(s)`}
                            className={`px-2.5 py-1 rounded-lg font-bold ${
                              fnjCount > 0 
                                ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40' 
                                : 'bg-slate-950 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {fnjCount} FNJ
                          </span>
                        </div>
                      </td>

                      {/* 5. Advertências (ADV) */}
                      <td className="py-4 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center font-mono text-xs sm:text-sm font-bold px-3 py-1 rounded-lg tabular-nums ${
                          activeWarnings > 0 
                            ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40' 
                            : 'bg-slate-950 text-slate-300 border border-slate-800'
                        }`}>
                          {activeWarnings}
                        </span>
                      </td>

                      {/* 6. Reposições */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {pendingRep > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40 font-mono tabular-nums">
                              <Repeat className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{pendingRep} pend.</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium text-xs sm:text-sm inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Em dia</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Indicador de Status de Certificação */}
                      <td className="py-4 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isApto ? (
                          <span 
                            title={`Apto ao Certificado (${member.accumulatedHours >= (config.minHoursForCertificate || 150) ? 'Carga horária ≥150h atingida' : 'Tempo de permanência ≥1 ano atingido'})`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Apto ✓</span>
                          </span>
                        ) : (
                          <span 
                            title={`Em andamento (${member.accumulatedHours}h / ${config.minHoursForCertificate || 150}h e ${activeTime.formatted})`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-950 text-slate-400 border border-slate-800"
                          >
                            <span>Não Apto</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPREADSHEET TABLE DE BAIXAS (DESKTOP VIEW >= 768px) */}
      {baixaMembers.length > 0 && (
        <div className="hidden md:block space-y-3 pt-2">
          <div 
            onClick={() => setIsBaixasOpen(!isBaixasOpen)}
            className="flex items-center justify-between px-1 cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg">
                <UserMinus className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-display group-hover:text-white transition-colors">
                Integrantes em Baixa ({filteredBaixaMembers.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Inativação reversível • Histórico preservado</span>
              <div className="p-1 text-slate-400 group-hover:text-white rounded-md shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBaixasOpen ? 'rotate-180 text-rose-400' : 'text-slate-400'}`} />
              </div>
            </div>
          </div>

          <div className={`grid transition-[grid-template-rows,opacity] duration-250 ease-in-out ${isBaixasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4 text-left w-[24%]">Integrante Inativo</th>
                        <th className="py-3.5 px-3 text-left w-[16%]">Admissão & Carga</th>
                        <th className="py-3.5 px-3 text-center w-[14%]">Aptidão</th>
                        <th className="py-3.5 px-3 text-center w-[23%]">Controle Certificado</th>
                        <th className="py-3.5 px-3 text-center w-[23%]">Devolução Crachá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredBaixaMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                            Nenhum integrante em baixa encontrado na busca.
                          </td>
                        </tr>
                      ) : (
                        filteredBaixaMembers.map((member) => {
                          const isApto = isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);
                          const isCertEmitted = Boolean(member.certificateEmitted);
                          const isBadgeCollected = Boolean(member.badgeCollected);

                          return (
                            <tr
                              key={member.id}
                              onClick={() => onSelectMember(member)}
                              className="hover:bg-slate-800/40 transition-colors group cursor-pointer opacity-90 hover:opacity-100"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0 font-display">
                                    {member.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-300 group-hover:text-emerald-400 transition-colors text-sm line-through decoration-slate-600 block truncate">
                                      {member.name}
                                    </span>
                                    <span className="text-[10px] text-rose-400/90 font-semibold uppercase">Em Baixa</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                                <div className="text-xs">{member.entryDate}</div>
                                <div className="text-emerald-400 font-bold">{member.accumulatedHours}h</div>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                {isApto ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Apto ✓</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Inapto</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={!isCoordination || !onUpdateMember}
                                  onClick={() => {
                                    if (onUpdateMember) {
                                      onUpdateMember({
                                        ...member,
                                        certificateEmitted: !member.certificateEmitted,
                                      });
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                    isCertEmitted
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                  } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>{isCertEmitted ? 'Cert. Emitido ✓' : 'Cert. Pendente'}</span>
                                </button>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={!isCoordination || !onUpdateMember}
                                  onClick={() => {
                                    if (onUpdateMember) {
                                      const nextCollected = !member.badgeCollected;
                                      onUpdateMember({
                                        ...member,
                                        badgeCollected: nextCollected,
                                        badgeCollectedDate: nextCollected ? new Date().toISOString().split('T')[0] : undefined,
                                      });
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                    isBadgeCollected
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                  } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>{isBadgeCollected ? 'Crachá Devolvido ✓' : 'Crachá Pendente'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Edit Member Modal Dialog (Triggered by pencil on member cards/rows) */}
      {editingMember && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto my-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 flex flex-col animate-modalPop">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Editar Dados do Integrante</h3>
                  <p className="text-[11px] text-slate-400">{editingMember.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingMember) return;
                const updated: Member = {
                  ...editingMember,
                  name: editName.trim(),
                  role: editRole,
                  entryDate: editEntryDate.trim(),
                  accumulatedHours: Number(editHours),
                  email: editEmail.trim(),
                  status: editStatus,
                };
                if (onUpdateMember) {
                  onUpdateMember(updated);
                }
                setEditingMember(null);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                    Cargo / Função *
                  </label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as RoleInLeague)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Ligante">Ligante</option>
                    <option value="Coordenação">Coordenação</option>
                  </select>
                </div>

                <div>
                  <CustomDatePicker
                    label="Data de Entrada / Admissão"
                    required
                    value={editEntryDate}
                    onChange={val => setEditEntryDate(val)}
                    format="BR"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                    Horas Totais Acumuladas *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editHours}
                    onChange={e => setEditHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    placeholder="exemplo@gmail.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                    Status na Liga
                  </label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as MemberStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="licenciado">Licenciado</option>
                    <option value="egresso">Egresso</option>
                    <option value="desligado">Desligado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
