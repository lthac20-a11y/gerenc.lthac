import React, { useState } from 'react';
import { Download, Share, X, PlusSquare, MoreVertical, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'mobile-menu' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'failed') {
        // Fallback to guided instructions if the browser declined or threw
        setActivePlatformTab(isIOS ? 'ios' : 'android');
        setShowModal(true);
      }
    } else {
      setActivePlatformTab(isIOS ? 'ios' : 'android');
      setShowModal(true);
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

      {/* Guided Install Modal for Android & iOS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 p-5 shadow-2xl space-y-4 text-white">
            {/* Header with official league icon */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-emerald-500/40 p-1 flex items-center justify-center shadow-xs">
                  <img
                    src="./icone.png"
                    alt="LTHAC Ícone"
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => {
                      // Fallback if image path has trouble
                      (e.currentTarget as HTMLImageElement).src = './pwa-192x192.png';
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Instalar LTHAC
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      PWA
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Adicionar à Tela Inicial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActivePlatformTab('android')}
                className={`py-1.5 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activePlatformTab === 'android'
                    ? 'bg-slate-800 text-emerald-400 shadow-xs border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android / Chrome</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePlatformTab('ios')}
                className={`py-1.5 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activePlatformTab === 'ios'
                    ? 'bg-slate-800 text-emerald-400 shadow-xs border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Share className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
            </div>

            {/* Android / Chrome Instructions */}
            {activePlatformTab === 'android' ? (
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">1. Menu do Navegador</strong>
                    No Chrome ou Edge do celular, toque no menu de <strong>três pontos (⋮)</strong> no canto superior direito.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">2. Instalar aplicativo</strong>
                    Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">3. Pronto!</strong>
                    O app será aberto em tela cheia com o ícone oficial verde de batimento cardíaco da LTHAC.
                  </div>
                </div>
              </div>
            ) : (
              /* iOS Safari Instructions */
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-blue-400 shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">1. Botão Compartilhar</strong>
                    No Safari, toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) na barra inferior.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">2. Adicionar à Tela de Início</strong>
                    Role a folha de opções para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">3. Confirmar</strong>
                    Toque em <strong>"Adicionar"</strong> no canto superior direito para criar o ícone nativo.
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
