import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Award, 
  AlertTriangle, 
  Repeat, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown,
  ChevronRight,
  ShieldAlert,
  Calendar,
  LayoutList,
  LayoutGrid,
  TrendingUp,
  Users
} from 'lucide-react';
import { Member, LeagueConfig } from '../types/league';
import { checkCertificateEligibility, calculateActiveTime } from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';

interface MembersViewProps {
  members: Member[];
  config: LeagueConfig;
  onSelectMember: (member: Member) => void;
  onOpenAddMember: () => void;
  onOpenCertificateModal: (member: Member) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  config,
  onSelectMember,
  onOpenAddMember,
  onOpenCertificateModal,
}) => {
  const { isCoordination, isReader } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'name' | 'hours-desc' | 'hours-asc' | 'date-desc' | 'adv'>('hours-desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Compute certificate eligibility map
  const eligibilitiesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof checkCertificateEligibility>>();
    members.forEach(m => {
      map.set(m.id, checkCertificateEligibility(m, config));
    });
    return map;
  }, [members, config]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const eligibility = eligibilitiesMap.get(member.id);

      if (filterType === 'aptos') {
        return eligibility?.isEligible;
      }
      if (filterType === 'ligantes') {
        return member.role === 'Ligante';
      }
      if (filterType === 'coordenacao') {
        return member.role === 'Coordenação';
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
  }, [members, searchTerm, filterType, sortBy, eligibilitiesMap]);

  // Statistics for top ribbon
  const totalHours = members.reduce((acc, m) => acc + (m.accumulatedHours || 0), 0);
  const eligibleCount = members.filter(m => eligibilitiesMap.get(m.id)?.isEligible).length;
  const pendingReplacementsCount = members.filter(m => m.replacements.some(r => !r.completed)).length;

  return (
    <div className="space-y-5">
      {/* Top Header Card with Quick Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight font-serif">
                Quadro de Membros & Banco de Horas
              </h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Meta: {config.minHoursForCertificate} Horas
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registro oficial de frequência, acúmulo de horas de plantão, assiduidade e controle de certificados
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-slate-800 border border-slate-700 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Tabela Alinhada"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Fichas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Add Member Button (Coordination Only) */}
            {isCoordination && (
              <button
                type="button"
                onClick={onOpenAddMember}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Ligante</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-slate-700/50 text-slate-300 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Total Cadastrado</span>
              <span className="text-base font-bold text-white font-mono">{members.length} ligantes</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Horas Cumpridas</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{totalHours} horas</span>
            </div>
          </div>

          {isCoordination ? (
            <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Aptos ao Certificado</span>
                <span className="text-base font-bold text-white font-mono">{eligibleCount} ({config.minHoursForCertificate}h)</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Média por Membro</span>
                <span className="text-base font-bold text-white font-mono">
                  {members.length > 0 ? Math.round(totalHours / members.length) : 0}h / ligante
                </span>
              </div>
            </div>
          )}

          <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">Reposições Pendentes</span>
              <span className="text-base font-bold text-amber-400 font-mono">{pendingReplacementsCount} ligantes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Sorters & Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar ligante pelo nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {[
            { id: 'todos', label: 'Todos', count: members.length },
            ...(isCoordination ? [{ id: 'aptos', label: `Aptos (≥${config.minHoursForCertificate}h)`, count: eligibleCount, badgeClass: 'bg-emerald-500/20 text-emerald-300' }] : []),
            { id: 'ligantes', label: 'Ligantes', count: members.filter(m => m.role === 'Ligante').length },
            { id: 'coordenacao', label: 'Coordenação', count: members.filter(m => m.role === 'Coordenação').length, badgeClass: 'bg-purple-500/20 text-purple-300' },
            { id: 'reposicoes', label: 'Reposições', count: pendingReplacementsCount, badgeClass: 'bg-amber-500/20 text-amber-300' },
            { id: 'advertencias', label: 'Advertências', count: members.filter(m => m.warnings.some(w => w.active)).length, badgeClass: 'bg-rose-500/20 text-rose-300' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === tab.id
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tab.badgeClass || 'bg-slate-800 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs text-slate-300 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
          >
            <option value="hours-desc" className="bg-slate-800">Mais horas</option>
            <option value="hours-asc" className="bg-slate-800">Menos horas</option>
            <option value="name" className="bg-slate-800">Nome (A-Z)</option>
            <option value="adv" className="bg-slate-800">Mais advertências</option>
          </select>
        </div>
      </div>

      {/* VIEW 1: STRICTLY ALIGNED STRUCTURED TABLE */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[1040px]">
              <colgroup><col className="w-[22%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[18%]" /><col className="w-[10%]" /><col className="w-[7%]" /><col className="w-[15%]" /><col className="w-[6%]" /></colgroup>

              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-left">Nome do Membro</th>
                  <th className="py-3.5 px-3 text-center">Função</th>
                  <th className="py-3.5 px-3 text-center">Admissão</th>
                  <th className="py-3.5 px-3 text-center">Progresso (Horas & 1 Ano)</th>
                  <th className="py-3.5 px-3 text-center">Faltas (FJ / FNJ)</th>
                  <th className="py-3.5 px-2 text-center">ADV</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Reposições</th>
                  <th className="py-3.5 px-4 text-center">Ficha</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      Nenhum membro encontrado com os critérios de busca selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const eligibility = eligibilitiesMap.get(member.id);
                    const activeTime = calculateActiveTime(member.entryDate);
                    const activeWarnings = member.warnings.filter(w => w.active).length;
                    const fjCount = member.justifiedAbsences.length;
                    const fnjCount = member.unjustifiedAbsences.length;
                    const pendingRep = member.replacements.filter(r => !r.completed).length;
                    const progressPercent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
                    const tenureDaysPercent = Math.min(100, Math.round((activeTime.totalDays / 365) * 100));
                    const isOneYear = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;

                    return (
                      <tr 
                        key={member.id} 
                        onClick={() => onSelectMember(member)}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      >
                        {/* 1. Nome do Membro */}
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-slate-200 text-xs shrink-0 group-hover:border-emerald-500/50 transition-colors">
                              {member.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors text-sm truncate block">
                                {member.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Função */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            member.role === 'Coordenação'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {member.role}
                          </span>
                        </td>

                        {/* 3. Admissão */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-mono text-slate-200 text-[11px] block font-medium">
                            {member.entryDate}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {activeTime.formatted}
                          </span>
                        </td>

                        {/* 4. Horas Acumuladas & Barra de Progresso de 1 Ano */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            {/* Barra 1: Horas (Meta 150h) */}
                            <div className="w-full max-w-[130px]">
                              <div className="flex items-baseline justify-between text-[10px] whitespace-nowrap mb-0.5">
                                <span className="font-bold text-white font-mono text-[11px]">
                                  {member.accumulatedHours}h
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  meta {config.minHoursForCertificate}h
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/60" title={`Carga Horária: ${member.accumulatedHours}h de ${config.minHoursForCertificate}h (${progressPercent}%)`}>
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    member.accumulatedHours >= config.minHoursForCertificate 
                                      ? 'bg-emerald-500' 
                                      : 'bg-emerald-400'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Barra 2: Tempo de Admissão até completar 1 ano */}
                            <div className="w-full max-w-[130px]">
                              <div className="flex items-baseline justify-between text-[10px] whitespace-nowrap mb-0.5">
                                <span className="text-slate-300 font-sans truncate max-w-[80px]" title={activeTime.formatted}>
                                  {activeTime.formatted}
                                </span>
                                <span className={`font-mono text-[10px] font-semibold ${isOneYear ? 'text-teal-400' : 'text-purple-400'}`}>
                                  {isOneYear ? '1 ano ✓' : `${tenureDaysPercent}%`}
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/60" title={`Tempo de Admissão: ${activeTime.formatted} de 1 ano (${tenureDaysPercent}%)`}>
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isOneYear 
                                      ? 'bg-teal-400' 
                                      : 'bg-gradient-to-r from-purple-500 to-indigo-400'
                                  }`}
                                  style={{ width: `${tenureDaysPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 5. Faltas (FJ acima de FNJ) */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-1 font-mono text-[11px]">
                            <span 
                              title={`${fjCount} falta(s) justificada(s)`}
                              className={`px-2 py-0.5 rounded font-semibold w-full max-w-[76px] text-center ${
                                fjCount > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-500 bg-slate-800/40'
                              }`}
                            >
                              {fjCount} FJ
                            </span>
                            <span 
                              title={`${fnjCount} falta(s) não justificada(s)`}
                              className={`px-2 py-0.5 rounded font-bold w-full max-w-[76px] text-center ${
                                fnjCount > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-500 bg-slate-800/40'
                              }`}
                            >
                              {fnjCount} FNJ
                            </span>
                          </div>
                        </td>

                        {/* 6. Advertências (ADV badge) */}
                        <td className="py-3.5 px-2 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            activeWarnings > 0 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                              : 'text-slate-500'
                          }`}>
                            {activeWarnings} ADV
                          </span>
                        </td>

                        {/* 7. Reposições (REP status) */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {pendingRep > 0 ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap shadow-sm">
                              <Repeat className="w-3.5 h-3.5 shrink-0" />
                              <span>{pendingRep} {pendingRep === 1 ? 'pendente' : 'pendentes'}</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-mono text-[11px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Em dia</span>
                            </span>
                          )}
                        </td>

                        {/* 8. Botão de Ficha */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectMember(member)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Abrir Prontuário do Membro"
                          >
                            <ChevronRight className="w-4 h-4" />
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
      ) : (
        /* VIEW 2: ALTERNATIVE CARDS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const eligibility = eligibilitiesMap.get(member.id);
            const activeTime = calculateActiveTime(member.entryDate);
            const activeWarnings = member.warnings.filter(w => w.active).length;
            const fjCount = member.justifiedAbsences.length;
            const fnjCount = member.unjustifiedAbsences.length;
            const pendingRep = member.replacements.filter(r => !r.completed).length;
            const progressPercent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember(member)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-sm cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm group-hover:border-emerald-500 transition-colors">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors text-sm">
                          {member.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-semibold border mt-0.5 ${
                          member.role === 'Coordenação'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg">
                      {member.accumulatedHours}h
                    </span>
                  </div>

                  {/* Progress towards 150h */}
                  <div className="space-y-2 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Horas Acumuladas ({config.minHoursForCertificate}h)</span>
                        <span className="font-mono text-emerald-400 font-medium">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${member.accumulatedHours >= config.minHoursForCertificate ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress towards 1 Year */}
                    {(() => {
                      const tenureDaysPercent = Math.min(100, Math.round((activeTime.totalDays / 365) * 100));
                      const isOneYear = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;

                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Tempo de Admissão (1 ano)</span>
                            <span className={`font-mono font-medium ${isOneYear ? 'text-teal-400 font-bold' : 'text-purple-400'}`}>
                              {isOneYear ? '1 ano completo ✓' : `${activeTime.formatted} (${tenureDaysPercent}%)`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isOneYear ? 'bg-teal-400' : 'bg-gradient-to-r from-purple-500 to-indigo-400'}`}
                              style={{ width: `${tenureDaysPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Stats Grid inside Card */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Admissão</span>
                      <span className="font-mono text-slate-200 text-[11px]">{member.entryDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-0.5">Faltas</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[10px] font-mono px-1 rounded ${fjCount > 0 ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500'}`}>
                          {fjCount} FJ
                        </span>
                        <span className={`text-[10px] font-mono px-1 rounded font-bold ${fnjCount > 0 ? 'bg-rose-500/20 text-rose-300' : 'text-slate-500'}`}>
                          {fnjCount} FNJ
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">ADV / REP</span>
                      <span className="font-mono text-slate-300 text-[11px] block mt-1">
                        {activeWarnings} ADV / {pendingRep} REP
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Tempo: {activeTime.formatted}
                  </span>
                  <span className="text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Ver prontuário
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
