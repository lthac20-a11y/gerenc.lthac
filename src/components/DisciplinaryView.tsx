import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Calendar, 
  Trash2, 
  Pencil, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle,
  User
} from 'lucide-react';
import { Member, WarningRecord } from '../types/league';
import { useAuth } from '../context/AuthContext';
import { QuickWarningModal } from './CoordinationModals';

interface DisciplinaryViewProps {
  members: Member[];
  onUpdateMember: (updated: Member) => void;
  onSelectMember: (member: Member) => void;
}

export const DisciplinaryView: React.FC<DisciplinaryViewProps> = ({
  members,
  onUpdateMember,
  onSelectMember,
}) => {
  const { isCoordination } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  // All accordion items closed by default on load
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(() => new Set<string>());

  const [editingWarning, setEditingWarning] = useState<{ memberId: string; warning: WarningRecord } | null>(null);

  // Toggle Accordion Expansion
  const toggleMemberExpand = (memberId: string) => {
    setExpandedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  // Expand all / Collapse all
  const expandAll = () => {
    const allIds = members.filter(m => m.warnings.length > 0).map(m => m.id);
    setExpandedMemberIds(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedMemberIds(new Set());
  };

  // Toggle warning active status (Arquivar / Reativar)
  const handleToggleWarning = (e: React.MouseEvent, memberId: string, warningId: string) => {
    e.stopPropagation();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const updated = member.warnings.map(w => 
      w.id === warningId ? { ...w, active: !w.active } : w
    );

    onUpdateMember({
      ...member,
      warnings: updated,
    });
  };

  // Delete warning permanently
  const handleDeleteWarning = (e: React.MouseEvent, memberId: string, warningId: string) => {
    e.stopPropagation();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const updated = member.warnings.filter(w => w.id !== warningId);

    onUpdateMember({
      ...member,
      warnings: updated,
    });
  };

  // Members with warnings filtered by search
  const membersWithWarnings = useMemo(() => {
    return members
      .filter(m => m.warnings && m.warnings.length > 0)
      .filter(m => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(term);
        const matchesRole = m.role.toLowerCase().includes(term);
        const matchesReason = m.warnings.some(w => w.reason.toLowerCase().includes(term));
        return matchesName || matchesRole || matchesReason;
      })
      .sort((a, b) => {
        // Sort by active warnings desc, then total warnings desc, then name
        const aActive = a.warnings.filter(w => w.active).length;
        const bActive = b.warnings.filter(w => w.active).length;
        if (bActive !== aActive) return bActive - aActive;
        if (b.warnings.length !== a.warnings.length) return b.warnings.length - a.warnings.length;
        return a.name.localeCompare(b.name);
      });
  }, [members, searchTerm]);

  // Overall statistics
  const totalActiveWarnings = useMemo(() => {
    return members.reduce((acc, m) => acc + m.warnings.filter(w => w.active).length, 0);
  }, [members]);

  const membersAtLimitCount = useMemo(() => {
    return members.filter(m => m.warnings.filter(w => w.active).length >= 3).length;
  }, [members]);

  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & METRICS BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 font-display">
                  Conselho Disciplinar & Advertências (ADV)
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {totalActiveWarnings} ativas
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Acompanhamento consolidado por integrante e controle regimental de advertências disciplinares
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Tag */}
          {membersAtLimitCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 font-semibold self-start md:self-center">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{membersAtLimitCount} integrante(s) no limite de 3 ADVs</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. SEARCH BAR & ACCORDION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do ligante ou motivo da falta..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Recolher todos
          </button>
        </div>
      </div>

      {/* 3. GROUPED LIST BY MEMBER (ACCORDION) */}
      <div className="space-y-3 pb-16">
        {membersWithWarnings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Nenhuma advertência encontrada</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchTerm 
                ? 'Nenhum integrante corresponde aos termos da busca digitada.'
                : 'Todos os ligantes da LTHAC estão com a ficha disciplinar regularizada!'}
            </p>
          </div>
        ) : (
          membersWithWarnings.map(member => {
            const isExpanded = expandedMemberIds.has(member.id);
            const activeWarnings = member.warnings.filter(w => w.active);
            const activeCount = activeWarnings.length;
            const totalCount = member.warnings.length;
            const isAtLimit = activeCount >= 3;

            return (
              <div
                key={member.id}
                className={`bg-slate-900 border rounded-2xl transition-all overflow-hidden ${
                  isAtLimit
                    ? 'border-rose-500/50 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20 shadow-md shadow-rose-950/20'
                    : activeCount > 0
                    ? 'border-slate-800 hover:border-slate-700/80'
                    : 'border-slate-800/80 opacity-75'
                }`}
              >
                {/* Accordion Header / Trigger */}
                <div
                  onClick={() => toggleMemberExpand(member.id)}
                  className="p-4 sm:p-4.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Member Avatar */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember(member);
                      }}
                      title="Abrir prontuário completo"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-all ${
                        isAtLimit
                          ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                          : member.role === 'Coordenação'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                          : 'bg-slate-800 border-slate-700 text-white hover:border-emerald-500'
                      }`}
                    >
                      {member.name.charAt(0)}
                    </div>

                    {/* Member Name and Role */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember(member);
                          }}
                          className="font-bold text-white hover:text-emerald-400 transition-colors text-sm sm:text-base truncate cursor-pointer"
                        >
                          {member.name}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                          member.role === 'Coordenação'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Admissão: <span className="font-mono text-slate-300">{member.entryDate}</span> · <span className="font-mono">{member.accumulatedHours}h</span> acumuladas
                      </p>
                    </div>
                  </div>

                  {/* Right: Counter Badges + Limit Alert + Chevron */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Subtle Alert Badge for 3 Warnings */}
                    {isAtLimit && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="hidden sm:inline">⚠️ Limite Atingido (3 ADVs)</span>
                        <span className="sm:hidden">⚠️ 3 ADVs</span>
                      </span>
                    )}

                    {/* Total Active Warnings Count Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border font-mono tabular-nums ${
                      activeCount > 0
                        ? isAtLimit
                          ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                          : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {activeCount} {activeCount === 1 ? 'Advertência Ativa' : 'Advertências Ativas'}
                      {totalCount > activeCount && (
                        <span className="text-slate-400 font-normal ml-1">
                          ({totalCount - activeCount} arquivada{totalCount - activeCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </span>

                    {/* Chevron Expand Indicator */}
                    <div className="p-1 text-slate-400 hover:text-white rounded-lg transition-transform">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Accordion Body: Compact Warning Records List */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/60 p-4 space-y-2.5 transition-all">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Histórico Detalhado ({totalCount} ocorrência{totalCount > 1 ? 's' : ''})</span>
                      <button
                        type="button"
                        onClick={() => onSelectMember(member)}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline capitalize text-xs cursor-pointer font-medium"
                      >
                        Abrir prontuário completo →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {member.warnings.map((w, idx) => (
                        <div
                          key={w.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                            w.active
                              ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                              : 'bg-slate-900/40 border-slate-800/50 opacity-60'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-300">
                                #{idx + 1}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {w.date}
                              </span>
                              {w.active ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  Ativa
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                  Arquivada / Anulada
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-200 leading-relaxed font-medium">
                              {w.reason}
                            </p>
                          </div>

                          {/* Quick Actions (Coordination Only) */}
                          {isCoordination && (
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingWarning({ memberId: member.id, warning: w });
                                }}
                                className="px-2.5 py-1 text-xs text-slate-300 hover:text-emerald-300 bg-slate-800 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Editar texto da advertência"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleToggleWarning(e, member.id, w.id)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                  w.active
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                    : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
                                }`}
                              >
                                {w.active ? 'Arquivar' : 'Reativar'}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDeleteWarning(e, member.id, w.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                title="Excluir advertência"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Warning Modal */}
      {editingWarning && (
        <QuickWarningModal
          members={members}
          editingWarning={editingWarning}
          onClose={() => setEditingWarning(null)}
          onUpdateMember={onUpdateMember}
        />
      )}
    </div>
  );
};
