import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { MonthlyScheduleView } from './components/MonthlyScheduleView';
import { ReplacementsView } from './components/ReplacementsView';
import { DisciplinaryView } from './components/DisciplinaryView';
import { CertificatesView } from './components/CertificatesView';
import { MemberDetailModal } from './components/MemberDetailModal';
import { CertificateModal } from './components/CertificateModal';
import { AddMemberModal } from './components/AddMemberModal';
import { AddShiftModal } from './components/AddShiftModal';
import { LeagueSettingsModal } from './components/LeagueSettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './context/AuthContext';

import { Member, LeagueConfig, ShiftRecord, RoleInLeague, ReplacementRecord, WarningRecord } from './types/league';
import { INITIAL_MEMBERS, DEFAULT_LEAGUE_CONFIG } from './data/initialData';
import { calculateLeagueStats, calculateReplacementDeadline, syncMemberReplacementsDeadlines } from './utils/leagueCalculations';
import { ShiftBatchSubmission } from './components/AddShiftModal';

// Firebase Firestore Imports
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './lib/firebase';
import {
  QuickReplacementModal,
  QuickWarningModal,
  DeleteMemberModal,
} from './components/CoordinationModals';

// Strip undefined properties before sending to Firestore
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const STORAGE_MEMBERS_KEY = 'lthac_members_v2';
const STORAGE_CONFIG_KEY = 'lthac_config_v2';

const OFFICIAL_COORD_NAMES = [
  'pedro ortolan',
  'jaciele',
  'nathan',
  'lorrana',
  'isabela luisa',
  'izabela luisa',
];

const FORMER_COORD_TO_LIGANTE_NAMES = [
  'paulo vinicius',
  'roberta sparneri',
  'jenniffer bueno',
];

function normalizeRole(role: string): RoleInLeague {
  if (
    role === 'Coordenação' ||
    role === 'Presidente' ||
    role === 'Vice-Presidente' ||
    role.includes('Diretor') ||
    role.includes('Secretário')
  ) {
    return 'Coordenação';
  }
  return 'Ligante';
}

function resolveCoordinationRole(name: string, currentRole: string): RoleInLeague {
  const lower = name.toLowerCase();
  if (OFFICIAL_COORD_NAMES.some(n => lower.includes(n))) {
    return 'Coordenação';
  }
  if (FORMER_COORD_TO_LIGANTE_NAMES.some(n => lower.includes(n))) {
    return 'Ligante';
  }
  return normalizeRole(currentRole);
}

function sanitizeMemberShifts(member: Member): { member: Member; changed: boolean } {
  const shifts = member.shifts || [];
  if (!shifts.some(s => s.isExcused || s.description === 'Abonado')) {
    return { member, changed: false };
  }

  const updatedShifts = shifts.map(s => {
    if (s.isExcused || s.description === 'Abonado') {
      return {
        ...s,
        isExcused: undefined,
        hours: s.hours || 12,
        shiftStatus: (s.shiftStatus && s.shiftStatus !== 'concluido' ? s.shiftStatus : 'concluido') as 'concluido' | 'falta_justificada' | 'falta_injustificada',
        description: s.description === 'Abonado' ? 'Plantão Concluído' : s.description,
      };
    }
    return s;
  });

  return {
    member: {
      ...member,
      shifts: updatedShifts,
    },
    changed: true,
  };
}

/**
 * Ensures every unjustifiedAbsence that has never been linked to a warning (!abs.warningId)
 * has a corresponding registered WarningRecord. Once abs.warningId is set, if the user later
 * deletes the warning from member.warnings, abs.warningId remains set so the deleted warning
 * is NOT recreated.
 */
