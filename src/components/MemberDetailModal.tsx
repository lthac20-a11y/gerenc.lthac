import React, { useState, useMemo } from 'react';
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
  syncMemberReplacementsDeadlines,
  completeReplacementAndDismissAbsence
} from '../utils/leagueCalculations';
import { parseMonthKey, formatFullMonthYear } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { QuickReplacementModal, QuickWarningModal } from './CoordinationModals';

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
  const { isCoordination } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Form states for Shift (Unified Date Picker YYYY-MM-DD -> DD/MM + monthKey)
  const [newShiftFullDate, setNewShiftFullDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const parseFullDateToShiftParts = (isoDate: string): { dayMonth: string; monthKey: string } => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const [yearStr, monthStr, dayStr] = parts;
      const monthIdx = Math.max(0, Math.min(11, parseInt(monthStr, 10) - 1));
      const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const shortYear = yearStr.slice(-2) || String(new Date().getFullYear()).slice(-2);
      return {
        dayMonth: `${dayStr}/${monthStr}`,
        monthKey: `${monthNames[monthIdx]}/${shortYear}`,
      };
    }
    const today = new Date();
    const dayStr = String(today.getDate()).padStart(2, '0');
    const monthStr = String(today.getMonth() + 1).padStart(2, '0');
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const shortYear = String(today.getFullYear()).slice(-2);
    return { dayMonth: `${dayStr}/${monthStr}`, monthKey: `${monthNames[today.getMonth()]}/${shortYear}` };
  };

  const { dayMonth: newShiftDate, monthKey: newShiftMonth } = parseFullDateToShiftParts(newShiftFullDate);
  const [newShiftHours, setNewShiftHours] = useState(12);

  // Sub-modals for Replacements & Warnings inside MemberDetailModal
  const [editingRep, setEditingRep] = useState<ReplacementRecord | null>(null);
  const [editingWarn, setEditingWarn] = useState<WarningRecord | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(false);

  // Edit Shift State
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftFullDate, setEditShiftFullDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [editShiftHours, setEditShiftHours] = useState(12);

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

  // Group member shifts by monthKey for organized visual blocks
  const groupedShifts = useMemo(() => {
    const groups: { monthKey: string; shifts: ShiftRecord[] }[] = [];
    member.shifts.forEach(shift => {
      const key = shift.monthKey || 'out/26';
      const existingGroup = groups.find(g => g.monthKey === key);
      if (existingGroup) {
        existingGroup.shifts.push(shift);
      } else {
        groups.push({ monthKey: key, shifts: [shift] });
      }
    });
    return groups;
  }, [member.shifts]);

  const formatShiftDateToIso = (dateStr: string, monthKey?: string): string => {
    const currentFullYear = String(new Date().getFullYear());
    if (!dateStr) return `${currentFullYear}-01-01`;
    if (dateStr.includes('-') && dateStr.split('-').length === 3) {
      return dateStr;
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      if (parts.length === 2) {
        let year = currentFullYear;
        const month = parts[1];
        if (monthKey && monthKey.includes('/')) {
          const shortY = monthKey.split('/')[1];
          year = shortY.length === 2 ? '20' + shortY : shortY;
        }
        return `${year}-${month.padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return `${currentFullYear}-01-01`;
  };

  // Handler: Start Editing Shift
  const handleStartEditShift = (shift: ShiftRecord) => {
    setEditingShiftId(shift.id);
    setEditShiftFullDate(formatShiftDateToIso(shift.date, shift.monthKey));
    setEditShiftHours(shift.hours || 12);
  };

  const handleCancelEditShift = () => {
    setEditingShiftId(null);
  };

  const handleSaveEditShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShiftId) return;

    const oldShift = member.shifts.find(s => s.id === editingShiftId);
    if (!oldShift) return;

    const { dayMonth, monthKey } = parseFullDateToShiftParts(editShiftFullDate);
    const newHours = Number(editShiftHours);
    const oldHours = oldShift.hours || 0;
    const diffHours = newHours - oldHours;

    const updatedShifts = member.shifts.map(s => {
      if (s.id === editingShiftId) {
        return {
          ...s,
          date: dayMonth,
          monthKey,
          hours: newHours,
          shiftStatus: 'concluido' as const,
          description: s.description && !s.description.includes('Falta') ? s.description : 'Plantão Concluído',
        };
      }
      return s;
    });

    onUpdateMember({
      ...member,
      shifts: updatedShifts,
      accumulatedHours: Math.max(0, member.accumulatedHours + diffHours),
      hoursUpdated: true,
    });

    setEditingShiftId(null);
    showFeedback(`Escala atualizada para ${dayMonth} (${monthKey}) — ${newHours}h computadas!`);
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

  // Handler: Register Shift or Absence with Regimental Rules
  const handleRegisterShiftWithStatus = (
    targetStatus: 'concluido' | 'falta_justificada' | 'falta_injustificada'
  ) => {
    if (targetStatus === 'concluido') {
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

    } else if (targetStatus === 'falta_justificada') {
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
        notes: `Falta Justificada em ${newShiftDate} (${newShiftMonth}) — sem advertência, requer reposição. Prazo: ${deadlineText}`,
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: newShiftDate,
        monthKey: newShiftMonth,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_justificada',
        description: 'Falta Justificada (sem advertência, requer reposição)',
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

    } else if (targetStatus === 'falta_injustificada') {
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
        reason: `Advertência automática por falta não justificada no plantão de ${newShiftDate} (${newShiftMonth})`,
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
        notes: `Falta Não Justificada em ${newShiftDate} (${newShiftMonth}) — gerou 1 ADV e requer reposição. Prazo: ${deadlineText}`,
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

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    handleRegisterShiftWithStatus('concluido');
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
    const { updatedMember, dismissedAbsence, hoursAdded } = completeReplacementAndDismissAbsence(member, repId, finalDate);

    onUpdateMember(updatedMember);

    if (dismissedAbsence) {
      showFeedback(`Reposição confirmada (${finalDate})! Falta de ${dismissedAbsence.date} quitada e removida. +${hoursAdded}h creditadas.`);
    } else {
      showFeedback(`Reposição confirmada (${finalDate})! +${hoursAdded}h creditadas.`);
    }
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

            {/* Edit Member Profile Action Button (In place of Meta badge) */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center mr-8 sm:mr-10">
              {isCoordination && (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  title="Editar cadastro do integrante"
                >
                  <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Editar Cadastro</span>
                </button>
              )}
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

        {/* Modal Body with unified single-view content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-5 text-xs text-slate-300">
          <div className="space-y-4">
              {/* Add Shift Form (Coordination Only) */}
              {isCoordination && (
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                        Data do Plantão *
                      </label>
                      <input
                        type="date"
                        value={newShiftFullDate}
                        onChange={e => setNewShiftFullDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none [color-scheme:dark] cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Carga Horária *</label>
                      <select
                        value={newShiftHours}
                        onChange={e => setNewShiftHours(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value={12}>12 horas (Padrão)</option>
                        <option value={6}>6 horas</option>
                        <option value={4}>4 horas (Aula/Reunião)</option>
                        <option value={24}>24 horas (Duplo)</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Salvar Plantão</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Absence Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRegisterShiftWithStatus('falta_justificada')}
                      className="w-full py-2 px-3 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-blue-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Lançar Falta Justificada (F.J)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRegisterShiftWithStatus('falta_injustificada')}
                      className="w-full py-2 px-3 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Lançar Falta Não Justificada (F.N.J)</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Shifts List Header */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-sm font-display">
                      Histórico de Escalas Realizadas ({member.shifts.length})
                    </h4>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold rounded-xl self-start sm:self-auto">
                    <span>Total computado:</span>
                    <strong className="text-emerald-400">{member.accumulatedHours}h</strong>
                  </span>
                </div>

                {groupedShifts.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/40 p-4">
                    <Calendar className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-300">Nenhum plantão individual registrado na lista</p>
                    <p className="text-[11px] text-slate-500 mt-1">Horas totais acumuladas no cadastro: {member.accumulatedHours}h</p>
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    {groupedShifts.map(group => {
                      const { monthIndex, year } = parseMonthKey(group.monthKey);
                      const monthLabel = formatFullMonthYear(monthIndex, year);

                      return (
                        <div key={group.monthKey} className="space-y-1.5">
                          {/* Cabeçalho / Separador do Mês */}
                          <div className="flex items-center gap-2 pb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-emerald-400" />
                              {monthLabel}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({group.shifts.length} {group.shifts.length === 1 ? 'plantão' : 'plantões'})
                            </span>
                            <div className="h-px bg-slate-800/80 flex-1 ml-1" />
                          </div>

                          {/* Bloco Único Título-Colado para Plantões do MESMO Mês */}
                          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
                            {group.shifts.map(shift => {
                              const isEditing = editingShiftId === shift.id;

                              if (isEditing) {
                                return (
                                  <form
                                    key={shift.id}
                                    onSubmit={handleSaveEditShift}
                                    className="py-2.5 px-3 bg-slate-800/90 border-l-2 border-l-emerald-500 space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                                        <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                                        Editar Escala / Plantão
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">ID: {shift.id}</span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
                                      <div className="flex-1 min-w-[140px]">
                                        <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                                          Data do Plantão *
                                        </label>
                                        <input
                                          type="date"
                                          value={editShiftFullDate}
                                          onChange={e => setEditShiftFullDate(e.target.value)}
                                          required
                                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none [color-scheme:dark] cursor-pointer"
                                        />
                                      </div>

                                      <div className="w-full sm:w-44 shrink-0">
                                        <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                                          Carga Horária *
                                        </label>
                                        <select
                                          value={editShiftHours}
                                          onChange={e => setEditShiftHours(Number(e.target.value))}
                                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                                        >
                                          <option value={12}>12 horas (Padrão)</option>
                                          <option value={6}>6 horas</option>
                                          <option value={4}>4 horas (Aula/Reunião)</option>
                                          <option value={24}>24 horas (Duplo)</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0 self-end">
                                        <button
                                          type="button"
                                          onClick={handleCancelEditShift}
                                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="submit"
                                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-sm transition-colors"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Salvar</span>
                                        </button>
                                      </div>
                                    </div>
                                  </form>
                                );
                              }

                              return (
                                <div
                                  key={shift.id}
                                  className="py-1.5 px-3 hover:bg-slate-800/40 flex flex-row items-center justify-between gap-2 transition-colors text-xs"
                                >
                                  {/* Esquerda + Centro */}
                                  <div className="flex flex-row items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                    {/* 1. Esquerda: Ícone de calendário, data em negrito, mês entre parênteses e barra vertical fina (|) */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Calendar className={`w-3.5 h-3.5 shrink-0 ${
                                        shift.shiftStatus === 'falta_injustificada'
                                          ? 'text-rose-400'
                                          : shift.shiftStatus === 'falta_justificada'
                                          ? 'text-blue-400'
                                          : 'text-emerald-400'
                                      }`} />
                                      <span className="font-bold text-white font-mono">{shift.date}</span>
                                      <span className="text-slate-400 font-mono text-[11px]">({shift.monthKey})</span>
                                      <span className="text-slate-700 px-1 select-none">|</span>
                                    </div>

                                    {/* 2. Centro: Ícone de relógio pequeno, tipo de plantão, ponto (•), carga horária (+12hs) e tag de status */}
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="text-slate-300 truncate">
                                        {shift.shiftStatus === 'falta_injustificada' || shift.shiftStatus === 'falta_justificada'
                                          ? shift.description
                                          : 'Plantão Concluído'}
                                      </span>
                                      <span className="text-slate-600 shrink-0">•</span>
                                      <span className="font-bold font-mono text-emerald-400 shrink-0">
                                        +{shift.hours || 12}hs
                                      </span>
                                      {shift.shiftStatus === 'falta_injustificada' ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/30 shrink-0 ml-1">
                                          [Falta Não Justif.]
                                        </span>
                                      ) : shift.shiftStatus === 'falta_justificada' ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 shrink-0 ml-1">
                                          [Falta Justificada]
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 shrink-0 ml-1">
                                          [Concluído]
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 3. Direita: Botões de ação ("Editar" e "Remover") compactos */}
                                  {isCoordination && (
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEditShift(shift);
                                        }}
                                        className="px-2 py-0.5 text-[11px] text-slate-300 hover:text-emerald-400 bg-slate-800/70 hover:bg-emerald-500/10 border border-slate-700/80 hover:border-emerald-500/30 rounded transition-colors cursor-pointer flex items-center gap-1"
                                        title="Editar esta escala"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                        <span>Editar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteShift(shift.id);
                                        }}
                                        className="px-2 py-0.5 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 rounded transition-colors cursor-pointer flex items-center gap-1"
                                        title="Remover escala"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                        <span>Remover</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Edit Member Profile Modal Dialog (Triggered by Editar Cadastro button in Header) */}
        {isEditingProfile && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Editar Cadastro do Integrante</h3>
                    <p className="text-[11px] text-slate-400">{member.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(false);
                    setConfirmDeleteMember(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={(e) => {
                handleSaveMemberInfo(e);
                setIsEditingProfile(false);
              }} className="space-y-4">
                {/* Grade 2x2 harmoniosa com os 4 campos principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                      Cargo / Função
                    </label>
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as RoleInLeague)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Ligante">Ligante</option>
                      <option value="Coordenação">Coordenação</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                      Data de Entrada
                    </label>
                    <input
                      type="text"
                      value={editEntryDate}
                      onChange={e => setEditEntryDate(e.target.value)}
                      required
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">
                      Horas Totais Acumuladas
                    </label>
                    <input
                      type="number"
                      value={editHours}
                      onChange={e => setEditHours(Number(e.target.value))}
                      required
                      min={0}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  {!confirmDeleteMember ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMember(true)}
                      className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Membro</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMember(member.id);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirmar Exclusão</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMember(false)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setConfirmDeleteMember(false);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                    >
                      Fechar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingRep && (
          <QuickReplacementModal
            members={[member]}
            initialMemberId={member.id}
            editingReplacement={{ memberId: member.id, replacement: editingRep }}
            onClose={() => {
              setEditingRep(null);
            }}
            onUpdateMember={(updated) => {
              onUpdateMember(updated);
              showFeedback('Reposição salva no Firestore com sucesso!');
            }}
          />
        )}

        {editingWarn && (
          <QuickWarningModal
            members={[member]}
            initialMemberId={member.id}
            editingWarning={{ memberId: member.id, warning: editingWarn }}
            onClose={() => {
              setEditingWarn(null);
            }}
            onUpdateMember={(updated) => {
              onUpdateMember(updated);
              showFeedback('Advertência salva no Firestore com sucesso!');
            }}
          />
        )}
      </div>
    </div>
  );
};
