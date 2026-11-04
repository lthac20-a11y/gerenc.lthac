import React, { useState, useMemo } from 'react';
import { 
  X, 
  Clock, 
  AlertTriangle, 
  Pencil, 
  FileText,
  User,
  Trash2,
  CheckCircle2,
  UserMinus,
  RotateCcw,
  Award,
  CreditCard,
  XCircle
} from 'lucide-react';
import { Member, LeagueConfig, ShiftRecord, RoleInLeague, MemberStatus } from '../types/league';
import { 
  calculateActiveTime, 
  parseDateToShiftParts,
  updateOrAddMemberShift,
  deleteMemberShift,
  isMemberEligibleForCertificate
} from '../utils/leagueCalculations';
import { ShiftModal } from './ShiftModal';
import { 
  getCurrentYear, 
  parseMonthKey, 
  formatFullMonthYear 
} from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

export interface MemberDetailModalProps {
  member: Member;
  config: LeagueConfig;
  onClose: () => void;
  onOpenCertificateModal?: (member: Member) => void;
  onUpdateMember?: (updated: Member) => void;
  onDeleteMember?: (id: string) => void;
}

function parseShiftDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d).getTime();
    }
  }
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      return new Date(y, m, d).getTime();
    } else if (parts.length === 2) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = getCurrentYear();
      return new Date(y, m, d).getTime();
    }
  }
  return 0;
}