function ensureUnjustifiedAbsencesHaveWarnings(member: Member): { member: Member; changed: boolean } {
  const { member: shiftSanitizedMember, changed: shiftChanged } = sanitizeMemberShifts(member);
  const currentMember = shiftSanitizedMember;

  const unjustified = currentMember.unjustifiedAbsences || [];
  if (!unjustified.some(a => !a.warningId)) {
    return { member: currentMember, changed: shiftChanged };
  }

  let changed = shiftChanged || true;
  const nextWarnings: WarningRecord[] = [...(currentMember.warnings || [])];
  const usedWarningIds = new Set<string>(
    unjustified.map(a => a.warningId).filter((id): id is string => Boolean(id))
  );

  const nextUnjustified = unjustified.map((abs) => {
    if (abs.warningId) {
      return abs;
    }

    changed = true;

    // Check if there is an existing unlinked warning we can pair with this unjustified absence
    const unlinkedIdx = nextWarnings.findIndex(w => !usedWarningIds.has(w.id));
    if (unlinkedIdx !== -1) {
      const existingWarn = nextWarnings[unlinkedIdx];
      usedWarningIds.add(existingWarn.id);
      if (existingWarn.id === 'w-6-1' || existingWarn.reason.includes('04/10')) {
        nextWarnings[unlinkedIdx] = {
          ...existingWarn,
          date: abs.date,
          reason: `Advertência automática por falta não justificada em ${abs.date}${abs.reason ? ` (${abs.reason})` : ''}`,
        };
      }
      return {
        ...abs,
        warningId: existingWarn.id,
      };
    }

    const newWarnId = `w-${abs.id}`;
    const newWarn: WarningRecord = {
      id: newWarnId,
      date: abs.date,
      reason: `Advertência automática por falta não justificada em ${abs.date}${abs.reason ? ` (${abs.reason})` : ''}`,
      severity: 'moderada',
      active: true,
    };
    nextWarnings.push(newWarn);
    usedWarningIds.add(newWarnId);

    return {
      ...abs,
      warningId: newWarnId,
    };
  });

  return {
    member: {
      ...currentMember,
      warnings: nextWarnings,
      unjustifiedAbsences: nextUnjustified,
    },
    changed,
  };
}

