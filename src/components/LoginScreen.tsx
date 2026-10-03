import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { loginWithEmail, loading } = useAuth();

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
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error('Auth error', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/user-not-found') {
        setErrorMsg('Usuário não encontrado.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Formato de e-mail inválido.');
      } else {
        setErrorMsg('Erro ao autenticar: ' + (err.message || 'Verifique suas credenciais.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      
      {/* Background Radial Lights */}
      <div className="absolute -top-48 -left-48 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-display font-extrabold text-3xl shadow-2xl shadow-emerald-500/30 mb-2 border border-emerald-400/30">
            LTHAC
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
            Liga do Trauma Hospital Angelina Caron
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
            Sistema de Gestão de Escalas, Banco de Horas e Prontuário dos Ligantes
          </p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6">
          
          {/* Form Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Acesso ao Sistema
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Entre com suas credenciais autorizadas
              </p>
            </div>
            <span className="p-2.5 bg-slate-800/80 text-emerald-400 rounded-2xl border border-slate-700/60 shadow-inner">
              <Lock className="w-5 h-5" />
            </span>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-4 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-xs sm:text-sm text-rose-200 flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/90 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm font-sans transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Senha de Acesso
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-950/90 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 font-display"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
