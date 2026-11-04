import React, { useState } from 'react';
import { 
  Activity,
  LayoutGrid, 
  Users, 
  Award, 
  AlertTriangle, 
  Repeat, 
  LogOut,
  ShieldAlert,
  FileSpreadsheet,
  Menu,
  X,
  Plus,
  ChevronRight
} from 'lucide-react';
import { LeagueConfig } from '../types/league';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

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
  onOpenAddMember,
  onOpenAddShift,
  activeMembersCount,
  eligibleCertificatesCount,
  pendingReplacementsCount,
}) => {
  const { isCoordination, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navigation Items
  const allNavItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      shortLabel: 'Início',
      desc: 'Visão geral e estatísticas gerais',
      icon: LayoutGrid 
    },
    { 
      id: 'members', 
      label: 'Integrantes', 
      shortLabel: 'Membros',
      desc: 'Cadastro, horas e fichas completas',
      icon: Users, 
      badge: activeMembersCount 
    },
    { 
      id: 'schedule', 
      label: 'Planilha', 
      shortLabel: 'Planilha',
      desc: 'Grade mensal de plantões e escalas',
      icon: FileSpreadsheet 
    },
    { 
      id: 'replacements', 
      label: 'Reposições', 
      shortLabel: 'Reposição',
      desc: 'Pendências, prazos e quitações',
      icon: Repeat, 
      alert: pendingReplacementsCount > 0 ? pendingReplacementsCount : undefined 
    },
    { 
      id: 'disciplinary', 
      label: 'Advertências', 
      shortLabel: 'ADVs',
      desc: 'Conselho disciplinar e advertências',
      icon: AlertTriangle 
    },
    { 
      id: 'certificates', 
      label: 'Diretoria', 
      shortLabel: 'Diretoria',
      desc: 'Aptos à certificação e diretoria',
      icon: Award, 
      highlight: eligibleCertificatesCount > 0 ? eligibleCertificatesCount : undefined,
    },
  ];

  const handleSelectNav = (id: string) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-[#0b131f] border-b border-slate-800 text-white sticky top-0 z-30 shadow-xl select-none w-full max-w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
          {/* DESKTOP LAYOUT (>= 768px) */}
          <div className="hidden md:flex items-center justify-between min-h-[70px] py-1.5 gap-3">
            {/* LEFT: BRAND LOGO & TITLE */}
            <div className="flex items-center gap-3 shrink-0 min-w-0">
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

            {/* CENTER: ENHANCED HORIZONTAL TABS */}
            <nav className="flex items-center gap-1.5 lg:gap-2 overflow-x-auto scrollbar-none flex-nowrap mx-2 py-1 flex-1 justify-start lg:justify-center pl-2 sm:pl-3">
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`group flex-none flex items-center gap-1.5 px-3 lg:px-3.5 py-2.5 text-xs lg:text-sm font-semibold rounded-xl whitespace-nowrap transition-all duration-200 cursor-pointer ${
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

            {/* RIGHT: PWA INSTALL, ADMIN PILL & LOGOUT */}
            <div className="flex items-center gap-2.5 shrink-0">
              <PWAInstallButton />

              <div className={`flex items-center gap-1.5 px-3.5 py-2 bg-[#080d16] border rounded-xl text-xs font-bold ${
                isCoordination 
                  ? 'border-amber-500/40 text-amber-300 shadow-xs' 
                  : 'border-blue-500/40 text-blue-300 shadow-xs'
              }`}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{isCoordination ? 'Admin' : 'Leitor'}</span>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sair da conta"
                className="p-2.5 text-rose-400 hover:text-white bg-[#080d16] hover:bg-rose-950/40 border border-rose-950/50 hover:border-rose-800/60 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MOBILE STREAMLINED HEADER (< 768px) - ZERO HORIZONTAL OVERFLOW */}
          <div className="flex md:hidden items-center justify-between min-h-[56px] py-2">
            {/* Brand Logo & Name */}
            <div 
              onClick={() => handleSelectNav('dashboard')}
              className="flex items-center gap-2 min-w-0 cursor-pointer active:opacity-80 transition-opacity"
            >
              <div className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow text-emerald-400 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-extrabold uppercase text-white tracking-wider text-xs font-display truncate">
                  LIGA DO TRAUMA
                </span>
                <span className="bg-[#121c2c] text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 font-mono">
                  {config.leagueAcronym}
                </span>
              </div>
            </div>

            {/* Quick Actions & Hamburger Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                isCoordination 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}>
                <ShieldAlert className="w-3 h-3 shrink-0" />
                <span>{isCoordination ? 'Admin' : 'Leitor'}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-h-[44px] min-w-[44px] p-2.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER / MENU HAMBÚRGUER (< 768px) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-[85%] max-w-sm h-full bg-[#0b131f] border-l border-slate-800 p-4 shadow-2xl flex flex-col justify-between overflow-y-auto animate-slideLeft z-10">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-white font-display">LIGA DO TRAUMA</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Hospital Angelina Caron</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Role Card */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isCoordination ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{isCoordination ? 'Coordenação / Admin' : 'Modo Leitor'}</p>
                    <p className="text-[10px] text-slate-400">{isCoordination ? 'Acesso total a edições' : 'Apenas consulta de dados'}</p>
                  </div>
                </div>
              </div>

              {/* In-App PWA Install in Mobile Drawer */}
              <PWAInstallButton variant="mobile-menu" />

              {/* Quick Action Shortcuts (Coordination Only) */}
              {isCoordination && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Ações Rápidas</span>
                  <div className="grid grid-cols-1 gap-2">
                    {onOpenAddShift && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenAddShift();
                        }}
                        className="min-h-[44px] w-full px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-98"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Lançar Plantão na Escala</span>
                      </button>
                    )}

                    {onOpenAddMember && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenAddMember();
                        }}
                        className="min-h-[44px] w-full px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                      >
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>Cadastrar Novo Integrante</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Complete Navigation Sections */}
              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Todas as Abas do Sistema</span>
                <nav className="space-y-1">
                  {allNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectNav(item.id)}
                        className={`w-full min-h-[46px] flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer text-left ${
                          isActive
                            ? 'bg-[#152538] text-white border border-emerald-500/50 shadow-md font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{item.label}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{item.desc}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge !== undefined && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
                              {item.badge}
                            </span>
                          )}

                          {item.alert !== undefined && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {item.alert}
                            </span>
                          )}

                          {item.highlight !== undefined && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {item.highlight}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Drawer Footer: Logout */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="min-h-[44px] w-full px-4 py-2.5 text-xs text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 font-semibold active:scale-98"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NATIVE-LIKE MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#090f19]/95 backdrop-blur-lg border-t border-slate-800/90 shadow-[0_-8px_20px_rgba(0,0,0,0.5)] select-none no-print"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegação móvel inferior"
      >
        <div className="grid grid-cols-6 h-16 max-w-lg mx-auto px-1 items-center">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 px-0.5 relative transition-all duration-150 cursor-pointer ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={item.label}
              >
                {/* Active Indicator Top Glow */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )}

                <div className="relative mb-0.5">
                  <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110 text-emerald-400' : 'text-slate-400'}`} />
                  
                  {/* Badge Notification Dots */}
                  {item.alert !== undefined && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-pulse" />
                  )}
                  {item.highlight !== undefined && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                  )}
                </div>

                <span className="text-[9px] tracking-tight truncate w-full text-center leading-tight">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