function groupShiftsByMonth(shifts: ShiftRecord[]): Array<{
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  latestTimestamp: number;
  shifts: ShiftRecord[];
}> {
  const groupsMap = new Map<string, { monthLabel: string; totalHours: number; latestTimestamp: number; shifts: ShiftRecord[] }>();

  shifts.forEach(shift => {
    const parts = parseDateToShiftParts(shift.date, shift.monthKey);
    const mKey = parts.monthKey || shift.monthKey || 'out/26';
    const { monthIndex, year } = parseMonthKey(mKey);
    const monthLabel = formatFullMonthYear(monthIndex, year).toUpperCase();
    const ts = parseShiftDateToTimestamp(shift.date);

    if (!groupsMap.has(mKey)) {
      groupsMap.set(mKey, {
        monthLabel,
        totalHours: 0,
        latestTimestamp: ts,
        shifts: []
      });
    }

    const group = groupsMap.get(mKey)!;
    group.shifts.push(shift);
    group.totalHours += (shift.hours || 0);
    if (ts > group.latestTimestamp) {
      group.latestTimestamp = ts;
    }
  });

  groupsMap.forEach(group => {
    group.shifts.sort((a, b) => parseShiftDateToTimestamp(b.date) - parseShiftDateToTimestamp(a.date));
  });

  return Array.from(groupsMap.entries()).map(([monthKey, val]) => ({
    monthKey,
    ...val
  })).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  member,
  config,
  onClose,
  onOpenCertificateModal,
  onUpdateMember,
  onDeleteMember,
}) => {
  const { isCoordination } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null);

  // Edit member form states
  const [editName, setEditName] = useState(member.name);
  const [editEntryDate, setEditEntryDate] = useState(member.entryDate);
  const [editHours, setEditHours] = useState(member.accumulatedHours);

  // Active time calculation
  const activeTime = useMemo(() => calculateActiveTime(member.entryDate), [member.entryDate]);
  const tenureDaysPercent = Math.min(100, Math.round((activeTime.totalDays / 365) * 100));
  const isOneYear = activeTime.totalDays >= 365 || activeTime.totalMonths >= 12;

  // Active pending replacements
  const pendingReplacements = useMemo(() => {
    return (member.replacements || []).filter(r => !r.completed);
  }, [member.replacements]);

  // Active warnings count
  const activeWarningsCount = useMemo(() => {
    return (member.warnings || []).filter(w => w.active).length;
  }, [member.warnings]);

  // Grouped shifts
  const groupedShifts = useMemo(() => {
    return groupShiftsByMonth(member.shifts || []);
  }, [member.shifts]);

  const handleSaveMemberProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateMember) return;
    onUpdateMember({
      ...member,
      name: editName,
      entryDate: editEntryDate,
      accumulatedHours: Number(editHours),
    });
    setIsEditingProfile(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        
        {/* 1. CABEÇALHO E IDENTIFICAÇÃO */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 relative shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {isCoordination && onUpdateMember && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Editar cadastro do integrante"
              >
                <Pencil className="w-4 h-4 text-emerald-400" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 pr-20 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-teal-500/20 shrink-0 font-display">
              {member.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight break-words font-display">
                {member.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 font-mono">
                  Admissão: {member.entryDate}
                </span>
              </div>
            </div>
          </div>

          {/* 2. BARRAS DE PROGRESSO DE HORAS E TEMPO */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
            {/* Progresso de Horas */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-slate-400">Progresso de Horas ({config.minHoursForCertificate}h):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {member.accumulatedHours}h / {config.minHoursForCertificate}h ({Math.min(100, Math.round((member.accumulatedHours / config.minHoursForCertificate) * 100))}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (member.accumulatedHours / config.minHoursForCertificate) * 100)}%` }}
                />
              </div>
            </div>

            {/* Tempo de Admissão */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-slate-400">Tempo de Admissão (1 ano):</span>
                <span className="font-mono font-bold text-blue-400">
                  {isOneYear ? '1 ano completo ✓' : `${activeTime.formatted} (${tenureDaysPercent}%)`}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                <div 
                  className="h-full rounded-full transition-all duration-300 bg-blue-500"
                  style={{ width: `${tenureDaysPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. CORPO DO MODAL (SCROLLABLE) */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-4 text-xs text-slate-300">
          
          {/* GRID DE INDICADORES PADRONIZADO EM 4 CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Horas</span>
              <span className="text-sm font-bold text-white font-mono">{member.accumulatedHours}h</span>
            </div>

            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Plantões</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">{(member.shifts || []).length}</span>
            </div>

            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Faltas</span>
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold mt-0.5">
                <span className="text-blue-400">{(member.justifiedAbsences || []).length} FJ</span>
                <span className="text-slate-600">|</span>
                <span className={(member.unjustifiedAbsences || []).length > 0 ? 'text-rose-400' : 'text-slate-400'}>
                  {(member.unjustifiedAbsences || []).length} FNJ
                </span>
              </div>
            </div>

            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">Advertências</span>
              <span className={`text-sm font-bold font-mono block mt-0.5 ${
                activeWarningsCount > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {activeWarningsCount} ADV
              </span>
            </div>
          </div>

          {/* CONTROLES DE SAÍDA / ENCERRAMENTO (Exibido para integrantes em Baixa) */}
          {Boolean(member.isBaixa || member.status === 'baixa') && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 my-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <UserMinus className="w-3.5 h-3.5" />
                  Controles de Encerramento de Ciclo
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Baixa Registrada</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                {/* 1. Aptidão */}
                <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold mb-1 truncate w-full">Aptidão</span>
                  {isMemberEligibleForCertificate(member, config.minHoursForCertificate || 150) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Apto ✓</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>Inapto</span>
                    </span>
                  )}
                </div>

                {/* 2. Controle de Certificado */}
                <button
                  type="button"
                  disabled={!isCoordination || !onUpdateMember}
                  onClick={() => {
                    if (onUpdateMember) {
                      onUpdateMember({
                        ...member,
                        certificateEmitted: !member.certificateEmitted,
                      });
                    }
                  }}
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center transition-all cursor-pointer active:scale-95 ${
                    member.certificateEmitted
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                >
                  <span className="text-[10px] text-slate-400 uppercase font-semibold mb-1 truncate w-full">Certificado</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                    <Award className="w-3 h-3 shrink-0" />
                    <span className="truncate">{member.certificateEmitted ? 'Emitido ✓' : 'Pendente'}</span>
                  </span>
                </button>

                {/* 3. Devolução de Crachá */}
                <button
                  type="button"
                  disabled={!isCoordination || !onUpdateMember}
                  onClick={() => {
                    if (onUpdateMember) {
                      const nextCollected = !member.badgeCollected;
                      onUpdateMember({
                        ...member,
                        badgeCollected: nextCollected,
                        badgeCollectedDate: nextCollected ? new Date().toISOString().split('T')[0] : undefined,
                      });
                    }
                  }}
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center transition-all cursor-pointer active:scale-95 ${
                    member.badgeCollected
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  } ${!isCoordination ? 'cursor-default opacity-80' : ''}`}
                >
                  <span className="text-[10px] text-slate-400 uppercase font-semibold mb-1 truncate w-full">Crachá</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                    <CreditCard className="w-3 h-3 shrink-0" />
                    <span className="truncate">{member.badgeCollected ? 'Devolvido ✓' : 'Pendente'}</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 4. SEÇÃO DE REPOSIÇÕES PENDENTES (BANNER AMARELO DE ALERTA) */}
          {pendingReplacements.length > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-1 text-xs text-amber-200 mt-4 mb-5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Reposições Pendentes ({pendingReplacements.length})</span>
              </div>
              {pendingReplacements.map(rep => (
                <p key={rep.id} className="text-[11px] text-slate-300 pl-5">
                  • Origem: {rep.missedShiftDate || 'Escala'} — Prazo: <strong>{rep.deadlineDescription || 'Mês seguinte'}</strong>
                </p>
              ))}
            </div>
          )}

          {/* 5. HISTÓRICO DE PLANTÕES AGRUPADO POR MÊS */}
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Histórico de Plantões ({(member.shifts || []).length})
              </h4>
            </div>

            {(member.shifts || []).length === 0 ? (
              <p className="text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-lg text-xs">
                Nenhum plantão individual registrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto pr-1">
                {groupedShifts.map(group => (
                  <div key={group.monthKey} className="space-y-1">
                    {/* Linha Divisória Horizontal Sutil com Mês e Subtotal */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 before:flex-1 before:border-t before:border-slate-800 after:flex-1 after:border-t after:border-slate-800 my-2">
                      <span className="font-mono font-semibold tracking-wider text-slate-300">
                        {group.monthLabel} • {group.totalHours}h ({group.shifts.length} {group.shifts.length === 1 ? 'plantão' : 'plantões'})
                      </span>
                    </div>

                    {/* Plantões em Linha Única Super Compacta */}
                    {group.shifts.map(shift => {
                      const parts = parseDateToShiftParts(shift.date, shift.monthKey);
                      const isAbsence = shift.shiftStatus === 'falta_injustificada' || 
                                        shift.shiftStatus === 'falta_justificada' || 
                                        shift.description?.toLowerCase().includes('falta') ||
                                        shift.hours === 0;

                      const { monthIndex, year } = parseMonthKey(shift.monthKey || parts.monthKey || group.monthKey);
                      const scaleMonthLabel = formatFullMonthYear(monthIndex, year);
                      const displayDate = isAbsence ? scaleMonthLabel : (parts.dayMonth || shift.date);

                      const statusLabel = shift.shiftStatus === 'falta_injustificada' 
                        ? 'Falta Não Just.' 
                        : shift.shiftStatus === 'falta_justificada' 
                        ? 'Falta Justificada' 
                        : 'Concluído';
                      const statusStyle = shift.shiftStatus === 'falta_injustificada'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : shift.shiftStatus === 'falta_justificada'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                      const typeLabel = isAbsence ? 'Escala' : (shift.type === 'reposicao' ? 'Reposição' : 'Plantão');

                      return (
                        <div 
                          key={shift.id}
                          className="py-1.5 px-2.5 bg-slate-800/40 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-bold font-mono text-xs shrink-0 ${isAbsence ? 'text-amber-300/90' : 'text-white'}`}>{displayDate}</span>
                            <span className="text-slate-400 text-xs truncate max-w-[140px] sm:max-w-[180px]">{typeLabel}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusStyle}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`font-mono font-bold text-xs ${shift.hours > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {shift.hours > 0 ? `${shift.hours}h` : '0h'}
                            </span>
                            {isCoordination && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingShift(shift);
                                }}
                                className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
                                title="Editar registro"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ DO MODAL COM BOTÃO "FECHAR" E "DAR BAIXA / REATIVAR" */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Fechar</span>
          </button>

          {isCoordination && onUpdateMember && (
            Boolean(member.isBaixa || member.status === 'baixa') ? (
              <button
                type="button"
                onClick={() => {
                  const updated: Member = {
                    ...member,
                    isBaixa: false,
                    status: 'ativo',
                  };
                  onUpdateMember(updated);
                }}
                className="py-2 px-3.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Reativar integrante na liga (retorna para a lista de Membros Ativos com todo o histórico intacto)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reativar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const updated: Member = {
                    ...member,
                    isBaixa: true,
                    status: 'baixa',
                  };
                  onUpdateMember(updated);
                }}
                className="py-2 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Dar baixa no integrante (inativação reversível sem perda de histórico)"
              >
                <UserMinus className="w-3.5 h-3.5 text-rose-400" />
                <span>Dar Baixa</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Submodal de Edição do Cadastro (Coordenação) */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Editar Cadastro do Integrante</h3>
                  <p className="text-[11px] text-slate-400">Atualizar dados básicos cadastrais</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberProfile} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Data de Admissão</label>
                  <input
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={editEntryDate}
                    onChange={e => setEditEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Carga Horária (h)</label>
                  <input
                    type="number"
                    min={0}
                    value={editHours}
                    onChange={e => setEditHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                {onDeleteMember && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Tem certeza que deseja excluir o integrante "${member.name}"?`)) {
                        onDeleteMember(member.id);
                        setIsEditingProfile(false);
                        onClose();
                      }
                    }}
                    className="px-2.5 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Salvar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submodal de Edição de Plantão/Falta/Reposição */}
      {editingShift && (
        <ShiftModal
          isOpen={Boolean(editingShift)}
          member={member}
          editingShift={editingShift}
          onClose={() => setEditingShift(null)}
          onSave={(shiftData, isEditing) => {
            if (!onUpdateMember) return;
            const updated = updateOrAddMemberShift(member, shiftData, isEditing ? shiftData.id : undefined);
            onUpdateMember(updated);
            setEditingShift(null);
          }}
          onDelete={(shiftId) => {
            if (!onUpdateMember) return;
            const updated = deleteMemberShift(member, shiftId);
            onUpdateMember(updated);
            setEditingShift(null);
          }}
        />
      )}
    </div>
  );
};

export const MemberFichaModal = MemberDetailModal;
