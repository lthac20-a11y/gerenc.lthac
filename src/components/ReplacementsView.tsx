import React, { useState, useMemo } from 'react';
import { 
  Repeat, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Search, 
  AlertCircle,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  User,
  ListFilter,
  Pencil
} from 'lucide-react';
import { Member, ReplacementRecord } from '../types/league';
import { 
  calculateReplacementDeadline, 
  syncMemberReplacementsDeadlines,
  completeReplacementAndDismissAbsence,
  deleteReplacementWithCascade
} from '../utils/leagueCalculations';
import { getCurrentYear, getCurrentMonthIndex, formatMonthKey, getMonthColumnsForYear, getReplacementDeadlineInfo, formatReferenceMonthYear } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { QuickReplacementModal } from './CoordinationModals';
import { CustomDatePicker } from './CustomDatePicker';

export interface GuidelineItem {
  id: string;
  badge: string;
  titulo: string;
  tag: string;
  descricao: string;
  colorTheme?: 'amber' | 'blue' | 'rose';
}

const DEFAULT_GUIDELINES: GuidelineItem[] = [
  {
    id: 'g1',
    badge: '1',
    titulo: '1 Falta no Mês',
    tag: 'Prazo: Mês seguinte',
    descricao: 'Deverá ser reposta impreterivelmente no mês imediatamente seguinte à escala faltosa.',
    colorTheme: 'amber',
  },
  {
    id: 'g2',
    badge: '2',
    titulo: '2 Faltas no Mesmo Mês',
    tag: 'Prazo: 2 meses',
    descricao: 'O acadêmico terá os próximos 2 meses consecutivos para repor esses 2 plantões.',
    colorTheme: 'blue',
  },
  {
    id: 'g3',
    badge: '!',
    titulo: 'Não Repor no Prazo',
    tag: 'Penalidade',
    descricao: 'O descumprimento do prazo regimental resulta em +1 advertência formal no cadastro.',
    colorTheme: 'rose',
  },
];

const STORAGE_DIRETRIZES_KEY = 'lthac_diretrizes_v1';

interface ReplacementsViewProps {
  members: Member[];
  onUpdateMember: (updated: Member) => void;
  onSelectMember: (member: Member) => void;
}

