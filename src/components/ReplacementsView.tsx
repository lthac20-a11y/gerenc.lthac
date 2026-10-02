import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Search, 
  AlertCircle,
  User,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { Member, ReplacementRecord } from '../types/league';
import { calculateReplacementDeadline, syncMemberReplacementsDeadlines } from '../utils/leagueCalculations';

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
  const [filter, setFilter] = useState<'pendentes' | 'cumpridas' | 'todas'>('pendentes');
  const [searchTerm, setSearchTerm] = useState('');

  // New Replacement Form Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [originMonth, setOriginMonth] = useState('out/26');
  const [scheduledHours, setScheduledHours] = useState(12);
  const [notes, setNotes] = useState('Referente à falta não justificada de 02/10/2026');
  const [isCompletedAlready, setIsCompletedAlready] = useState(false);
  const [completedDateInput, setCompletedDateInput] = useState(new Date().toLocaleDateString('pt-BR'));

  // Completion dates state for individual items
  const [completionDates, setCompletionDates] = useState<Record<string, string>>({});
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});
  const [isEditingDateId, setIsEditingDateId] = useState<string | null>(null);

  // Collect all replacements with their member data
  const allReplacements = members.flatMap(member => 
    member.replacements.map(rep => ({
      ...rep,
      member,
    }))
  );

  const filteredReplacements = allReplacements.filter(item => {
    const matchesSearch = item.member.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'pendentes') return !item.completed;
    if (filter === 'cumpridas') return item.completed;
    return true;
  });

  const pendingCount = allReplacements.filter(r => !r.completed).length;
  const completedCount = allReplacements.filter(r => r.completed).length;

  // Handler: Complete replacement with custom completion date
  const handleComplete = (memberId: string, repId: string, customDate?: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const rep = targetMember.replacements.find(r => r.id === repId);
    const hoursToAdd = rep ? rep.scheduledHours || 12 : 12;
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const finalDate = (customDate && customDate.trim()) || completionDates[repId] || todayStr;

    const updatedReplacements = targetMember.replacements.map(r => {
      if (r.id === repId) {
        return {
          ...r,
          completed: true,
          completedDate: finalDate,
        };
      }
      return r;
    });

    onUpdateMember({
      ...targetMember,
      replacements: updatedReplacements,
      accumulatedHours: targetMember.accumulatedHours + hoursToAdd,
      hoursUpdated: true,
    });

    alert(`Reposição confirmada como realizada em ${finalDate}! (+${hoursToAdd}h computadas para ${targetMember.name}).`);
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

    alert(`Advertência disciplinar aplicada a ${targetMember.name} por não reposição no prazo!`);
  };

  // Handler: Delete replacement
  const handleDeleteReplacement = (memberId: string, repId: string) => {
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    const rep = targetMember.replacements.find(r => r.id === repId);
    const hoursToDeduct = (rep && rep.completed) ? (rep.scheduledHours || 12) : 0;

    const updatedReplacements = syncMemberReplacementsDeadlines(
      targetMember.replacements.filter(r => r.id !== repId)
    );

    const updatedJustified = targetMember.justifiedAbsences.filter(a => a.replacementId !== repId && a.id !== rep?.absenceId);
    const updatedUnjustified = targetMember.unjustifiedAbsences.filter(a => a.replacementId !== repId && a.id !== rep?.absenceId);

    onUpdateMember({
      ...targetMember,
      replacements: updatedReplacements,
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      accumulatedHours: Math.max(0, targetMember.accumulatedHours - hoursToDeduct),
    });
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
      completedDate: isCompletedAlready ? (completedDateInput || new Date().toLocaleDateString('pt-BR')) : undefined,
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

    setIsAddModalOpen(false);
    setNotes('');
    setIsCompletedAlready(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Repeat className="w-5 h-5 text-amber-400" />
              Gestão de Reposições de Plantão
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Ligantes com faltas justificadas ou injustificadas devem cumprir reposição para zerar pendências
              e poder receber o certificado oficial da liga.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Agendar Nova Reposição
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Reposições Pendentes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-400 font-mono">{pendingCount}</span>
              <span className="text-xs text-slate-400">exigem cumprimento</span>
            </div>
          </div>

          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Reposições Concluídas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{completedCount}</span>
              <span className="text-xs text-slate-400">horas creditadas</span>
            </div>
          </div>

          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Prazos Regimentais</span>
            <p className="text-[11px] text-slate-300 mt-1 leading-tight">
              • 1 falta de plantão = repor no <strong>mês seguinte</strong>.<br />
              • 2 faltas no mesmo mês = o acadêmico terá os <strong>próximos 2 meses seguintes</strong> para repor esses 2 plantões.<br />
              <span className="text-amber-300 font-medium">• Não repor no prazo = +1 advertência</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-1">
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
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ligante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Replacements List */}
      <div className="space-y-3">
        {filteredReplacements.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Nenhuma reposição encontrada para este filtro.
          </div>
        ) : (
          filteredReplacements.map(rep => (
            <div
              key={rep.id}
              className={`bg-slate-900 border rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                rep.completed
                  ? 'border-slate-800 opacity-80'
                  : 'border-amber-800/40 bg-gradient-to-r from-slate-900 to-amber-950/10'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div 
                  onClick={() => onSelectMember(rep.member)}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm cursor-pointer hover:border-emerald-500 transition-colors shrink-0"
                >
                  {rep.member.name.charAt(0)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 
                      onClick={() => onSelectMember(rep.member)}
                      className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {rep.member.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {rep.member.role}
                    </span>
                    {rep.completed ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Cumprida
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Pendente
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                    {rep.missedShiftDate && (
                      <span className="flex items-center gap-1 text-white font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Origem: {rep.missedShiftDate}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      {rep.scheduledHours || 12} horas
                    </span>
                    {rep.completedDate && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Realizada em:</span>
                        {isEditingDateId === rep.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="DD/MM/AAAA"
                              value={editingDates[rep.id] ?? rep.completedDate}
                              onChange={e => setEditingDates(prev => ({ ...prev, [rep.id]: e.target.value }))}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono w-28"
                            />
                            <button
                              onClick={() => handleSaveCompletedDate(rep.member.id, rep.id, editingDates[rep.id] ?? rep.completedDate ?? '')}
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

                  {rep.notes && (
                    <p className="text-xs text-slate-300 mt-1">
                      {rep.notes}
                    </p>
                  )}
                  {rep.deadlineDescription && (
                    <span className="text-amber-300 font-medium text-[11px] block mt-1">
                      ⏰ Prazo Regulamentar: {rep.deadlineDescription}
                    </span>
                  )}
                  {rep.warningIssuedForDelay && (
                    <span className="text-rose-300 bg-rose-500/20 text-[10px] px-2 py-0.5 rounded font-bold border border-rose-500/30 inline-block mt-1">
                      Advertido por não repor no prazo
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons & Date Input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 self-end md:self-center">
                {!rep.completed ? (
                  <>
                    <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] text-slate-300 whitespace-nowrap">Data feita:</span>
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={completionDates[rep.id] ?? new Date().toLocaleDateString('pt-BR')}
                        onChange={e => setCompletionDates(prev => ({ ...prev, [rep.id]: e.target.value }))}
                        className="px-1 py-0.5 bg-transparent text-white font-mono text-xs w-24 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleComplete(rep.member.id, rep.id, completionDates[rep.id] || new Date().toLocaleDateString('pt-BR'))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluir (+{rep.scheduledHours || 12}h)
                      </button>

                      {!rep.warningIssuedForDelay && (
                        <button
                          onClick={() => handleLateWarning(rep.member.id, rep.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          title="A não reposição acarreta em mais uma advertência"
                        >
                          +1 ADV
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteReplacement(rep.member.id, rep.id)}
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
                      onClick={() => handleDeleteReplacement(rep.member.id, rep.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remover reposição"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
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
                  {['jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26', 'dez/26'].map(m => (
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
    </div>
  );
};
