import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Save, RotateCcw } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Configurações da Liga & Parâmetros de Certificado</h3>
            <p className="text-xs text-slate-400">Personalize dados institucionais e critérios estatutários</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-3">
            <h4 className="font-semibold text-emerald-400 uppercase text-[10px] tracking-wider">Identificação da Liga</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Nome Completo da Liga</label>
                <input
                  type="text"
                  required
                  value={form.leagueName}
                  onChange={e => setForm({ ...form, leagueName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Sigla Oficial</label>
                <input
                  type="text"
                  required
                  value={form.leagueAcronym}
                  onChange={e => setForm({ ...form, leagueAcronym: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Instituição / Faculdade / Hospital</label>
                <input
                  type="text"
                  required
                  value={form.institution}
                  onChange={e => setForm({ ...form, institution: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Cidade / UF</label>
                <input
                  type="text"
                  required
                  value={form.cityState}
                  onChange={e => setForm({ ...form, cityState: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="font-semibold text-emerald-400 uppercase text-[10px] tracking-wider">Assinaturas do Certificado</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Nome do(a) Presidente</label>
                <input
                  type="text"
                  required
                  value={form.presidentName}
                  onChange={e => setForm({ ...form, presidentName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Nome do Professor Orientador</label>
                <input
                  type="text"
                  required
                  value={form.coordinatorName}
                  onChange={e => setForm({ ...form, coordinatorName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block uppercase text-[10px]">Titulação do Orientador</label>
              <input
                type="text"
                required
                value={form.coordinatorTitle}
                onChange={e => setForm({ ...form, coordinatorTitle: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="font-semibold text-emerald-400 uppercase text-[10px] tracking-wider">Regras de Emissão de Certificados</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Carga Horária Mínima (horas)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.minHoursForCertificate}
                  onChange={e => setForm({ ...form, minHoursForCertificate: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Tempo Ativo Mínimo (meses)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.minActiveMonthsForCertificate}
                  onChange={e => setForm({ ...form, minActiveMonthsForCertificate: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block uppercase text-[10px]">Máx. Advertências Ativas</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  required
                  value={form.maxActiveWarningsAllowed}
                  onChange={e => setForm({ ...form, maxActiveWarningsAllowed: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja restaurar as configurações padrão?')) {
                  onResetToDefaults();
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Padrões
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Salvar Configurações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
