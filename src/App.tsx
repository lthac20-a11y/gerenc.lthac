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
import { SpreadsheetModal } from './components/SpreadsheetModal';

import { Member, LeagueConfig, ShiftRecord, RoleInLeague, ReplacementRecord, WarningRecord } from './types/league';
import { INITIAL_MEMBERS, DEFAULT_LEAGUE_CONFIG } from './data/initialData';
import { calculateLeagueStats, calculateReplacementDeadline, syncMemberReplacementsDeadlines } from './utils/leagueCalculations';
import { ShiftBatchSubmission } from './components/AddShiftModal';

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

export default function App() {
  // Members State
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_MEMBERS_KEY) || localStorage.getItem('lthac_members_v1');
      if (stored) {
        const parsed: Member[] = JSON.parse(stored);
        return parsed.map(m => {
          const seenAbs = new Set<string>();
          const dedupedJustified = (m.justifiedAbsences || []).filter(a => {
            const key = `${a.date}-${a.monthKey || 'out/26'}-${a.type}-${a.reason}`;
            if (seenAbs.has(key)) return false;
            seenAbs.add(key);
            return true;
          });
          const dedupedUnjustified = (m.unjustifiedAbsences || []).filter(a => {
            const key = `${a.date}-${a.monthKey || 'out/26'}-${a.type}-${a.reason}`;
            if (seenAbs.has(key)) return false;
            seenAbs.add(key);
            return true;
          });

          const sanitizedReplacements = (m.replacements || []).map(r => {
            if (!r.notes || r.notes.includes('Agendado para meados de outubro') || r.notes.includes('Agendado para novembro')) {
              return {
                ...r,
                notes: 'Referente à falta não justificada de 02/10/2026',
              };
            }
            return r;
          });

          const sanitizedWarnings = (m.warnings || []).filter(w => {
            const r = w.reason.toLowerCase();
            return !r.includes('urgência sem cobertura') && 
                   !r.includes('reincidência de ausência') && 
                   !r.includes('descumprimento de escala');
          });

          // If Amanda Kalinoski, ensure official single warning is present
          if (m.name.toLowerCase().includes('amanda kalinoski') && sanitizedWarnings.length === 0) {
            sanitizedWarnings.push({
              id: 'w-6-1',
              date: '04/10/2026',
              reason: 'Advertência por falta não justificada no plantão de 04/10 (out/26)',
              severity: 'moderada',
              active: true,
            });
          }

          return {
            ...m,
            role: resolveCoordinationRole(m.name, m.role as string),
            justifiedAbsences: dedupedJustified,
            unjustifiedAbsences: dedupedUnjustified,
            warnings: sanitizedWarnings,
            replacements: syncMemberReplacementsDeadlines(sanitizedReplacements),
          };
        });
      }
    } catch (e) {
      console.error('Failed to parse members from localStorage', e);
    }
    return INITIAL_MEMBERS;
  });

  // League Config State
  const [config, setConfig] = useState<LeagueConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY) || localStorage.getItem('lthac_config_v1');
      if (stored) {
        const parsed: LeagueConfig = JSON.parse(stored);
        const nameNeedsUpdate = !parsed.leagueName || 
          parsed.leagueName.includes('Urgência e Emergência Cirúrgica') || 
          parsed.leagueName.includes('Liga Acadêmica de Trauma');
        
        return {
          ...parsed,
          leagueName: nameNeedsUpdate ? 'Liga do Trauma Hospital Angelina Caron' : parsed.leagueName,
          leagueAcronym: parsed.leagueAcronym === 'LHT' || !parsed.leagueAcronym ? 'LTHAC' : parsed.leagueAcronym,
          institution: (!parsed.institution || parsed.institution.includes('Faculdade de Medicina')) ? 'Hospital Angelina Caron' : parsed.institution,
          minHoursForCertificate: 150, // enforce 150h default goal
        };
      }
    } catch (e) {
      console.error('Failed to parse config from localStorage', e);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
    } catch (e) {
      console.error('Failed to save members to localStorage', e);
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
  }, [config]);

  // Keep selectedMember in sync with updated members array
  useEffect(() => {
    if (selectedMember) {
      const fresh = members.find(m => m.id === selectedMember.id);
      if (fresh) {
        setSelectedMember(fresh);
      }
    }
  }, [members]);

  // Handlers
  const handleUpdateMember = (updated: Member) => {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    setSelectedMember(updated);
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    if (selectedMember?.id === memberId) {
      setSelectedMember(null);
    }
  };

  const handleAddMember = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev]);
  };

  // Quick Action: +12 Hours
  const handleQuickAddHours = (memberId: string, hours = 12) => {
    const today = new Date();
    const dayStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const monthKey = 'out/26';

    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;

      const newShift: ShiftRecord = {
        id: `s-${Date.now()}`,
        date: dayStr,
        monthKey,
        hours,
        type: 'plantao',
        description: 'Plantão de escala (+12h)',
      };

      return {
        ...m,
        shifts: [newShift, ...m.shifts],
        accumulatedHours: m.accumulatedHours + hours,
        hoursUpdated: true,
      };
    }));
  };

  // Quick Action: + Falta Justificada (FJ)
  const handleQuickAddFJ = (memberId: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const newAbsence = {
        id: `ab-fj-${Date.now()}`,
        date: today,
        monthKey: 'out/26',
        type: 'justificada' as const,
        reason: 'Falta justificada com atestado/comprovante',
        hasMedicalCertificate: true,
        requiresReplacement: false,
      };
      return {
        ...m,
        justifiedAbsences: [newAbsence, ...m.justifiedAbsences],
      };
    }));
  };

  // Quick Action: + Falta Não Justificada (FNJ) & gera reposição
  const handleQuickAddFNJ = (memberId: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const absenceId = `ab-fnj-${Date.now()}`;
      const newAbsence = {
        id: absenceId,
        date: today,
        monthKey: 'out/26',
        type: 'injustificada' as const,
        reason: 'Falta não justificada em escala',
        requiresReplacement: true,
      };
      const newRep = {
        id: `rep-${Date.now()}`,
        memberId: m.id,
        absenceId,
        scheduledDate: 'A definir',
        scheduledHours: 12,
        completed: false,
        notes: `Referente à falta não justificada de ${today}`,
      };
      return {
        ...m,
        unjustifiedAbsences: [newAbsence, ...m.unjustifiedAbsences],
        replacements: [newRep, ...m.replacements],
      };
    }));
  };

  // Quick Action: + Advertência (ADV)
  const handleQuickAddADV = (memberId: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const newWarn = {
        id: `w-${Date.now()}`,
        date: today,
        reason: 'Advertência por falta não justificada no plantão de 04/10 (out/26)',
        severity: 'moderada' as const,
        active: true,
      };
      return {
        ...m,
        warnings: [newWarn, ...m.warnings],
      };
    }));
  };

  const handleAddShiftsToMembers = (memberIds: string[], shiftData: ShiftBatchSubmission) => {
    setMembers(prev => prev.map(m => {
      if (!memberIds.includes(m.id)) return m;

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
        return {
          ...m,
          shifts: [baseShift, ...m.shifts],
          accumulatedHours: m.accumulatedHours + shiftData.hours,
          hoursUpdated: true,
        };
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
        // Falta Justificada: NÃO gera advertência, mas GERA reposição obrigatória
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

        return {
          ...m,
          shifts: [baseShift, ...m.shifts],
          justifiedAbsences: [newAbsence, ...m.justifiedAbsences],
          replacements: updatedReplacements,
        };
      }

      // Falta Não Justificada: GERA 1 ADVERTÊNCIA e GERA reposição obrigatória
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

      return {
        ...m,
        shifts: [baseShift, ...m.shifts],
        warnings: [newWarning, ...m.warnings],
        unjustifiedAbsences: [newAbsence, ...m.unjustifiedAbsences],
        replacements: updatedReplacements,
      };
    }));
  };

  const handleImportMembers = (importedList: Partial<Member>[]) => {
    setMembers(prev => {
      const currentMap = new Map(prev.map(m => [m.name.toLowerCase().trim(), m]));
      importedList.forEach(imp => {
        if (!imp.name) return;
        const key = imp.name.toLowerCase().trim();
        const role = normalizeRole(imp.role as string || 'Ligante');
        if (currentMap.has(key)) {
          const existing = currentMap.get(key)!;
          currentMap.set(key, {
            ...existing,
            ...imp,
            role,
            id: existing.id,
            shifts: [...existing.shifts, ...(imp.shifts || [])],
            warnings: [...existing.warnings, ...(imp.warnings || [])],
            replacements: [...existing.replacements, ...(imp.replacements || [])],
          } as Member);
        } else {
          currentMap.set(key, {
            id: imp.id || `m-imp-${Date.now()}-${Math.random()}`,
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
          } as Member);
        }
      });
      return Array.from(currentMap.values());
    });
  };

  const handleResetOriginalData = () => {
    setMembers(INITIAL_MEMBERS);
    setConfig(DEFAULT_LEAGUE_CONFIG);
    localStorage.removeItem(STORAGE_MEMBERS_KEY);
    localStorage.removeItem(STORAGE_CONFIG_KEY);
    localStorage.removeItem('lthac_members_v1');
    localStorage.removeItem('lthac_config_v1');
  };

  const stats = calculateLeagueStats(members, config);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header with Navigation & Quick Actions */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        config={config}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAddMember={() => setIsAddMemberOpen(true)}
        onOpenAddShift={() => setIsAddShiftOpen(true)}
        onOpenSpreadsheet={() => setIsSpreadsheetOpen(true)}
        activeMembersCount={stats.activeMembers}
        eligibleCertificatesCount={stats.eligibleCount}
        pendingReplacementsCount={stats.totalPendingReplacements}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            members={members}
            config={config}
            onSelectMember={setSelectedMember}
            onNavigateTab={setCurrentTab}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
            onOpenAddShift={() => setIsAddShiftOpen(true)}
          />
        )}

        {currentTab === 'members' && (
          <MembersView
            members={members}
            config={config}
            onSelectMember={setSelectedMember}
            onOpenAddMember={() => setIsAddMemberOpen(true)}
            onOpenCertificateModal={setCertificateMember}
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
            onUpdateConfig={setConfig}
            onOpenCertificateModal={setCertificateMember}
            onSelectMember={setSelectedMember}
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

      {certificateMember && (
        <CertificateModal
          member={certificateMember}
          config={config}
          onClose={() => setCertificateMember(null)}
        />
      )}

      {isAddMemberOpen && (
        <AddMemberModal
          onClose={() => setIsAddMemberOpen(false)}
          onAddMember={handleAddMember}
        />
      )}

      {isAddShiftOpen && (
        <AddShiftModal
          members={members}
          onClose={() => setIsAddShiftOpen(false)}
          onAddShiftsToMembers={handleAddShiftsToMembers}
        />
      )}

      {isSettingsOpen && (
        <LeagueSettingsModal
          config={config}
          onClose={() => setIsSettingsOpen(false)}
          onSaveConfig={setConfig}
          onResetToDefaults={() => {
            setConfig(DEFAULT_LEAGUE_CONFIG);
          }}
        />
      )}

      {isSpreadsheetOpen && (
        <SpreadsheetModal
          members={members}
          onClose={() => setIsSpreadsheetOpen(false)}
          onImportMembers={handleImportMembers}
          onResetOriginalData={handleResetOriginalData}
        />
      )}
    </div>
  );
}
