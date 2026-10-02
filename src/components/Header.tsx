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
  Plus,
  LogOut,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { LeagueConfig } from '../types/league';
import { useAuth } from '../context/AuthContext';

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
  const { user, role, isCoordination, isReader, logout } = useAuth();

  // Navigation Items (Certificates tab is COMPLETELY HIDDEN for Leitor)
  const allNavItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: GraduationCap },
    { id: 'members', label: 'Membros & Horas', icon: Users, badge: activeMembersCount },
    { id: 'schedule', label: 'Grade Mensal / Plantões', icon: Calendar },
    { id: 'replacements', label: 'Reposições', icon: Repeat, alert: pendingReplacementsCount > 0 ? pendingReplacementsCount : undefined },
    { id: 'disciplinary', label: 'Advertências', icon: AlertTriangle },
    { 
      id: 'certificates', 
      label: 'Emissão de Certificados', 
      icon: Award, 
      highlight: eligibleCertificatesCount > 0 ? eligibleCertificatesCount : undefined,
      coordinationOnly: true 
    },
  ];

  const visibleNavItems = allNavItems.filter(item => !item.coordinationOnly || isCoordination);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      {/* Top Bar with Brand, User Profile Badge & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold text-xl tracking-wider font-serif shrink-0">
              {config.leagueAcronym.substring(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-100 text-base leading-tight tracking-tight truncate">
                  {config.leagueName}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">
                  {config.leagueAcronym}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-none mt-1 truncate">
                {config.institution} • {config.cityState}
              </p>
            </div>
          </div>

          {/* User Profile Badge, Coordination Actions & Logout */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Logged-in User Pill */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
              <div className={`p-1 rounded-md ${
                isCoordination ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
                {isCoordination ? <ShieldCheck className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-mono block leading-none truncate max-w-[140px]">
                  {user?.email || (isCoordination ? 'lthac20@gmail.com' : 'liganteslthac@gmail.com')}
                </span>
                <span className={`text-[10px] font-bold leading-tight block ${
                  isCoordination ? 'text-purple-300' : 'text-blue-300'
                }`}>
                  {isCoordination ? 'Coordenação (Acesso Total)' : 'Perfil Leitor (Consulta)'}
                </span>
              </div>
            </div>

            {/* Coordination-Only Action Buttons */}
            {isCoordination && (
              <>
                <button
                  type="button"
                  onClick={onOpenAddShift}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lançar Plantão</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAddMember}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Membro</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSpreadsheet}
                  title="Importar / Exportar Planilhas"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="hidden lg:inline">Planilhas</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSettings}
                  title="Configurações da Liga e Certificados"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Sair / Logout Button */}
            <button
              type="button"
              onClick={logout}
              title="Sair / Trocar de conta"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/70 border border-rose-800/50 rounded-xl transition-all cursor-pointer shadow-sm ml-1"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto scrollbar-none py-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>

                {item.badge !== undefined && (
                  <span className="ml-1 text-[11px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full border border-slate-700 font-mono">
                    {item.badge}
                  </span>
                )}

                {item.alert !== undefined && (
                  <span className="ml-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-semibold font-mono">
                    {item.alert}
                  </span>
                )}

                {item.highlight !== undefined && (
                  <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded-full font-bold">
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
