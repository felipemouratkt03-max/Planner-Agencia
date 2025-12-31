
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const SYSTEM_PASSWORD = 'jm_digital_access_2025_secure';
const PROJECT_ID = 'ftuflhnihmdziepnlcsc';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorType, setErrorType] = useState<'auth_config' | 'db_config' | 'signup_disabled' | 'user_exists' | 'generic' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;
    
    setIsLoading(true);
    setMessage(null);
    setErrorType(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: SYSTEM_PASSWORD,
      });

      if (!signInError) return;

      if (signInError.message.toLowerCase().includes('invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password: SYSTEM_PASSWORD,
        });

        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('already exists')) {
            setErrorType('user_exists');
          } else if (msg.includes('signups not allowed')) {
            setErrorType('signup_disabled');
          } else {
            setErrorType('generic');
            setMessage(signUpError.message);
          }
        }
      } else {
        if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setErrorType('auth_config');
        } else {
          setErrorType('generic');
          setMessage(signInError.message);
        }
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
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Agência de Marketing & Tecnologia</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100">
          
          {errorType === 'user_exists' && (
            <div className="mb-8 p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl animate-in zoom-in">
              <h3 className="font-black text-amber-800 text-sm uppercase mb-2">Conflito de Credenciais</h3>
              <p className="text-amber-700 text-[10px] font-bold leading-relaxed">
                Este e-mail já possui uma conta ativa. Se você não lembra a senha, entre em contato com o suporte da agência.
              </p>
            </div>
          )}

          {errorType === 'signup_disabled' && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-3xl">
              <h3 className="font-black text-red-800 text-sm uppercase mb-2">Acesso Restrito</h3>
              <p className="text-red-700 text-[10px] font-bold">O cadastro de novos usuários está temporariamente bloqueado.</p>
            </div>
          )}

          <form onSubmit={handleQuickAccess} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@suaempresa.com"
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
                "Acessar AgencyCore"
              )}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          JM Digital • Versão 2025.2
        </p>
      </div>
    </div>
  );
};

export default Login;
