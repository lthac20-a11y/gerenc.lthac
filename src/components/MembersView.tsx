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
  Users
} from 'lucide-react';
import { Member, LeagueConfig } from '../types/league';
import { 
  checkCertificateEligibility, 
  calculateActiveTime,
  isMemberEligibleForCertificate 
} from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';

interface MembersViewProps {
  members: Member[];
  config: LeagueConfig;
  onSelectMember: (member: Member) => void;
  onOpenAddMember: () => void;
  onOpenCertificateModal: (member: Member) => void;
  onOpenAddShiftForMember?: (memberId: string) => void;
  onOpenAddReplacementForMember?: (memberId: string) => void;
  onOpenAddWarningForMember?: (memberId: string) => void;
  onRequestDeleteMember?: (memberId: string) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  config,
  onSelectMember,
  onOpenAddMember,
}) => {
  const { isCoordination } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'name' | 'hours-desc' | 'hours-asc' | 'date-desc' | 'adv'>('hours-desc');

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

      if (filterType === 'aptos') {
        return isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150);
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
  }, [members, searchTerm, filterType, sortBy, config]);

  // Statistics for top ribbon
  const totalHours = members.reduce((acc, m) => acc + (m.accumulatedHours || 0), 0);
  const eligibleCount = members.filter(m => isMemberEligibleForCertificate(m, config.minHoursForCertificate || 150)).length;
  const pendingReplacementsCount = members.filter(m => m.replacements.some(r => !r.completed)).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                Integrantes & Banco de Horas
              </h2>
              <span className="text-xs sm:text-sm text-emerald-400 font-medium">
                · Meta de Certificação: <strong className="font-mono">{config.minHoursForCertificate}h</strong>
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Acompanhamento detalhado de carga horária, tempo de permanência, assiduidade e reposições
            </p>
          </div>

          {/* Add Member Button (Coordination Only) */}
          {isCoordination && (
            <div className="flex items-center gap-3 self-start md:self-center">
              <button
                type="button"
                onClick={onOpenAddMember}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Integrante</span>
              </button>
            </div>
          )}
        </div>

        {/* High-Visibility Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
            <div className="p-2.5 bg-slate-800 text-slate-200 rounded-xl shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-300 font-medium block">Total de Integrantes</span>
              <span className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">{members.length}</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-300 font-medium block">Horas Acumuladas</span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">{totalHours}h</span>
            </div>
          </div>

          {isCoordination ? (
            <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-300 font-medium block">Aptos ao Certificado</span>
                <span className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                  {eligibleCount} <span className="text-xs text-slate-400 font-normal">de {members.length}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-300 font-medium block">Média por Integrante</span>
                <span className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                  {members.length > 0 ? Math.round(totalHours / members.length) : 0}h
                </span>
              </div>
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-xl shrink-0">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-300 font-medium block">Com Reposição Pendente</span>
              <span className="text-xl sm:text-2xl font-bold text-amber-400 font-mono tabular-nums">{pendingReplacementsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filters & Sort Controls Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        {/* 1º: Campo de Busca (Busca) */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar integrante por nome ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2º a 5º: Botões de Filtro Ordenados [Todos -> Ligantes -> Coordenação -> Aptos] */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          {[
            { id: 'todos', label: 'Todos', count: members.length },
            { id: 'ligantes', label: 'Ligantes', count: members.filter(m => m.role === 'Ligante').length },
            { id: 'coordenacao', label: 'Coordenação', count: members.filter(m => m.role === 'Coordenação').length },
            { id: 'aptos', label: `Aptos (≥${config.minHoursForCertificate}h)`, count: eligibleCount },
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-xs font-mono tabular-nums ${isActive ? 'text-emerald-200 font-bold' : 'text-slate-400'}`}>
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 px-3.5 py-2 rounded-xl text-sm text-slate-200 shrink-0 self-start xl:self-center">
          <ArrowUpDown className="w-4 h-4 text-emerald-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs sm:text-sm"
          >
            <option value="hours-desc" className="bg-slate-900">Maior carga horária</option>
            <option value="hours-asc" className="bg-slate-900">Menor carga horária</option>
            <option value="name" className="bg-slate-900">Ordem alfabética (A-Z)</option>
            <option value="adv" className="bg-slate-900">Mais advertências</option>
          </select>
        </div>
      </div>

      {/* SPREADSHEET TABLE (FIXED DEFAULT VIEW) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg mb-16">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1060px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <th className="py-4 px-5 text-left w-[24%]">Integrante</th>
                <th className="py-4 px-4 text-left w-[14%]">Admissão & Tempo</th>
                <th className="py-4 px-4 text-left w-[18%]">Carga Horária</th>
                <th className="py-4 px-4 text-center w-[12%]">Faltas (FJ / FNJ)</th>
                <th className="py-4 px-3 text-center w-[7%]">ADV</th>
                <th className="py-4 px-4 text-center w-[11%]">Reposições</th>
                <th className="py-4 px-4 text-center w-[14%]">Certificação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-sm">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-300 text-base">
                    Nenhum integrante encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member, index) => {
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
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-colors ${
                            member.role === 'Coordenação'
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                              : 'bg-slate-800 border-slate-700 text-white group-hover:border-emerald-500/60'
                          }`}>
                            {member.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white group-hover:text-emerald-400 transition-colors text-base truncate">
                                {member.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs">
                              <span className={member.role === 'Coordenação' ? 'text-purple-300 font-semibold' : 'text-slate-300 font-medium'}>
                                {member.role}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-400 font-mono">#{index + 1}</span>
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
                              className={`h-full rounded-full transition-all duration-300 ${
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
    </div>
  );
};
