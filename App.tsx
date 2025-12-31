
import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import { Layout } from './components/Layout';
import { supabase } from './lib/supabase';

const ADMIN_EMAIL = 'jadermourabh@gmail.com';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('projects');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleUserSession(session.user.id, session.user.email!);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        handleUserSession(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserSession = async (authId: string, email: string) => {
    const lowerEmail = email.toLowerCase().trim();
    setIsLoading(true);
    setAccessDenied(false);

    // 1. Verificar Admin
    if (lowerEmail === ADMIN_EMAIL.toLowerCase()) {
      const adminProfile: UserProfile = {
        id: authId,
        email: lowerEmail,
        full_name: 'Jader Moura',
        role: 'admin'
      };
      setUser(adminProfile);
      await supabase.from('profiles').upsert(adminProfile);
      setIsLoading(false);
      return;
    }

    // 2. Buscar Perfil via E-mail (O JWT do usuário logado permite este select nas novas políticas)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', lowerEmail)
      .maybeSingle();

    if (!profile || error) {
      console.warn("Acesso negado: Perfil não encontrado na gestão de clientes.", lowerEmail);
      await supabase.auth.signOut();
      setUser(null);
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }

    // 3. Vincular ID se necessário
    if (!profile.id || profile.id !== authId) {
      await supabase.from('profiles').update({ id: authId }).eq('email', lowerEmail);
    }

    // 4. Iniciar Sessão Cliente
    setUser({
      id: authId,
      email: lowerEmail,
      full_name: profile.full_name,
      role: 'client'
    });
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessDenied(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase">Autenticando JM Digital...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login accessDenied={accessDenied} />;
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      currentView={currentView} 
      onViewChange={setCurrentView}
    >
      {user.role === 'admin' ? (
        <AdminDashboard user={user} view={currentView} />
      ) : (
        <ClientDashboard user={user} view={currentView} onViewChange={setCurrentView} />
      )}
    </Layout>
  );
};

export default App;
