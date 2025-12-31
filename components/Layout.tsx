
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface LayoutProps {
  user: UserProfile;
  onLogout: () => void;
  currentView: string;
  onViewChange: (view: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, currentView, onViewChange, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = user.role === 'admin';

  const menuItems = [
    { id: 'projects', label: isAdmin ? 'Projetos' : 'Estratégia', icon: isAdmin ? '📂' : '💎' },
    { id: 'kanban', label: isAdmin ? 'Quadro Kanban' : 'Progresso', icon: '📊' },
    { id: 'reports', label: 'Relatórios', icon: '📈' },
    ...(isAdmin ? [
      { id: 'clients', label: 'Gestão de Clientes', icon: '👥' },
      { id: 'settings', label: 'Configurações', icon: '⚙️' }
    ] : []),
  ];

  const handleNavClick = (id: string) => {
    onViewChange(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-indigo-950 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
            <span className="text-indigo-950 font-black text-sm">JM</span>
          </div>
          <span className="font-black tracking-tight">JM Digital</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar / Mobile Menu */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        fixed md:sticky top-0 left-0 w-72 md:w-64 bg-indigo-950 text-white h-full md:h-screen flex flex-col shadow-2xl z-40 transition-transform duration-300
      `}>
        <div className="hidden md:flex p-8 border-b border-white/10 items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-indigo-950 font-black text-xl">JM</span>
          </div>
          <h1 className="text-lg font-black tracking-tight leading-none">JM Digital</h1>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 px-2 opacity-50">
            PAINEL DE CONTROLE
          </div>
          
          {menuItems.map(item => (
            <button 
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${
                currentView === item.id
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50' 
                : 'text-indigo-200 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-3xl flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-sm font-black shadow-inner flex-shrink-0">
              {user.full_name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-black truncate text-white">{user.full_name}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter opacity-70">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
          >
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="hidden md:flex h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 items-center justify-between sticky top-0 z-10">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
            {isAdmin ? 'Agência Operational Hub' : 'Portal Estratégico do Cliente'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black text-slate-500">
              {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </header>
        <div className="p-4 md:p-10">
          {children}
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
