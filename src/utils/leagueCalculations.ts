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

import { calculateDynamicReplacementDeadline, getDeadlineMonthKey, formatMonthKey, parseMonthKey } from './dateUtils';

/**
 * Helper to parse a date string ('DD/MM/YYYY', 'YYYY-MM-DD', or 'DD/MM')
 * into shift record parts ({ dayMonth: 'DD/MM', monthKey: 'mmm/yy' })
 */
export function parseDateToShiftParts(
  dateStr: string,
  fallbackMonthKey: string = 'out/26'
): { dayMonth: string; monthKey: string } {
  const clean = (dateStr || '').trim();
  if (!clean) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      dayMonth: `${d}/${m}`,
      monthKey: formatMonthKey(now.getMonth(), now.getFullYear()),
    };
  }

  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const yearNum = parseInt(parts[0], 10) || new Date().getFullYear();
      const monthNum = parseInt(parts[1], 10) || 1;
      const dayStr = parts[2].padStart(2, '0');
      const monthStr = String(monthNum).padStart(2, '0');
      const mIdx = Math.max(0, Math.min(11, monthNum - 1));
      return {
        dayMonth: `${dayStr}/${monthStr}`,
        monthKey: formatMonthKey(mIdx, yearNum),
      };
    }
  }

  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 2) {
      const dayStr = parts[0].trim().padStart(2, '0');
      const monthNum = parseInt(parts[1].trim(), 10) || 1;
      const monthStr = String(monthNum).padStart(2, '0');
      const mIdx = Math.max(0, Math.min(11, monthNum - 1));
      let yearNum = parseMonthKey(fallbackMonthKey).year;
      if (parts.length >= 3 && parts[2].trim()) {
        const rawY = parts[2].trim();
        yearNum = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
      }
      return {
        dayMonth: `${dayStr}/${monthStr}`,
        monthKey: formatMonthKey(mIdx, yearNum),
      };
    }
  }

  return {
    dayMonth: clean,
    monthKey: fallbackMonthKey,
  };
}

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
 * based on how many original absences/replacements exist in each monthKey.
 * Tendo duas faltas de plantões no mesmo mês, o acadêmico terá os próximos 2 meses para repor esses dois plantões.
 * O prazo de 2 meses é mantido permanentemente mesmo que uma das reposições seja cumprida ou removida.
 */
export function syncMemberReplacementsDeadlines(
  replacements: import('../types/league').ReplacementRecord[],
  member?: import('../types/league').Member
): import('../types/league').ReplacementRecord[] {
  const maxCountByMonth = new Map<string, number>();

  // Pass 1: Collect stored originalAbsenceCountInMonth from existing records
  replacements.forEach(rep => {
    const m = rep.deadlineMonth || 'out/26';
    const storedCount = rep.originalAbsenceCountInMonth || 1;
    const currentMax = maxCountByMonth.get(m) || 0;
    maxCountByMonth.set(m, Math.max(currentMax, storedCount));
  });

  // Pass 2: Check total replacement records registered for each month
  const repCountByMonth = new Map<string, number>();
  replacements.forEach(rep => {
    const m = rep.deadlineMonth || 'out/26';
    repCountByMonth.set(m, (repCountByMonth.get(m) || 0) + 1);
  });

  repCountByMonth.forEach((count, m) => {
    const currentMax = maxCountByMonth.get(m) || 1;
    if (count >= 2) {
      maxCountByMonth.set(m, Math.max(currentMax, count));
    }
  });

  // Pass 3: Inspect member's historical absences and shift records if provided
  if (member) {
    const justifiedCountByMonth = new Map<string, number>();
    member.justifiedAbsences.forEach(a => {
      const m = a.monthKey || 'out/26';
      justifiedCountByMonth.set(m, (justifiedCountByMonth.get(m) || 0) + 1);
    });

    const unjustifiedCountByMonth = new Map<string, number>();
    member.unjustifiedAbsences.forEach(a => {
      const m = a.monthKey || 'out/26';
      unjustifiedCountByMonth.set(m, (unjustifiedCountByMonth.get(m) || 0) + 1);
    });

    const shiftAbsencesByMonth = new Map<string, number>();
    member.shifts.forEach(s => {
      if (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta')) {
        const m = s.monthKey || 'out/26';
        shiftAbsencesByMonth.set(m, (shiftAbsencesByMonth.get(m) || 0) + 1);
      }
    });

    const allMonths = new Set([
      ...Array.from(maxCountByMonth.keys()),
      ...Array.from(justifiedCountByMonth.keys()),
      ...Array.from(unjustifiedCountByMonth.keys()),
      ...Array.from(shiftAbsencesByMonth.keys()),
    ]);

    allMonths.forEach(m => {
      const curMax = maxCountByMonth.get(m) || 1;
      const totalAbsencesInMember = (justifiedCountByMonth.get(m) || 0) + (unjustifiedCountByMonth.get(m) || 0);
      const totalShiftAbsences = shiftAbsencesByMonth.get(m) || 0;
      maxCountByMonth.set(m, Math.max(curMax, totalAbsencesInMember, totalShiftAbsences));
    });
  }

  return replacements.map(rep => {
    const m = rep.deadlineMonth || 'out/26';
    const originalCount = Math.max(
      rep.originalAbsenceCountInMonth || 1,
      maxCountByMonth.get(m) || 1
    );
    const monthsToAdd = originalCount >= 2 ? 2 : 1;
    const fixedDeadlineMonthKey = rep.fixedDeadlineMonthKey || getDeadlineMonthKey(m, monthsToAdd);
    const deadlineDescription = calculateReplacementDeadline(m, originalCount);

    return {
      ...rep,
      originalAbsenceCountInMonth: originalCount,
      fixedDeadlineMonthKey,
      deadlineDescription,
    };
  });
}

