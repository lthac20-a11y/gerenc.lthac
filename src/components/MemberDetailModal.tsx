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
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Member, LeagueConfig, ShiftRecord, RoleInLeague, MemberStatus, ReplacementRecord, WarningRecord } from '../types/league';
import { MONTH_COLUMNS } from '../data/initialData';
import { 
  checkCertificateEligibility, 
  calculateActiveTime, 
  calculateReplacementDeadline,
  syncMemberReplacementsDeadlines,
  completeReplacementAndDismissAbsence,
  deleteReplacementWithCascade
} from '../utils/leagueCalculations';
import { 
  parseMonthKey, 
  formatFullMonthYear, 
  getReplacementDeadlineInfo,
  formatReferenceMonthYear,
  formatNumericMonthYear,
  getCurrentYear,
  getCurrentMonthIndex,
  formatMonthKey,
  FULL_MONTH_NAMES
} from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { QuickReplacementModal, QuickWarningModal } from './CoordinationModals';
import { CustomDatePicker } from './CustomDatePicker';

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

  // Sub-modals for Replacements, Warnings & Monthly Absence Registration inside MemberDetailModal
  const [editingRep, setEditingRep] = useState<ReplacementRecord | null>(null);
  const [editingWarn, setEditingWarn] = useState<WarningRecord | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(false);
  const [absenceModalType, setAbsenceModalType] = useState<'falta_justificada' | 'falta_injustificada' | null>(null);
  const [absenceModalMonthKey, setAbsenceModalMonthKey] = useState(() =>
    formatMonthKey(getCurrentMonthIndex(), getCurrentYear())
  );

  const { monthIndex: selectedAbsenceMonthIdx, year: selectedAbsenceYear } = parseMonthKey(absenceModalMonthKey);

  const handleSelectAbsenceMonthYear = (mIdx: number, yr: number) => {
    setAbsenceModalMonthKey(formatMonthKey(mIdx, yr));
  };

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

  // Handler: Delete Replacement (Eliminação Bidirecional 1:1 com Histórico de Escalas e Contadores)
  const handleDeleteReplacement = (repId: string) => {
    const { updatedMember, wasFNJ, wasFJ } = deleteReplacementWithCascade(member, repId);
    onUpdateMember(updatedMember);

    if (wasFNJ) {
      showFeedback('Reposição pendente eliminada: registo no histórico removido, -1 REP, -1 FNJ e -1 Advertência.');
    } else if (wasFJ) {
      showFeedback('Reposição pendente eliminada: registo no histórico removido, -1 REP e -1 FJ.');
    } else {
      showFeedback('Reposição removida e histórico atualizado com sucesso!');
    }
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
    targetStatus: 'concluido' | 'falta_justificada' | 'falta_injustificada',
    customMonthKey?: string
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
      const targetMonthKey = customMonthKey || absenceModalMonthKey || 'out/26';
      const numericMonthRef = formatNumericMonthYear(targetMonthKey);
      const fullMonthRef = formatReferenceMonthYear(targetMonthKey, targetMonthKey);

      const absenceId = `ab-fj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;

      const existingArrayAbsences = [...member.justifiedAbsences, ...member.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === targetMonthKey).length;
      const existingShiftAbsences = member.shifts
        .filter(s => (s.monthKey || 'out/26') === targetMonthKey && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada')).length;
      const currentAbsencesInMonth = Math.max(existingArrayAbsences, existingShiftAbsences) + 1;
      const deadlineText = calculateReplacementDeadline(targetMonthKey, currentAbsencesInMonth);

      const newAbsence: typeof member.justifiedAbsences[0] = {
        id: absenceId,
        date: numericMonthRef,
        monthKey: targetMonthKey,
        type: 'justificada',
        reason: `Falta justificada — Mês de Referência: ${fullMonthRef}`,
        requiresReplacement: true,
        shiftId,
        replacementId,
      };

      const newReplacement: ReplacementRecord = {
        id: replacementId,
        memberId: member.id,
        absenceId,
        shiftId,
        faltaOrigemId: absenceId,
        scheduledDate: 'A definir',
        scheduledHours: Number(newShiftHours),
        completed: false,
        deadlineMonth: targetMonthKey,
        deadlineDescription: deadlineText,
        missedShiftDate: fullMonthRef,
        notes: `Falta Justificada — Mês de Referência: ${fullMonthRef} (sem advertência, requer reposição). Prazo: ${deadlineText}`,
        originalAbsenceCountInMonth: currentAbsencesInMonth >= 2 ? 2 : 1,
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: numericMonthRef,
        monthKey: targetMonthKey,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_justificada',
        description: 'Falta Justificada (sem advertência, requer reposição)',
        absenceId,
        replacementId,
      };

      const draftMember: Member = {
        ...member,
        shifts: [newShift, ...member.shifts],
        justifiedAbsences: [newAbsence, ...member.justifiedAbsences],
      };

      const updatedReplacements = syncMemberReplacementsDeadlines([newReplacement, ...member.replacements], draftMember);

      onUpdateMember({
        ...draftMember,
        replacements: updatedReplacements,
      });

      showFeedback(`Falta Justificada registrada para ${fullMonthRef} (Reposição: ${deadlineText}).`);

    } else if (targetStatus === 'falta_injustificada') {
      const targetMonthKey = customMonthKey || absenceModalMonthKey || 'out/26';
      const numericMonthRef = formatNumericMonthYear(targetMonthKey);
      const fullMonthRef = formatReferenceMonthYear(targetMonthKey, targetMonthKey);

      const absenceId = `ab-fnj-${Date.now()}`;
      const shiftId = `s-${Date.now()}`;
      const replacementId = `rep-${Date.now()}`;
      const warningId = `w-${Date.now()}`;

      const existingArrayAbsences = [...member.justifiedAbsences, ...member.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === targetMonthKey).length;
      const existingShiftAbsences = member.shifts
        .filter(s => (s.monthKey || 'out/26') === targetMonthKey && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada')).length;
      const currentAbsencesInMonth = Math.max(existingArrayAbsences, existingShiftAbsences) + 1;
      const deadlineText = calculateReplacementDeadline(targetMonthKey, currentAbsencesInMonth);

      const newWarning: WarningRecord = {
        id: warningId,
        date: numericMonthRef,
        reason: `Advertência automática por falta não justificada — Mês de Referência: ${fullMonthRef}`,
        severity: 'moderada',
        active: true,
      };

      const newAbsence: typeof member.unjustifiedAbsences[0] = {
        id: absenceId,
        date: numericMonthRef,
        monthKey: targetMonthKey,
        type: 'injustificada',
        reason: `Falta não justificada — Mês de Referência: ${fullMonthRef}`,
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
        faltaOrigemId: absenceId,
        scheduledDate: 'A definir',
        scheduledHours: Number(newShiftHours),
        completed: false,
        deadlineMonth: targetMonthKey,
        deadlineDescription: deadlineText,
        missedShiftDate: fullMonthRef,
        notes: `Falta Não Justificada — Mês de Referência: ${fullMonthRef} (gerou 1 ADV e requer reposição). Prazo: ${deadlineText}`,
        originalAbsenceCountInMonth: currentAbsencesInMonth >= 2 ? 2 : 1,
      };

      const newShift: ShiftRecord = {
        id: shiftId,
        date: numericMonthRef,
        monthKey: targetMonthKey,
        hours: 0,
        type: 'plantao',
        shiftStatus: 'falta_injustificada',
        description: 'Falta Não Justificada (Gerou 1 ADV e 1 Reposição)',
        absenceId,
        replacementId,
      };

      const draftMember: Member = {
        ...member,
        shifts: [newShift, ...member.shifts],
        warnings: [newWarning, ...member.warnings],
        unjustifiedAbsences: [newAbsence, ...member.unjustifiedAbsences],
      };

      const updatedReplacements = syncMemberReplacementsDeadlines([newReplacement, ...member.replacements], draftMember);

      onUpdateMember({
        ...draftMember,
        replacements: updatedReplacements,
      });

      showFeedback(`Falta Não Justificada registrada para ${fullMonthRef} (Gerou +1 ADV e 1 Reposição).`);
    }
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    handleRegisterShiftWithStatus('concluido');
  };

  // Handler: Delete Shift with Full Cascade (Reversão Automática 1:1 ao Remover do Histórico)
  const handleDeleteShift = (shiftId: string) => {
    const shift = member.shifts.find(s => s.id === shiftId);
    if (!shift) return;

    // 1. Identify linked absence, replacement, or warning identifiers
    const linkedAbsenceId = shift.absenceId;
    const linkedReplacementId = shift.replacementId;

    const linkedJustifiedAbsence = member.justifiedAbsences.find(
      a => a.shiftId === shiftId || a.id === linkedAbsenceId || (a.date === shift.date && a.monthKey === shift.monthKey)
    );
    const linkedUnjustifiedAbsence = member.unjustifiedAbsences.find(
      a => a.shiftId === shiftId || a.id === linkedAbsenceId || (a.date === shift.date && a.monthKey === shift.monthKey)
    );

    const actualAbsenceId = linkedAbsenceId || linkedJustifiedAbsence?.id || linkedUnjustifiedAbsence?.id;
    const actualWarningId = linkedUnjustifiedAbsence?.warningId;

    // 2. Reversal of Falta Justificada (strictly -1 FJ)
    let fjRemoved = false;
    const updatedJustified = member.justifiedAbsences.filter(a => {
      if (fjRemoved) return true;
      const isMatch = a.id === actualAbsenceId || a.shiftId === shiftId || (a.date === shift.date && a.monthKey === shift.monthKey);
      if (isMatch && (shift.shiftStatus === 'falta_justificada' || shift.description?.includes('Falta Justificada'))) {
        fjRemoved = true;
        return false;
      }
      return a.id !== actualAbsenceId && a.shiftId !== shiftId;
    });

    // 3. Reversal of Falta Não Justificada (strictly -1 FNJ)
    let fnjRemoved = false;
    const updatedUnjustified = member.unjustifiedAbsences.filter(a => {
      if (fnjRemoved) return true;
      const isMatch = a.id === actualAbsenceId || a.shiftId === shiftId || (a.date === shift.date && a.monthKey === shift.monthKey);
      if (isMatch && (shift.shiftStatus === 'falta_injustificada' || shift.description?.includes('Falta Não Justificada'))) {
        fnjRemoved = true;
        return false;
      }
      return a.id !== actualAbsenceId && a.shiftId !== shiftId;
    });

    // 4. Reversal of Reposição Pendente (strictly -1 Reposição Pendente by faltaOrigemId / absenceId / shiftId match)
    const isAbsenceShift = shift.shiftStatus === 'falta_justificada' || 
                           shift.shiftStatus === 'falta_injustificada' || 
                           Boolean(shift.description?.includes('Falta'));

    let repRemoved = false;
    const updatedReplacementsRaw = member.replacements.filter(r => {
      if (repRemoved) return true;
      if (!isAbsenceShift) return true;

      const isMatch = 
        (linkedReplacementId && r.id === linkedReplacementId) ||
        (actualAbsenceId && (r.faltaOrigemId === actualAbsenceId || r.absenceId === actualAbsenceId)) ||
        (r.shiftId === shiftId) ||
        (r.missedShiftDate && r.missedShiftDate.includes(shift.date) && (!shift.monthKey || r.deadlineMonth === shift.monthKey || r.notes?.includes(shift.date)) && !r.completed);

      if (isMatch) {
        repRemoved = true;
        return false; // Remove strictly 1 replacement that matches this absence!
      }
      return true;
    });

    const updatedReplacements = syncMemberReplacementsDeadlines(updatedReplacementsRaw, member);

    // 5. Reversal of Advertência (strictly -1 ADV for FNJ)
    let warningRemoved = false;
    let updatedWarnings = member.warnings;
    if (shift.shiftStatus === 'falta_injustificada' || shift.description?.includes('Falta Não Justificada')) {
      updatedWarnings = member.warnings.filter(w => {
        if (warningRemoved) return true;
        const isMatch = (actualWarningId && w.id === actualWarningId) || (w.reason && w.reason.includes(shift.date));
        if (isMatch) {
          warningRemoved = true;
          return false;
        }
        return true;
      });
    }

    // 6. Deduct hours for regular completed shifts
    const hoursToDeduct = (shift.shiftStatus === 'concluido' || !shift.shiftStatus || shift.type === 'plantao') && shift.hours ? shift.hours : 0;

    // 7. Update member state immediately
    const updatedShifts = member.shifts.filter(s => s.id !== shiftId);

    onUpdateMember({
      ...member,
      shifts: updatedShifts,
      accumulatedHours: Math.max(0, member.accumulatedHours - hoursToDeduct),
      justifiedAbsences: updatedJustified,
      unjustifiedAbsences: updatedUnjustified,
      replacements: updatedReplacements,
      warnings: updatedWarnings,
    });

    if (shift.shiftStatus === 'falta_justificada') {
      showFeedback('Falta Justificada removida: -1 FJ e reposição pendente excluída automaticamente.');
    } else if (shift.shiftStatus === 'falta_injustificada') {
      showFeedback('Falta Não Justificada removida: -1 FNJ, reposição pendente e advertência excluídas automaticamente.');
    } else {
      showFeedback('Plantão removido do histórico com sucesso!');
    }
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
      ),
      member
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

  // Handler: Complete Replacement (Transforma falta no Histórico em Plantão de Reposição Concluído e deduz -1 falta)
  const handleCompleteReplacement = (repId: string, customDate?: string) => {
    const rep = member.replacements.find(r => r.id === repId);
    if (!rep) return;

    const finalDate = customDate && customDate.trim() ? customDate.trim() : new Date().toLocaleDateString('pt-BR');
    const { updatedMember, dismissedAbsence, hoursAdded } = completeReplacementAndDismissAbsence(member, repId, finalDate);

    onUpdateMember(updatedMember);

    if (dismissedAbsence) {
      showFeedback(`Reposição concluída (${finalDate})! Registo transformado no histórico em "Plantão de Reposição Concluído" (+${hoursAdded}h) e -1 falta deduzida.`);
    } else {
      showFeedback(`Reposição concluída (${finalDate})! +${hoursAdded}h creditadas no histórico.`);
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
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
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
                      <CustomDatePicker
                        label="Data do Plantão"
                        required
                        value={newShiftFullDate}
                        onChange={val => setNewShiftFullDate(val)}
                        format="ISO"
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

                  {/* Quick Absence Action Buttons (Desvinculados de Data do Plantão — Abrem Seletor Mês/Ano) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAbsenceModalMonthKey(formatMonthKey(getCurrentMonthIndex(), getCurrentYear()));
                        setAbsenceModalType('falta_justificada');
                      }}
                      className="w-full py-2 px-3 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-blue-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Lançar Falta Justificada (F.J)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAbsenceModalMonthKey(formatMonthKey(getCurrentMonthIndex(), getCurrentYear()));
                        setAbsenceModalType('falta_injustificada');
                      }}
                      className="w-full py-2 px-3 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Lançar Falta Não Justificada (F.N.J)</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Pending Replacements Section (Interactive Real-Time Queue) */}
              {member.replacements.filter(r => !r.completed).length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-white text-sm font-display">
                        Reposições Pendentes ({member.replacements.filter(r => !r.completed).length})
                      </h4>
                    </div>
                    <span className="text-[11px] text-amber-300/90 font-medium">
                      Concluir transforma a falta no histórico • Apagar reverte a falta original
                    </span>
                  </div>

                  <div className="space-y-2">
                    {member.replacements
                      .filter(r => !r.completed)
                      .map(rep => {
                        const originMonth = rep.deadlineMonth || 'out/26';
                        const totalJustifiedInMonth = member.justifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
                        const totalUnjustifiedInMonth = member.unjustifiedAbsences.filter(a => (a.monthKey || 'out/26') === originMonth).length;
                        const totalShiftsAbsencesInMonth = member.shifts.filter(
                          s => (s.monthKey || 'out/26') === originMonth && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta'))
                        ).length;

                        const absencesInSameMonth = Math.max(
                          rep.originalAbsenceCountInMonth || 1,
                          totalJustifiedInMonth + totalUnjustifiedInMonth,
                          totalShiftsAbsencesInMonth
                        );

                        const { deadlineText, isOverdue } = getReplacementDeadlineInfo(
                          originMonth,
                          absencesInSameMonth,
                          rep.fixedDeadlineMonthKey
                        );

                        return (
                          <div
                            key={rep.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              isOverdue
                                ? 'bg-rose-950/20 border-rose-500/50'
                                : 'bg-slate-800/40 border-amber-500/30'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                  isOverdue
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                  {isOverdue ? 'Pendência Expirada' : 'Reposição Pendente'}
                                </span>

                                <span className="font-mono font-bold text-emerald-400 text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {rep.scheduledHours || 12}h
                                </span>

                                <span className="text-slate-300 text-xs font-mono">
                                  Mês de Referência: <strong>{formatReferenceMonthYear(rep.missedShiftDate, rep.deadlineMonth || 'out/26')}</strong>
                                </span>
                              </div>

                              <div className="text-xs">
                                {isOverdue ? (
                                  <span className="text-rose-300 font-semibold">
                                    ⚠️ Prazo Expirado - Sujeito a Advertência ({deadlineText})
                                  </span>
                                ) : (
                                  <span className="text-amber-300 font-semibold">
                                    {deadlineText}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isCoordination && (
                              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
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

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCompleteReplacement(
                                      rep.id,
                                      completionDates[rep.id] || new Date().toLocaleDateString('pt-BR')
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Concluir (+{rep.scheduledHours || 12}h)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteReplacement(rep.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/80 hover:border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                                  title="Eliminar reposição e reverter falta original"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
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
                                        <CustomDatePicker
                                          label="Data do Plantão"
                                          required
                                          value={editShiftFullDate}
                                          onChange={val => setEditShiftFullDate(val)}
                                          format="ISO"
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
                                  className="py-2 px-3 hover:bg-slate-800/40 flex flex-row items-center justify-between gap-3 transition-colors text-xs overflow-x-auto scrollbar-none whitespace-nowrap"
                                >
                                  {/* Esquerda + Centro */}
                                  <div className="flex flex-row items-center gap-2 flex-1 whitespace-nowrap">
                                    {/* 1. Esquerda: Ícone de calendário, data em negrito (ou Mês de Referência para faltas) e barra vertical fina (|) */}
                                    <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                      <Calendar className={`w-3.5 h-3.5 shrink-0 ${
                                        shift.shiftStatus === 'falta_injustificada'
                                          ? 'text-rose-400'
                                          : shift.shiftStatus === 'falta_justificada'
                                          ? 'text-blue-400'
                                          : 'text-emerald-400'
                                      }`} />
                                      {shift.shiftStatus === 'falta_injustificada' || shift.shiftStatus === 'falta_justificada' ? (
                                        <span className="font-bold text-white font-mono whitespace-nowrap">
                                          Mês de Referência: {formatReferenceMonthYear(shift.date, shift.monthKey)}
                                        </span>
                                      ) : (
                                        <>
                                          <span className="font-bold text-white font-mono whitespace-nowrap">{shift.date}</span>
                                          <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">({shift.monthKey})</span>
                                        </>
                                      )}
                                      <span className="text-slate-700 px-1 select-none">|</span>
                                    </div>

                                    {/* 2. Centro: Ícone de relógio pequeno, tipo de plantão sem corte, ponto (•), carga horária (+12hs) e tag de status */}
                                    <div className="flex items-center gap-2 flex-1 whitespace-nowrap">
                                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="text-slate-200 whitespace-nowrap shrink-0">
                                        {shift.shiftStatus === 'falta_injustificada' ||
                                        shift.shiftStatus === 'falta_justificada' ||
                                        shift.type === 'reposicao' ||
                                        shift.description === 'Plantão de Reposição Concluído'
                                          ? shift.description || 'Plantão de Reposição Concluído'
                                          : shift.description || 'Plantão Concluído'}
                                      </span>
                                      <span className="text-slate-600 shrink-0">•</span>
                                      <span className="font-bold font-mono text-emerald-400 shrink-0 whitespace-nowrap">
                                        +{shift.hours || 12}hs
                                      </span>
                                      {shift.shiftStatus === 'falta_injustificada' ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/30 shrink-0 ml-1 whitespace-nowrap">
                                          [Falta Não Justif.]
                                        </span>
                                      ) : shift.shiftStatus === 'falta_justificada' ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 shrink-0 ml-1 whitespace-nowrap">
                                          [Falta Justificada]
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 shrink-0 ml-1 whitespace-nowrap">
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

        {/* Monthly Absence Launch Modal (Lançar Falta Justificada / Não Justificada com Referência Mensal Exclusiva) */}
        {absenceModalType && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    absenceModalType === 'falta_justificada'
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {absenceModalType === 'falta_justificada' ? (
                      <Info className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {absenceModalType === 'falta_justificada'
                        ? 'Lançar Falta Justificada (F.J)'
                        : 'Lançar Falta Não Justificada (F.N.J)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Selecione apenas o Mês e Ano de referência (sem dia exato)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAbsenceModalType(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Custom Month/Year Grid Selector (Paleta Escura #1E293B) */}
                <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-3.5 shadow-inner space-y-3">
                  {/* Top Year Selector Bar */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/70">
                    <button
                      type="button"
                      onClick={() => handleSelectAbsenceMonthYear(selectedAbsenceMonthIdx, selectedAbsenceYear - 1)}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/70 rounded-xl transition-colors cursor-pointer"
                      title="Ano anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {[getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1].map(yr => {
                        const isYearSelected = selectedAbsenceYear === yr;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => handleSelectAbsenceMonthYear(selectedAbsenceMonthIdx, yr)}
                            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                              isYearSelected
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                            }`}
                          >
                            {yr}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectAbsenceMonthYear(selectedAbsenceMonthIdx, selectedAbsenceYear + 1)}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/70 rounded-xl transition-colors cursor-pointer"
                      title="Próximo ano"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 4x3 Grid of Month Buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((shortLabel, mIdx) => {
                      const isSelected = selectedAbsenceMonthIdx === mIdx;
                      const isCurrentMonth = mIdx === getCurrentMonthIndex() && selectedAbsenceYear === getCurrentYear();

                      return (
                        <button
                          key={shortLabel}
                          type="button"
                          onClick={() => handleSelectAbsenceMonthYear(mIdx, selectedAbsenceYear)}
                          className={`py-2 px-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-emerald-400 shadow-md shadow-emerald-950/50'
                              : isCurrentMonth
                              ? 'bg-slate-900/90 hover:bg-slate-700/80 text-emerald-300 font-semibold border-emerald-500/40'
                              : 'bg-slate-900/70 hover:bg-slate-700/80 text-slate-200 hover:text-white border-slate-700/60'
                          }`}
                        >
                          <span className="text-xs font-mono tracking-wide">{shortLabel}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {FULL_MONTH_NAMES[mIdx]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo da Referência Mensal e Cálculo Automático do Prazo (+1 ou +2 meses) */}
                {(() => {
                  const existingArrayAbs = [...member.justifiedAbsences, ...member.unjustifiedAbsences]
                    .filter(a => (a.monthKey || 'out/26') === absenceModalMonthKey).length;
                  const existingShiftAbs = member.shifts
                    .filter(s => (s.monthKey || 'out/26') === absenceModalMonthKey && (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada')).length;
                  const nextTotalInMonth = Math.max(existingArrayAbs, existingShiftAbs) + 1;
                  const { deadlineText } = getReplacementDeadlineInfo(absenceModalMonthKey, nextTotalInMonth);

                  return (
                    <div className={`p-3 rounded-xl border space-y-1.5 ${
                      absenceModalType === 'falta_justificada'
                        ? 'bg-blue-950/30 border-blue-500/30 text-blue-200'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                    }`}>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-slate-300">Registo no Histórico:</span>
                        <strong className="text-white">
                          Mês de Referência: {formatReferenceMonthYear(absenceModalMonthKey, absenceModalMonthKey)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-slate-300">Total de faltas neste mês:</span>
                        <strong className="text-amber-300">
                          {nextTotalInMonth}ª falta ({nextTotalInMonth >= 2 ? 'Prazo estendido +2 meses' : 'Prazo padrão +1 mês'})
                        </strong>
                      </div>
                      <div className="pt-1 border-t border-slate-800/80 text-amber-300 font-semibold text-xs">
                        {deadlineText}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAbsenceModalType(null)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetType = absenceModalType;
                      const chosenMonth = absenceModalMonthKey;
                      setAbsenceModalType(null);
                      handleRegisterShiftWithStatus(targetType, chosenMonth);
                    }}
                    className={`px-4 py-2 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-sm transition-colors flex items-center gap-1.5 ${
                      absenceModalType === 'falta_justificada'
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {absenceModalType === 'falta_justificada'
                        ? 'Confirmar Falta Justificada (F.J)'
                        : 'Confirmar Falta Não Justificada (F.N.J)'}
                    </span>
                  </button>
                </div>
              </div>
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
