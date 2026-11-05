import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Member, ShiftRecord } from '../types/league';
import { 
  getCurrentYear, 
  parseMonthKey, 
  formatMonthKey, 
  formatShortMonthYear, 
  getMonthColumnsForYear 
} from '../utils/dateUtils';
import { CustomDatePicker } from './CustomDatePicker';
import { ModalPortal } from './ModalPortal';

export interface ShiftModalData {
  id?: string;
  date: string;
  monthKey: string;
  hours: number;
  shiftStatus: 'concluido' | 'falta_justificada' | 'falta_injustificada';
  description?: string;
  type?: 'plantao' | 'reposicao' | 'aula' | 'reuniao' | 'evento' | 'outro';
}

export interface ShiftModalProps {
  isOpen: boolean;
  member: Member;
  editingShift?: ShiftRecord | null;
  initialMonthKey?: string;
  initialDate?: string;
  onClose: () => void;
  onSave: (shiftData: ShiftModalData, isEditing: boolean) => void;
  onDelete?: (shiftId: string) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  member,
  editingShift,
  initialMonthKey,
  initialDate,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditing = Boolean(editingShift);
  const currentYear = getCurrentYear();

  // Normalize initial date
  const computeInitialDate = (): string => {
    if (editingShift?.date) {
      const raw = editingShift.date.trim();
      if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts.length === 2) {
          const yr = editingShift.monthKey ? parseMonthKey(editingShift.monthKey).year : currentYear;
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${yr}`;
        }
        return raw;
      }
      return raw;
    }
    if (initialDate) return initialDate;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${currentYear}`;
  };

  const [shiftStatus, setShiftStatus] = useState<'concluido' | 'falta_justificada' | 'falta_injustificada'>('concluido');
  const [hours, setHours] = useState<number>(12);
  const [date, setDate] = useState<string>(computeInitialDate);
  const [monthKey, setMonthKey] = useState<string>(() => editingShift?.monthKey || initialMonthKey || formatMonthKey(new Date().getMonth(), currentYear));
  const [description, setDescription] = useState<string>('Plantão Pronto Socorro');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  // Sync state whenever modal opens or editingShift changes
  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      return;
    }

