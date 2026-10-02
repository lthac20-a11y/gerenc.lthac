import React from 'react';
import { 
  GraduationCap, 
  Users, 
  Calendar, 
  Award, 
  AlertTriangle, 
  Repeat, 
  FileSpreadsheet, 
  Settings, 
  Plus
} from 'lucide-react';
import { LeagueConfig } from '../types/league';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  config: LeagueConfig;
  onOpenSettings: () => void;
  onOpenAddMember: () => void;
  onOpenAddShift: () => void;
  onOpenSpreadsheet: () => void;
  activeMembersCount: number;
  eligibleCertificatesCount: number;
  pendingReplacementsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  config,
  onOpenSettings,
  onOpenAddMember,
  onOpenAddShift,
  onOpenSpreadsheet,
  activeMembersCount,
  eligibleCertificatesCount,
  pendingReplacementsCount,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: GraduationCap },
    { id: 'members', label: 'Membros & Horas', icon: Users, badge: activeMembersCount },
    { id: 'schedule', label: 'Grade Mensal / Plantões', icon: Calendar },
    { id: 'replacements', label: 'Reposições', icon: Repeat, alert: pendingReplacementsCount > 0 ? pendingReplacementsCount : undefined },
    { id: 'disciplinary', label: 'Advertências', icon: AlertTriangle },
    { id: 'certificates', label: 'Emissão de Certificados', icon: Award, highlight: eligibleCertificatesCount > 0 ? eligibleCertificatesCount : undefined },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      {/* Top Bar with Brand & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold text-xl tracking-wider font-serif">
              {config.leagueAcronym.substring(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 text-base leading-tight tracking-tight">
                  {config.leagueName}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-medium">
                  {config.leagueAcronym}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-none mt-1">
                {config.institution} • {config.cityState}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddShift}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Lançar Plantão
            </button>

            <button
              onClick={onOpenAddMember}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Membro
            </button>

            <button
              onClick={onOpenSpreadsheet}
              title="Importar / Exportar Planilhas"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Planilhas</span>
            </button>

            <button
              onClick={onOpenSettings}
              title="Configurações da Liga e Certificados"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>

                {item.badge !== undefined && (
                  <span className="ml-1 text-[11px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full border border-slate-700">
                    {item.badge}
                  </span>
                )}

                {item.alert !== undefined && (
                  <span className="ml-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-semibold">
                    {item.alert}
                  </span>
                )}

                {item.highlight !== undefined && (
                  <span className="ml-1 text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.2 rounded-full font-semibold">
                    {item.highlight} aptos
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
