import React, { useState } from 'react';
import { X, Settings, Clock, Shield, Award, Save, RotateCcw } from 'lucide-react';
import { LeagueConfig } from '../types/league';
import { DEFAULT_LEAGUE_CONFIG } from '../data/initialData';

interface LeagueSettingsModalProps {
  config: LeagueConfig;
  onClose: () => void;
  onSaveConfig: (config: LeagueConfig) => void;
  onResetToDefaults: () => void;
}

export const LeagueSettingsModal: React.FC<LeagueSettingsModalProps> = ({
  config,
  onClose,
  onSaveConfig,
  onResetToDefaults,
}) => {
  const [form, setForm] = useState<LeagueConfig>({ ...config });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative my-auto"
      >
        {/* Cabeçalho Enxuto (1 Linha) - Fixado no topo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 p-1.5">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white font-display whitespace-nowrap truncate">
              Parâmetros da Liga
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Corpo do Formulário com Rolagem Interna Independentemente da Tela */}
        <div className="p-4 space-y-3 text-xs overflow-y-auto flex-1 min-h-0">
          {/* Seção 1: Carga Horária & Certificação */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <h4 className="font-bold text-emerald-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>1. CARGA HORÁRIA & CERTIFICAÇÃO</span>
            </h4>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  META (HORAS)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.minHoursForCertificate}
                  onChange={e => setForm({ ...form, minHoursForCertificate: Number(e.target.value) })}
                  className="w-full min-w-0 h-9 px-2 text-xs font-bold text-center font-mono bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  H / PLANTÃO
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.defaultShiftHours || 12}
                  onChange={e => setForm({ ...form, defaultShiftHours: Number(e.target.value) })}
                  className="w-full min-w-0 h-9 px-2 text-xs font-bold text-center font-mono bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  TEMPO (MESES)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.minActiveMonthsForCertificate}
                  onChange={e => setForm({ ...form, minActiveMonthsForCertificate: Number(e.target.value) })}
                  className="w-full min-w-0 h-9 px-2 text-xs font-bold text-center font-mono bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Regras Disciplinares & Limites */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <h4 className="font-bold text-rose-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>2. REGRAS DISCIPLINARES & LIMITES</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 mt-2 items-center">
              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  MÁX. ADVERTÊNCIAS
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  required
                  value={form.maxActiveWarningsAllowed}
                  onChange={e => setForm({ ...form, maxActiveWarningsAllowed: Number(e.target.value) })}
                  className="w-full min-w-0 h-9 px-2 text-xs font-bold text-center font-mono bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0 pt-4 sm:pt-0">
                <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer font-medium p-2 bg-slate-900 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors h-9 min-w-0">
                  <input
                    type="checkbox"
                    checked={Boolean(form.requireAllReplacementsCompleted)}
                    onChange={e => setForm({ ...form, requireAllReplacementsCompleted: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                  />
                  <span className="truncate leading-none">Exigir 100% Reposições</span>
                </label>
              </div>
            </div>
          </div>

          {/* Seção 3: Identificação Institucional da Liga */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <h4 className="font-bold text-cyan-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>3. IDENTIFICAÇÃO DA LIGA</span>
            </h4>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="col-span-2 min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  NOME COMPLETO
                </label>
                <input
                  type="text"
                  required
                  value={form.leagueName}
                  onChange={e => setForm({ ...form, leagueName: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  SIGLA
                </label>
                <input
                  type="text"
                  required
                  value={form.leagueAcronym}
                  onChange={e => setForm({ ...form, leagueAcronym: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="col-span-2 min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  INSTITUIÇÃO / HOSPITAL
                </label>
                <input
                  type="text"
                  required
                  value={form.institution}
                  onChange={e => setForm({ ...form, institution: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  CIDADE / UF
                </label>
                <input
                  type="text"
                  required
                  value={form.cityState}
                  onChange={e => setForm({ ...form, cityState: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="col-span-2 min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  PRECEPTOR / ORIENTADOR
                </label>
                <input
                  type="text"
                  required
                  value={form.coordinatorName}
                  onChange={e => setForm({ ...form, coordinatorName: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1 truncate">
                  PRESIDENTE
                </label>
                <input
                  type="text"
                  required
                  value={form.presidentName}
                  onChange={e => setForm({ ...form, presidentName: e.target.value })}
                  className="w-full min-w-0 h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Compacto Fixado na Parte Inferior */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 shrink-0 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Parâmetros</span>
          </button>
        </div>
      </form>
    </div>
  );
};
