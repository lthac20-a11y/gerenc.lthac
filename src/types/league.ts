export type MemberStatus = 'ativo' | 'licenciado' | 'egresso' | 'desligado';

export type RoleInLeague = 
  | 'Ligante'
  | 'Coordenação';

export interface ShiftRecord {
  id: string;
  date: string; // YYYY-MM-DD or DD/MM
  monthKey: string; // e.g., 'jan/26', 'fev/26', etc.
  hours: number;
  type: 'plantao' | 'aula' | 'reuniao' | 'evento' | 'reposicao' | 'outro';
  shiftStatus?: 'concluido' | 'falta_justificada' | 'falta_injustificada';
  description?: string;
  isExcused?: boolean; // Abonado
  absenceId?: string;
  replacementId?: string;
}

export interface AbsenceRecord {
  id: string;
  date: string;
  monthKey?: string;
  type: 'justificada' | 'injustificada';
  reason: string;
  hasMedicalCertificate?: boolean;
  requiresReplacement: boolean;
  shiftId?: string;
  replacementId?: string;
  warningId?: string;
}

export interface ReplacementRecord {
  id: string;
  memberId: string;
  absenceId?: string;
  shiftId?: string;
  scheduledDate?: string; // e.g. "xx/10" or "18/10/2026"
  scheduledHours: number;
  completed: boolean;
  completedDate?: string;
  deadlineMonth?: string;
  deadlineDescription?: string; // e.g. "Reposição no mês seguinte" ou "Nos 2 próximos meses"
  missedShiftDate?: string;
  warningIssuedForDelay?: boolean;
  notes?: string;
}

export interface WarningRecord {
  id: string;
  date: string;
  reason: string;
  severity: 'leve' | 'moderada' | 'grave';
  active: boolean;
  notes?: string;
}

export interface Member {
  id: string;
  name: string;
  entryDate: string; // DD/MM/YYYY
  role: RoleInLeague;
  status: MemberStatus;
  accumulatedHours: number;
  hoursUpdated: boolean; // HS ATU
  warnings: WarningRecord[]; // ADV count = active warnings length
  justifiedAbsences: AbsenceRecord[]; // F.J
  unjustifiedAbsences: AbsenceRecord[]; // F.N.J
  replacements: ReplacementRecord[]; // REP
  shifts: ShiftRecord[];
  email?: string;
  phone?: string;
  studentId?: string; // Matrícula / RA
  notes?: string;
}

export interface LeagueConfig {
  leagueName: string;
  leagueAcronym: string;
  institution: string; // Universidade / Faculdade
  coordinatorName: string;
  coordinatorTitle: string;
  presidentName: string;
  minHoursForCertificate: number; // e.g., 180
  minActiveMonthsForCertificate: number; // e.g., 6 or 12
  maxUnjustifiedAbsencesAllowed: number; // e.g., 0
  maxActiveWarningsAllowed: number; // e.g., 0 or 1
  requireAllReplacementsCompleted: boolean; // true
  cityState: string;
}

export interface CertificateEligibility {
  isEligible: boolean;
  memberId: string;
  memberName: string;
  currentHours: number;
  requiredHours: number;
  hoursMet: boolean;
  activeMonths: number;
  requiredMonths: number;
  timeMet: boolean;
  activeWarningsCount: number;
  warningsMet: boolean;
  pendingReplacementsCount: number;
  replacementsMet: boolean;
  unjustifiedAbsencesCount: number;
  absencesMet: boolean;
  reasonsPending: string[];
}

export const MONTH_COLUMNS = [
  'jan/26',
  'fev/26',
  'mar/26',
  'abr/26',
  'mai/26',
  'jun/26',
  'jul/26',
  'ago/26',
  'set/26',
  'out/26',
  'nov/26',
  'dez/26',
];
