import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  CalendarPlus,
  Repeat,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { Member, ReplacementRecord, WarningRecord, MONTH_COLUMNS } from '../types/league';
import { 
  calculateReplacementDeadline, 
  syncMemberReplacementsDeadlines,
  completeReplacementAndDismissAbsence
} from '../utils/leagueCalculations';

interface CoordinationPanelBarProps {
  onOpenAddMember: () => void;
  onOpenAddShift: () => void;
  onOpenAddReplacement: () => void;
  onOpenAddWarning: () => void;
  onOpenDeleteMember: () => void;
}

export const CoordinationPanelBar: React.FC<CoordinationPanelBarProps> = ({
  onOpenAddMember,
  onOpenAddShift,
  onOpenAddReplacement,
  onOpenAddWarning,
  onOpenDeleteMember,
}) => {
  return (
    <div className="bg-slate-900/95 border-b border-slate-800/90 px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Painel de Coordenação
          </span>
          <span className="hidden md:inline-block text-[11px] text-slate-400">
            • Ações sincronizadas em tempo real no Firestore
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <button
            type="button"
            onClick={onOpenAddShift}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Lançar Plantão</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddReplacement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Repeat className="w-3.5 h-3.5 text-amber-400" />
            <span>Lançar Reposição</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddWarning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Adicionar Advertência</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddMember}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Novo Membro</span>
          </button>

          <button
            type="button"
            onClick={onOpenDeleteMember}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-rose-950/50 text-rose-400 border border-rose-900/40 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Membro</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface QuickReplacementModalProps {
  members: Member[];
  initialMemberId?: string;
  editingReplacement?: { memberId: string; replacement: ReplacementRecord } | null;
  onClose: () => void;
  onUpdateMember: (updated: Member) => void;
}

export const QuickReplacementModal: React.FC<QuickReplacementModalProps> = ({
  members,
  initialMemberId,
  editingReplacement,
  onClose,
  onUpdateMember,
}) => {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const [selectedMemberId, setSelectedMemberId] = useState(
    editingReplacement?.memberId || initialMemberId || members[0]?.id || ''
  );
  const [originMonth, setOriginMonth] = useState(
    editingReplacement?.replacement.deadlineMonth || 'out/26'
  );
  const [missedShiftDate, setMissedShiftDate] = useState(
    editingReplacement?.replacement.missedShiftDate || ''
  );
  const [scheduledHours, setScheduledHours] = useState(
    editingReplacement?.replacement.scheduledHours || 12
  );
  const [notes, setNotes] = useState(
    editingReplacement?.replacement.notes || ''
  );
  const [isCompleted, setIsCompleted] = useState(
    editingReplacement?.replacement.completed || false
  );
  const [completedDate, setCompletedDate] = useState(
    editingReplacement?.replacement.completedDate || todayStr
  );

  useEffect(() => {
    if (editingReplacement) {
      setSelectedMemberId(editingReplacement.memberId);
      setOriginMonth(editingReplacement.replacement.deadlineMonth || 'out/26');
      setMissedShiftDate(editingReplacement.replacement.missedShiftDate || '');
      setScheduledHours(editingReplacement.replacement.scheduledHours || 12);
      setNotes(editingReplacement.replacement.notes || '');
      setIsCompleted(editingReplacement.replacement.completed);
      setCompletedDate(editingReplacement.replacement.completedDate || todayStr);
    }
  }, [editingReplacement, todayStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = members.find(m => m.id === selectedMemberId);
    if (!targetMember) return;

    if (editingReplacement) {
      const oldRep = editingReplacement.replacement;
      const wasCompleted = oldRep.completed;

      if (!wasCompleted && isCompleted) {
        // Complete replacement and dismiss absence
        const { updatedMember } = completeReplacementAndDismissAbsence(
          targetMember,
          oldRep.id,
          completedDate.trim() || todayStr,
          Number(scheduledHours)
        );
        onUpdateMember(updatedMember);
      } else {
        const oldHours = wasCompleted ? (oldRep.scheduledHours || 12) : 0;
        const newHours = isCompleted ? Number(scheduledHours) : 0;
        const hoursDiff = newHours - oldHours;

        const updatedRep: ReplacementRecord = {
          ...oldRep,
          deadlineMonth: originMonth,
          deadlineDescription: calculateReplacementDeadline(originMonth, 1),
          missedShiftDate: missedShiftDate.trim() || oldRep.missedShiftDate || `${originMonth}`,
          scheduledHours: Number(scheduledHours),
          notes: notes.trim(),
          completed: isCompleted,
          ...(isCompleted ? { completedDate: completedDate.trim() || todayStr } : {}),
        };
        if (!isCompleted) {
          delete updatedRep.completedDate;
        }

        const updatedReplacements = syncMemberReplacementsDeadlines(
          targetMember.replacements.map(r => (r.id === oldRep.id ? updatedRep : r))
        );

        onUpdateMember({
          ...targetMember,
          replacements: updatedReplacements,
          accumulatedHours: Math.max(0, targetMember.accumulatedHours + hoursDiff),
          hoursUpdated: true,
        });
      }
    } else {
      const deadlineText = calculateReplacementDeadline(originMonth, 1);
      const newRepId = `rep-${Date.now()}`;
      const newRep: ReplacementRecord = {
        id: newRepId,
        memberId: selectedMemberId,
        deadlineMonth: originMonth,
        deadlineDescription: deadlineText,
        missedShiftDate: missedShiftDate.trim() || originMonth,
        scheduledHours: Number(scheduledHours),
        completed: isCompleted,
        ...(isCompleted ? { completedDate: completedDate.trim() || todayStr } : {}),
        notes: notes.trim() || `Reposição referente a ${originMonth}`,
      };

      if (isCompleted) {
        // Add rep and dismiss linked absence for originMonth if any
        const tempMember: Member = {
          ...targetMember,
          replacements: [newRep, ...targetMember.replacements],
        };
        const { updatedMember } = completeReplacementAndDismissAbsence(
          tempMember,
          newRepId,
          completedDate.trim() || todayStr,
          Number(scheduledHours)
        );
        onUpdateMember(updatedMember);
      } else {
        const updatedReplacements = syncMemberReplacementsDeadlines([
          ...targetMember.replacements,
          newRep,
        ]);

        onUpdateMember({
          ...targetMember,
          replacements: updatedReplacements,
        });
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4 my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {editingReplacement ? 'Editar Reposição de Plantão' : 'Lançar / Agendar Reposição'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Salva diretamente no Firebase Firestore em tempo real
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Integrante *
            </label>
            <select
              value={selectedMemberId}
              disabled={Boolean(editingReplacement)}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white disabled:opacity-60"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.accumulatedHours}h)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
                Mês de Origem *
              </label>
              <select
                value={originMonth}
                onChange={e => setOriginMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
              >
                {MONTH_COLUMNS.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
                Carga Horária (h) *
              </label>
              <input
                type="number"
                min={1}
                max={48}
                required
                value={scheduledHours}
                onChange={e => setScheduledHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Data da Falta de Origem (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: 15/10 (out/26)"
              value={missedShiftDate}
              onChange={e => setMissedShiftDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Observações / Motivo
            </label>
            <textarea
              rows={2}
              placeholder="Descreva detalhes da reposição..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/70 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={e => setIsCompleted(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-700"
              />
              <span className="font-semibold text-xs">Reposição já concluída / cumprida?</span>
            </label>

            {isCompleted && (
              <div>
                <label className="text-slate-300 uppercase font-semibold text-[10px] block mb-1">
                  Data em que foi realizada *
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={completedDate}
                  onChange={e => setCompletedDate(e.target.value)}
                  required={isCompleted}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Soma +{scheduledHours}h na carga horária do integrante.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow cursor-pointer"
            >
              Salvar no Firestore
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface QuickWarningModalProps {
  members: Member[];
  initialMemberId?: string;
  editingWarning?: { memberId: string; warning: WarningRecord } | null;
  onClose: () => void;
  onUpdateMember: (updated: Member) => void;
}

export const QuickWarningModal: React.FC<QuickWarningModalProps> = ({
  members,
  initialMemberId,
  editingWarning,
  onClose,
  onUpdateMember,
}) => {
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const [selectedMemberId, setSelectedMemberId] = useState(
    editingWarning?.memberId || initialMemberId || members[0]?.id || ''
  );
  const [date, setDate] = useState(editingWarning?.warning.date || todayStr);
  const [reason, setReason] = useState(editingWarning?.warning.reason || '');
  const [active, setActive] = useState(
    editingWarning ? editingWarning.warning.active : true
  );

  useEffect(() => {
    if (editingWarning) {
      setSelectedMemberId(editingWarning.memberId);
      setDate(editingWarning.warning.date);
      setReason(editingWarning.warning.reason);
      setActive(editingWarning.warning.active);
    }
  }, [editingWarning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = members.find(m => m.id === selectedMemberId);
    if (!targetMember || !reason.trim()) return;

    if (editingWarning) {
      const updatedWarnings = targetMember.warnings.map(w =>
        w.id === editingWarning.warning.id
          ? {
              ...w,
              date: date.trim(),
              reason: reason.trim(),
              active,
            }
          : w
      );

      onUpdateMember({
        ...targetMember,
        warnings: updatedWarnings,
      });
    } else {
      const newWarn: WarningRecord = {
        id: `w-${Date.now()}`,
        date: date.trim() || todayStr,
        reason: reason.trim(),
        severity: 'moderada',
        active,
      };

      onUpdateMember({
        ...targetMember,
        warnings: [newWarn, ...targetMember.warnings],
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4 my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {editingWarning ? 'Editar Advertência Disciplinar' : 'Adicionar Advertência Formal'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Registra e atualiza imediatamente no Firebase Firestore
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Integrante *
            </label>
            <select
              value={selectedMemberId}
              disabled={Boolean(editingWarning)}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white disabled:opacity-60"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Data da Ocorrência *
            </label>
            <input
              type="text"
              required
              placeholder="DD/MM/AAAA"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Motivo / Descrição da Advertência *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Descreva o motivo formal da advertência..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/70">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 border-slate-700"
              />
              <span className="font-semibold text-xs">Advertência Ativa (vigente no prontuário)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow cursor-pointer"
            >
              {editingWarning ? 'Salvar Alterações' : 'Registrar Advertência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteMemberModalProps {
  members: Member[];
  initialMemberId?: string;
  onClose: () => void;
  onConfirmDelete: (memberId: string) => void;
}

export const DeleteMemberModal: React.FC<DeleteMemberModalProps> = ({
  members,
  initialMemberId,
  onClose,
  onConfirmDelete,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState(
    initialMemberId || members[0]?.id || ''
  );

  const selectedMember = members.find(m => m.id === selectedMemberId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    onConfirmDelete(selectedMemberId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4 my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Excluir Membro Permanentemente</h3>
            <p className="text-[11px] text-slate-400">
              Remove o registro do Firebase Firestore para todos os usuários
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 uppercase font-semibold block text-[10px] mb-1">
              Selecione o Membro a Excluir *
            </label>
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role} • {m.accumulatedHours}h)
                </option>
              ))}
            </select>
          </div>

          {selectedMember && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-200 space-y-1">
              <p className="font-bold text-white text-sm">{selectedMember.name}</p>
              <p className="text-[11px] text-slate-300">
                Cargo: {selectedMember.role} • Horas: {selectedMember.accumulatedHours}h • Plantões: {selectedMember.shifts.length}
              </p>
              <p className="text-[11px] text-rose-300 font-semibold pt-1">
                Atenção: Esta ação apaga definitivamente o documento no banco de dados e não pode ser desfeita.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedMemberId}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Confirmar Exclusão</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