export default function App() {
  const { user, isAuthenticated, isCoordination, isReader, loading } = useAuth();

  // State synchronized in real-time with Firebase Firestore
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_MEMBERS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse cached members', e);
    }
    return [];
  });

  const [config, setConfig] = useState<LeagueConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse cached config', e);
    }
    return DEFAULT_LEAGUE_CONFIG;
  });

  // Current View Tab
  const [currentTab, setCurrentTab] = useState<string>('members');

  // Modals
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [certificateMember, setCertificateMember] = useState<Member | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [shiftModalMemberIds, setShiftModalMemberIds] = useState<string[]>([]);
  const [isQuickRepOpen, setIsQuickRepOpen] = useState(false);
  const [quickRepMemberId, setQuickRepMemberId] = useState<string | undefined>(undefined);
  const [isQuickWarnOpen, setIsQuickWarnOpen] = useState(false);
  const [quickWarnMemberId, setQuickWarnMemberId] = useState<string | undefined>(undefined);
  const [isDeleteMemberOpen, setIsDeleteMemberOpen] = useState(false);
  const [deleteTargetMemberId, setDeleteTargetMemberId] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Firestore Real-Time Listener (onSnapshot) sync
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Listen in real-time to config document
    const configDocRef = doc(db, 'config', 'league');
    const unsubscribeConfig = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LeagueConfig;
        setConfig(data);
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(data));
      } else {
        // Automatically seed default league config in Firestore if not present
        if (isCoordination) {
          setDoc(configDocRef, DEFAULT_LEAGUE_CONFIG)
            .catch(err => handleFirestoreError(err, OperationType.WRITE, 'config/league'));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/league');
    });

    // 2. Listen in real-time to members collection
    const membersColRef = collection(db, 'members');
    const unsubscribeMembers = onSnapshot(membersColRef, (snapshot) => {
      const list: Member[] = [];
      const toSyncInFirestore: Member[] = [];

      snapshot.forEach((docSnap) => {
        const rawMember = docSnap.data() as Member;
        const { member: reconciledMember, changed } = ensureUnjustifiedAbsencesHaveWarnings(rawMember);
        list.push(reconciledMember);
        if (changed) {
          toSyncInFirestore.push(reconciledMember);
        }
      });

      // Persist any newly linked automatic warnings for existing unjustified absences
      if (toSyncInFirestore.length > 0) {
        toSyncInFirestore.forEach((m) => {
          const clean = sanitizeForFirestore(m);
          setDoc(doc(db, 'members', m.id), clean).catch((err) =>
            console.warn('Auto-sync warning for member deferred:', err)
          );
        });
      }

      // Maintain consistent sort order (by name)
      list.sort((a, b) => a.name.localeCompare(b.name));

      setMembers(list);
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(list));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'members');
    });

    return () => {
      unsubscribeConfig();
      unsubscribeMembers();
    };
  }, [isAuthenticated, isCoordination]);

  // Keep selectedMember in sync with updated members array
  useEffect(() => {
    if (selectedMember) {
      const fresh = members.find(m => m.id === selectedMember.id);
      if (fresh) {
        setSelectedMember(fresh);
      }
    }
  }, [members, selectedMember]);

  // Enforce reader permissions
  useEffect(() => {
    if (isReader) {
      setIsAddMemberOpen(false);
      setIsAddShiftOpen(false);
      setIsSettingsOpen(false);
      setCertificateMember(null);
    }
  }, [isReader]);

  // Handlers - Write directly to Firebase Firestore using setDoc / updateDoc / deleteDoc
  const handleUpdateMember = async (updated: Member) => {
    const cleanData = sanitizeForFirestore(updated);
    try {
      const memberRef = doc(db, 'members', updated.id);
      await updateDoc(memberRef, cleanData as Record<string, any>).catch(async () => {
        await setDoc(memberRef, cleanData);
      });
      if (selectedMember && selectedMember.id === updated.id) {
        setSelectedMember(cleanData);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `members/${updated.id}`);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      await deleteDoc(doc(db, 'members', memberId));
      if (selectedMember?.id === memberId) {
        setSelectedMember(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `members/${memberId}`);
    }
  };

  const handleAddMember = async (newMember: Member) => {
    const cleanData = sanitizeForFirestore(newMember);
    try {
      await setDoc(doc(db, 'members', cleanData.id), cleanData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `members/${cleanData.id}`);
    }
  };

  const handleSaveConfig = async (newConfig: LeagueConfig) => {
    const cleanConfig = sanitizeForFirestore(newConfig);
    try {
      await setDoc(doc(db, 'config', 'league'), cleanConfig);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'config/league');
    }
  };

  // Quick Action: +12 Hours
  const handleQuickAddHours = async (memberId: string, hours = 12) => {
    const m = members.find(x => x.id === memberId);
    if (!m) return;

    const today = new Date();
    const dayStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const monthKey = 'out/26';

    const newShift: ShiftRecord = {
      id: `s-${Date.now()}`,
      date: dayStr,
      monthKey,
      hours,
      type: 'plantao',
      description: 'Plantão de escala (+12h)',
    };

    const updated: Member = {
      ...m,
      shifts: [newShift, ...m.shifts],
      accumulatedHours: m.accumulatedHours + hours,
      hoursUpdated: true,
    };

    try {
      await setDoc(doc(db, 'members', m.id), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `members/${m.id}`);
    }
  };

  // Quick Action: + Falta Justificada (FJ) -> Sem advertência, mas gera reposição obrigatória
  const handleQuickAddFJ = async (memberId: string) => {
    const m = members.find(x => x.id === memberId);
    if (!m) return;

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const monthKey = 'out/26';
    const absenceId = `ab-fj-${Date.now()}`;
    const replacementId = `rep-${Date.now()}`;

    const existingInMonth = [...m.justifiedAbsences, ...m.unjustifiedAbsences]
      .filter(a => (a.monthKey || 'out/26') === monthKey).length;
    const deadlineText = calculateReplacementDeadline(monthKey, existingInMonth + 1);

    const newAbsence = {
      id: absenceId,
      date: today,
      monthKey,
      type: 'justificada' as const,
      reason: `Falta justificada no plantão de ${today} (${monthKey})`,
      hasMedicalCertificate: true,
      requiresReplacement: true,
      replacementId,
    };

    const newRep: ReplacementRecord = {
      id: replacementId,
      memberId: m.id,
      absenceId,
      scheduledDate: 'A definir',
      scheduledHours: 12,
      completed: false,
      deadlineMonth: monthKey,
      deadlineDescription: deadlineText,
      missedShiftDate: `${today} (${monthKey})`,
      notes: `Falta Justificada em ${today} (${monthKey}) — sem advertência, requer reposição. Prazo: ${deadlineText}`,
    };

    const updated: Member = {
      ...m,
      justifiedAbsences: [newAbsence, ...m.justifiedAbsences],
      replacements: syncMemberReplacementsDeadlines([newRep, ...m.replacements]),
    };

    await handleUpdateMember(updated);
  };

  // Quick Action: + Falta Não Justificada (FNJ) -> Gera automaticamente 1 Advertência + 1 Reposição obrigatória
  const handleQuickAddFNJ = async (memberId: string) => {
    const m = members.find(x => x.id === memberId);
    if (!m) return;

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const monthKey = 'out/26';
    const absenceId = `ab-fnj-${Date.now()}`;
    const replacementId = `rep-${Date.now()}`;
    const warningId = `w-${Date.now()}`;

    const existingInMonth = [...m.justifiedAbsences, ...m.unjustifiedAbsences]
      .filter(a => (a.monthKey || 'out/26') === monthKey).length;
    const deadlineText = calculateReplacementDeadline(monthKey, existingInMonth + 1);

    const newWarning: WarningRecord = {
      id: warningId,
      date: today,
      reason: `Advertência automática por falta não justificada no plantão de ${today} (${monthKey})`,
      severity: 'moderada',
      active: true,
    };

    const newAbsence = {
      id: absenceId,
      date: today,
      monthKey,
      type: 'injustificada' as const,
      reason: `Falta não justificada no plantão de ${today} (${monthKey})`,
      requiresReplacement: true,
      replacementId,
      warningId,
    };

    const newRep: ReplacementRecord = {
      id: replacementId,
      memberId: m.id,
      absenceId,
      scheduledDate: 'A definir',
      scheduledHours: 12,
      completed: false,
      deadlineMonth: monthKey,
      deadlineDescription: deadlineText,
      missedShiftDate: `${today} (${monthKey})`,
      notes: `Falta Não Justificada em ${today} (${monthKey}) — gerou 1 ADV e requer reposição. Prazo: ${deadlineText}`,
    };

    const updated: Member = {
      ...m,
      warnings: [newWarning, ...m.warnings],
      unjustifiedAbsences: [newAbsence, ...m.unjustifiedAbsences],
      replacements: syncMemberReplacementsDeadlines([newRep, ...m.replacements]),
    };

    await handleUpdateMember(updated);
  };

  // Quick Action: + Advertência (ADV)
  const handleQuickAddADV = async (memberId: string) => {
    const m = members.find(x => x.id === memberId);
    if (!m) return;

    const today = new Date().toLocaleDateString('pt-BR');
    const newWarn = {
      id: `w-${Date.now()}`,
      date: today,
      reason: 'Advertência por falta não justificada no plantão de 04/10 (out/26)',
      severity: 'moderada' as const,
      active: true,
    };

    const updated: Member = {
      ...m,
      warnings: [newWarn, ...m.warnings],
    };

    try {
      await setDoc(doc(db, 'members', m.id), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `members/${m.id}`);
    }
  };

  const handleAddShiftsToMembers = async (memberIds: string[], shiftData: ShiftBatchSubmission) => {
    memberIds.forEach(async (id) => {
      const m = members.find(member => member.id === id);
      if (!m) return;

      const baseShift: ShiftRecord = {
        id: `s-${Date.now()}-${m.id}`,
        date: shiftData.date,
        monthKey: shiftData.monthKey,
        hours: shiftData.shiftStatus === 'concluido' ? shiftData.hours : 0,
        type: 'plantao',
        shiftStatus: shiftData.shiftStatus,
        description: shiftData.description,
      };

      if (shiftData.shiftStatus === 'concluido') {
        const updated: Member = {
          ...m,
          shifts: [baseShift, ...m.shifts],
          accumulatedHours: m.accumulatedHours + shiftData.hours,
          hoursUpdated: true,
        };
        await handleUpdateMember(updated);
        return;
      }

      const existingInMonth = [...m.justifiedAbsences, ...m.unjustifiedAbsences]
        .filter(a => (a.monthKey || 'out/26') === shiftData.monthKey).length;
      const countInMonth = existingInMonth + 1;
      const deadlineText = calculateReplacementDeadline(shiftData.monthKey, countInMonth);

      const shiftId = `s-${Date.now()}-${m.id}`;
      const absenceId = `ab-${shiftData.shiftStatus === 'falta_justificada' ? 'fj' : 'fnj'}-${Date.now()}-${m.id}`;
      const replacementId = `rep-${Date.now()}-${m.id}`;
      const warningId = `w-${Date.now()}-${m.id}`;

      baseShift.id = shiftId;
      baseShift.absenceId = absenceId;
      baseShift.replacementId = replacementId;

      const newRep: ReplacementRecord = {
        id: replacementId,
        memberId: m.id,
        absenceId,
        shiftId,
        scheduledDate: 'A definir',
        scheduledHours: shiftData.hours || 12,
        completed: false,
        deadlineMonth: shiftData.monthKey,
        deadlineDescription: deadlineText,
        missedShiftDate: `${shiftData.date} (${shiftData.monthKey})`,
        notes: shiftData.shiftStatus === 'falta_justificada'
          ? `Falta Justificada. Prazo: ${deadlineText}`
          : `Falta Não Justificada. Prazo: ${deadlineText}. Gerou 1 ADV`,
      };

      const updatedReplacements = syncMemberReplacementsDeadlines([newRep, ...m.replacements]);

      if (shiftData.shiftStatus === 'falta_justificada') {
        const newAbsence: typeof m.justifiedAbsences[0] = {
          id: absenceId,
          date: shiftData.date,
          monthKey: shiftData.monthKey,
          type: 'justificada',
          reason: `Falta justificada no plantão de ${shiftData.date} (${shiftData.monthKey})`,
          requiresReplacement: true,
          shiftId,
          replacementId,
        };

        const updated: Member = {
          ...m,
          shifts: [baseShift, ...m.shifts],
          justifiedAbsences: [newAbsence, ...m.justifiedAbsences],
          replacements: updatedReplacements,
        };

        await handleUpdateMember(updated);
      } else {
        const newWarning: WarningRecord = {
          id: warningId,
          date: shiftData.date,
          reason: `Advertência por falta não justificada no plantão de ${shiftData.date} (${shiftData.monthKey})`,
          severity: 'moderada',
          active: true,
        };

        const newAbsence: typeof m.unjustifiedAbsences[0] = {
          id: absenceId,
          date: shiftData.date,
          monthKey: shiftData.monthKey,
          type: 'injustificada',
          reason: `Falta não justificada no plantão de ${shiftData.date} (${shiftData.monthKey})`,
          requiresReplacement: true,
          shiftId,
          replacementId,
          warningId,
        };

        const updated: Member = {
          ...m,
          shifts: [baseShift, ...m.shifts],
          warnings: [newWarning, ...m.warnings],
          unjustifiedAbsences: [newAbsence, ...m.unjustifiedAbsences],
          replacements: updatedReplacements,
        };

        await handleUpdateMember(updated);
      }
    });
  };

  const handleImportMembers = async (importedList: Partial<Member>[]) => {
    const currentMap = new Map(members.map(m => [m.name.toLowerCase().trim(), m]));
    importedList.forEach(async (imp) => {
      if (!imp.name) return;
      const key = imp.name.toLowerCase().trim();
      const role = normalizeRole(imp.role as string || 'Ligante');
      let updated: Member;

      if (currentMap.has(key)) {
        const existing = currentMap.get(key)!;
        updated = {
          ...existing,
          ...imp,
          role,
          id: existing.id,
          shifts: [...existing.shifts, ...(imp.shifts || [])],
          warnings: [...existing.warnings, ...(imp.warnings || [])],
          replacements: [...existing.replacements, ...(imp.replacements || [])],
        } as Member;
      } else {
        const id = imp.id || `m-imp-${Date.now()}-${Math.random()}`;
        updated = {
          id,
          name: imp.name,
          entryDate: imp.entryDate || '01/01/2026',
          role,
          status: imp.status || 'ativo',
          accumulatedHours: imp.accumulatedHours || 0,
          hoursUpdated: true,
          warnings: imp.warnings || [],
          justifiedAbsences: imp.justifiedAbsences || [],
          unjustifiedAbsences: imp.unjustifiedAbsences || [],
          replacements: imp.replacements || [],
          shifts: imp.shifts || [],
        } as Member;
      }

      try {
        await setDoc(doc(db, 'members', updated.id), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `members/${updated.id}`);
      }
    });
  };

  const handleResetOriginalData = async () => {
    // Delete existing documents in Firestore
    members.forEach(async (m) => {
      try {
        await deleteDoc(doc(db, 'members', m.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `members/${m.id}`);
      }
    });

    // Seed back initial members
    INITIAL_MEMBERS.forEach(async (m) => {
      try {
        await setDoc(doc(db, 'members', m.id), m);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `members/${m.id}`);
      }
    });

    // Reset config
    try {
      await setDoc(doc(db, 'config', 'league'), DEFAULT_LEAGUE_CONFIG);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'config/league');
    }

    localStorage.removeItem(STORAGE_MEMBERS_KEY);
    localStorage.removeItem(STORAGE_CONFIG_KEY);
  };

  const stats = calculateLeagueStats(members, config);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Carregando autenticação...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header with Navigation & Quick Actions */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        config={config}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAddMember={() => setIsAddMemberOpen(true)}
        onOpenAddShift={() => {
          setShiftModalMemberIds([]);
          setIsAddShiftOpen(true);
        }}
        activeMembersCount={stats.activeMembers}
        eligibleCertificatesCount={stats.eligibleCount}
        pendingReplacementsCount={stats.totalPendingReplacements}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-8 pb-20">
        {currentTab === 'dashboard' && (
          <DashboardView
            members={members}
            config={config}
            onSelectMember={setSelectedMember}
            onNavigateTab={setCurrentTab}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
            onOpenAddShift={() => {
              setShiftModalMemberIds([]);
              setIsAddShiftOpen(true);
            }}
          />
        )}

        {currentTab === 'members' && (
          <MembersView
            members={members}
            config={config}
            onSelectMember={setSelectedMember}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
            onOpenCertificateModal={setCertificateMember}
            onOpenAddShiftForMember={(memberId) => {
              setShiftModalMemberIds([memberId]);
              setIsAddShiftOpen(true);
            }}
            onOpenAddReplacementForMember={(memberId) => {
              setQuickRepMemberId(memberId);
              setIsQuickRepOpen(true);
            }}
            onOpenAddWarningForMember={(memberId) => {
              setQuickWarnMemberId(memberId);
              setIsQuickWarnOpen(true);
            }}
            onRequestDeleteMember={(memberId) => {
              setDeleteTargetMemberId(memberId);
              setIsDeleteMemberOpen(true);
            }}
          />
        )}

        {currentTab === 'schedule' && (
          <MonthlyScheduleView
            members={members}
            config={config}
            onSelectMember={setSelectedMember}
            onUpdateMember={handleUpdateMember}
            onOpenAddShift={() => setIsAddShiftOpen(true)}
            onOpenCertificateModal={setCertificateMember}
          />
        )}

        {currentTab === 'replacements' && (
          <ReplacementsView
            members={members}
            onUpdateMember={handleUpdateMember}
            onSelectMember={setSelectedMember}
          />
        )}

        {currentTab === 'disciplinary' && (
          <DisciplinaryView
            members={members}
            onUpdateMember={handleUpdateMember}
            onSelectMember={setSelectedMember}
          />
        )}

        {currentTab === 'certificates' && (
          <CertificatesView
            members={members}
            config={config}
            onUpdateConfig={handleSaveConfig}
            onOpenCertificateModal={setCertificateMember}
            onSelectMember={setSelectedMember}
            onUpdateMember={handleUpdateMember}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 text-center py-4 text-xs text-slate-500 no-print">
        <p>
          {config.leagueName} ({config.leagueAcronym}) • Meta de Certificação: {config.minHoursForCertificate} horas
        </p>
      </footer>

      {/* Modals */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          config={config}
          onClose={() => setSelectedMember(null)}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
        />
      )}

      {certificateMember && isCoordination && (
        <CertificateModal
          member={certificateMember}
          config={config}
          onClose={() => setCertificateMember(null)}
        />
      )}

      {isAddMemberOpen && isCoordination && (
        <AddMemberModal
          onClose={() => setIsAddMemberOpen(false)}
          onAddMember={handleAddMember}
        />
      )}

      {isAddShiftOpen && isCoordination && (
        <AddShiftModal
          members={members}
          initialMemberIds={shiftModalMemberIds}
          onClose={() => {
            setIsAddShiftOpen(false);
            setShiftModalMemberIds([]);
          }}
          onAddShiftsToMembers={handleAddShiftsToMembers}
        />
      )}

      {isQuickRepOpen && isCoordination && (
        <QuickReplacementModal
          members={members}
          initialMemberId={quickRepMemberId}
          onClose={() => {
            setIsQuickRepOpen(false);
            setQuickRepMemberId(undefined);
          }}
          onUpdateMember={handleUpdateMember}
        />
      )}

      {isQuickWarnOpen && isCoordination && (
        <QuickWarningModal
          members={members}
          initialMemberId={quickWarnMemberId}
          onClose={() => {
            setIsQuickWarnOpen(false);
            setQuickWarnMemberId(undefined);
          }}
          onUpdateMember={handleUpdateMember}
        />
      )}

      {isDeleteMemberOpen && isCoordination && (
        <DeleteMemberModal
          members={members}
          initialMemberId={deleteTargetMemberId}
          onClose={() => {
            setIsDeleteMemberOpen(false);
            setDeleteTargetMemberId(undefined);
          }}
          onConfirmDelete={handleDeleteMember}
        />
      )}

      {isSettingsOpen && isCoordination && (
        <LeagueSettingsModal
          config={config}
          onClose={() => setIsSettingsOpen(false)}
          onSaveConfig={handleSaveConfig}
          onResetToDefaults={() => {
            handleSaveConfig(DEFAULT_LEAGUE_CONFIG);
          }}
        />
      )}
    </div>
  );
}
