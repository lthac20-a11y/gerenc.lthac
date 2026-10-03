import React from 'react';
import { 
  Activity,
  LayoutGrid, 
  Users, 
  Award, 
  AlertTriangle, 
  Repeat, 
  LogOut,
  ShieldAlert,
  FileSpreadsheet
} from 'lucide-react';
import { LeagueConfig } from '../types/league';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  config: LeagueConfig;
  onOpenSettings?: () => void;
  onOpenAddMember?: () => void;
  onOpenAddShift?: () => void;
  activeMembersCount: number;
  eligibleCertificatesCount: number;
  pendingReplacementsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  config,
  activeMembersCount,
  eligibleCertificatesCount,
  pendingReplacementsCount,
}) => {
  const { isCoordination, logout } = useAuth();

  // Navigation Items
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'members', label: 'Integrantes', icon: Users, badge: activeMembersCount },
    { id: 'schedule', label: 'Planilha', icon: FileSpreadsheet },
    { id: 'replacements', label: 'Reposições', icon: Repeat, alert: pendingReplacementsCount > 0 ? pendingReplacementsCount : undefined },
    { id: 'disciplinary', label: 'Advertências', icon: AlertTriangle },
    { 
      id: 'certificates', 
      label: 'Diretoria', 
      icon: Award, 
      highlight: eligibleCertificatesCount > 0 ? eligibleCertificatesCount : undefined,
      coordinationOnly: true 
    },
  ];

  const visibleNavItems = allNavItems.filter(item => !item.coordinationOnly || isCoordination);

  return (
    <header className="bg-[#0b131f] border-b border-slate-800 text-white sticky top-0 z-50 shadow-xl select-none">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between min-h-[70px] py-1.5 gap-3">
          
          {/* LEFT: BRAND LOGO & TITLE */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            {/* Medical activity icon box */}
            <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg text-emerald-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold uppercase text-white tracking-wider text-xs sm:text-sm font-display truncate">
                LIGA DO TRAUMA H.A.C.
              </span>
              <span className="bg-[#121c2c] text-emerald-400 border border-emerald-500/30 text-[11px] px-2.5 py-0.5 rounded-full font-bold shrink-0 font-mono shadow-xs">
                {config.leagueAcronym}
              </span>
            </div>
          </div>

          {/* CENTER: ENHANCED HORIZONTAL TABS (HIGH CONTRAST & VISIBILITY) */}
          <nav className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap mx-2 py-1 flex-1 justify-start md:justify-center">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`group flex-none flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#152538] text-white border border-emerald-500/50 shadow-md font-bold ring-1 ring-emerald-500/30'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700 shadow-xs'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-300 group-hover:text-emerald-400'
                  }`} />
                  <span className="tracking-wide">{item.label}</span>

                  {item.badge !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold shrink-0 border ${
                      isActive 
                        ? 'bg-slate-900 text-emerald-300 border-emerald-500/40' 
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {item.alert !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/25 text-amber-200 border border-amber-500/50 shrink-0">
                      {item.alert}
                    </span>
                  )}

                  {item.highlight !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 shrink-0">
                      {item.highlight}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* RIGHT: ADMIN PILL, SPREADSHEET & LOGOUT */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Admin/User Role badge */}
            <div className={`flex items-center gap-1.5 px-3.5 py-2 bg-[#080d16] border rounded-xl text-xs font-bold ${
              isCoordination 
                ? 'border-amber-500/40 text-amber-300 shadow-xs' 
                : 'border-blue-500/40 text-blue-300 shadow-xs'
            }`}>
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{isCoordination ? 'Admin' : 'Leitor'}</span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              title="Sair da conta"
              className="p-2.5 text-rose-400 hover:text-white bg-[#080d16] hover:bg-rose-950/40 border border-rose-950/50 hover:border-rose-800/60 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
