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
  ShieldAlert
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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full">
      {/* Welcome & League Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/80 rounded-2xl p-4 border border-slate-700/60 shadow-xl text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold">
              Gestão Integrada de Plantões
            </span>
            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold border ${
              isCoordination 
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            }`}>
              {isCoordination ? 'Perfil: Coordenação (Total)' : 'Perfil: Leitor (Modo Consulta)'}
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white font-display">
            Painel de Controle da {config.leagueAcronym}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Monitore o banco de horas dos ligantes, registro de presenças em plantões, faltas justificadas com atestado, 
            controle de reposições pendentes e cumprimento das metas regimentais da liga.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Members */}
        <div 
          onClick={() => onNavigateTab('members')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">MEMBROS</span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center text-emerald-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white tracking-tight">{stats.totalMembers}</span>
            <span className="text-xs font-medium text-emerald-400">
              {stats.activeMembers} ativos
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate">Total cadastrados</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
          </div>
        </div>

        {/* Total Accumulated Hours */}
        <div 
          onClick={() => onNavigateTab('schedule')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">HORAS GRAVADAS</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-400 tracking-tight font-mono">
              {stats.totalHours}h
            </span>
            <span className="text-xs text-slate-400">
              feitas
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate">Média: {stats.avgHours}h/membro</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
          </div>
        </div>

        {/* Eligible Members */}
        <div 
          onClick={() => onNavigateTab(isCoordination ? 'certificates' : 'members')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">APTOS</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-400 tracking-tight font-mono">{stats.eligibleCount}</span>
            <span className="text-xs text-slate-400">
              de {stats.totalMembers} ({Math.round((stats.eligibleCount / (stats.totalMembers || 1)) * 100)}%)
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate">Carga ≥{config.minHoursForCertificate}h</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
          </div>
        </div>

        {/* Pending Replacements */}
        <div 
          onClick={() => onNavigateTab('replacements')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">REPOSIÇÕES</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${stats.totalPendingReplacements > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl font-bold tracking-tight font-mono ${stats.totalPendingReplacements > 0 ? 'text-amber-400' : 'text-white'}`}>
              {stats.totalPendingReplacements}
            </span>
            <span className="text-xs text-slate-400">
              pendentes
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate">{stats.membersWithWarnings} com ADV</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Top Performers & Pending Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Members by Hours (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-bold text-white whitespace-nowrap font-display truncate">
                Top Carga Horária
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('members')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {topMembers.map((member, index) => {
              const activeTime = calculateActiveTime(member.entryDate);
              const shortTime = activeTime.formatted
                .replace(/ anos?/g, 'a')
                .replace(/ mes(es|ês)/g, 'm')
                .replace(/ e /g, ' ');
              const percent = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
              const isGoalMet = member.accumulatedHours >= config.minHoursForCertificate;

              return (
                <div 
                  key={member.id} 
                  onClick={() => onSelectMember(member)}
                  className="px-3 py-2 bg-slate-800/40 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl flex items-center justify-between gap-2.5 transition-all hover:bg-slate-800/60 cursor-pointer group shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-6.5 h-6.5 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                      index === 1 ? 'bg-slate-700/50 text-slate-200 border-slate-600' :
                      index === 2 ? 'bg-amber-800/25 text-amber-400 border-amber-700/30' :
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white text-xs sm:text-sm group-hover:text-emerald-300 transition-colors truncate block">
                        {member.name}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate">
                        Adm: {member.entryDate} • {shortTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right whitespace-nowrap">
                      <span className={`text-xs sm:text-sm font-bold font-mono ${isGoalMet ? 'text-emerald-400' : 'text-white'}`}>
                        {member.accumulatedHours}h
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                        ({percent}%)
                      </span>
                    </div>

                    <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700 hidden sm:block">
                      <div 
                        className={`h-full rounded-full transition-all ${isGoalMet ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-emerald-500'}`}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Repeat className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-white whitespace-nowrap font-display truncate">
                  Reposições Pendentes
                </h2>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('replacements')}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer active:scale-95"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {pendingReplacementsMembers.length === 0 ? (
                <div className="text-center py-4 text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs font-medium">Nenhuma reposição pendente!</p>
                </div>
              ) : (
                pendingReplacementsMembers.slice(0, 4).map(m => {
                  const pendingCount = m.replacements.filter(r => !r.completed).length;
                  return (
                    <div 
                      key={m.id}
                      onClick={() => onSelectMember(m)}
                      className="px-3 py-2 bg-slate-800/40 border border-slate-800/80 hover:border-amber-500/30 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-800/60 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-semibold text-white text-xs truncate">
                          {m.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                          • {m.accumulatedHours}h
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shrink-0 font-mono whitespace-nowrap">
                        {pendingCount} REP
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Warnings Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-white whitespace-nowrap font-display truncate">
                  Advertências Ativas
                </h2>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('disciplinary')}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer active:scale-95"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {warnedMembers.length === 0 ? (
                <div className="text-center py-4 text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs font-medium">Nenhuma advertência ativa!</p>
                </div>
              ) : (
                warnedMembers.slice(0, 4).map(m => {
                  const activeWarnCount = m.warnings.filter(w => w.active).length;
                  const shortDate = m.entryDate.length === 10 && m.entryDate.includes('/') 
                    ? `${m.entryDate.slice(0, 6)}${m.entryDate.slice(8)}`
                    : m.entryDate;

                  return (
                    <div 
                      key={m.id}
                      onClick={() => onSelectMember(m)}
                      className="px-3 py-2 bg-slate-800/40 border border-slate-800/80 hover:border-rose-500/30 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-800/60 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-semibold text-white text-xs truncate">
                          {m.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                          • {shortDate}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 shrink-0 font-mono whitespace-nowrap">
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