    if (editingShift) {
      const rawStatus = editingShift.shiftStatus || (editingShift.hours === 0 ? 'falta_injustificada' : 'concluido');
      setShiftStatus(rawStatus as any);
      setHours(editingShift.hours !== undefined ? editingShift.hours : 12);
      setDate(computeInitialDate());
      setMonthKey(editingShift.monthKey || initialMonthKey || formatMonthKey(new Date().getMonth(), currentYear));
      setDescription(editingShift.description || 'Plantão Pronto Socorro');
    } else {
      setShiftStatus('concluido');
      setHours(12);
      setDate(computeInitialDate());
      setMonthKey(initialMonthKey || formatMonthKey(new Date().getMonth(), currentYear));
      setDescription('Plantão Pronto Socorro');
    }
    setConfirmDelete(false);
  }, [isOpen, editingShift, initialMonthKey]);

  const targetYear = useMemo(() => {
    return parseMonthKey(monthKey).year || currentYear;
  }, [monthKey, currentYear]);

  const availableMonths = useMemo(() => {
    const list = getMonthColumnsForYear(targetYear);
    if (monthKey && !list.includes(monthKey)) {
      return [...list, monthKey].sort((a, b) => {
        const pa = parseMonthKey(a);
        const pb = parseMonthKey(b);
        return pa.year === pb.year ? pa.monthIndex - pb.monthIndex : pa.year - pb.year;
      });
    }
    return list;
  }, [targetYear, monthKey]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Sincronização estrita de Mês da Escala quando data específica estiver preenchida
    let synchronizedMonthKey = monthKey;
    if (shiftStatus === 'concluido') {
      if (date.includes('/')) {
        const parts = date.split('/');
        if (parts.length >= 2) {
          const mNum = parseInt(parts[1].trim(), 10);
          let yNum = targetYear;
          if (parts.length >= 3 && parts[2]) {
            const rawY = parts[2].trim();
            yNum = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
          }
          if (!isNaN(mNum) && !isNaN(yNum)) {
            synchronizedMonthKey = formatMonthKey(Math.max(0, Math.min(11, mNum - 1)), yNum);
          }
        }
      } else if (date.includes('-')) {
        const parts = date.split('-');
        if (parts.length === 3) {
          const yNum = parseInt(parts[0], 10);
          const mNum = parseInt(parts[1], 10);
          if (!isNaN(mNum) && !isNaN(yNum)) {
            synchronizedMonthKey = formatMonthKey(Math.max(0, Math.min(11, mNum - 1)), yNum);
          }
        }
      }
    }

    onSave({
      id: editingShift?.id,
      date,
      monthKey: synchronizedMonthKey,
      hours: shiftStatus === 'concluido' ? Number(hours) : 0,
      shiftStatus,
      description: description || (shiftStatus === 'concluido' ? 'Plantão Concluído' : 'Falta na Escala'),
      type: editingShift?.type || 'plantao',
    }, isEditing);

    onClose();
  };

  const handleDelete = () => {
    if (!editingShift || !onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editingShift.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
        <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto my-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 animate-modalPop">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${
              isEditing 
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}>
              {isEditing ? <Pencil className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight font-display truncate">
                {isEditing ? 'Editar Lançamento' : 'Lançar Plantão na Escala'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">{member.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Status do Registro *</label>
              <select
                value={shiftStatus}
                onChange={e => {
                  const val = e.target.value as any;
                  setShiftStatus(val);
                  if (val !== 'concluido') {
                    setHours(0);
                  } else if (hours === 0) {
                    setHours(12);
                  }
                }}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="concluido">Concluído</option>
                <option value="falta_justificada">Falta Just. (FJ)</option>
                <option value="falta_injustificada">Falta Não Just. (FNJ)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Carga Horária</label>
              <select
                value={shiftStatus === 'concluido' ? hours : 0}
                onChange={e => setHours(Number(e.target.value))}
                disabled={shiftStatus !== 'concluido'}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {shiftStatus !== 'concluido' ? (
                  <option value={0}>0h (Falta computada)</option>
                ) : (
                  <>
                    <option value={12}>12h (Padrão)</option>
                    <option value={6}>6h</option>
                    <option value={4}>4h</option>
                    <option value={24}>24h (Duplo)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {shiftStatus === 'concluido' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <CustomDatePicker
                  label="Data do Plantão"
                  required
                  value={date}
                  onChange={val => {
                    let detectedMonthKey = monthKey;
                    let formattedDate = val;

                    if (val.includes('-')) {
                      const parts = val.split('-');
                      if (parts.length === 3) {
                        const [y, m, d] = parts;
                        const mNum = parseInt(m, 10);
                        const yNum = parseInt(y, 10);
                        if (!isNaN(mNum) && !isNaN(yNum)) {
                          const mIdx = Math.max(0, Math.min(11, mNum - 1));
                          detectedMonthKey = formatMonthKey(mIdx, yNum);
                          formattedDate = `${d}/${m}/${y}`;
                        }
                      }
                    } else if (val.includes('/')) {
                      const parts = val.split('/');
                      if (parts.length >= 2) {
                        const d = parts[0].trim().padStart(2, '0');
                        const m = parts[1].trim().padStart(2, '0');
                        const mNum = parseInt(m, 10);
                        let yNum = targetYear;
                        if (parts.length >= 3 && parts[2]) {
                          const rawY = parts[2].trim();
                          yNum = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
                        }
                        if (!isNaN(mNum) && !isNaN(yNum)) {
                          const mIdx = Math.max(0, Math.min(11, mNum - 1));
                          detectedMonthKey = formatMonthKey(mIdx, yNum);
                          formattedDate = `${d}/${m}/${yNum}`;
                        }
                      }
                    }

                    setDate(formattedDate);
                    setMonthKey(detectedMonthKey);
                  }}
                  format="BR"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-300 uppercase font-semibold block mb-1">Mês da Escala</label>
                <select
                  value={monthKey}
                  onChange={e => setMonthKey(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {availableMonths.map((m: string) => {
                    const { monthIndex, year } = parseMonthKey(m);
                    return (
                      <option key={m} value={m}>{formatShortMonthYear(monthIndex, year)}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
              <label className="text-[10px] text-slate-300 uppercase font-semibold block">
                Mês da Escala (Referência da Falta) *
              </label>
              <select
                value={monthKey}
                onChange={e => setMonthKey(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {availableMonths.map((m: string) => {
                  const { monthIndex, year } = parseMonthKey(m);
                  return (
                    <option key={m} value={m}>{formatShortMonthYear(monthIndex, year)}</option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400">
                Faltas vinculam-se ao mês da escala ({formatShortMonthYear(parseMonthKey(monthKey).monthIndex, parseMonthKey(monthKey).year)}), sem dia específico.
              </p>
            </div>
          )}

          {/* Botões do Rodapé: Excluir (apenas em edição) + Cancelar + Salvar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  confirmDelete 
                    ? 'bg-rose-600 text-white animate-pulse' 
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
                title={confirmDelete ? 'Clique novamente para confirmar a exclusão' : 'Excluir este registro'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDelete ? 'Confirmar Exclusão?' : 'Excluir'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Salvar Alterações' : 'Salvar Plantão'}</span>
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </ModalPortal>
  );
};
