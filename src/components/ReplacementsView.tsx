import React, { useState } from 'react';
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
  const [filter, setFilter] = useState<'pendentes' | 'cumpridas' | 'todas'>('pendentes');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Collect overall counts
  const allReplacements = members.flatMap(member => member.replacements);
  const pendingCount = allReplacements.filter(r => !r.completed).length;
  const completedCount = allReplacements.filter(r => r.completed).length;

  // Group replacements by Member
  const memberGroups = members
    .map(member => {
      const filteredReps = member.replacements.filter(item => {
        if (filter === 'pendentes') return !item.completed;
        if (filter === 'cumpridas') return item.completed;
        return true;
      });

      const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const pendingRepsCount = member.replacements.filter(r => !r.completed).length;
      const completedRepsCount = member.replacements.filter(r => r.completed).length;

      return {
        member,
        replacements: filteredReps,
        allMemberReplacements: member.replacements,
        pendingRepsCount,
        completedRepsCount,
        matchesSearch,
      };
    })
    .filter(group => {
      if (searchTerm) {
        return group.matchesSearch && group.allMemberReplacements.length > 0;
      }
      return group.replacements.length > 0;
    });

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
    <div className="space-y-6">
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2 font-display">
          <Repeat className="w-5 h-5 text-amber-400" />
          Gestão de Reposições de Plantão por Integrante
        </h2>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
          <h3 className="text-xs text-amber-400 uppercase font-bold tracking-wider">Prazos Regimentais</h3>
          <div className="text-xs text-slate-200 leading-relaxed font-sans space-y-1">
            <p>• 1 falta de plantão = repor no mês seguinte.</p>
            <p>• 2 faltas no mesmo mês = o acadêmico terá os próximos 2 meses seguintes para repor esses 2 plantões.</p>
            <p className="text-amber-300 font-medium">• Não repor no prazo = +1 advertência</p>
          </div>
        </div>
      </div>

      {/* Filter, Search & Accordion Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: 'pendentes', label: 'Pendentes', count: pendingCount, activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { id: 'cumpridas', label: 'Cumpridas', count: completedCount, activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            { id: 'todas', label: 'Todas', count: allReplacements.length, activeClass: 'bg-slate-800 text-white' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filter === tab.id
                  ? `${tab.activeClass} border shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800">
                {tab.count}
              </span>
            </button>
          ))}

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={expandAll}
            className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Expandir Todos
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Recolher Todos
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do integrante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grouped Replacements Accordion List */}
      <div className="space-y-3 pb-16">
        {memberGroups.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Nenhuma reposição pendente ou cumprida para este filtro.
          </div>
        ) : (
          memberGroups.map(({ member, replacements, pendingRepsCount, completedRepsCount }) => {
            const isExpanded = Boolean(expandedMembers[member.id]);

            return (
              <div
                key={member.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all"
              >
                {/* Member Header Card (Clickable to Expand/Collapse) */}
                <div
                  onClick={() => toggleExpand(member.id)}
                  className="p-4 bg-slate-900 hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember(member);
                      }}
                      className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm hover:border-emerald-500 transition-colors shrink-0"
                      title="Ver ficha completa do membro"
                    >
                      {member.name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember(member);
                          }}
                          className="text-sm font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer truncate font-display"
                        >
                          {member.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                          {member.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Horas totais no cadastro: <strong className="text-white font-mono">{member.accumulatedHours}h</strong>
                      </p>
                    </div>
                  </div>

                  {/* Summary Badges & Expand Icon */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    {pendingRepsCount > 0 && (
                      <span className="text-xs px-3 py-1 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {pendingRepsCount} {pendingRepsCount === 1 ? 'Reposição Pendente' : 'Reposições Pendentes'}
                      </span>
                    )}

                    {completedRepsCount > 0 && (
                      <span className="text-xs px-3 py-1 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {completedRepsCount} {completedRepsCount === 1 ? 'Cumprida' : 'Cumpridas'}
                      </span>
                    )}

                    {pendingRepsCount === 0 && completedRepsCount === 0 && (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Sem pendências
                      </span>
                    )}

                    <div className="p-1.5 text-slate-400 bg-slate-800/80 rounded-lg border border-slate-700/60">
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
                  <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800/60 text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                      <span>Lista de Pendências de Reposição ({replacements.length})</span>
                      <span>Membro ID: {member.id}</span>
                    </div>

                    {replacements.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-900/40 rounded-xl">
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
                            className={`bg-slate-900 border rounded-xl p-3.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              rep.completed
                                ? 'border-slate-800 opacity-85'
                                : isOverdue
                                ? 'border-rose-500/60 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20 shadow-md shadow-rose-950/20'
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
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 self-end md:self-center">
                              {!rep.completed ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-300 whitespace-nowrap font-medium">Data feita:</span>
                                    <div className="w-36">
                                      <CustomDatePicker
                                        value={completionDates[rep.id] ?? new Date().toLocaleDateString('pt-BR')}
                                        onChange={val => setCompletionDates(prev => ({ ...prev, [rep.id]: val }))}
                                        format="BR"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleComplete(member.id, rep.id, completionDates[rep.id] || new Date().toLocaleDateString('pt-BR'))}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Concluir (+{rep.scheduledHours || 12}h)
                                    </button>

                                    {!rep.warningIssuedForDelay && (
                                      <button
                                        onClick={() => handleLateWarning(member.id, rep.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                        title="A não reposição acarreta em mais uma advertência"
                                      >
                                        +1 ADV
                                      </button>
                                    )}

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