/**
 * Automatically completes a replacement, transforms the original absence shift in the history
 * into "Plantão de Reposição Concluído" with the new completion date and [Concluído] status,
 * and deducts -1 from the corresponding absence counter in real-time.
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
  const originAbsenceId = rep.faltaOrigemId || rep.absenceId;
  const originShiftId = rep.shiftId;
  const missedDayMonth = (rep.missedShiftDate || '').split(' ')[0].trim();
  const originMonth = rep.deadlineMonth || 'out/26';

  const { dayMonth: newShiftDate, monthKey: newShiftMonthKey } = parseDateToShiftParts(finalDate, originMonth);

  // 1. Locate the linked absence to dismiss (-1 in Faltas Justificadas or Faltas Não Justif.)
  let dismissedAbsence: import('../types/league').AbsenceRecord | null = null;
  let targetType: 'justificada' | 'injustificada' | null = null;

  // Priority A: Direct match by faltaOrigemId / absenceId
  if (originAbsenceId) {
    const fj = member.justifiedAbsences.find(a => a.id === originAbsenceId);
    if (fj) {
      dismissedAbsence = fj;
      targetType = 'justificada';
    } else {
      const fnj = member.unjustifiedAbsences.find(a => a.id === originAbsenceId);
      if (fnj) {
        dismissedAbsence = fnj;
        targetType = 'injustificada';
      }
    }
  }

  // Priority B: Match by replacementId
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

  // Priority C: Match by shiftId
  if (!dismissedAbsence && originShiftId) {
    const fj = member.justifiedAbsences.find(a => a.shiftId === originShiftId);
    if (fj) {
      dismissedAbsence = fj;
      targetType = 'justificada';
    } else {
      const fnj = member.unjustifiedAbsences.find(a => a.shiftId === originShiftId);
      if (fnj) {
        dismissedAbsence = fnj;
        targetType = 'injustificada';
      }
    }
  }

  // Priority D: Match by missedShiftDate or deadlineMonth reference
  if (!dismissedAbsence) {
    const refDate = rep.missedShiftDate || '';
    const refMonth = rep.deadlineMonth || '';

    if (refDate) {
      const fj = member.justifiedAbsences.find(a => refDate.includes(a.date) || a.date.includes(refDate) || (missedDayMonth && a.date.startsWith(missedDayMonth)));
      if (fj) {
        dismissedAbsence = fj;
        targetType = 'justificada';
      } else {
        const fnj = member.unjustifiedAbsences.find(a => refDate.includes(a.date) || a.date.includes(refDate) || (missedDayMonth && a.date.startsWith(missedDayMonth)));
        if (fnj) {
          dismissedAbsence = fnj;
          targetType = 'injustificada';
        }
      }
    }

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

  // 2. Remove strictly 1 dismissed absence from the arrays (-1 in FJ or FNJ counter)
  let fjDismissed = false;
  const updatedJustified = dismissedAbsence && targetType === 'justificada'
    ? member.justifiedAbsences.filter(a => {
        if (fjDismissed) return true;
        if (a.id === dismissedAbsence!.id) {
          fjDismissed = true;
          return false;
        }
        return true;
      })
    : member.justifiedAbsences;

  let fnjDismissed = false;
  const updatedUnjustified = dismissedAbsence && targetType === 'injustificada'
    ? member.unjustifiedAbsences.filter(a => {
        if (fnjDismissed) return true;
        if (a.id === dismissedAbsence!.id) {
          fnjDismissed = true;
          return false;
        }
        return true;
      })
    : member.unjustifiedAbsences;

  // 3. Mark replacement as completed (removes it from pending replacements list -> -1 in Reposições Pendentes)
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
    }),
    member
  );

  // 4. Locate original absence record in Histórico de Escalas Realizadas (via faltaOrigemId / absenceId / shiftId)
  // and TRANSFORM it into "Plantão de Reposição Concluído" with [Concluído] badge and the new completion date!
  let shiftTransformed = false;
  const updatedShifts = member.shifts.map(s => {
    if (shiftTransformed) return s;

    const isDirectMatch =
      s.replacementId === replacementId ||
      (originShiftId && s.id === originShiftId) ||
      (originAbsenceId && (s.absenceId === originAbsenceId || s.id === originAbsenceId)) ||
      (dismissedAbsence && (s.absenceId === dismissedAbsence.id || s.id === dismissedAbsence.shiftId));

    const isFallbackDateMatch =
      !originShiftId &&
      !originAbsenceId &&
      (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta')) &&
      missedDayMonth &&
      (s.date === missedDayMonth || s.date.startsWith(missedDayMonth));

    if (isDirectMatch || isFallbackDateMatch) {
      shiftTransformed = true;
      return {
        ...s,
        date: newShiftDate,
        monthKey: newShiftMonthKey,
        hours: hoursToAdd,
        type: 'reposicao' as const,
        shiftStatus: 'concluido' as const,
        description: 'Plantão de Reposição Concluído',
      };
    }
    return s;
  });

  // If the original absence didn't have a shift entry in member.shifts yet, insert the transformed shift
  const finalShifts = shiftTransformed
    ? updatedShifts
    : [
        {
          id: originShiftId || `s-rep-${Date.now()}`,
          date: newShiftDate,
          monthKey: newShiftMonthKey,
          hours: hoursToAdd,
          type: 'reposicao' as const,
          shiftStatus: 'concluido' as const,
          description: 'Plantão de Reposição Concluído',
          absenceId: originAbsenceId,
          replacementId,
        },
        ...updatedShifts,
      ];

  const updatedMember: Member = {
    ...member,
    replacements: updatedReplacements,
    justifiedAbsences: updatedJustified,
    unjustifiedAbsences: updatedUnjustified,
    shifts: finalShifts,
    accumulatedHours: member.accumulatedHours + hoursToAdd,
    hoursUpdated: true,
  };

  return {
    updatedMember,
    dismissedAbsence,
    hoursAdded: hoursToAdd,
  };
}

/**
 * Bidirectional Cascade Deletion when a Replacement is manually deleted (Trash Can icon):
 * - Uses `faltaOrigemId` / `absenceId` / `shiftId` to find and automatically delete the original shift in `member.shifts`
 * - Deducts -1 in Reposições Pendentes
 * - Deducts -1 in the corresponding absence (F.J or F.N.J)
 * - If the origin was an F.N.J, also deducts -1 Advertência
 */
