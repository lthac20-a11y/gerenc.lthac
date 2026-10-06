import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Member, RoleInLeague } from '../types/league';
import { CustomDatePicker } from './CustomDatePicker';

interface AddMemberModalProps {
  onClose: () => void;
  onAddMember: (newMember: Member) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  onClose,
  onAddMember,
}) => {
  const [name, setName] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toLocaleDateString('pt-BR'));
  const [role, setRole] = useState<RoleInLeague>('Ligante');
  const [initialHours, setInitialHours] = useState(0);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newMember: Member = {
      id: `m-${Date.now()}`,
      name: name.trim(),
      entryDate,
      role,
      status: 'ativo',
      accumulatedHours: Number(initialHours) || 0,
      hoursUpdated: true,
      warnings: [],
      justifiedAbsences: [],
      unjustifiedAbsences: [],
      replacements: [],
      shifts: [],
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };

    onAddMember(newMember);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative space-y-4 my-auto max-h-[96vh] flex flex-col overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Cadastrar Membro da Liga</h3>
            <p className="text-[11px] text-slate-400 leading-tight">Adicione o nome, cargo (Ligante ou Coordenação) e data de entrada</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
          <div>
            <label className="text-slate-300 font-semibold block uppercase text-[10px]">Nome Completo *</label>
            <input
              type="text"
              required
              placeholder="Ex: Mariana Silveira Guimarães"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px]">Cargo / Função *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as RoleInLeague)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="Ligante">Ligante</option>
                <option value="Coordenação">Coordenação</option>
              </select>
            </div>

            <div>
              <CustomDatePicker
                label="Data de Entrada"
                required
                value={entryDate}
                onChange={val => setEntryDate(val)}
                format="BR"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px]">Horas Iniciais Acumuladas</label>
              <input
                type="number"
                min={0}
                value={initialHours}
                onChange={e => setInitialHours(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px]">E-mail (Opcional)</label>
              <input
                type="email"
                placeholder="membro@liga.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow cursor-pointer"
            >
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
