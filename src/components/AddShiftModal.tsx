import React, { useState } from 'react';
import { X, Calendar, Plus, Check, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Member, MONTH_COLUMNS } from '../types/league';
import { calculateReplacementDeadline } from '../utils/leagueCalculations';

export type ShiftSubmissionStatus = 'concluido' | 'falta_justificada' | 'falta_injustificada';

export interface ShiftBatchSubmission {
  date: string;
  monthKey: string;
  hours: number;
  type: 'plantao';
  shiftStatus: ShiftSubmissionStatus;
  description?: string;
}

interface AddShiftModalProps {
  members: Member[];
  onClose: () => void;
  onAddShiftsToMembers: (memberIds: string[], shiftData: ShiftBatchSubmission) => void;
}

export const AddShiftModal: React.FC<AddShiftModalProps> = ({
  members,
  onClose,
  onAddShiftsToMembers,
}) => {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [date, setDate] = useState('02/10');
  const [monthKey, setMonthKey] = useState('out/26');
  const [hours, setHours] = useState(12);
  const [shiftStatus, setShiftStatus] = useState<ShiftSubmissionStatus>('concluido');

  const toggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(mId => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const selectAll = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map(m => m.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) {
      alert('Selecione pelo menos um ligante para a escala.');
      return;
    }

    let description = 'Plantão Concluído';
    if (shiftStatus === 'falta_justificada') {
      description = 'Falta Justificada (Requer reposição regimental)';
    } else if (shiftStatus === 'falta_injustificada') {
      description = 'Falta Não Justificada (Gerou 1 ADV e Requer reposição)';
    }

    onAddShiftsToMembers(selectedMemberIds, {
      date,
      monthKey,
      hours: Number(hours),
      type: 'plantao',
      shiftStatus,
      description,
    });

    onClose();
  };

  const sampleDeadline = calculateReplacementDeadline(monthKey, 1);
  const sampleDeadlineTwo = calculateReplacementDeadline(monthKey, 2);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative space-y-4 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Lançar Plantão na Escala</h3>
            <p className="text-xs text-slate-400">Atribua plantões, faltas justificadas ou faltas não justificadas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px] mb-1">Data (Dia/Mês) *</label>
              <input
                type="text"
                required
                placeholder="Ex: 22/03"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px] mb-1">Mês da Escala *</label>
              <select
                value={monthKey}
                onChange={e => setMonthKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
              >
                {MONTH_COLUMNS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px] mb-1">Carga Horária *</label>
              <select
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
              >
                <option value={12}>12 horas (Padrão)</option>
                <option value={6}>6 horas</option>
                <option value={4}>4 horas (Aula/Reunião)</option>
                <option value={24}>24 horas (Duplo)</option>
              </select>
            </div>
          </div>

          {/* STATUS DO PLANTÃO (SUBSTITUI DESCRIÇÃO/SETOR POR LISTA SUSPENSA EXPANDIDA) */}
          <div>
            <label className="text-slate-200 font-semibold block uppercase text-[10px] mb-1.5 flex items-center justify-between">
              <span>Status do Plantão *</span>
              <span className="text-[10px] text-slate-400 font-normal normal-case">
                Selecione o resultado da escala
              </span>
            </label>
            
            <select
              value={shiftStatus}
              onChange={e => setShiftStatus(e.target.value as ShiftSubmissionStatus)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="concluido">Plantão Concluído</option>
              <option value="falta_justificada">Falta Justificada</option>
              <option value="falta_injustificada">Falta Não Justificada</option>
            </select>
          </div>

          {/* EXPLANATORY GUIDANCE BOX ACCORDING TO REGIMENTAL RULES */}
          <div className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
            shiftStatus === 'concluido'
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
              : shiftStatus === 'falta_justificada'
              ? 'bg-blue-950/30 border-blue-800/40 text-blue-200'
              : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
          }`}>
            {shiftStatus === 'concluido' && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Plantão Concluído:</strong> Presença confirmada. Soma automaticamente <strong>+{hours} horas</strong> para cada membro selecionado.
                </div>
              </div>
            )}

            {shiftStatus === 'falta_justificada' && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Falta Justificada:</strong> <u>Não gera advertência</u> disciplinar.
                  </div>
                </div>
                <div className="text-[11px] text-slate-300 pl-6 space-y-1">
                  <p>
                    • <strong>Obrigatoriedade de Reposição:</strong> Em ambos os casos os plantões devem ser repostos.
                  </p>
                  <p>
                    • <strong>Prazos Regimentais:</strong> 1 plantão faltado deve ser reposto no <strong>mês seguinte ({sampleDeadline})</strong>. 2 plantões faltados podem ser repostos nos <strong>dois próximos meses seguintes ({sampleDeadlineTwo})</strong>.
                  </p>
                  <p className="text-amber-300 font-semibold">
                    • <strong>Penalidade:</strong> A não reposição do plantão dentro do prazo acarreta em mais uma advertência disciplinar.
                  </p>
                </div>
              </div>
            )}

            {shiftStatus === 'falta_injustificada' && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Falta Não Justificada:</strong> <u>Gera automaticamente 1 ADVERTÊNCIA</u> disciplinar no prontuário.
                  </div>
                </div>
                <div className="text-[11px] text-slate-300 pl-6 space-y-1">
                  <p>
                    • <strong>Obrigatoriedade de Reposição:</strong> Em ambos os casos os plantões devem ser repostos.
                  </p>
                  <p>
                    • <strong>Prazos Regimentais:</strong> 1 plantão faltado deve ser reposto no <strong>mês seguinte ({sampleDeadline})</strong>. 2 plantões faltados podem ser repostos nos <strong>dois próximos meses seguintes ({sampleDeadlineTwo})</strong>.
                  </p>
                  <p className="text-amber-300 font-semibold">
                    • <strong>Penalidade:</strong> A não reposição do plantão dentro do prazo acarreta em mais uma advertência disciplinar.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Member Selection List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold uppercase text-[10px]">
                Selecione os Ligantes ({selectedMemberIds.length} selecionados)
              </label>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {selectedMemberIds.length === members.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto border border-slate-700/80 rounded-xl p-2 bg-slate-800/50 space-y-1">
              {members.map(member => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-950/40 border border-emerald-700/50 text-white' : 'hover:bg-slate-700/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <span className="font-medium text-xs">{member.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {member.accumulatedHours}h atuais
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={selectedMemberIds.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow cursor-pointer transition-colors"
            >
              {shiftStatus === 'concluido'
                ? `Confirmar Plantão Concluído (+${hours}h)`
                : shiftStatus === 'falta_justificada'
                ? `Registrar Falta Justificada (Reposição)`
                : `Registrar Falta Não Justificada (+1 ADV + Reposição)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
