import React, { useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'mobile-menu' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // If not installable and not iOS, return null
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      install();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const buttonContent = (
    <>
      <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span>Instalar App</span>
    </>
  );

  return (
    <>
      {variant === 'mobile-menu' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 transition-colors shadow-xs cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Instalar Aplicativo (PWA)</span>
          </div>
          <span className="text-[10px] uppercase font-bold bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
            Adicionar
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-500/40 shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 ${className}`}
          title="Instalar aplicativo LTHAC na tela inicial"
        >
          {buttonContent}
        </button>
      )}

      {/* iOS Safari Guided Install Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 p-5 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Instalar no iPhone / iPad</h3>
                  <p className="text-[11px] text-slate-400">Adicionar à Tela de Início</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800 text-blue-400 shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white block font-semibold mb-0.5">1. Toque em Compartilhar</strong>
                  No Safari, toque no ícone de <strong>Compartilhar</strong> na barra de ferramentas inferior do navegador.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white block font-semibold mb-0.5">2. Adicionar à Tela de Início</strong>
                  Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