export const ReplacementsView: React.FC<ReplacementsViewProps> = ({
  members,
  onUpdateMember,
  onSelectMember,
}) => {
  const { isCoordination } = useAuth();
  const [filter, setFilter] = useState<'pendentes' | 'todas'>('pendentes');
  const [searchTerm, setSearchTerm] = useState('');

  // Diretrizes e Prazos Regimentais (Estado Dinâmico e Persistente)
  const [diretrizes, setDiretrizes] = useState<GuidelineItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DIRETRIZES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse guidelines', e);
    }
    return DEFAULT_GUIDELINES;
  });

  const [isEditingGuidelines, setIsEditingGuidelines] = useState(false);
  const [guidelinesDraft, setGuidelinesDraft] = useState<GuidelineItem[]>(diretrizes);

  const handleStartEditingGuidelines = () => {
    setGuidelinesDraft(JSON.parse(JSON.stringify(diretrizes)));
    setIsEditingGuidelines(true);
  };

  const handleCancelEditingGuidelines = () => {
    setIsEditingGuidelines(false);
    setGuidelinesDraft(diretrizes);
  };

  const handleSaveGuidelines = () => {
    setDiretrizes(guidelinesDraft);
    localStorage.setItem(STORAGE_DIRETRIZES_KEY, JSON.stringify(guidelinesDraft));
    setIsEditingGuidelines(false);
  };

  // Expandable members state (map of memberId -> boolean)
  // By default, members start collapsed (closed)
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const toggleExpand = (memberId: string) => {
    setExpandedMembers(prev => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    members.forEach(m => { next[m.id] = true; });
    setExpandedMembers(next);
  };

  const collapseAll = () => {
    setExpandedMembers({});
  };

  const currentYear = getCurrentYear();
  const currentMonthIdx = getCurrentMonthIndex();
  const defaultOriginMonth = formatMonthKey(currentMonthIdx, currentYear);

  // New Replacement Form Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [originMonth, setOriginMonth] = useState(defaultOriginMonth);
  const [scheduledHours, setScheduledHours] = useState(12);
  const [notes, setNotes] = useState(`Referente à falta de ${new Date().toLocaleDateString('pt-BR')}`);
  const [isCompletedAlready, setIsCompletedAlready] = useState(false);
  const [completedDateInput, setCompletedDateInput] = useState(new Date().toLocaleDateString('pt-BR'));

  // Completion dates state for individual items
  const [completionDates, setCompletionDates] = useState<Record<string, string>>({});
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});
  const [isEditingDateId, setIsEditingDateId] = useState<string | null>(null);
  const [editingReplacement, setEditingReplacement] = useState<{ memberId: string; replacement: ReplacementRecord } | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Filter active members only (exclude baixas)
  const activeMembers: Member[] = useMemo(() => {
    return members.filter(m => !Boolean(m.isBaixa || m.status === 'baixa'));
  }, [members]);

  // Collect overall counts for active members
  const allReplacements: ReplacementRecord[] = useMemo(() => activeMembers.flatMap((member: Member) => member.replacements), [activeMembers]);
  const pendingCount: number = useMemo(() => allReplacements.filter((r: ReplacementRecord) => !r.completed).length, [allReplacements]);
  const completedCount: number = useMemo(() => allReplacements.filter((r: ReplacementRecord) => r.completed).length, [allReplacements]);
  const membersWithPending: number = useMemo(() => activeMembers.filter((m: Member) => m.replacements.some((r: ReplacementRecord) => !r.completed)).length, [activeMembers]);

  // Group replacements by Active Member
  const memberGroups = useMemo(() => {
    return activeMembers
      .map((member: Member) => {
        const filteredReps = member.replacements.filter((item: ReplacementRecord) => {
          if (filter === 'pendentes') return !item.completed;
          return true;
        });

        const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
        const pendingRepsCount = member.replacements.filter((r: ReplacementRecord) => !r.completed).length;

        return {
          member,
          replacements: filteredReps,
          allMemberReplacements: member.replacements,
          pendingRepsCount,
          matchesSearch,
        };
      })
      .filter(group => {
        if (searchTerm) {
          return group.matchesSearch && group.allMemberReplacements.length > 0;
        }
        return group.replacements.length > 0;
      });
  }, [activeMembers, filter, searchTerm]);

  // Handler: Complete replacement with custom completion date
  const handleComplete = (memberId: string, repId: string, customDate?: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const finalDate = (customDate && customDate.trim()) || completionDates[repId] || todayStr;

    const { updatedMember, dismissedAbsence, hoursAdded } = completeReplacementAndDismissAbsence(targetMember, repId, finalDate);

    onUpdateMember(updatedMember);

    if (dismissedAbsence) {
      showFeedback(`Reposição confirmada em ${finalDate}! Falta de ${dismissedAbsence.date} quitada e removida. (+${hoursAdded}h computadas para ${targetMember.name}).`);
    } else {
      showFeedback(`Reposição confirmada em ${finalDate}! (+${hoursAdded}h computadas para ${targetMember.name}).`);
    }
  };

  // Handler: Edit / Update completion date for an already completed replacement
  const handleSaveCompletedDate = (memberId: string, repId: string, newDate: string) => {
    if (!newDate.trim()) return;
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const updatedReplacements = targetMember.replacements.map(r => {
      if (r.id === repId) {
        return {
          ...r,
          completedDate: newDate.trim(),
        };
      }
      return r;
    });

    onUpdateMember({
      ...targetMember,
      replacements: updatedReplacements,
    });
    setIsEditingDateId(null);
  };

  // Handler: Apply warning for late/overdue replacement
  const handleLateWarning = (memberId: string, repId: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const rep = targetMember.replacements.find(r => r.id === repId);
    const today = new Date().toLocaleDateString('pt-BR');
    const newWarning = {
      id: `w-${Date.now()}`,
      date: today,
      reason: `Advertência por não reposição de plantão no prazo regulamentar (${rep?.missedShiftDate || 'escala'})`,
      severity: 'grave' as const,
      active: true,
    };

    const updatedReplacements = targetMember.replacements.map(r => 
      r.id === repId ? { ...r, warningIssuedForDelay: true } : r
    );

    onUpdateMember({
      ...targetMember,
      warnings: [newWarning, ...targetMember.warnings],
      replacements: updatedReplacements,
    });

    showFeedback(`Advertência disciplinar aplicada a ${targetMember.name} por não reposição no prazo!`);
  };

  // Handler: Delete replacement (Eliminação Bidirecional com Histórico de Escalas e Contadores)
  const handleDeleteReplacement = (memberId: string, repId: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const { updatedMember, wasFNJ, wasFJ } = deleteReplacementWithCascade(targetMember, repId);
    onUpdateMember(updatedMember);

    if (wasFNJ) {
      showFeedback(`Reposição eliminada de ${targetMember.name}: registo no histórico removido, -1 REP, -1 FNJ e -1 Advertência.`);
    } else if (wasFJ) {
      showFeedback(`Reposição eliminada de ${targetMember.name}: registo no histórico removido, -1 REP e -1 FJ.`);
    } else {
      showFeedback(`Reposição removida de ${targetMember.name} com sucesso!`);
    }
  };

  // Handler: Add new replacement
  const handleAddNewReplacement = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = members.find(m => m.id === selectedMemberId);
    if (!targetMember) return;

    const deadlineText = calculateReplacementDeadline(originMonth, 1);

    const newRep: ReplacementRecord = {
      id: `rep-${Date.now()}`,
      memberId: selectedMemberId,
      deadlineMonth: originMonth,
      deadlineDescription: deadlineText,
      scheduledHours: Number(scheduledHours),
      completed: isCompletedAlready,
      ...(isCompletedAlready ? { completedDate: completedDateInput || new Date().toLocaleDateString('pt-BR') } : {}),
      notes,
    };

    const hoursToAdd = isCompletedAlready ? Number(scheduledHours) : 0;
    const updatedReplacements = syncMemberReplacementsDeadlines([...targetMember.replacements, newRep]);

    onUpdateMember({
      ...targetMember,
      replacements: updatedReplacements,
      accumulatedHours: targetMember.accumulatedHours + hoursToAdd,
      hoursUpdated: isCompletedAlready ? true : targetMember.hoursUpdated,
    });

    // Expand the target member automatically
    setExpandedMembers(prev => ({ ...prev, [selectedMemberId]: true }));

    setIsAddModalOpen(false);
    setNotes('');
    setIsCompletedAlready(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between space-y-4 sm:space-y-6 w-full max-w-full pb-16">
      {feedbackMsg && (
        <div className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {feedbackMsg}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Prazos Regimentais */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Top Header Row: Title & Action Button in Single Row */}
        <div className="flex items-center justify-between gap-2 flex-nowrap whitespace-nowrap">
          <div className="flex items-center gap-2 flex-nowrap min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 p-1.5 shadow-xs">
              <Repeat className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-display truncate">
              Gestão de Reposições
            </h2>
          </div>

          {isCoordination && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95"
              title="Lançar nova reposição manualmente"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Reposição</span>
            </button>
          )}
        </div>

        {/* Faixa Única (2 Colunas) com as métricas compactas focadas em pendências */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Reposições Pendentes</span>
            <span className="text-xs font-bold text-amber-400 font-mono">{pendingCount}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 sm:p-2 rounded-xl min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Integrantes com Pendência</span>
            <span className="text-xs font-bold text-white font-mono">{membersWithPending}</span>
          </div>
        </div>

        {/* Prazos Regimentais: 100% Dinâmico, Editável e Compacto */}
        {!isEditingGuidelines ? (
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                  Diretrizes e Prazos Regimentais
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
                  Estatuto da Liga do Trauma HAC
                </span>
                {isCoordination && (
                  <button
                    type="button"
                    onClick={handleStartEditingGuidelines}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                    title="Editar diretrizes e prazos regimentais"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    <span>Editar</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {diretrizes.map((g) => {
                const badgeColor = g.colorTheme === 'blue'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : g.colorTheme === 'rose'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                const tagColor = g.colorTheme === 'blue'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : g.colorTheme === 'rose'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                return (
                  <div
                    key={g.id}
                    className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 hover:border-slate-700/80 transition-colors"
                  >
                    {/* Linha Superior (flex items-center justify-between gap-2) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded text-[10px] font-bold font-mono border flex items-center justify-center shrink-0 ${badgeColor}`}>
                          {g.badge}
                        </span>
                        <h4 className="text-xs font-semibold text-white truncate">
                          {g.titulo}
                        </h4>
                      </div>

                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border shrink-0 whitespace-nowrap ${tagColor}`}>
                        {g.tag}
                      </span>
                    </div>

                    {/* Descrição Alinhada logo abaixo com pl-7 */}
                    <p className="text-[11px] text-slate-400 leading-snug pl-7 mt-1">
                      {g.descricao}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Modo de Edição de Diretrizes */
          <div className="bg-slate-950/80 border border-emerald-500/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs text-white font-bold uppercase tracking-wider">
                  Editar Diretrizes Regimentais
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditingGuidelines}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveGuidelines}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  Salvar
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {guidelinesDraft.map((item, idx) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.badge}
                      onChange={e => {
                        const val = e.target.value;
                        setGuidelinesDraft(prev => prev.map((g, i) => i === idx ? { ...g, badge: val } : g));
                      }}
                      placeholder="Ícone"
                      className="w-10 h-8 text-center text-xs font-bold font-mono bg-slate-950 border border-slate-700 rounded-lg text-amber-400 focus:outline-none focus:border-emerald-500 shrink-0"
                      title="Símbolo ou número do badge"
                    />

                    <input
                      type="text"
                      value={item.titulo}
                      onChange={e => {
                        const val = e.target.value;
                        setGuidelinesDraft(prev => prev.map((g, i) => i === idx ? { ...g, titulo: val } : g));
                      }}
                      placeholder="Título da Regra"
                      className="flex-1 min-w-0 h-8 px-2.5 text-xs font-semibold bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />

                    <input
                      type="text"
                      value={item.tag}
                      onChange={e => {
                        const val = e.target.value;
                        setGuidelinesDraft(prev => prev.map((g, i) => i === idx ? { ...g, tag: val } : g));
                      }}
                      placeholder="Prazo / Penalidade"
                      className="w-36 h-8 px-2.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-medium focus:outline-none focus:border-emerald-500 shrink-0"
                    />
                  </div>

                  <textarea
                    value={item.descricao}
                    onChange={e => {
                      const val = e.target.value;
                      setGuidelinesDraft(prev => prev.map((g, i) => i === idx ? { ...g, descricao: val } : g));
                    }}
                    placeholder="Descrição explicativa da diretriz..."
                    rows={2}
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 leading-snug"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter, Search & Accordion Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-900 border border-slate-800 p-2.5 sm:p-3.5 rounded-2xl w-full max-w-full shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full sm:w-auto flex-nowrap shrink-0">
          {[
            { id: 'pendentes', label: 'Pendentes', count: pendingCount, activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { id: 'todas', label: 'Todas', count: allReplacements.length, activeClass: 'bg-slate-800 text-white' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
                filter === tab.id
                  ? `${tab.activeClass} border shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono font-bold">
                {tab.count}
              </span>
            </button>
          ))}

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={expandAll}
            className="min-h-[40px] px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            Expandir
          </button>
          <button
            onClick={collapseAll}
            className="min-h-[40px] px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            Recolher
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar integrante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full min-h-[42px] pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grouped Replacements Accordion List */}
      <div className="space-y-2 pb-20">
        {memberGroups.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            Nenhuma reposição pendente encontrada.
          </div>
        ) : (
          memberGroups.map(({ member, replacements, pendingRepsCount }) => {
            const isExpanded = Boolean(expandedMembers[member.id]);
            const hasAnyOverdueReplacement = member.replacements.some(rep => {
              if (rep.completed) return false;
              const originMonth = rep.deadlineMonth || 'out/26';
              const totalJustifiedInMonth = member.justifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
              const totalUnjustifiedInMonth = member.unjustifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
              const totalShiftsAbsencesInMonth = member.shifts.filter(s => (s.monthKey || 'out/26') === originMonth && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta'))).length;
              const totalReplacementsInMonth = member.replacements.filter(r => (r.deadlineMonth || 'out/26') === originMonth).length;

              const absencesInSameMonth = Math.max(
                rep.originalAbsenceCountInMonth || 1,
                totalJustifiedInMonth + totalUnjustifiedInMonth,
                totalShiftsAbsencesInMonth,
                totalReplacementsInMonth
              );

              const { isOverdue } = getReplacementDeadlineInfo(
                originMonth, 
                absencesInSameMonth, 
                rep.fixedDeadlineMonthKey
              );
              return isOverdue;
            });

            return (
              <div
                key={member.id}
                className={`bg-slate-900 border rounded-xl overflow-hidden shadow-xs transition-all ${
                  hasAnyOverdueReplacement ? 'border-rose-500/60 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20' : 'border-slate-800'
                }`}
              >
                {/* Member Header Card (Clickable to Expand/Collapse) */}
                <div
                  onClick={() => toggleExpand(member.id)}
                  className="p-3 sm:p-3.5 bg-slate-900 hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-between gap-3 select-none flex-nowrap"
                >
                  {/* Left Column (Avatar + Name + Hours subtitle) */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember(member);
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs hover:border-emerald-500 transition-colors shrink-0"
                      title="Ver ficha completa do membro"
                    >
                      {member.name.charAt(0)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMember(member);
                        }}
                        className="text-xs sm:text-sm font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer truncate font-display"
                      >
                        {member.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        Total cadastrado: <strong className="text-white font-mono">{member.accumulatedHours}h</strong>
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Pending Badge ("X Rep.") + Expand Icon */}
                  <div className="flex items-center gap-2 shrink-0">
                    {pendingRepsCount > 0 ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{pendingRepsCount} {pendingRepsCount === 1 ? 'Reposição Pendente' : 'Reposições Pendentes'}</span>
                        <span className="inline sm:hidden">{pendingRepsCount} Rep.</span>
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap shrink-0">
                        Sem pendências
                      </span>
                    )}

                    <div className="p-1.5 text-slate-400 bg-slate-800/80 rounded-md border border-slate-700/60 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Body with Replacement Items */}
                {isExpanded && (
                  <div className="p-2.5 sm:p-3 bg-slate-950/60 border-t border-slate-800/80 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800/60 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                      <span>Lista de Pendências de Reposição ({replacements.length})</span>
                      <span>Membro ID: {member.id}</span>
                    </div>

                    {replacements.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs italic bg-slate-900/40 rounded-lg">
                        Nenhuma reposição corresponde ao filtro selecionado para este membro.
                      </div>
                    ) : (
                      replacements.map(rep => {
                        const originMonth = rep.deadlineMonth || 'out/26';
                        const totalJustifiedInMonth = member.justifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
                        const totalUnjustifiedInMonth = member.unjustifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
                        const totalShiftsAbsencesInMonth = member.shifts.filter(s => (s.monthKey || 'out/26') === originMonth && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta'))).length;
                        const totalReplacementsInMonth = member.replacements.filter(r => (r.deadlineMonth || 'out/26') === originMonth).length;

                        const absencesInSameMonth = Math.max(
                          rep.originalAbsenceCountInMonth || 1,
                          totalJustifiedInMonth + totalUnjustifiedInMonth,
                          totalShiftsAbsencesInMonth,
                          totalReplacementsInMonth
                        );

                        const { deadlineText, isOverdue } = getReplacementDeadlineInfo(
                          originMonth, 
                          absencesInSameMonth, 
                          rep.fixedDeadlineMonthKey
                        );

                        return (
                          <div
                            key={rep.id}
                            className={`bg-slate-900 border rounded-lg p-2.5 sm:p-3 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              rep.completed
                                ? 'border-slate-800 opacity-85'
                                : isOverdue
                                ? 'border-rose-500/60 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20 shadow-xs'
                                : 'border-amber-800/40 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/10'
                            }`}
                          >
                            {/* Replacement Info */}
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {rep.completed ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Reposição Cumprida
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shadow-xs animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    Pendência Expirada
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Pendência a Cumprir
                                  </span>
                                )}

                                <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold text-xs">
                                  <Clock className="w-3.5 h-3.5" />
                                  {rep.scheduledHours || 12} horas
                                </span>

                                <span className="flex items-center gap-1 text-slate-300 text-xs font-mono">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  Mês de Referência: <strong>{formatReferenceMonthYear(rep.missedShiftDate, rep.deadlineMonth || 'out/26')}</strong>
                                </span>
                              </div>

                              {rep.notes &&
                                !rep.notes.toLowerCase().includes('falta referente ao mês') &&
                                !rep.notes.toLowerCase().includes('falta justificada') &&
                                !rep.notes.toLowerCase().includes('falta não justificada') && (
                                <p className="text-xs text-slate-300">
                                  {rep.notes}
                                </p>
                              )}

                              {!rep.completed && (
                                <div className="pt-0.5">
                                  {isOverdue ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-xs">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      <span>⚠️ Prazo Expirado - Sujeito a Advertência</span>
                                    </span>
                                  ) : (
                                    <span className="text-amber-300 font-semibold text-xs flex items-center gap-1.5">
                                      {deadlineText}
                                    </span>
                                  )}
                                </div>
                              )}

                              {rep.warningIssuedForDelay && (
                                <span className="text-rose-300 bg-rose-500/20 text-[10px] px-2 py-0.5 rounded font-bold border border-rose-500/30 inline-block mt-1">
                                  Advertência disciplinar emitida por atraso
                                </span>
                              )}

                            {/* Completed date details */}
                            {rep.completedDate && (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium pt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Realizada em:</span>
                                {isEditingDateId === rep.id ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      placeholder="DD/MM/AAAA"
                                      value={editingDates[rep.id] ?? rep.completedDate}
                                      onChange={e => setEditingDates(prev => ({ ...prev, [rep.id]: e.target.value }))}
                                      className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono w-28 focus:outline-none"
                                    />
                                    <button
                                      onClick={() => handleSaveCompletedDate(member.id, rep.id, editingDates[rep.id] ?? rep.completedDate ?? '')}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      onClick={() => setIsEditingDateId(null)}
                                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-white text-xs">{rep.completedDate}</span>
                                    <button
                                      onClick={() => {
                                        setEditingDates(prev => ({ ...prev, [rep.id]: rep.completedDate || '' }));
                                        setIsEditingDateId(rep.id);
                                      }}
                                      className="text-slate-400 hover:text-white underline text-[10px] ml-1 cursor-pointer"
                                      title="Alterar data na qual foi feita a reposição"
                                    >
                                      Alterar data
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons & Completion Input */}
                          {isCoordination ? (
                            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 shrink-0">
                              {!rep.completed ? (
                                <>
                                  <div className="flex items-center gap-2 flex-1 sm:flex-none justify-between sm:justify-start">
                                    <span className="text-[11px] text-slate-300 whitespace-nowrap font-medium">Data feita:</span>
                                    <div className="w-full sm:w-36">
                                      <CustomDatePicker
                                        value={completionDates[rep.id] ?? new Date().toLocaleDateString('pt-BR')}
                                        onChange={val => setCompletionDates(prev => ({ ...prev, [rep.id]: val }))}
                                        format="BR"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                    <button
                                      onClick={() => handleComplete(member.id, rep.id, completionDates[rep.id] || new Date().toLocaleDateString('pt-BR'))}
                                      className="flex-1 sm:flex-none min-h-[34px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap active:scale-[0.99]"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Concluir (+{rep.scheduledHours || 12}h)
                                    </button>

                                    {!rep.warningIssuedForDelay && (
                                      <button
                                        onClick={() => handleLateWarning(member.id, rep.id)}
                                        className="min-h-[34px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap active:scale-[0.99]"
                                        title="A não reposição acarreta em mais uma advertência"
                                      >
                                        +1 ADV
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setEditingReplacement({ memberId: member.id, replacement: rep })}
                                      className="min-h-[34px] min-w-[34px] flex items-center justify-center p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer border border-slate-700/80"
                                      title="Editar reposição"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteReplacement(member.id, rep.id)}
                                      className="min-h-[34px] min-w-[34px] flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border border-slate-700/80"
                                      title="Remover reposição"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Horas Computadas
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingReplacement({ memberId: member.id, replacement: rep })}
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Editar reposição"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReplacement(member.id, rep.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Remover reposição"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="shrink-0 self-end md:self-center">
                              {rep.completed ? (
                                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                                  <CheckCircle2 className="w-4 h-4" />
                                  Horas Computadas
                                </span>
                              ) : (
                                <span className="text-xs text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-lg font-semibold">
                                  Reposição Pendente
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Replacement Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Repeat className="w-5 h-5 text-amber-400" />
              Agendar Reposição de Plantão
            </h3>

            <form onSubmit={handleAddNewReplacement} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 uppercase font-semibold">Selecione o Ligante</label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.accumulatedHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Mês da Escala / Falta *</label>
                <select
                  value={originMonth}
                  onChange={e => setOriginMonth(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                >
                  {[
                    ...getMonthColumnsForYear(currentYear - 1),
                    ...getMonthColumnsForYear(currentYear),
                    ...getMonthColumnsForYear(currentYear + 1),
                  ].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Carga Horária da Reposição</label>
                <input
                  type="number"
                  value={scheduledHours}
                  onChange={e => setScheduledHours(Number(e.target.value))}
                  required
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Observações / Motivo</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/70 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={isCompletedAlready}
                    onChange={e => setIsCompletedAlready(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-700 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-xs">Esta reposição já foi realizada?</span>
                </label>

                {isCompletedAlready && (
                  <div>
                    <label className="text-slate-300 uppercase font-semibold text-[10px] block mb-1">
                      Data na qual foi realizada a reposição *
                    </label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA (Ex: 02/10/2026)"
                      value={completedDateInput}
                      onChange={e => setCompletedDateInput(e.target.value)}
                      required={isCompletedAlready}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <p className="text-[10px] text-emerald-400 mt-1">
                      ✓ As horas (+{scheduledHours}h) serão creditadas automaticamente ao membro.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg cursor-pointer"
                >
                  {isCompletedAlready ? 'Salvar Reposição Cumprida' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Replacement Modal */}
      {editingReplacement && (
        <QuickReplacementModal
          members={members}
          editingReplacement={editingReplacement}
          onClose={() => setEditingReplacement(null)}
          onUpdateMember={onUpdateMember}
        />
      )}
    </div>
  );
};
