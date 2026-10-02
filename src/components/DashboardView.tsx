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
  CalendarDays
} from 'lucide-react';
import { Member, LeagueConfig } from '../types/league';
import { calculateLeagueStats, checkCertificateEligibility, calculateActiveTime } from '../utils/leagueCalculations';

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
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Gestão Integrada de Plantões e Certificação
              </span>
              <span className="text-xs text-slate-400">
                Critério de Certificado: {config.minHoursForCertificate}h mínimas & {config.minActiveMonthsForCertificate} meses
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
              Painel de Controle da {config.leagueAcronym}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Monitore o banco de horas dos ligantes, registro de presenças em plantões, faltas justificadas com atestado, 
              controle de reposições pendentes e critérios regimentais para emissão de certificados oficiais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('certificates')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Award className="w-4 h-4" />
              Ver Certificados ({stats.eligibleCount})
            </button>
            <button
              onClick={onOpenAddShift}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl transition-all cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              Lançar Plantão
            </button>
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
            <span>Inclui efetivos e trainees</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>

        {/* Accumulated Hours */}
        <div 
          onClick={() => onNavigateTab('schedule')}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Carga Horária Total</span>
            <div className="p-2 bg-slate-800 group-hover:bg-slate-700 rounded-lg text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">{stats.totalHours}h</span>
            <span className="text-xs font-medium text-blue-400">
              Média {stats.avgHours}h/membro
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Horas em plantões e aulas</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>

        {/* Eligible for Certificate */}
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
            <span className="text-3xl font-bold text-amber-400 tracking-tight">
              {stats.totalPendingReplacements}
            </span>
            <span className="text-xs text-slate-400">
              em {stats.membersWithPendingReplacements} membros
            </span>
          </div>
          <p className="mt-2 text-xs text-amber-300/80 flex items-center justify-between">
            <span>{stats.membersWithWarnings} ligante(s) com advertência</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
      </div>

      {/* Grid: Action Center & League Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Pending Replacements & Absences Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reposições Pendentes Alert Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Membros com Reposições Pendentes de Plantão</h3>
                  <p className="text-xs text-slate-400">Faltas não justificadas ou justificadas que requerem reposição</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('replacements')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                Gerenciar todas
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingReplacementsMembers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-lg">
                Nenhum membro possui reposição pendente no momento. Frequência 100% em dia!
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {pendingReplacementsMembers.map((member) => {
                  const pendingCount = member.replacements.filter(r => !r.completed).length;
                  const dates = member.replacements.map(r => r.scheduledDate).filter(Boolean).join(', ');
                  return (
                    <div 
                      key={member.id}
                      onClick={() => onSelectMember(member)}
                      className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-semibold text-slate-300 text-xs">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white hover:text-emerald-400 transition-colors">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.role} • Entrada: {member.entryDate}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {pendingCount} reposição(ões)
                        </span>
                        {dates && (
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Previstas: {dates}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Membros Próximos de se Certificar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Líderes de Carga Horária e Elegibilidade</h3>
                  <p className="text-xs text-slate-400">Progresso para emissão de certificado oficial ({config.minHoursForCertificate}h)</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('certificates')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                Ver todos
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {topMembers.map((member) => {
                const eligibility = eligibilities.find(e => e.memberId === member.id);
                const activeTime = calculateActiveTime(member.entryDate);
                const progressPct = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));

                return (
                  <div 
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                    className="p-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 rounded-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{member.name}</span>
                        <span className="text-xs text-slate-400 font-light">({member.role})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{member.accumulatedHours}h</span>
                        {eligibility?.isEligible ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Apto
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-700 text-slate-300">
                            {member.accumulatedHours >= config.minHoursForCertificate ? 'Pendências' : `${config.minHoursForCertificate - member.accumulatedHours}h rest.`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          progressPct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>Tempo ativo: {activeTime.formatted} (desde {member.entryDate})</span>
                      <span>{progressPct}% da meta</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Regimental Rules & Disciplinary Vigilance */}
        <div className="space-y-6">
          {/* Regimental Rules Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Critérios Regimentais</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Parâmetros exigidos pelo estatuto da liga para deferimento de certificação e permanência:
            </p>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Carga Horária Mínima:</strong> {config.minHoursForCertificate} horas comprovadas em plantões ou atividades.
                </div>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Permanência Ativa:</strong> Mínimo de {config.minActiveMonthsForCertificate} meses contínuos de dedicação.
                </div>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Reposições de Plantão:</strong> Faltas devem estar 100% repostas antes da emissão.
                </div>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Disciplina:</strong> Máximo de {config.maxActiveWarningsAllowed} advertência ativa no prontuário.
                </div>
              </li>
            </ul>
          </div>

          {/* Membros sob Advertência Disciplinar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Quadro Disciplinar (ADV)</h3>
              </div>
              <button
                onClick={() => onNavigateTab('disciplinary')}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                Ver tudo
              </button>
            </div>

            {warnedMembers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-800 rounded-lg">
                Nenhum membro possui advertências ativas registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {warnedMembers.map(member => (
                  <div 
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                    className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg cursor-pointer hover:bg-rose-950/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-rose-200">{member.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {member.warnings.filter(w => w.active).length} ADV
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                      {member.warnings[member.warnings.length - 1]?.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
