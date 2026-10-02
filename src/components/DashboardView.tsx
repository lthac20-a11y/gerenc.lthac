import React from 'react';
import { 
  Users, 
  Clock, 
  Award, 
  Repeat, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ChevronRight, 
  ArrowUpRight, 
  ShieldAlert, 
  CalendarDays,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { Member, LeagueConfig } from '../types/league';
import { calculateLeagueStats, checkCertificateEligibility, calculateActiveTime } from '../utils/leagueCalculations';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  members: Member[];
  config: LeagueConfig;
  onSelectMember: (member: Member) => void;
  onNavigateTab: (tab: string) => void;
  onOpenAddMember: () => void;
  onOpenAddShift: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  config,
  onSelectMember,
  onNavigateTab,
  onOpenAddMember,
  onOpenAddShift,
}) => {
  const { isCoordination, isReader } = useAuth();
  const stats = calculateLeagueStats(members, config);
  const eligibilities = members.map(m => checkCertificateEligibility(m, config));
  const eligibleMembers = members.filter(m => eligibilities.find(e => e.memberId === m.id)?.isEligible);
  const pendingReplacementsMembers = members.filter(m => m.replacements.some(r => !r.completed));
  const warnedMembers = members.filter(m => m.warnings.some(w => w.active));

  // Top 5 members by hours
  const topMembers = [...members]
    .sort((a, b) => b.accumulatedHours - a.accumulatedHours)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome & League Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/80 rounded-2xl p-6 border border-slate-700/60 shadow-xl text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Gestão Integrada de Plantões
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                isCoordination 
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}>
                {isCoordination ? 'Perfil: Coordenação (Total)' : 'Perfil: Leitor (Modo Consulta)'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
              Painel de Controle da {config.leagueAcronym}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Monitore o banco de horas dos ligantes, registro de presenças em plantões, faltas justificadas com atestado, 
              controle de reposições pendentes e cumprimento das metas regimentais da liga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCoordination && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('certificates')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Ver Certificados ({stats.eligibleCount})</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAddShift}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl transition-all cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4 text-emerald-400" />
                  <span>Lançar Plantão</span>
                </button>
              </>
            )}

            {isReader && (
              <button
                type="button"
                onClick={() => onNavigateTab('members')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Consultar Membros & Horas</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div 
          onClick={() => onNavigateTab('members')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Membros Registrados</span>
            <div className="p-2 bg-slate-800 group-hover:bg-slate-700 rounded-lg text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">{stats.totalMembers}</span>
            <span className="text-xs font-medium text-emerald-400">
              {stats.activeMembers} ativos
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Membros e ligantes cadastrados</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>

        {/* Total Accumulated Hours */}
        <div 
          onClick={() => onNavigateTab('schedule')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Horas Gravadas</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 tracking-tight font-mono">
              {stats.totalHours}h
            </span>
            <span className="text-xs text-slate-400">
              cumpridas
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Média: {stats.avgHours}h / ligante</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>

        {/* Card 3: Certificates (Visible only to Coordination) OR General Attendance */}
        {isCoordination ? (
          <div 
            onClick={() => onNavigateTab('certificates')}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aptos ao Certificado</span>
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/30">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-400 tracking-tight">{stats.eligibleCount}</span>
              <span className="text-xs text-slate-400">
                de {stats.totalMembers} ({Math.round((stats.eligibleCount / (stats.totalMembers || 1)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.eligibleCount / (stats.totalMembers || 1)) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div 
            onClick={() => onNavigateTab('members')}
            className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Meta Regimental</span>
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight font-mono">{config.minHoursForCertificate}h</span>
              <span className="text-xs text-emerald-400">mínimas</span>
            </div>
            <p className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Critério de horas da liga</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
            </p>
          </div>
        )}

        {/* Pending Replacements & Warnings */}
        <div 
          onClick={() => onNavigateTab('replacements')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reposições & Faltas</span>
            <div className={`p-2 rounded-lg ${stats.totalPendingReplacements > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 tracking-tight font-mono">
              {stats.totalPendingReplacements}
            </span>
            <span className="text-xs text-slate-400">
              em {stats.membersWithPendingReplacements} membros
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>{stats.membersWithWarnings} ligantes com ADV ativa</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
      </div>

      {/* Main Content Grid: Top Performers & Pending Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Members by Hours (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Membros com Maior Carga Horária
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Progresso rumo à meta regimental de {config.minHoursForCertificate} horas
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('members')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-800/60">
            {topMembers.map((member, index) => {
              const activeTime = calculateActiveTime(member.entryDate);
              const percent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
              const isGoalMet = member.accumulatedHours >= config.minHoursForCertificate;

              return (
                <div 
                  key={member.id} 
                  onClick={() => onSelectMember(member)}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      index === 1 ? 'bg-slate-700 text-slate-200' :
                      index === 2 ? 'bg-amber-800/30 text-amber-400' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs truncate">
                          {member.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          member.role === 'Coordenação' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Admissão: {member.entryDate} • {activeTime.formatted}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm font-bold font-mono block ${isGoalMet ? 'text-emerald-400' : 'text-white'}`}>
                        {member.accumulatedHours}h
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {percent}% da meta
                      </span>
                    </div>

                    <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className={`h-full rounded-full ${isGoalMet ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Pending Replacements & Warnings */}
        <div className="space-y-4">
          
          {/* Pending Replacements List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Repeat className="w-4 h-4 text-amber-400" />
                Reposições Pendentes
              </h2>
              <span className="text-xs text-amber-400 font-mono font-bold">
                {stats.totalPendingReplacements} pendências
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
              {pendingReplacementsMembers.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs">Nenhuma reposição pendente!</p>
                </div>
              ) : (
                pendingReplacementsMembers.map(m => {
                  const pendingCount = m.replacements.filter(r => !r.completed).length;
                  return (
                    <div 
                      key={m.id}
                      onClick={() => onSelectMember(m)}
                      className="p-2.5 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-white text-xs truncate block">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {m.role} • {m.accumulatedHours}h
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 shrink-0 font-mono">
                        {pendingCount} REP
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Warnings Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Advertências Ativas
              </h2>
              <span className="text-xs text-rose-400 font-mono font-bold">
                {stats.membersWithWarnings} ligantes
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
              {warnedMembers.length === 0 ? (
                <div className="text-center py-5 text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs">Nenhuma advertência ativa!</p>
                </div>
              ) : (
                warnedMembers.map(m => {
                  const activeWarnCount = m.warnings.filter(w => w.active).length;
                  return (
                    <div 
                      key={m.id}
                      onClick={() => onSelectMember(m)}
                      className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-center justify-between hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-white text-xs truncate block">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {m.role}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 shrink-0 font-mono">
                        {activeWarnCount} ADV
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
