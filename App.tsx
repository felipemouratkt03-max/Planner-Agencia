
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

  const handleUserSession = async (id: string, email: string) => {
    const lowerEmail = email.toLowerCase();
    
    // Tenta buscar o perfil existente primeiro
    const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', id).single();

    if (lowerEmail === ADMIN_EMAIL.toLowerCase()) {
      const adminProfile: UserProfile = {
        id,
        email: lowerEmail,
        full_name: existingProfile?.full_name || 'Jader Moura',
        role: 'admin'
      };
      setUser(adminProfile);
      setIsLoading(false);
      await supabase.from('profiles').upsert(adminProfile);
      return;
    }

    const clientProfile: UserProfile = {
      id,
      email: lowerEmail,
      full_name: existingProfile?.full_name || email.split('@')[0].split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      role: 'client'
    };
    setUser(clientProfile);
    if (!existingProfile) {
      await supabase.from('profiles').upsert(clientProfile).catch(() => {});
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase">JM Digital Hub...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
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
