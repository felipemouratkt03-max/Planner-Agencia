
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const SYSTEM_PASSWORD = 'jm_digital_access_2025_secure';

interface LoginProps {
  accessDenied?: boolean;
}

const Login: React.FC<LoginProps> = ({ accessDenied }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorType, setErrorType] = useState<'auth' | 'generic' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;
    
    setIsLoading(true);
    setMessage(null);
    setErrorType(null);

    try {
      // Proceder com Auth direto (App.tsx faz a gestão de perfis após o login)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: SYSTEM_PASSWORD,
      });

      if (!signInError) return;

      // Se o usuário não existe, tentamos o SignUp (Fluxo JM de primeiro acesso)
      if (signInError.message.toLowerCase().includes('invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password: SYSTEM_PASSWORD,
        });

        if (signUpError) {
          setErrorType('auth');
          setMessage(signUpError.message);
        } else {
          setMessage("Validando credenciais...");
        }
      } else {
        setErrorType('generic');
        setMessage(signInError.message);
      }
    } catch (err: any) {
      setErrorType('generic');
      setMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-600 text-white rounded-[2.5rem] shadow-2xl mb-6 shadow-indigo-200">
            <span className="text-4xl font-black">JM</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">JM Digital</h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Portal de Acesso Estratégico</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100">
          
          {accessDenied && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-3xl animate-in shake-vertical">
              <h3 className="font-black text-red-800 text-sm uppercase mb-2 text-center">Acesso Não Autorizado</h3>
              <p className="text-red-700 text-[10px] font-bold leading-relaxed text-center">
                Seu e-mail não foi encontrado na nossa base de clientes ativos. <br/>Entre em contato com a agência para solicitar acesso.
              </p>
            </div>
          )}

          {message && !errorType && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 text-[10px] font-black uppercase text-center rounded-2xl">
              {message}
            </div>
          )}

          <form onSubmit={handleQuickAccess} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Cadastro</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all text-lg font-bold shadow-inner"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Entrar no Portal"
              )}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          JM Digital Hub • Acesso Restrito
        </p>
      </div>
    </div>
  );
};

export default Login;
