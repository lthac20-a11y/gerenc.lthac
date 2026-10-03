import { Member, LeagueConfig, CertificateEligibility } from '../types/league';

/**
 * Parses DD/MM/YYYY or YYYY-MM-DD into a Date object
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  return new Date();
}

/**
 * Calculates active time from entryDate until referenceDate (default: 2026-10-02)
 */
export function calculateActiveTime(entryDateStr: string, refDate: Date = new Date(2026, 9, 2)): {
  totalMonths: number;
  totalDays: number;
  formatted: string;
} {
  const entry = parseDate(entryDateStr);
  const diffTime = Math.max(0, refDate.getTime() - entry.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let months = (refDate.getFullYear() - entry.getFullYear()) * 12 + (refDate.getMonth() - entry.getMonth());
  if (refDate.getDate() < entry.getDate()) {
    months = Math.max(0, months - 1);
  }
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  let formatted = '';
  if (years > 0) {
    formatted = `${years} ano${years > 1 ? 's' : ''}`;
    if (remainingMonths > 0) {
      formatted += ` e ${remainingMonths} m${remainingMonths > 1 ? 'eses' : 'ês'}`;
    }
  } else if (months > 0) {
    formatted = `${months} m${months > 1 ? 'eses' : 'ês'}`;
  } else {
    formatted = `${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  }

  return {
    totalMonths: months,
    totalDays: diffDays,
    formatted,
  };
}

/**
 * Checks certificate eligibility for a member
 */
export function checkCertificateEligibility(
  member: Member,
  config: LeagueConfig
): CertificateEligibility {
  const activeTime = calculateActiveTime(member.entryDate);
  const activeWarningsCount = member.warnings.filter(w => w.active).length;
  const pendingReplacementsCount = member.replacements.filter(r => !r.completed).length;
  const unjustifiedAbsencesCount = member.unjustifiedAbsences.length;

  const hoursMet = member.accumulatedHours >= config.minHoursForCertificate;
  const timeMet = activeTime.totalMonths >= config.minActiveMonthsForCertificate;
  const warningsMet = activeWarningsCount <= config.maxActiveWarningsAllowed;
  const replacementsMet = config.requireAllReplacementsCompleted 
    ? pendingReplacementsCount === 0 
    : true;

  const reasonsPending: string[] = [];

  if (!hoursMet) {
    const diff = config.minHoursForCertificate - member.accumulatedHours;
    reasonsPending.push(`Carga horária insuficiente: faltam ${diff}h (possui ${member.accumulatedHours}h de ${config.minHoursForCertificate}h necessárias)`);
  }

  if (!timeMet) {
    const diffMonths = config.minActiveMonthsForCertificate - activeTime.totalMonths;
    reasonsPending.push(`Tempo ativo insuficiente: possui ${activeTime.totalMonths} meses de ${config.minActiveMonthsForCertificate} meses exigidos (faltam ${diffMonths} m${diffMonths > 1 ? 'eses' : 'ês'})`);
  }

  if (!warningsMet) {
    reasonsPending.push(`Possui ${activeWarningsCount} advertência(s) ativa(s) no prontuário disciplinar`);
  }

  if (!replacementsMet) {
    reasonsPending.push(`Possui ${pendingReplacementsCount} reposição(ões) de plantão pendente(s)`);
  }

  const isEligible = hoursMet && timeMet && warningsMet && replacementsMet && member.status === 'ativo';

  return {
    isEligible,
    memberId: member.id,
    memberName: member.name,
    currentHours: member.accumulatedHours,
    requiredHours: config.minHoursForCertificate,
    hoursMet,
    activeMonths: activeTime.totalMonths,
    requiredMonths: config.minActiveMonthsForCertificate,
    timeMet,
    activeWarningsCount,
    warningsMet,
    pendingReplacementsCount,
    replacementsMet,
    unjustifiedAbsencesCount,
    absencesMet: true,
    reasonsPending,
  };
}

/**
 * Checks if a member is eligible (Apto) for certification based on either:
 * 1) Accumulated hours >= 150h (or configured minimum); OR
 * 2) Active time in league >= 1 year (>= 12 months or >= 365 days).
 */
export function isMemberEligibleForCertificate(
  member: Member,
  minHours: number = 150
): boolean {
  const activeTime = calculateActiveTime(member.entryDate);
  const hoursMet = (member.accumulatedHours || 0) >= minHours;
  const timeMet = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;
  return hoursMet || timeMet;
}

/**
 * Calculates league statistical summaries
 */
export function calculateLeagueStats(members: Member[], config: LeagueConfig) {
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'ativo').length;
  const totalHours = members.reduce((acc, m) => acc + (m.accumulatedHours || 0), 0);
  const avgHours = totalMembers > 0 ? Math.round(totalHours / totalMembers) : 0;

  const eligibilities = members.map(m => checkCertificateEligibility(m, config));
  const eligibleCount = eligibilities.filter(e => e.isEligible).length;

  const membersWithPendingReplacements = members.filter(
    m => m.replacements.some(r => !r.completed) || (m.unjustifiedAbsences.length > 0 && m.replacements.length === 0)
  ).length;

  const membersWithWarnings = members.filter(
    m => m.warnings.some(w => w.active)
  ).length;

  const totalJustifiedAbsences = members.reduce(
    (acc, m) => acc + m.justifiedAbsences.length, 0
  );

  const totalUnjustifiedAbsences = members.reduce(
    (acc, m) => acc + m.unjustifiedAbsences.length, 0
  );

  const totalPendingReplacements = members.reduce(
    (acc, m) => acc + m.replacements.filter(r => !r.completed).length, 0
  );

  return {
    totalMembers,
    activeMembers,
    totalHours,
    avgHours,
    eligibleCount,
    membersWithPendingReplacements,
    membersWithWarnings,
    totalJustifiedAbsences,
    totalUnjustifiedAbsences,
    totalPendingReplacements,
  };
}

import { calculateDynamicReplacementDeadline } from './dateUtils';

/**
 * Calculates regimental replacement deadline:
 * - 1 falta de plantão no mês = repor no mês seguinte (M+1)
 * - 2 faltas de plantões no mesmo mês = o acadêmico terá os próximos 2 meses (M+1 e M+2) para repor esses 2 plantões
 */
export function calculateReplacementDeadline(currentMonthKey: string, absencesInSameMonth: number): string {
  return calculateDynamicReplacementDeadline(currentMonthKey, absencesInSameMonth);
}

/**
 * Re-synchronizes replacement deadline descriptions for all replacements of a member
 * based on how many absences/replacements exist in each monthKey.
 * Tendo duas faltas de plantões no mesmo mês, o acadêmico terá os próximos 2 meses para repor esses dois plantões.
 */
export function syncMemberReplacementsDeadlines(replacements: import('../types/league').ReplacementRecord[]): import('../types/league').ReplacementRecord[] {
  // Count how many replacements share the same deadlineMonth
  const countByMonth = new Map<string, number>();
  replacements.forEach(rep => {
    const m = rep.deadlineMonth || 'out/26';
    countByMonth.set(m, (countByMonth.get(m) || 0) + 1);
  });

  return replacements.map(rep => {
    const m = rep.deadlineMonth || 'out/26';
    const count = countByMonth.get(m) || 1;
    const deadlineDescription = calculateReplacementDeadline(m, count);
    return {
      ...rep,
      deadlineDescription,
    };
  });
}

/**
 * Automatically completes a replacement and dismisses (removes) the linked absence
 * from the member's record, recalculating hours and syncing deadlines in real-time.
 */
export function completeReplacementAndDismissAbsence(
  member: Member,
  replacementId: string,
  completionDate?: string,
  customHours?: number
): { updatedMember: Member; dismissedAbsence: import('../types/league').AbsenceRecord | null; hoursAdded: number } {
  const rep = member.replacements.find(r => r.id === replacementId);
  if (!rep) {
    return { updatedMember: member, dismissedAbsence: null, hoursAdded: 0 };
  }

  const hoursToAdd = customHours ?? rep.scheduledHours ?? 12;
  const finalDate = completionDate && completionDate.trim() ? completionDate.trim() : new Date().toLocaleDateString('pt-BR');

  // 1. Locate the linked absence to dismiss
  let dismissedAbsence: import('../types/league').AbsenceRecord | null = null;
  let targetType: 'justificada' | 'injustificada' | null = null;

  // Check direct ID match
  if (rep.absenceId) {
    const fj = member.justifiedAbsences.find(a => a.id === rep.absenceId);
    if (fj) {
      dismissedAbsence = fj;
      targetType = 'justificada';
    } else {
      const fnj = member.unjustifiedAbsences.find(a => a.id === rep.absenceId);
      if (fnj) {
        dismissedAbsence = fnj;
        targetType = 'injustificada';
      }
    }
  }

  // Check matching by replacementId
  if (!dismissedAbsence) {
    const fj = member.justifiedAbsences.find(a => a.replacementId === replacementId);
    if (fj) {
      dismissedAbsence = fj;
      targetType = 'justificada';
    } else {
      const fnj = member.unjustifiedAbsences.find(a => a.replacementId === replacementId);
      if (fnj) {
        dismissedAbsence = fnj;
        targetType = 'injustificada';
      }
    }
  }

  // Check matching by shiftId
  if (!dismissedAbsence && rep.shiftId) {
    const fj = member.justifiedAbsences.find(a => a.shiftId === rep.shiftId);
    if (fj) {
      dismissedAbsence = fj;
      targetType = 'justificada';
    } else {
      const fnj = member.unjustifiedAbsences.find(a => a.shiftId === rep.shiftId);
      if (fnj) {
        dismissedAbsence = fnj;
        targetType = 'injustificada';
      }
    }
  }

  // Check matching by missedShiftDate or deadlineMonth reference
  if (!dismissedAbsence) {
    const refDate = rep.missedShiftDate || '';
    const refMonth = rep.deadlineMonth || '';

    // Try finding by exact date / month string
    if (refDate) {
      const fj = member.justifiedAbsences.find(a => refDate.includes(a.date) || a.date.includes(refDate));
      if (fj) {
        dismissedAbsence = fj;
        targetType = 'justificada';
      } else {
        const fnj = member.unjustifiedAbsences.find(a => refDate.includes(a.date) || a.date.includes(refDate));
        if (fnj) {
          dismissedAbsence = fnj;
          targetType = 'injustificada';
        }
      }
    }

    // Try finding by monthKey
    if (!dismissedAbsence && refMonth) {
      const fj = member.justifiedAbsences.find(a => (a.monthKey || 'out/26') === refMonth);
      if (fj) {
        dismissedAbsence = fj;
        targetType = 'justificada';
      } else {
        const fnj = member.unjustifiedAbsences.find(a => (a.monthKey || 'out/26') === refMonth);
        if (fnj) {
          dismissedAbsence = fnj;
          targetType = 'injustificada';
        }
      }
    }

    // Fallback: pick the first pending absence from the member
    if (!dismissedAbsence) {
      if (member.justifiedAbsences.length > 0) {
        dismissedAbsence = member.justifiedAbsences[0];
        targetType = 'justificada';
      } else if (member.unjustifiedAbsences.length > 0) {
        dismissedAbsence = member.unjustifiedAbsences[0];
        targetType = 'injustificada';
      }
    }
  }

  // 2. Remove the dismissed absence from the arrays
  const updatedJustified = dismissedAbsence && targetType === 'justificada'
    ? member.justifiedAbsences.filter(a => a.id !== dismissedAbsence!.id)
    : member.justifiedAbsences;

  const updatedUnjustified = dismissedAbsence && targetType === 'injustificada'
    ? member.unjustifiedAbsences.filter(a => a.id !== dismissedAbsence!.id)
    : member.unjustifiedAbsences;

  // 3. Mark replacement as completed
  const updatedReplacements = syncMemberReplacementsDeadlines(
    member.replacements.map(r => {
      if (r.id === replacementId) {
        return {
          ...r,
          completed: true,
          completedDate: finalDate,
        };
      }
      return r;
    })
  );

  // 4. Update shift record if it was an unexcused absence shift
  const updatedShifts = member.shifts.map(s => {
    if (
      (dismissedAbsence && (s.absenceId === dismissedAbsence.id || s.id === dismissedAbsence.shiftId)) ||
      (rep.shiftId && s.id === rep.shiftId) ||
      s.replacementId === replacementId
    ) {
      return {
        ...s,
        shiftStatus: 'concluido' as const,
        description: `Plantão Reposto em ${finalDate} (+${hoursToAdd}h)`,
        hours: hoursToAdd,
      };
    }
    return s;
  });

  const updatedMember: Member = {
    ...member,
    replacements: updatedReplacements,
    justifiedAbsences: updatedJustified,
    unjustifiedAbsences: updatedUnjustified,
    shifts: updatedShifts,
    accumulatedHours: member.accumulatedHours + hoursToAdd,
    hoursUpdated: true,
  };

  return {
    updatedMember,
    dismissedAbsence,
    hoursAdded: hoursToAdd,
  };
}

