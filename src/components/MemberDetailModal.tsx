import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Repeat, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Info,
  RefreshCw,
  Pencil,
  Check
} from 'lucide-react';
import { Member, LeagueConfig, ShiftRecord, RoleInLeague, MemberStatus, ReplacementRecord, WarningRecord } from '../types/league';
import { MONTH_COLUMNS } from '../data/initialData';
import { 
  checkCertificateEligibility, 
  calculateActiveTime, 
  calculateReplacementDeadline,
  syncMemberReplacementsDeadlines 
} from '../utils/leagueCalculations';

interface MemberDetailModalProps {
  member: Member;
  config: LeagueConfig;
  onClose: () => void;
  onUpdateMember: (updated: Member) => void;
  onDeleteMember: (id: string) => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  member,
  config,
  onClose,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'absences' | 'replacements' | 'warnings' | 'edit'>('shifts');

  // Form states for Shift
  const [newShiftDate, setNewShiftDate] = useState('02/10');
  const [newShiftMonth, setNewShiftMonth] = useState('out/26');
  const [newShiftHours, setNewShiftHours] = useState(12);
  const [shiftStatus, setShiftStatus] = useState<'concluido' | 'falta_justificada' | 'falta_injustificada'>('concluido');

  // Edit Shift State
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftDate, setEditShiftDate] = useState('');
  const [editShiftMonth, setEditShiftMonth] = useState('out/26');
  const [editShiftHours, setEditShiftHours] = useState(12);
  const [editShiftDescription, setEditShiftDescription] = useState('');
  const [editShiftStatus, setEditShiftStatus] = useState<'concluido' | 'falta_justificada' | 'falta_injustificada'>('concluido');

  // Repositions completion dates states
  const [completionDates, setCompletionDates] = useState<Record<string, string>>({});
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});
  const [isEditingDateId, setIsEditingDateId] = useState<string | null>(null);

  // Edit member states
  const [editName, setEditName] = useState(member.name);
  const [editRole, setEditRole] = useState<RoleInLeague>(member.role === 'Coordenação' ? 'Coordenação' : 'Ligante');
  const [editStatus, setEditStatus] = useState<MemberStatus>(member.status);
  const [editEntryDate, setEditEntryDate] = useState(member.entryDate);
  const [editHours, setEditHours] = useState(member.accumulatedHours);
  const [editEmail, setEditEmail] = useState(member.email || '');

  // Feedback banner state
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  const eligibility = checkCertificateEligibility(member, config);
  const activeTime = calculateActiveTime(member.entryDate);

  // Count pending replacements
  const currentPendingReplacements = member.replacements.filter(r => !r.completed).length;

  // Handler: Start Editing Shift
  const handleStartEditShift = (shift: ShiftRecord) => {
    setEditingShiftId(shift.id);
    setEditShiftDate(shift.date);
    setEditShiftMonth(shift.monthKey || 'out/26');
    setEditShiftHours(shift.hours || 12);
    setEditShiftDescription(shift.description || '');
    setEditShiftStatus(shift.shiftStatus || (shift.hours > 0 ? 'concluido' : 'falta_justificada'));
  };

  const handleCancelEditShift = () => {
    setEditingShiftId(null);
  };

  const handleSaveEditShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShiftId) return;

    const oldShift = member.shifts.find(s => s.id === editingShiftId);
    if (!oldShift) return;

    const oldHours = (oldShift.isExcused || oldShift.shiftStatus === 'falta_justificada' || oldShift.shiftStatus === 'falta_injustificada') ? 0 : oldShift.hours;
    const newHours = (editShiftStatus === 'falta_justificada' || editShiftStatus === 'falta_injustificada') ? 0 : Number(editShiftHours);
    const diffHours = newHours - oldHours;

    const updatedShifts = member.shifts.map(s => {
      if (s.id === editingShiftId) {
        return {
          ...s,
          date: editShiftDate,
          monthKey: editShiftMonth,
          hours: newHours,
          description: editShiftDescription || (editShiftStatus === 'falta_justificada' ? 'Falta Justificada' : editShiftStatus === 'falta_injustificada' ? 'Falta Não Justificada' : 'Plantão Concluído'),
          shiftStatus: editShiftStatus,
        };
      }
      return s;
    });

    const updatedJustified = member.justifiedAbsences.map(a => {
      if (a.shiftId === editingShiftId || a.id === oldShift.absenceId) {
        return {
          ...a,
          date: editShiftDate,
          monthKey: editShiftMonth,
        };
      }
      return a;
    });

    const updatedUnjustified = member.unjustifiedAbsences.map(a => {
      if (a.shiftId === editingShiftId || a.id === oldShift.absenceId) {
        return {
          ...a,
          date: editShiftDate,
          monthKey: editShiftMonth,
        };
      }
      return a;
    });

    const updatedReplacements = member.replacements.map(r => {
      if (r.shiftId === editingShiftId || r.absenceId === oldShift.absenceId || r.id === oldShift.replacementId) {
        return {
          ...r,
          missedShiftDate: `${editShiftDate} (${editShiftMonth})`,
        };
      }
      return r;
    });

    onUpdateMember({
      ...member,
      shifts: updatedShifts,
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      replacements: syncMemberReplacementsDeadlines(updatedReplacements),
      accumulatedHours: Math.max(0, member.accumulatedHours + diffHours),
      hoursUpdated: true,
    });

    setEditingShiftId(null);
    showFeedback('Escala atualizada com sucesso!');
  };

  // Handler: Delete Replacement
  const handleDeleteReplacement = (repId: string) => {
    const rep = member.replacements.find(r => r.id === repId);
    const hoursToDeduct = (rep && rep.completed) ? (rep.scheduledHours || 12) : 0;

    const updatedReplacements = syncMemberReplacementsDeadlines(
      member.replacements.filter(r => r.id !== repId)
    );

    const updatedJustified = member.justifiedAbsences.filter(a => a.replacementId !== repId && a.id !== rep?.absenceId);
    const updatedUnjustified = member.unjustifiedAbsences.filter(a => a.replacementId !== repId && a.id !== rep?.absenceId);

    onUpdateMember({
      ...member,
      replacements: updatedReplacements,
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      accumulatedHours: Math.max(0, member.accumulatedHours - hoursToDeduct),
    });

    showFeedback('Reposição removida com sucesso!');
  };

  // Handler: Delete Warning Permanently
  const handleDeleteWarning = (warnId: string) => {
    onUpdateMember({
      ...member,
      warnings: member.warnings.filter(w => w.id !== warnId),
    });
    showFeedback('Advertência removida com sucesso!');
  };

  // Handler: Add Shift with Regimental Rules
  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();

    if (shiftStatus === 'concluido') {
      const newShift: ShiftRecord = {
        id: `s-${Date.now()}`,
        date: newShiftDate,
        monthKey: newShiftMonth,
        hours: Number(newShiftHours),
        type: 'plantao',
        shiftStatus: 'concluido',
        description: 'Plantão Concluído',
      };

      onUpdateMember({
        ...member,
        shifts: [newShift, ...member.shifts],
        accumulatedHours: member.accumulatedHours + Number(newShiftHours),
        hoursUpdated: true,
      });

      showFeedback(`Plantão concluído registrado (+${newShiftHours}h adicionadas).`);

    } else if (shiftStatus === 'falta_justificada') {
      const absenceId = `ab-fj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;

      const currentAbsencesInMonth = [...member.justifiedAbsences, ...member.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === newShiftMonth).length + 1;
      const deadlineText = calculateReplacementDeadline(newShiftMonth, currentAbsencesInMonth);

      const newAbsence: typeof member.justifiedAbsences[0] = {
        id: absenceId,
        date: newShiftDate,
        monthKey: newShiftMonth,
        type: 'justificada',
        reason: `Falta justificada no plantão de ${newShiftDate} (${newShiftMonth})`,
        requiresReplacement: true,
        shiftId,
        replacementId,
      };

      const newReplacement: ReplacementRecord = {
        id: replacementId,
        memberId: member.id,
        absenceId,
        shiftId,
        scheduledDate: 'A definir',
        scheduledHours: Number(newShiftHours),
        completed: false,
        deadlineMonth: newShiftMonth,
        deadlineDescription: deadlineText,
        missedShiftDate: `${newShiftDate} (${newShiftMonth})`,
        notes: 'Referente à falta não justificada de 02/10/2026',
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: newShiftDate,
        monthKey: newShiftMonth,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_justificada',
        description: 'Falta Justificada (requer reposição)',
        absenceId,
        replacementId,
      };

      const updatedReplacements = syncMemberReplacementsDeadlines([newReplacement, ...member.replacements]);

      onUpdateMember({
        ...member,
        shifts: [newShift, ...member.shifts],
        justifiedAbsences: [newAbsence, ...member.justifiedAbsences],
        replacements: updatedReplacements,
      });

      showFeedback(`Falta Justificada registrada (Reposição: ${deadlineText}).`);

    } else if (shiftStatus === 'falta_injustificada') {
      const absenceId = `ab-fnj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;
      const warningId = `w-${Date.now()}`;

      const currentAbsencesInMonth = [...member.justifiedAbsences, ...member.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === newShiftMonth).length + 1;
      const deadlineText = calculateReplacementDeadline(newShiftMonth, currentAbsencesInMonth);

      const newWarning: WarningRecord = {
        id: warningId,
        date: newShiftDate,
        reason: `Advertência por falta não justificada no plantão de ${newShiftDate} (${newShiftMonth})`,
        severity: 'moderada',
        active: true,
      };

      const newAbsence: typeof member.unjustifiedAbsences[0] = {
        id: absenceId,
        date: newShiftDate,
        monthKey: newShiftMonth,
        type: 'injustificada',
        reason: `Falta não justificada no plantão de ${newShiftDate} (${newShiftMonth})`,
        requiresReplacement: true,
        shiftId,
        replacementId,
        warningId,
      };

      const newReplacement: ReplacementRecord = {
        id: replacementId,
        memberId: member.id,
        absenceId,
        shiftId,
        scheduledDate: 'A definir',
        scheduledHours: Number(newShiftHours),
        completed: false,
        deadlineMonth: newShiftMonth,
        deadlineDescription: deadlineText,
        missedShiftDate: `${newShiftDate} (${newShiftMonth})`,
        notes: 'Referente à falta não justificada de 02/10/2026',
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: newShiftDate,
        monthKey: newShiftMonth,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_injustificada',
        description: 'Falta Não Justificada (Gerou 1 ADV e 1 Reposição)',
        absenceId,
        replacementId,
      };

      const updatedReplacements = syncMemberReplacementsDeadlines([newReplacement, ...member.replacements]);

      onUpdateMember({
        ...member,
        shifts: [newShift, ...member.shifts],
        warnings: [newWarning, ...member.warnings],
        unjustifiedAbsences: [newAbsence, ...member.unjustifiedAbsences],
        replacements: updatedReplacements,
      });

      showFeedback(`Falta Não Justificada registrada (Gerou +1 ADV e 1 Reposição).`);
    }
  };

  // Handler: Delete Shift with Full Cascade
  const handleDeleteShift = (shiftId: string) => {
    const shift = member.shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const hoursToDeduct = shift.isExcused ? 0 : shift.hours;

    const updatedJustified = member.justifiedAbsences.filter(
      a => a.shiftId !== shiftId && a.id !== shift.absenceId && !(a.date === shift.date && a.monthKey === shift.monthKey && shift.shiftStatus === 'falta_justificada')
    );
    const updatedUnjustified = member.unjustifiedAbsences.filter(
      a => a.shiftId !== shiftId && a.id !== shift.absenceId && !(a.date === shift.date && a.monthKey === shift.monthKey && shift.shiftStatus === 'falta_injustificada')
    );

    const updatedReplacements = syncMemberReplacementsDeadlines(
      member.replacements.filter(
        r => r.shiftId !== shiftId && r.id !== shift.replacementId && r.absenceId !== shift.absenceId && !(r.missedShiftDate?.includes(shift.date) && !r.completed)
      )
    );

    let updatedWarnings = member.warnings;
    if (shift.shiftStatus === 'falta_injustificada') {
      updatedWarnings = member.warnings.filter(
        w => !w.reason.includes(shift.date)
      );
    }

    onUpdateMember({
      ...member,
      shifts: member.shifts.filter(s => s.id !== shiftId),
      accumulatedHours: Math.max(0, member.accumulatedHours - hoursToDeduct),
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      replacements: updatedReplacements,
      warnings: updatedWarnings,
    });

    showFeedback('Escala/plantão removido com sucesso!');
  };

  // Handler: Delete Absence directly from Faltas Tab
  const handleDeleteAbsence = (absenceId: string, type: 'justificada' | 'injustificada') => {
    const targetAbs = (type === 'justificada' ? member.justifiedAbsences : member.unjustifiedAbsences)
      .find(a => a.id === absenceId);
    if (!targetAbs) return;

    const updatedJustified = member.justifiedAbsences.filter(a => a.id !== absenceId);
    const updatedUnjustified = member.unjustifiedAbsences.filter(a => a.id !== absenceId);

    const updatedShifts = member.shifts.filter(
      s => s.absenceId !== absenceId && s.id !== targetAbs.shiftId && !(s.date === targetAbs.date && s.monthKey === targetAbs.monthKey && s.hours === 0)
    );

    const updatedReplacements = syncMemberReplacementsDeadlines(
      member.replacements.filter(
        r => r.absenceId !== absenceId && r.id !== targetAbs.replacementId && !(r.missedShiftDate?.includes(targetAbs.date) && !r.completed)
      )
    );

    let updatedWarnings = member.warnings;
    if (type === 'injustificada') {
      updatedWarnings = member.warnings.filter(
        w => w.id !== targetAbs.warningId && !w.reason.includes(targetAbs.date)
      );
    }

    onUpdateMember({
      ...member,
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      shifts: updatedShifts,
      replacements: updatedReplacements,
      warnings: updatedWarnings,
    });

    showFeedback('Registro de falta removido com sucesso!');
  };

  // Handler: Clean Duplicate Absences
  const handleCleanDuplicateAbsences = () => {
    const seen = new Set<string>();
    const uniqueJustified: typeof member.justifiedAbsences = [];
    member.justifiedAbsences.forEach(a => {
      const key = `${a.date}-${a.monthKey || 'out/26'}-${a.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJustified.push(a);
      }
    });

    const uniqueUnjustified: typeof member.unjustifiedAbsences = [];
    member.unjustifiedAbsences.forEach(a => {
      const key = `${a.date}-${a.monthKey || 'out/26'}-${a.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueUnjustified.push(a);
      }
    });

    onUpdateMember({
      ...member,
      justifiedAbsences: uniqueJustified,
      unjustifiedAbsences: uniqueUnjustified,
    });

    showFeedback('Faltas duplicadas removidas com sucesso!');
  };

  // Handler: Complete Replacement
  const handleCompleteReplacement = (repId: string, customDate?: string) => {
    const rep = member.replacements.find(r => r.id === repId);
    if (!rep) return;

    const finalDate = customDate && customDate.trim() ? customDate.trim() : new Date().toLocaleDateString('pt-BR');

    const updated = member.replacements.map(r => {
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
      ...member,
      replacements: updated,
      accumulatedHours: member.accumulatedHours + (rep.scheduledHours || 12),
      hoursUpdated: true,
    });

    showFeedback(`Reposição confirmada (${finalDate})! +${rep.scheduledHours || 12}h creditadas.`);
  };

  // Handler: Edit / Update completion date for an already completed replacement
  const handleSaveCompletedDate = (repId: string, newDate: string) => {
    if (!newDate.trim()) return;
    const updated = member.replacements.map(r => {
      if (r.id === repId) {
        return {
          ...r,
          completedDate: newDate.trim(),
        };
      }
      return r;
    });

    onUpdateMember({
      ...member,
      replacements: updated,
    });
    setIsEditingDateId(null);
    showFeedback('Data de reposição atualizada!');
  };

  // Handler: Issue Warning for Late / Overdue Replacement
  const handleIssueWarningForLateReplacement = (repId: string) => {
    const rep = member.replacements.find(r => r.id === repId);
    if (!rep) return;

    const today = new Date().toLocaleDateString('pt-BR');
    const newWarning: WarningRecord = {
      id: `w-${Date.now()}`,
      date: today,
      reason: `Advertência por descumprimento do prazo regimental para reposição do plantão (${rep.missedShiftDate || 'escala pendente'})`,
      severity: 'grave',
      active: true,
    };

    const updatedReplacements = member.replacements.map(r => 
      r.id === repId ? { ...r, warningIssuedForDelay: true } : r
    );

    onUpdateMember({
      ...member,
      warnings: [newWarning, ...member.warnings],
      replacements: updatedReplacements,
    });

    showFeedback('Advertência disciplinar aplicada por atraso na reposição!');
  };

  // Handler: Toggle/Revoke Warning
  const handleToggleWarning = (warnId: string) => {
    onUpdateMember({
      ...member,
      warnings: member.warnings.map(w => w.id === warnId ? { ...w, active: !w.active } : w),
    });
    showFeedback('Status da advertência alterado com sucesso!');
  };

  // Handler: Save Basic Member Info
  const handleSaveMemberInfo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMember({
      ...member,
      name: editName,
      role: editRole,
      status: editStatus,
      entryDate: editEntryDate,
      accumulatedHours: Number(editHours),
      email: editEmail,
    });
    showFeedback('Dados do cadastro atualizados com sucesso!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header with Member Overview */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 border-b border-slate-800 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer z-10"
            title="Fechar ficha"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg shadow-teal-500/20 font-serif shrink-0">
                {member.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">{member.name}</h2>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border shrink-0 ${
                    member.role === 'Coordenação'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {member.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Admissão: {member.entryDate} • {activeTime.formatted} de atividade contínua
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                member.accumulatedHours >= config.minHoursForCertificate && member.replacements.filter(r => !r.completed).length === 0 && member.warnings.filter(w => w.active).length === 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                {member.accumulatedHours >= config.minHoursForCertificate
                  ? `Meta ${config.minHoursForCertificate}h Atingida`
                  : `Progresso: ${member.accumulatedHours}/${config.minHoursForCertificate}h`}
              </span>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold truncate">Carga Horária</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-bold text-white font-mono text-sm">{member.accumulatedHours}h</span>
                <span className="text-[10px] text-slate-400">/ {config.minHoursForCertificate}h</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold truncate">Faltas Justificadas</span>
              <span className="font-bold text-blue-400 font-mono text-sm block mt-0.5">{member.justifiedAbsences.length} FJ</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold truncate">Faltas Não Justif.</span>
              <span className={`font-bold font-mono text-sm block mt-0.5 ${member.unjustifiedAbsences.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {member.unjustifiedAbsences.length} FNJ
              </span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold truncate">Reposições Pend.</span>
              <span className={`font-bold font-mono text-sm block mt-0.5 ${currentPendingReplacements > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {currentPendingReplacements} REP
              </span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 col-span-2 sm:col-span-1 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold truncate">Advertências</span>
              <span className={`font-bold font-mono text-sm block mt-0.5 ${member.warnings.filter(w => w.active).length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {member.warnings.filter(w => w.active).length} ADV
              </span>
            </div>
          </div>
        </div>

        {/* Action Feedback Notice */}
        {actionNotice && (
          <div className="bg-emerald-950/80 border-b border-emerald-800/60 text-emerald-300 px-4 py-2 text-xs flex items-center justify-between shrink-0 animate-fadeIn">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {actionNotice}
            </span>
            <button 
              type="button" 
              onClick={() => setActionNotice(null)}
              className="text-emerald-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-4 sm:px-5 gap-1.5 sm:gap-2 overflow-x-auto shrink-0 z-10">
          {[
            { id: 'shifts', label: `Plantões & Escala (${member.shifts.length})` },
            { id: 'absences', label: `Faltas (${member.justifiedAbsences.length + member.unjustifiedAbsences.length})` },
            { id: 'replacements', label: `Reposições (${member.replacements.length})` },
            { id: 'warnings', label: `Advertências (${member.warnings.length})` },
            { id: 'edit', label: 'Editar Cadastro' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 sm:px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body with internal scrolling */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-5 text-xs text-slate-300">
          
          {/* TAB 1: SHIFTS */}
          {activeTab === 'shifts' && (
            <div className="space-y-4">
              {/* Add Shift Form */}
              <form onSubmit={handleAddShift} className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    Lançar Plantão na Escala
                  </span>
                  <span className="text-[11px] text-slate-400">
                    O regimento aplica advertências e reposições conforme o status
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Data / Dia *</label>
                    <input
                      type="text"
                      placeholder="Ex: 22/03"
                      value={newShiftDate}
                      onChange={e => setNewShiftDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Mês da Escala *</label>
                    <select
                      value={newShiftMonth}
                      onChange={e => setNewShiftMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    >
                      {['jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26', 'dez/26'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Carga Horária *</label>
                    <select
                      value={newShiftHours}
                      onChange={e => setNewShiftHours(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    >
                      <option value={12}>12 horas (Padrão)</option>
                      <option value={6}>6 horas</option>
                      <option value={4}>4 horas (Aula/Reunião)</option>
                      <option value={24}>24 horas (Duplo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                      Status do Plantão *
                    </label>
                    <select
                      value={shiftStatus}
                      onChange={e => setShiftStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="concluido">Plantão Concluído</option>
                      <option value="falta_justificada">Falta Justificada</option>
                      <option value="falta_injustificada">Falta Não Justificada</option>
                    </select>
                  </div>
                </div>

                {/* Regimental Guidance Info Box */}
                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  shiftStatus === 'concluido'
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                    : shiftStatus === 'falta_justificada'
                    ? 'bg-blue-950/30 border-blue-800/40 text-blue-200'
                    : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                }`}>
                  {shiftStatus === 'concluido' && (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Presença Confirmada:</strong> Adiciona <strong>{newShiftHours} horas</strong> ao ligante e computa no progresso da meta de {config.minHoursForCertificate}h.
                      </span>
                    </div>
                  )}

                  {shiftStatus === 'falta_justificada' && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Falta Justificada:</strong> <u>Não gera advertência</u> disciplinar.
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-6">
                        • <strong>Regra de Reposição:</strong> O plantão deve ser reposto. Prazo: <strong>{calculateReplacementDeadline(newShiftMonth, currentPendingReplacements + 1)}</strong> (1 plantão faltado = mês seguinte; 2 faltados = 2 meses seguintes).
                      </p>
                    </div>
                  )}

                  {shiftStatus === 'falta_injustificada' && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Falta Não Justificada:</strong> <u>Gera 1 ADVERTÊNCIA</u> disciplinar ativa no prontuário.
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-6">
                        • <strong>Regra de Reposição:</strong> O plantão deve ser reposto. Prazo: <strong>{calculateReplacementDeadline(newShiftMonth, currentPendingReplacements + 1)}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Salvar Plantão / Ocorrência
                  </button>
                </div>
              </form>

              {/* Shifts List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-xs">Histórico de Escalas Realizadas ({member.shifts.length})</h4>
                  <span className="text-[11px] text-slate-400">Total computado: {member.accumulatedHours}h</span>
                </div>

                {member.shifts.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 border border-dashed border-slate-800 rounded-xl">
                    Nenhum plantão individual registrado na lista (horas acumuladas: {member.accumulatedHours}h).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {member.shifts.map(shift => {
                      const isEditing = editingShiftId === shift.id;

                      if (isEditing) {
                        return (
                          <form
                            key={shift.id}
                            onSubmit={handleSaveEditShift}
                            className="p-3.5 bg-slate-800 border border-emerald-500/50 rounded-xl space-y-3 shadow-md"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                              <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                                <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                                Editar Escala / Plantão
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {shift.id}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              <div>
                                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Data / Dia</label>
                                <input
                                  type="text"
                                  value={editShiftDate}
                                  onChange={e => setEditShiftDate(e.target.value)}
                                  required
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Mês da Escala</label>
                                <select
                                  value={editShiftMonth}
                                  onChange={e => setEditShiftMonth(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500"
                                >
                                  {MONTH_COLUMNS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Status</label>
                                <select
                                  value={editShiftStatus}
                                  onChange={e => setEditShiftStatus(e.target.value as any)}
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500 font-semibold"
                                >
                                  <option value="concluido">Plantão Concluído</option>
                                  <option value="falta_justificada">Falta Justificada</option>
                                  <option value="falta_injustificada">Falta Não Justificada</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Horas Computadas</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={24}
                                  value={editShiftStatus === 'concluido' ? editShiftHours : 0}
                                  onChange={e => setEditShiftHours(Number(e.target.value))}
                                  disabled={editShiftStatus !== 'concluido'}
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500 font-mono disabled:opacity-50"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Descrição / Setor</label>
                              <input
                                type="text"
                                value={editShiftDescription}
                                onChange={e => setEditShiftDescription(e.target.value)}
                                placeholder="Ex: Plantão Concluído"
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEditShift}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs cursor-pointer font-medium"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Salvar Alterações
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={shift.id}
                          className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between gap-3 group hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              shift.shiftStatus === 'falta_injustificada'
                                ? 'bg-rose-500/10 text-rose-400'
                                : shift.shiftStatus === 'falta_justificada'
                                ? 'bg-blue-500/10 text-blue-400'
                                : shift.isExcused 
                                ? 'bg-purple-500/10 text-purple-400' 
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs font-mono">{shift.date}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({shift.monthKey})</span>
                                {shift.shiftStatus === 'falta_injustificada' ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                                    Falta Não Justif.
                                  </span>
                                ) : shift.shiftStatus === 'falta_justificada' ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                                    Falta Justificada
                                  </span>
                                ) : shift.isExcused ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                                    Abonado
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                                    Concluído
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {shift.description || 'Plantão'} • <span className="font-mono text-slate-300 font-semibold">{shift.hours}hs</span>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons: Edit & Remove */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditShift(shift);
                              }}
                              className="px-2 py-1.5 text-xs text-slate-300 hover:text-emerald-400 bg-slate-800 hover:bg-emerald-500/10 border border-slate-700 hover:border-emerald-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Editar esta escala"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteShift(shift.id);
                              }}
                              className="px-2 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Remover escala"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Remover</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ABSENCES */}
          {activeTab === 'absences' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-400" />
                    Regulamento de Faltas & Prazos de Reposição
                  </h4>
                  {(() => {
                    const allAbs = [...member.justifiedAbsences, ...member.unjustifiedAbsences];
                    const keys = allAbs.map(a => `${a.date}-${a.monthKey || 'out/26'}-${a.type}`);
                    const hasDups = new Set(keys).size < keys.length;
                    return hasDups ? (
                      <button
                        type="button"
                        onClick={handleCleanDuplicateAbsences}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Limpar faltas duplicadas detectadas"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin-hover" />
                        Remover Faltas Duplicadas
                      </button>
                    ) : null;
                  })()}
                </div>
                <div className="text-slate-300 text-xs leading-relaxed space-y-1">
                  <p>
                    • <strong>Falta Justificada:</strong> <u>Não gera advertência</u>. O plantão deve ser reposto.
                  </p>
                  <p>
                    • <strong>Falta Não Justificada:</strong> <u>Gera 1 advertência disciplinar</u> ativa e o plantão deve ser reposto.
                  </p>
                  <p className="text-amber-300 font-medium">
                    • <strong>Prazo Regimental:</strong> Tendo <strong>duas faltas de plantões no mesmo mês</strong>, o acadêmico terá os <strong>próximos 2 meses seguintes</strong> para repor esses dois plantões. (No caso de 1 falta no mês, deve repor no mês seguinte).
                  </p>
                </div>
              </div>

              {/* Absences List */}
              <div className="space-y-2">
                {[...member.justifiedAbsences, ...member.unjustifiedAbsences].length === 0 ? (
                  <p className="text-slate-400 text-center py-6 border border-dashed border-slate-800 rounded-xl">
                    Nenhuma falta registrada no prontuário.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {member.justifiedAbsences.map(abs => {
                      const sameMonthCount = member.justifiedAbsences.filter(a => (a.monthKey || 'out/26') === (abs.monthKey || 'out/26')).length +
                        member.unjustifiedAbsences.filter(a => (a.monthKey || 'out/26') === (abs.monthKey || 'out/26')).length;
                      const deadlineText = calculateReplacementDeadline(abs.monthKey || 'out/26', sameMonthCount);

                      return (
                        <div key={abs.id} className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-blue-700/60 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Falta Justificada (F.J)
                              </span>
                              <span className="text-white font-mono font-bold text-xs">{abs.date}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({abs.monthKey || 'out/26'})</span>
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Sem advertência
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1 text-xs">{abs.reason}</p>
                            <p className="text-[11px] text-amber-300 font-medium mt-0.5">
                              ⏰ Prazo de Reposição: {deadlineText} {sameMonthCount >= 2 ? '(2 faltas no mês)' : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                              Requer Reposição
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAbsence(abs.id, 'justificada');
                              }}
                              className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Excluir este registro de falta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Remover</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {member.unjustifiedAbsences.map(abs => {
                      const sameMonthCount = member.justifiedAbsences.filter(a => (a.monthKey || 'out/26') === (abs.monthKey || 'out/26')).length +
                        member.unjustifiedAbsences.filter(a => (a.monthKey || 'out/26') === (abs.monthKey || 'out/26')).length;
                      const deadlineText = calculateReplacementDeadline(abs.monthKey || 'out/26', sameMonthCount);

                      return (
                        <div key={abs.id} className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-rose-700/60 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Falta Não Justificada (F.N.J)
                              </span>
                              <span className="text-white font-mono font-bold text-xs">{abs.date}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({abs.monthKey || 'out/26'})</span>
                              <span className="text-[10px] text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded font-bold border border-rose-500/30">
                                Gerou Advertência (+1 ADV)
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1 text-xs">{abs.reason}</p>
                            <p className="text-[11px] text-amber-300 font-medium mt-0.5">
                              ⏰ Prazo de Reposição: {deadlineText} {sameMonthCount >= 2 ? '(2 faltas no mês)' : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                              Requer Reposição
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAbsence(abs.id, 'injustificada');
                              }}
                              className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Excluir este registro de falta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Remover</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REPLACEMENTS */}
          {activeTab === 'replacements' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl">
                <h4 className="font-semibold text-white text-xs mb-1">Reposições de Plantões & Prazos Regimentais</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  • <strong>Prazo:</strong> 1 plantão faltado deve ser reposto no <strong>mês seguinte</strong>. 
                  No caso de 2 plantões faltados, podem ser repostos nos <strong>dois próximos meses seguintes</strong>.<br />
                  • <strong>Penalidade:</strong> A não reposição do plantão dentro do prazo estipulado acarreta em <strong>mais uma advertência disciplinar</strong>.
                </p>
              </div>

              {member.replacements.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p>Membro sem reposições pendentes. Frequência 100% em conformidade!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {member.replacements.map(rep => (
                    <div 
                      key={rep.id}
                      className={`p-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                        rep.completed 
                          ? 'bg-slate-800/30 border-slate-800 text-slate-400' 
                          : 'bg-amber-950/20 border-amber-800/40 text-slate-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rep.completed 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {rep.completed ? 'Cumprida' : 'Pendente de Reposição'}
                          </span>
                          <span className="font-mono text-white text-xs font-semibold">
                            Carga: {rep.scheduledHours || 12} horas
                          </span>
                          {rep.missedShiftDate && (
                            <span className="text-[11px] text-slate-400">
                              (Origem: {rep.missedShiftDate})
                            </span>
                          )}
                        </div>

                        {/* Deadline information */}
                        {!rep.completed && (
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="text-amber-300 font-semibold">
                              ⏰ Prazo: {rep.deadlineDescription || 'Mês seguinte (1 falta) / 2 meses (2 faltas)'}
                            </span>
                            {rep.warningIssuedForDelay && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                                Advertido por Atraso
                              </span>
                            )}
                          </div>
                        )}

                        {rep.notes && (
                          <p className="text-xs text-slate-300">
                            {rep.notes}
                          </p>
                        )}

                        {rep.completedDate && (
                          <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1 flex-wrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Reposição realizada em:</span>
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
                                  type="button"
                                  onClick={() => handleSaveCompletedDate(rep.id, editingDates[rep.id] ?? rep.completedDate ?? '')}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
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
                                  type="button"
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

                      {/* Action buttons & Date Input */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                        {!rep.completed ? (
                          <>
                            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 shadow-inner">
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

                            <button
                              type="button"
                              onClick={() => handleCompleteReplacement(rep.id, completionDates[rep.id] || new Date().toLocaleDateString('pt-BR'))}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmar (+12h)
                            </button>

                            {!rep.warningIssuedForDelay && (
                              <button
                                type="button"
                                onClick={() => handleIssueWarningForLateReplacement(rep.id)}
                                title="A não reposição acarreta em mais uma advertência"
                                className="px-2.5 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/70 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                +1 ADV
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReplacement(rep.id);
                              }}
                              className="px-2.5 py-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Remover reposição"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Horas Computadas
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReplacement(rep.id);
                              }}
                              className="px-2.5 py-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Remover reposição"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WARNINGS */}
          {activeTab === 'warnings' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl text-xs text-slate-300">
                <h4 className="font-semibold text-white text-xs mb-1">Prontuário Disciplinar (ADV)</h4>
                <p>
                  As advertências são geradas automaticamente por falta não justificada em plantão ou pelo não cumprimento de reposições dentro do prazo regulamentar.
                </p>
              </div>

              {/* Warnings List */}
              <div className="space-y-2">
                {member.warnings.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 border border-dashed border-slate-800 rounded-xl">
                    Nenhuma advertência cadastrada. Conduta exemplar!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {member.warnings.map(warn => (
                      <div 
                        key={warn.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          warn.active 
                            ? 'bg-rose-950/20 border-rose-800/40 text-rose-200' 
                            : 'bg-slate-800/30 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              warn.active 
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {warn.active ? `Advertência Ativa (${warn.severity.toUpperCase()})` : 'Arquivada / Anulada'}
                            </span>
                            <span className="font-mono text-white text-xs">{warn.date}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{warn.reason}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWarning(warn.id);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            {warn.active ? 'Anular / Arquivar' : 'Reativar'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWarning(warn.id);
                            }}
                            className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Remover advertência permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: EDIT PROFILE */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveMemberInfo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">Nome Completo</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">Cargo / Função</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as RoleInLeague)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
                  >
                    <option value="Ligante">Ligante</option>
                    <option value="Coordenação">Coordenação</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">Data de Entrada</label>
                  <input
                    type="text"
                    value={editEntryDate}
                    onChange={e => setEditEntryDate(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">Horas Totais Acumuladas</label>
                  <input
                    type="number"
                    value={editHours}
                    onChange={e => setEditHours(Number(e.target.value))}
                    required
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">E-mail</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="licenciado">Licenciado</option>
                    <option value="egresso">Egresso</option>
                    <option value="desligado">Desligado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMember(member.id);
                    onClose();
                  }}
                  className="px-4 py-2 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Ligante
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
