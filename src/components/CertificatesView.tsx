import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  CheckCircle2, 
  XCircle,
  Clock, 
  Search,
  CreditCard,
  User,
  Stethoscope,
  Crown,
  Shield,
  GraduationCap,
  Megaphone,
  ClipboardList,
  FileCheck,
  ExternalLink,
  Settings,
  RotateCcw,
  Save,
  X
} from 'lucide-react';
import { Member, LeagueConfig, LeadershipMemberConfig } from '../types/league';
import { DEFAULT_LEADERSHIP_BOARD, DEFAULT_LEAGUE_CONFIG } from '../data/initialData';
import { useAuth } from '../context/AuthContext';

interface CertificatesViewProps {
  members: Member[];
  config: LeagueConfig;
  onUpdateConfig: (newConfig: LeagueConfig) => void;
  onOpenCertificateModal?: (member: Member) => void;
  onSelectMember: (member: Member) => void;
  onUpdateMember: (updated: Member) => void;
}

// Retorna o ícone e a cor adequada de acordo com o cargo
function getRoleIconAndColor(role: string, isPreceptor?: boolean) {
  const lower = (role || '').toLowerCase();
  if (isPreceptor || lower.includes('preceptor') || lower.includes('orientador')) {
    return {
      icon: Stethoscope,
      defaultBadge: 'Supervisão Hospitalar',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      iconColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    };
  }
  if (lower.includes('presidente') && !lower.includes('vice')) {
    return {
      icon: Crown,
      defaultBadge: 'Presidência Executiva',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      iconColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
  }
  if (lower.includes('vice')) {
    return {
      icon: Shield,
      defaultBadge: 'Vice-Presidência',
      badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      iconColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };
  }
  if (lower.includes('científico') || lower.includes('cientifica')) {
    return {
      icon: GraduationCap,
      defaultBadge: 'Comitê Científico',
      badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      iconColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    };
  }
  if (lower.includes('marketing') || lower.includes('comunicação')) {
    return {
      icon: Megaphone,
      defaultBadge: 'Comunicação & Mídia',
      badgeColor: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
      iconColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    };
  }
  return {
    icon: ClipboardList,
    defaultBadge: 'Secretaria Geral',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    iconColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };
}

// Validação Dinâmica de Aptidão Estatutária baseada na LeagueConfig
export function getMemberAptitudeStatus(member: Member, config?: LeagueConfig) {
  const minHours = config?.minHoursForCertificate || 192;
  const maxWarnings = config?.maxActiveWarningsAllowed ?? 0;
  const requireReplacements = config?.requireAllReplacementsCompleted ?? true;

  const hoursMet = (member.accumulatedHours || 0) >= minHours;
  const activeWarningsCount = (member.warnings || []).filter(w => w.active).length;
  const pendingReplacementsCount = (member.replacements || []).filter(r => !r.completed).length;
  
  const warningsMet = activeWarningsCount <= maxWarnings;
  const replacementsMet = requireReplacements ? pendingReplacementsCount === 0 : true;
  const statusMet = member.status === 'ativo';

  const isApto = hoursMet && warningsMet && replacementsMet && statusMet;

  const reasons: string[] = [];
  if (!hoursMet) reasons.push(`Carga horária insuficiente (${member.accumulatedHours || 0}h de ${minHours}h necessárias)`);
  if (!warningsMet) reasons.push(`${activeWarningsCount} advertência(s) ativa(s) (limite regimental: ${maxWarnings})`);
  if (!replacementsMet) reasons.push(`${pendingReplacementsCount} reposição(ões) pendente(s)`);
  if (!statusMet) reasons.push(`Status inativo (${member.status})`);

  return {
    isApto,
    hoursMet,
    minHours,
    maxWarnings,
    activeWarningsCount,
    pendingReplacementsCount,
    reasons,
  };
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  members,
  config,
  onUpdateConfig,
  onSelectMember,
  onUpdateMember,
}) => {
  const { isCoordination } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'aptos' | 'inaptos' | 'pending-cert' | 'pending-badge'>('all');
  
  // Estado do Modal de Edição de Metas e Parâmetros
  const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState<LeagueConfig>({ ...config });
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  // Lista atual da diretoria (a partir da config ou do padrão)
  const currentLeadershipBoard: LeadershipMemberConfig[] = useMemo(() => {
    if (config.leadershipBoard && config.leadershipBoard.length > 0) {
      return config.leadershipBoard;
    }
    return DEFAULT_LEADERSHIP_BOARD;
  }, [config.leadershipBoard]);

  // Sincronizar estado do formulário de metas quando a config global muda
  useEffect(() => {
    setConfigForm({ ...config });
  }, [config, isEditConfigModalOpen]);

  // Salvar alterações no Modal de Metas e Parâmetros
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(configForm);
    setFeedbackSaved(true);
    setTimeout(() => {
      setFeedbackSaved(false);
      setIsEditConfigModalOpen(false);
    }, 1000);
  };

  // Restaurar padrões globais
  const handleResetConfigDefaults = () => {
    setConfigForm({ ...DEFAULT_LEAGUE_CONFIG });
  };

  // Mapa de aptidão para cada membro dinamicamente atualizado
  const memberAptitudes = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getMemberAptitudeStatus>>();
    members.forEach(m => {
      map.set(m.id, getMemberAptitudeStatus(m, config));
    });
    return map;
  }, [members, config]);

  // Contadores estatísticos
  const stats = useMemo(() => {
    const total = members.length;
    const aptosCount = members.filter(m => memberAptitudes.get(m.id)?.isApto).length;
    const inaptosCount = total - aptosCount;
    const certEmitted = members.filter(m => m.certificateEmitted).length;
    const certPending = total - certEmitted;
    const badgeCollected = members.filter(m => m.badgeCollected).length;
    const badgePending = total - badgeCollected;
    const fullyCompleted = members.filter(m => m.certificateEmitted && m.badgeCollected).length;

    return {
      total,
      aptosCount,
      inaptosCount,
      certEmitted,
      certPending,
      badgeCollected,
      badgePending,
      fullyCompleted,
    };
  }, [members, memberAptitudes]);

  // Filtro e Ordenação
  const filteredMembers = useMemo(() => {
    return members
      .filter(m => {
        const matchesSearch = 
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.role.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        const aptitude = memberAptitudes.get(m.id);
        if (filterMode === 'aptos') return aptitude?.isApto;
        if (filterMode === 'inaptos') return !aptitude?.isApto;
        if (filterMode === 'pending-cert') return !m.certificateEmitted;
        if (filterMode === 'pending-badge') return !m.badgeCollected;
        return true;
      })
      .sort((a, b) => {
        // Aptos primeiro, depois por carga horária decrescente
        const aptoA = memberAptitudes.get(a.id)?.isApto ? 1 : 0;
        const aptoB = memberAptitudes.get(b.id)?.isApto ? 1 : 0;
        if (aptoA !== aptoB) return aptoB - aptoA;
        return b.accumulatedHours - a.accumulatedHours;
      });
  }, [members, searchTerm, filterMode, memberAptitudes]);

  // Alternância direta do status do Certificado com persistência imediata
  const handleToggleCertificate = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCoordination) return;
    const updated: Member = {
      ...member,
      certificateEmitted: !member.certificateEmitted,
    };
    onUpdateMember(updated);
  };

  // Alternância direta do status do Crachá com persistência imediata
  const handleToggleBadge = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCoordination) return;
    const isNowCollected = !member.badgeCollected;
    const updated: Member = {
      ...member,
      badgeCollected: isNowCollected,
      badgeCollectedDate: isNowCollected && !member.badgeCollectedDate 
        ? new Date().toISOString().split('T')[0] 
        : member.badgeCollectedDate,
    };
    onUpdateMember(updated);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ========================================================= */}
      {/* 1. SEÇÃO SUPERIOR — QUADRO DIRETIVO & PRECEPTORIA         */}
      {/* ========================================================= */}
      <section className="space-y-4">
        {/* Banner Institucional */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Corpo Diretivo & Preceptoria Acadêmica
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-300">
                  Gestão Oficial {config.leagueAcronym}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
                Diretoria Executiva & Preceptoria
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Quadro de liderança estatutária da {config.leagueName} ({config.institution}) e painel central de auditoria de aptidão, certificados e crachás.
              </p>
            </div>
            
            {/* Botão de Editar Metas e Parâmetros */}
            {isCoordination && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditConfigModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/50 border border-emerald-500/50 transition-all cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-emerald-200" />
                  <span>Editar Metas e Parâmetros</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grade de Cartões do Quadro Diretivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentLeadershipBoard.map((leader, index) => {
            const { icon: IconComponent, badgeColor, iconColor, defaultBadge } = getRoleIconAndColor(leader.role, leader.isPreceptor);
            return (
              <div
                key={leader.id || index}
                className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 border group ${
                  leader.isPreceptor
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/20 md:col-span-2 lg:col-span-1'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                }`}
              >
                <div>
                  {/* Topo do Card: Ícone e Badge do Cargo */}
                  <div className="flex items-center justify-between gap-3 mb-3.5">
                    <div className={`p-2.5 rounded-xl border ${iconColor}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                        {leader.badge || defaultBadge}
                      </span>
                    </div>
                  </div>

                  {/* Cargo e Nome */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      {leader.role}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight leading-snug">
                      {leader.name || <span className="text-slate-500 italic">Não informado</span>}
                    </h3>
                  </div>

                  {/* Descrição Estatutária */}
                  <p className="text-xs text-slate-300 mt-3 leading-relaxed border-t border-slate-800/80 pt-3">
                    {leader.description}
                  </p>
                </div>

                {leader.institution && (
                  <div className="mt-4 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Instituição Vinculada</span>
                    <span className="font-semibold text-slate-200">{leader.institution}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. SEÇÃO INFERIOR — CONTROLO DE CERTIFICADOS & CRACHÁS    */}
      {/* ========================================================= */}
      <section className="space-y-4 pt-2">
        {/* Cabeçalho do Painel de Auditoria */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <FileCheck className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white font-display tracking-tight">
                Controlo de Aptidão, Certificados & Devolução de Crachás
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Critério Estatutário de Aptidão: <strong>≥{config.minHoursForCertificate}h acumuladas</strong>, máx. {config.maxActiveWarningsAllowed} ADV ativa(s) e sem reposições pendentes
            </p>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium uppercase">Total Membros</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-white font-mono">{stats.total}</span>
              <span className="text-[11px] text-slate-400">integrantes</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium uppercase">Aptos ao Certificado</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-400 font-mono">{stats.aptosCount}</span>
              <span className="text-[11px] text-slate-400">/ {stats.total} (≥{config.minHoursForCertificate}h)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium uppercase">Certificados Emitidos</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-400 font-mono">{stats.certEmitted}</span>
              <span className="text-[11px] text-slate-400">/ {stats.total}</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* Todos */}
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-white border border-slate-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>Todos</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-300">
                {stats.total}
              </span>
            </button>

            {/* Aptos */}
            <button
              type="button"
              onClick={() => setFilterMode('aptos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'aptos'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
              }`}
            >
              <span>Aptos (≥{config.minHoursForCertificate}h)</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 text-emerald-400">
                {stats.aptosCount}
              </span>
            </button>

            {/* Não Aptos */}
            <button
              type="button"
              onClick={() => setFilterMode('inaptos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'inaptos'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800/60'
              }`}
            >
              <span>Não Aptos</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 text-rose-400">
                {stats.inaptosCount}
              </span>
            </button>

            {/* Certificado Pendente */}
            <button
              type="button"
              onClick={() => setFilterMode('pending-cert')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'pending-cert'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
              }`}
            >
              <span>Certificado Pendente</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-400">
                {stats.certPending}
              </span>
            </button>

            {/* Crachá Pendente */}
            <button
              type="button"
              onClick={() => setFilterMode('pending-badge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'pending-badge'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
              }`}
            >
              <span>Crachá Pendente</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-400">
                {stats.badgePending}
              </span>
            </button>
          </div>

          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar integrante..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista Compacta de Membros */}
        <div className="space-y-2.5">
          {filteredMembers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold">Nenhum integrante encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const aptitude = memberAptitudes.get(member.id) || getMemberAptitudeStatus(member, config);
              const isApto = aptitude.isApto;
              const isCertEmitted = Boolean(member.certificateEmitted);
              const isBadgeCollected = Boolean(member.badgeCollected);

              return (
                <div
                  key={member.id}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-4.5 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                    isApto && isCertEmitted && isBadgeCollected
                      ? 'border-emerald-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/15'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Lado Esquerdo: Identidade do Integrante e Horas */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectMember(member)}
                      title="Clique para abrir a ficha"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border cursor-pointer transition-transform hover:scale-105 ${
                        isApto
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {member.name.charAt(0)}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectMember(member)}
                          className="text-sm sm:text-base font-bold text-white font-display truncate hover:text-emerald-400 transition-colors text-left cursor-pointer"
                        >
                          {member.name}
                        </button>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                          {member.role}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          Carga Horária: <strong className={`font-mono ${aptitude.hoursMet ? 'text-emerald-400' : 'text-amber-400'}`}>{member.accumulatedHours}h</strong>
                          <span className="text-slate-500 font-mono text-[11px]">/ {config.minHoursForCertificate}h</span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>Entrada: <strong className="text-slate-300 font-mono">{member.entryDate}</strong></span>
                        {aptitude.activeWarningsCount > 0 && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-rose-400 font-semibold">{aptitude.activeWarningsCount} ADV</span>
                          </>
                        )}
                        {aptitude.pendingReplacementsCount > 0 && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-amber-400 font-semibold">{aptitude.pendingReplacementsCount} Reposição Pendente</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Organização Visual Padronizada */}
                  {/* [ Apto / Não Apto ] ➜ [ Certificado Pendente / Emitido ] ➜ [ Crachá Pendente / Devolvido ] */}
                  <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-start md:self-center flex-wrap sm:flex-nowrap">
                    
                    {/* 1. Badge de Indicação de Aptidão Estatutária */}
                    <div
                      title={
                        isApto 
                          ? `Apto: Cumpriu ${config.minHoursForCertificate}h e não possui pendências regimentais` 
                          : `Não Apto: ${aptitude.reasons.join(' | ')}`
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border select-none shadow-xs ${
                        isApto
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {isApto ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Apto</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Não Apto</span>
                        </>
                      )}
                    </div>

                    {/* 2. Botão de Alternância Direta: Certificado */}
                    <button
                      type="button"
                      disabled={!isCoordination}
                      onClick={(e) => handleToggleCertificate(member, e)}
                      title={isCoordination ? (isCertEmitted ? 'Clique para marcar como Certificado Pendente' : 'Clique para marcar como Certificado Emitido') : 'Status do Certificado'}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all select-none shadow-xs ${
                        !isCoordination ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95'
                      } ${
                        isCertEmitted
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50 shadow-emerald-950/30'
                          : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40 shadow-rose-950/30'
                      }`}
                    >
                      {isCertEmitted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Certificado Emitido</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>Certificado Pendente</span>
                        </>
                      )}
                    </button>

                    {/* 3. Botão de Alternância Direta: Crachá / Carteirinha */}
                    <button
                      type="button"
                      disabled={!isCoordination}
                      onClick={(e) => handleToggleBadge(member, e)}
                      title={isCoordination ? (isBadgeCollected ? 'Clique para marcar como Crachá Pendente' : 'Clique para marcar como Crachá Devolvido') : 'Status do Crachá'}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all select-none shadow-xs ${
                        !isCoordination ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95'
                      } ${
                        isBadgeCollected
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50 shadow-emerald-950/30'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-amber-950/30'
                      }`}
                    >
                      <CreditCard className={`w-4 h-4 shrink-0 ${isBadgeCollected ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span>{isBadgeCollected ? 'Crachá Devolvido' : 'Crachá Pendente'}</span>
                    </button>

                    {/* Acesso rápido à ficha */}
                    <button
                      type="button"
                      onClick={() => onSelectMember(member)}
                      title="Ver Ficha Completa do Integrante"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. MODAL DE EDIÇÃO DE METAS E PARÂMETROS GLOBAIS          */}
      {/* ========================================================= */}
      {isEditConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">
                    Editar Metas e Parâmetros da Liga
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure as metas de carga horária, regras regimentais e limites globais da {config.leagueAcronym}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditConfigModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário de Configuração das Metas */}
            <form onSubmit={handleSaveConfig} className="p-5 space-y-6 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
              
              {feedbackSaved && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Metas e parâmetros salvos e aplicados em toda a aplicação!</span>
                </div>
              )}

              {/* Seção 1: Metas de Certificação & Carga Horária */}
              <div className="space-y-3.5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                <h4 className="font-bold text-emerald-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  1. Metas de Carga Horária & Certificação
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Meta de Horas (Certificado) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={configForm.minHoursForCertificate}
                      onChange={e => setConfigForm({ ...configForm, minHoursForCertificate: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Meta mínima de horas acumuladas (ex: 192h)</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Horas Padrão por Plantão
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={configForm.defaultShiftHours || 12}
                      onChange={e => setConfigForm({ ...configForm, defaultShiftHours: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Carga horária padrão de cada escala (ex: 12h)</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Tempo Ativo Mínimo (meses)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={configForm.minActiveMonthsForCertificate}
                      onChange={e => setConfigForm({ ...configForm, minActiveMonthsForCertificate: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Tempo na liga para aptidão (ex: 12 meses)</span>
                  </div>
                </div>
              </div>

              {/* Seção 2: Regras Disciplinares & Limites Regimentais */}
              <div className="space-y-3.5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                <h4 className="font-bold text-rose-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  2. Regras Disciplinares & Limites de Advertências
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Limite Máx. Advertências Ativas *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      required
                      value={configForm.maxActiveWarningsAllowed}
                      onChange={e => setConfigForm({ ...configForm, maxActiveWarningsAllowed: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Tolerância para aptidão ou desligamento (ex: 0 ou 3 ADVs)</span>
                  </div>

                  <div className="pt-2 sm:pt-0 sm:self-center">
                    <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer font-medium p-3 bg-slate-900/60 border border-slate-700/80 rounded-xl hover:border-slate-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={Boolean(configForm.requireAllReplacementsCompleted)}
                        onChange={e => setConfigForm({ ...configForm, requireAllReplacementsCompleted: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span>Exigir 100% de reposições cumpridas para concessão do certificado</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Seção 3: Identificação Institucional da Liga */}
              <div className="space-y-3.5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                <h4 className="font-bold text-cyan-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  3. Identificação Institucional da Liga
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Nome Oficial da Liga
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.leagueName}
                      onChange={e => setConfigForm({ ...configForm, leagueName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Sigla Oficial
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.leagueAcronym}
                      onChange={e => setConfigForm({ ...configForm, leagueAcronym: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Instituição / Hospital
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.institution}
                      onChange={e => setConfigForm({ ...configForm, institution: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Cidade / UF
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.cityState}
                      onChange={e => setConfigForm({ ...configForm, cityState: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Preceptor / Orientador
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.coordinatorName}
                      onChange={e => setConfigForm({ ...configForm, coordinatorName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block uppercase text-[11px] mb-1.5">
                      Presidente da Liga
                    </label>
                    <input
                      type="text"
                      required
                      value={configForm.presidentName}
                      onChange={e => setConfigForm({ ...configForm, presidentName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ações do Formulário */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetConfigDefaults}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrões Regimentais</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditConfigModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Metas e Parâmetros</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
