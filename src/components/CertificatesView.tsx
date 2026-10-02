import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Sliders, 
  Search, 
  ChevronRight,
  Printer,
  Sparkles,
  Info
} from 'lucide-react';
import { Member, LeagueConfig, CertificateEligibility } from '../types/league';
import { checkCertificateEligibility, calculateActiveTime } from '../utils/leagueCalculations';

interface CertificatesViewProps {
  members: Member[];
  config: LeagueConfig;
  onUpdateConfig: (newConfig: LeagueConfig) => void;
  onOpenCertificateModal: (member: Member) => void;
  onSelectMember: (member: Member) => void;
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  members,
  config,
  onUpdateConfig,
  onOpenCertificateModal,
  onSelectMember,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'aptos' | 'inaptos'>('todos');
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Compute eligibilities
  const eligibilities = members.map(m => checkCertificateEligibility(m, config));
  const eligibleCount = eligibilities.filter(e => e.isEligible).length;

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const eligibility = eligibilities.find(e => e.memberId === member.id);
    if (statusFilter === 'aptos') return eligibility?.isEligible;
    if (statusFilter === 'inaptos') return !eligibility?.isEligible;
    return true;
  }).sort((a, b) => {
    // Eligible first, then by hours descending
    const eligA = eligibilities.find(e => e.memberId === a.id)?.isEligible ? 1 : 0;
    const eligB = eligibilities.find(e => e.memberId === b.id)?.isEligible ? 1 : 0;
    if (eligA !== eligB) return eligB - eligA;
    return b.accumulatedHours - a.accumulatedHours;
  });

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/70 border border-slate-700/80 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                Módulo de Certificação Acadêmica
              </span>
              <span className="text-xs text-slate-400">
                Regimento Oficial {config.leagueAcronym}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-serif">
              Aptidão e Emissão de Certificados
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Verificação automática de todos os requisitos do estatuto: carga horária mínima ({config.minHoursForCertificate}h), 
              tempo de permanência na liga ({config.minActiveMonthsForCertificate} meses), quitação de reposições e 
              prontuário disciplinar sem advertências impeditivas.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl transition-colors cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              {showConfigPanel ? 'Ocultar Requisitos' : 'Ajustar Requisitos'}
            </button>
          </div>
        </div>

        {/* Live Criteria Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-700/80 text-xs">
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">1. Horas Mínimas</span>
            <span className="text-sm font-bold text-white font-mono">{config.minHoursForCertificate} horas</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">2. Tempo Ativo Mínimo</span>
            <span className="text-sm font-bold text-white font-mono">{config.minActiveMonthsForCertificate} meses ({Math.floor(config.minActiveMonthsForCertificate / 12)} ano)</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">3. Reposições Pendentes</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">0 permitidas</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">4. Advertências Ativas</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">Máx. {config.maxActiveWarningsAllowed}</span>
          </div>
        </div>
      </div>

      {/* Criteria Customizer Drawer */}
      {showConfigPanel && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Configurar Regras de Concessão de Certificado da Liga
            </h3>
            <span className="text-xs text-slate-400">Altere os parâmetros para recalcular imediatamente a lista de aptos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Horas Mínimas para Certificado (hs)
              </label>
              <input
                type="number"
                min={10}
                step={12}
                value={config.minHoursForCertificate}
                onChange={e => onUpdateConfig({ ...config, minHoursForCertificate: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Geralmente múltiplos de 12 (ex: 120, 180, 240hs)</p>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Tempo Ativo Mínimo na Liga (meses)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={config.minActiveMonthsForCertificate}
                onChange={e => onUpdateConfig({ ...config, minActiveMonthsForCertificate: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Ex: 6 meses (1 semestre) ou 12 meses (1 ano acadêmico)</p>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Máximo de Advertências Permitidas
              </label>
              <select
                value={config.maxActiveWarningsAllowed}
                onChange={e => onUpdateConfig({ ...config, maxActiveWarningsAllowed: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value={0}>0 (Nenhuma advertência tolerada)</option>
                <option value={1}>Até 1 advertência leve</option>
                <option value={2}>Até 2 advertências</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Regra disciplinar estatutária</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-1">
          {[
            { id: 'todos', label: 'Todos os Ligantes', count: members.length },
            { id: 'aptos', label: 'Aptos ao Certificado', count: eligibleCount, activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            { id: 'inaptos', label: 'Pendências a Cumprir', count: members.length - eligibleCount, activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.id
                  ? `${tab.activeClass || 'bg-slate-800 text-white'} border shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do ligante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Member Certificate Eligibility Cards */}
      <div className="space-y-3">
        {filteredMembers.map((member) => {
          const eligibility = checkCertificateEligibility(member, config);
          const activeTime = calculateActiveTime(member.entryDate);
          const hoursProgress = Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100));
          const timeProgress = Math.min(100, Math.round((activeTime.totalMonths / config.minActiveMonthsForCertificate) * 100));

          return (
            <div
              key={member.id}
              className={`bg-slate-900 border rounded-xl p-4 sm:p-5 transition-all ${
                eligibility.isEligible
                  ? 'border-emerald-800/50 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 shadow-sm'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Left: Member Identity & Status */}
                <div className="flex items-start gap-3.5">
                  <div 
                    onClick={() => onSelectMember(member)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-base cursor-pointer shrink-0 border ${
                      eligibility.isEligible
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {member.name.charAt(0)}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 
                        onClick={() => onSelectMember(member)}
                        className="text-base font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        {member.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {member.role}
                      </span>
                      {eligibility.isEligible ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Apto para Certificado Oficial
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Critérios Pendentes ({eligibility.reasonsPending.length})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                      <span>Entrada: <strong className="text-slate-200">{member.entryDate}</strong> ({activeTime.formatted} de atividade)</span>
                      <span>•</span>
                      <span>Horas: <strong className="text-emerald-400 font-mono">{member.accumulatedHours}h</strong> / {config.minHoursForCertificate}h</span>
                      {member.warnings.filter(w => w.active).length > 0 && (
                        <span className="text-rose-400 font-semibold">• {member.warnings.filter(w => w.active).length} ADV</span>
                      )}
                      {member.replacements.filter(r => !r.completed).length > 0 && (
                        <span className="text-amber-400 font-semibold">• {member.replacements.filter(r => !r.completed).length} Reposições Pendentes</span>
                      )}
                    </div>

                    {/* Pending Reasons Checklist if not eligible */}
                    {!eligibility.isEligible && (
                      <div className="mt-3 space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Pendências para Certificação:
                        </span>
                        {eligibility.reasonsPending.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-300/90">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Progress Meters and Action */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 shrink-0">
                  <div className="w-full sm:w-48 space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Carga Horária</span>
                        <span className="font-mono text-white font-semibold">{hoursProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${hoursProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${hoursProgress}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Tempo Ativo</span>
                        <span className="font-mono text-white font-semibold">{timeProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${timeProgress >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                          style={{ width: `${timeProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Generate / Preview Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenCertificateModal(member)}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl shadow transition-all cursor-pointer ${
                        eligibility.isEligible
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Award className="w-4 h-4 text-amber-300" />
                      {eligibility.isEligible ? 'Emitir Certificado Oficial' : 'Pré-visualizar Modelo'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
