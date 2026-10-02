import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  Search, 
  Scale,
  Calendar,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Member, WarningRecord } from '../types/league';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [date, setDate] = useState('02/10/2026');
  const [severity, setSeverity] = useState<'leve' | 'moderada' | 'grave'>('moderada');
  const [reason, setReason] = useState('');

  // Collect all warnings
  const allWarnings = members.flatMap(member => 
    member.warnings.map(w => ({
      ...w,
      member,
    }))
  );

  const activeWarningsCount = allWarnings.filter(w => w.active).length;

  const filteredWarnings = allWarnings.filter(w => 
    w.member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle active/archived
  const handleToggleWarning = (memberId: string, warningId: string) => {
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
  const handleDeleteWarning = (memberId: string, warningId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const updated = member.warnings.filter(w => w.id !== warningId);

    onUpdateMember({
      ...member,
      warnings: updated,
    });
  };

  // Add warning
  const handleAddWarning = (e: React.FormEvent) => {
    e.preventDefault();
    const member = members.find(m => m.id === selectedMemberId);
    if (!member || !reason.trim()) return;

    const newWarn: WarningRecord = {
      id: `w-${Date.now()}`,
      date,
      reason,
      severity,
      active: true,
    };

    onUpdateMember({
      ...member,
      warnings: [...member.warnings, newWarn],
    });

    setIsAddModalOpen(false);
    setReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Conselho Disciplinar & Advertências (ADV)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Registro formal de advertências por descumprimento de escalas, atrasos ou faltas não justificadas.
              Advertências ativas bloqueiam a emissão do certificado de conclusão.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Lançar Advertência Formal
          </button>
        </div>

        {/* Severity Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-800">
            <span className="font-semibold text-white block">1. Advertência Leve</span>
            <span className="text-slate-400 text-[11px]">Atrasos reiterados em reuniões ou plantões</span>
          </div>

          <div className="p-2.5 bg-amber-950/20 rounded-lg border border-amber-900/30">
            <span className="font-semibold text-amber-300 block">2. Advertência Moderada</span>
            <span className="text-slate-400 text-[11px]">Falta não comunicada em escala regular</span>
          </div>

          <div className="p-2.5 bg-rose-950/20 rounded-lg border border-rose-900/30">
            <span className="font-semibold text-rose-300 block">3. Advertência Grave</span>
            <span className="text-slate-400 text-[11px]">Abandono de plantão de emergência / Suspensão</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="font-bold text-white">{activeWarningsCount}</span>
          <span>advertência(s) ativa(s) na liga</span>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ligante ou motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Warnings List */}
      <div className="space-y-3">
        {filteredWarnings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Nenhuma advertência encontrada.
          </div>
        ) : (
          filteredWarnings.map(w => (
            <div
              key={w.id}
              className={`bg-slate-900 border rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                w.active
                  ? 'border-rose-800/40 bg-gradient-to-r from-slate-900 to-rose-950/10'
                  : 'border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div 
                  onClick={() => onSelectMember(w.member)}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm cursor-pointer hover:border-emerald-500 transition-colors shrink-0"
                >
                  {w.member.name.charAt(0)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 
                      onClick={() => onSelectMember(w.member)}
                      className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors cursor-pointer truncate"
                    >
                      {w.member.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {w.member.role}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      w.severity === 'grave'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : w.severity === 'moderada'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {w.severity}
                    </span>
                    {w.active ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold">
                        Ativa
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                        Arquivada
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mt-1">
                    {w.reason}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Data: {w.date}
                    </span>
                    <span>•</span>
                    <span>Total no histórico do ligante: {w.member.warnings.length}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => handleToggleWarning(w.member.id, w.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    w.active
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      : 'bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
                  }`}
                >
                  {w.active ? 'Arquivar / Anular' : 'Reativar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteWarning(w.member.id, w.id)}
                  className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Remover advertência permanentemente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Warning Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Lançar Advertência Disciplinar
            </h3>

            <form onSubmit={handleAddWarning} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 uppercase font-semibold">Selecione o Ligante</label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Data da Ocorrência</label>
                <input
                  type="text"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Gravidade da Falta</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="grave">Grave</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase font-semibold">Motivo Formal / Ocorrência</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Descreva a infração regimental e consequências..."
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg cursor-pointer"
                >
                  Registrar Advertência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
