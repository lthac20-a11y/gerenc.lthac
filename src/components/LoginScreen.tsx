import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  UserCheck, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Sparkles,
  BookOpen,
  Hospital
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { COORDINATION_EMAIL } from '../lib/firebase';

export const LoginScreen: React.FC = () => {
  const { loginWithEmail, signupWithEmail, loginWithGoogle, loginAsDemo, loading } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Auth error', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Este e-mail já está cadastrado. Tente entrar com sua senha.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Formato de e-mail inválido.');
      } else {
        setErrorMsg('Erro ao autenticar: ' + (err.message || 'Verifique sua conexão.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginAsDemo(targetEmail);
    } catch (err: any) {
      setErrorMsg('Erro no login rápido: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Erro no login com Google: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      
      {/* Subtle Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-serif font-bold text-2xl shadow-xl shadow-teal-500/20 mb-1 border border-emerald-400/30">
            LTHAC
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif">
            Liga do Trauma Hospital Angelina Caron
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sistema de Gestão de Escalas, Banco de Horas e Prontuário dos Ligantes
          </p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          
          {/* Form Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">
                {isRegisterMode ? 'Criar Nova Conta' : 'Acesso ao Sistema'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isRegisterMode 
                  ? 'Informe seu e-mail para cadastrar' 
                  : 'Entre com suas credenciais autorizadas'}
              </p>
            </div>
            <span className="p-2 bg-slate-800 text-emerald-400 rounded-xl border border-slate-700">
              <Lock className="w-4 h-4" />
            </span>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase block mb-1.5">
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="ex: seu.email@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase block mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Cadastrar e Entrar' : 'Entrar no Sistema'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMsg(null);
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 underline cursor-pointer transition-colors"
            >
              {isRegisterMode 
                ? 'Já possui conta? Faça login aqui' 
                : 'Novo integrante? Criar senha de acesso'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Acesso Rápido por Perfil
            </span>
          </div>

          {/* 1-Click Role Access Buttons */}
          <div className="space-y-2">
            {/* Coordination button */}
            <button
              type="button"
              onClick={() => handleQuickLogin(COORDINATION_EMAIL)}
              disabled={isSubmitting || loading}
              className="w-full p-2.5 bg-gradient-to-r from-purple-950/40 to-slate-800 hover:from-purple-900/60 hover:to-slate-750 border border-purple-800/40 rounded-xl text-left flex items-center justify-between group cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                      Coordenação Geral
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 uppercase">
                      Acesso Total
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {COORDINATION_EMAIL}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Reader / Ligante button */}
            <button
              type="button"
              onClick={() => handleQuickLogin('liganteslthac@gmail.com')}
              disabled={isSubmitting || loading}
              className="w-full p-2.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left flex items-center justify-between group cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                      Perfil Ligante / Leitor
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 uppercase">
                      Modo Consulta
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    liganteslthac@gmail.com
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

        </div>

        {/* Access Rights Policy Footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>
            🔒 <strong>Coordenação ({COORDINATION_EMAIL}):</strong> Acesso irrestrito a escalas, certidões e certificados.
          </p>
          <p>
            📖 <strong>Perfil Leitor:</strong> Consulta pública de presenças, banco de horas e reposições (sem edição).
          </p>
        </div>

      </div>
    </div>
  );
};
