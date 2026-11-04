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
import { LeagueSettingsModal } from './LeagueSettingsModal';

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
    <div className="min-h-screen flex flex-col justify-between space-y-6 sm:space-y-8 animate-fadeIn w-full max-w-full pb-16">
      {/* ========================================================= */}
      {/* 1. SEÇÃO SUPERIOR — QUADRO DIRETIVO & PRECEPTORIA         */}
      {/* ========================================================= */}
      <section className="space-y-4">
        {/* Banner Institucional */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950/60 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-xl text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Corpo Diretivo & Preceptoria Acadêmica
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] sm:text-xs text-slate-300">
                  Gestão Oficial {config.leagueAcronym}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display">
                Diretoria Executiva & Preceptoria
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Quadro de liderança estatutária da {config.leagueName} ({config.institution}) e gestão de parâmetros e diretrizes gerais da liga.
              </p>
            </div>
            
            {/* Botão de Editar Metas e Parâmetros */}
            {isCoordination && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditConfigModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs border border-emerald-500/50 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title="Configurar metas e parâmetros da liga"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                  <span>Parâmetros</span>
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
      {/* 3. MODAL DE EDIÇÃO DE METAS E PARÂMETROS GLOBAIS          */}
      {/* Modal de Configuração de Parâmetros e Metas */}
      {isEditConfigModalOpen && (
        <LeagueSettingsModal
          config={config}
          onClose={() => setIsEditConfigModalOpen(false)}
          onSaveConfig={(newConfig) => {
            onUpdateConfig(newConfig);
            setIsEditConfigModalOpen(false);
          }}
          onResetToDefaults={() => {
            onUpdateConfig(DEFAULT_LEAGUE_CONFIG);
            setIsEditConfigModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