export function deleteReplacementWithCascade(
  member: Member,
  replacementId: string
): { updatedMember: Member; wasFNJ: boolean; wasFJ: boolean } {
  const rep = member.replacements.find(r => r.id === replacementId);
  if (!rep) {
    return { updatedMember: member, wasFNJ: false, wasFJ: false };
  }

  const originAbsenceId = rep.faltaOrigemId || rep.absenceId;
  const originShiftId = rep.shiftId;
  const missedDayMonth = (rep.missedShiftDate || '').split(' ')[0].trim();
  const originMonth = rep.deadlineMonth || 'out/26';

  // 1. Find and remove the original record in Histórico de Escalas Realizadas (member.shifts)
  let removedShift: import('../types/league').ShiftRecord | null = null;
  const updatedShifts = member.shifts.filter(s => {
    if (removedShift) return true;

    const isDirectMatch =
      s.replacementId === replacementId ||
      (originShiftId && s.id === originShiftId) ||
      (originAbsenceId && (s.absenceId === originAbsenceId || s.id === originAbsenceId));

    const isFallbackMatch =
      (s.shiftStatus === 'falta_justificada' || s.shiftStatus === 'falta_injustificada' || s.description?.includes('Falta')) &&
      missedDayMonth &&
      (s.date === missedDayMonth || s.date.startsWith(missedDayMonth)) &&
      (!originMonth || s.monthKey === originMonth);

    if (isDirectMatch || isFallbackMatch) {
      removedShift = s;
      return false; // Delete strictly this 1 original shift record
    }
    return true;
  });

  const effectiveAbsenceId = originAbsenceId || (removedShift as import('../types/league').ShiftRecord | null)?.absenceId;
  const effectiveShiftId = originShiftId || (removedShift as import('../types/league').ShiftRecord | null)?.id;

  // 2. Find and remove strictly 1 linked absence (-1 in F.J or -1 in F.N.J)
  let removedFJ: import('../types/league').AbsenceRecord | null = null;
  const updatedJustified = member.justifiedAbsences.filter(a => {
    if (removedFJ) return true;
    const isMatch =
      a.replacementId === replacementId ||
      (effectiveAbsenceId && a.id === effectiveAbsenceId) ||
      (effectiveShiftId && a.shiftId === effectiveShiftId) ||
      (missedDayMonth && (a.date === missedDayMonth || a.date.startsWith(missedDayMonth)) && (!originMonth || (a.monthKey || 'out/26') === originMonth));

    if (isMatch) {
      removedFJ = a;
      return false;
    }
    return true;
  });

  let removedFNJ: import('../types/league').AbsenceRecord | null = null;
  const updatedUnjustified = member.unjustifiedAbsences.filter(a => {
    if (removedFNJ || removedFJ) return true;
    const isMatch =
      a.replacementId === replacementId ||
      (effectiveAbsenceId && a.id === effectiveAbsenceId) ||
      (effectiveShiftId && a.shiftId === effectiveShiftId) ||
      (missedDayMonth && (a.date === missedDayMonth || a.date.startsWith(missedDayMonth)) && (!originMonth || (a.monthKey || 'out/26') === originMonth));

    if (isMatch) {
      removedFNJ = a;
      return false;
    }
    return true;
  });

  const wasFNJ = Boolean(
    removedFNJ ||
    (removedShift as import('../types/league').ShiftRecord | null)?.shiftStatus === 'falta_injustificada' ||
    rep.notes?.toLowerCase().includes('não justificada')
  );
  const wasFJ = Boolean(
    removedFJ ||
    (removedShift as import('../types/league').ShiftRecord | null)?.shiftStatus === 'falta_justificada' ||
    (!wasFNJ && rep.notes?.toLowerCase().includes('justificada'))
  );

  // 3. If origin was F.N.J, also deduct -1 Advertência
  let updatedWarnings = member.warnings;
  if (wasFNJ) {
    const targetWarnId = (removedFNJ as import('../types/league').AbsenceRecord | null)?.warningId;
    const refDateForWarn = missedDayMonth || (removedShift as import('../types/league').ShiftRecord | null)?.date || '';
    let warnRemoved = false;

    updatedWarnings = member.warnings.filter(w => {
      if (warnRemoved) return true;
      const isMatch =
        (targetWarnId && w.id === targetWarnId) ||
        (effectiveAbsenceId && w.id === `w-${effectiveAbsenceId}`) ||
        (refDateForWarn && w.reason && w.reason.includes(refDateForWarn));

      if (isMatch) {
        warnRemoved = true;
        return false;
      }
      return true;
    });
  }

  // 4. Remove the replacement (-1 in Reposições Pendentes) and deduct hours if it was already completed
  const hoursToDeduct = rep.completed ? (rep.scheduledHours || 12) : 0;
  const remainingReplacements = member.replacements.filter(r => r.id !== replacementId);

  const nextMemberDraft: Member = {
    ...member,
    shifts: updatedShifts,
    justifiedAbsences: updatedJustified,
    unjustifiedAbsences: updatedUnjustified,
    warnings: updatedWarnings,
    accumulatedHours: Math.max(0, member.accumulatedHours - hoursToDeduct),
  };

  const updatedReplacements = syncMemberReplacementsDeadlines(remainingReplacements, nextMemberDraft);

  return {
    updatedMember: {
      ...nextMemberDraft,
      replacements: updatedReplacements,
    },
    wasFNJ,
    wasFJ,
  };
}

