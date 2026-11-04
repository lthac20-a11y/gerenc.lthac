import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Calendar, 
  Trash2, 
  Pencil, 
  ChevronDown, 
  ChevronUp, 
  ChevronsDown,
  ChevronsUp,
  CheckCircle2, 
  AlertTriangle,
  User,
  Archive,
  RotateCcw
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
    <div className="space-y-4 sm:space-y-5 w-full max-w-full">
      {/* 1. TOP HEADER & METRICS BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 font-display">
                  Conselho Disciplinar & Advertências (ADV)
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
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

      {/* Banner de Aviso Regimental: 3 Advertências = Desligamento Automático */}
      <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border border-rose-600/50 rounded-2xl p-3.5 sm:p-4 shadow-lg flex items-start gap-3 sm:gap-3.5 text-xs">
        <div className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-xl shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-extrabold text-rose-300 text-xs sm:text-sm uppercase tracking-wide font-display">
              Aviso Regimental Disciplinar
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/40 font-mono font-bold">
              REGRA DE DESLIGAMENTO
            </span>
          </div>
          <p className="text-slate-200 leading-relaxed text-xs">
            Ao atingir <strong>3 (três) advertências ativas</strong>, o ligante é <strong>automaticamente desligado da liga</strong> e perde a elegibilidade para certificação e atividades acadêmicas.
          </p>
        </div>
      </div>

      {/* 2. SEARCH BAR & ACCORDION CONTROLS (Linha Única Horizontal) */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 sm:p-2.5 rounded-2xl w-full max-w-full shadow-sm">
        {/* Input de Busca: flex-1 min-w-0 h-9 text-xs */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ligante ou motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-9 text-xs pl-8 pr-7 py-1 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500/40"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
            >
              ✕
            </button>
          )}
        </div>

        {/* Botões Compactos à Direita (shrink-0 flex items-center gap-1.5) */}
        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 h-9 text-xs whitespace-nowrap text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
            title="Expandir todas as ocorrências"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Expandir</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 h-9 text-xs whitespace-nowrap text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
            title="Recolher todas as ocorrências"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Recolher</span>
          </button>
        </div>
      </div>

      {/* 3. GROUPED LIST BY MEMBER (ACCORDION) */}
      <div className="space-y-2 pb-16">
        {membersWithWarnings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Nenhuma advertência encontrada</h3>
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
                className={`bg-slate-900 border rounded-xl transition-all overflow-hidden ${
                  isAtLimit
                    ? 'border-rose-500/50 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20 shadow-md shadow-rose-950/20'
                    : activeCount > 0
                    ? 'border-slate-800 hover:border-slate-700/80'
                    : 'border-slate-800/80 opacity-75'
                }`}
              >
                {/* Accordion Header / Trigger - Single Line Compact Layout */}
                <div
                  onClick={() => toggleMemberExpand(member.id)}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors select-none flex-nowrap"
                >
                  {/* Bloco Esquerdo: Avatar + Nome + Metadados */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember(member);
                      }}
                      title="Abrir prontuário completo"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border transition-all ${
                        isAtLimit
                          ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                          : 'bg-slate-800 border-slate-700 text-white hover:border-emerald-500'
                      }`}
                    >
                      {member.name.charAt(0)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMember(member);
                        }}
                        className="text-xs sm:text-sm font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer truncate font-display"
                      >
                        {member.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                        Adm: {member.entryDate} • <strong className="text-white font-normal whitespace-nowrap">{member.accumulatedHours}h</strong>
                      </p>
                    </div>
                  </div>

                  {/* Bloco Direito: Etiqueta de Advertências + Seta */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border font-mono tabular-nums inline-flex items-center gap-1.5 whitespace-nowrap ${
                      activeCount > 0
                        ? isAtLimit
                          ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                          : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span>{activeCount} Adv.</span>
                    </span>

                    {isAtLimit && (
                      <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-xs animate-pulse whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>Limite (3 ADVs)</span>
                      </span>
                    )}

                    <div className="p-1 text-slate-400 hover:text-white rounded-md transition-transform shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Accordion Body: Compact Warning Records List */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3 space-y-2 transition-all">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        OCORRÊNCIAS ({totalCount})
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectMember(member)}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline capitalize text-xs cursor-pointer font-medium shrink-0"
                      >
                        Ver Prontuário →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {member.warnings.map((w, idx) => (
                        <div
                          key={w.id}
                          className={`p-3 rounded-xl border flex flex-col transition-all ${
                            w.active
                              ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                              : 'bg-slate-900/40 border-slate-800/50 opacity-60'
                          }`}
                        >
                          {/* Linha 1 (Topo): Identificador, Data, Badge à esquerda | Botões de ícones à direita */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
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
                                  Arquivada
                                </span>
                              )}
                            </div>

                            {/* Botões de Ação apenas com Ícones (w-7 h-7) para Coordenação */}
                            {isCoordination && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingWarning({ memberId: member.id, warning: w });
                                  }}
                                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-emerald-300 bg-slate-800 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleToggleWarning(e, member.id, w.id)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                    w.active
                                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                      : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                                  }`}
                                  title={w.active ? 'Arquivar' : 'Reativar'}
                                >
                                  {w.active ? (
                                    <Archive className="w-3.5 h-3.5" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteWarning(e, member.id, w.id)}
                                  className="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Linha 2 (Base): Descrição ocupando toda a largura */}
                          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-medium break-words whitespace-normal">
                            {w.reason}
                          </p>
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
