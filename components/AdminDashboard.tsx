
import React, { useState, useEffect } from 'react';
import { UserProfile, Project, Task, Deliverable } from '../types';
import { geminiService } from '../services/gemini';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  user: UserProfile;
  view: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, view }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastError, setLastError] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<{t: string, m: string, type: 'info' | 'error' | 'success'}[]>([]);
  
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<UserProfile> | null>(null);
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({ name: '', file_url: '' });
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    category: 'Geral',
    priority: 'medium' as const,
    status: 'todo' as const,
    due_date: new Date().toISOString().split('T')[0]
  });
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'single' | 'project' | 'profile' | 'deliverable' | 'bulk_tasks';
    id?: string;
    email?: string;
    title: string;
    message: string;
  } | null>(null);
  
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    objectives: '',
    client_emails: '',
    start_date: new Date().toISOString().split('T')[0]
  });

  const [editProjectData, setEditProjectData] = useState({
    name: '',
    objectives: '',
    start_date: ''
  });

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{t: timestamp, m: message, type}, ...prev].slice(0, 50));
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectDetails(selectedProject.id);
      setSelectedTaskIds(new Set());
    }
  }, [selectedProject?.id, view]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setLastError(null);
    try {
      addLog("Sincronizando dados mestres...");
      await Promise.all([fetchProjects(), fetchProfiles(), fetchGlobalTasks()]);
      addLog("Sistema operacional.", "success");
    } catch (err) {
      setLastError(err);
      addLog("Falha na sincronização inicial. Verifique as políticas RLS.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlobalTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*');
    if (!error && data) setTasks(data);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (data) setProjects(data);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (error) throw error;
    if (data) setProfiles(data);
  };

  const fetchProjectDetails = async (projectId: string) => {
    const [tRes, dRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
      supabase.from('deliverables').select('*').eq('project_id', projectId).order('created_at', { descending: true })
    ]);
    if (!tRes.error) setTasks(tRes.data || []);
    if (!dRes.error) setDeliverables(dRes.data || []);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setIsAiLoading(true);
    
    const { type, id, email } = confirmDelete;
    addLog(`Executando exclusão: ${type}...`);
    
    try {
      let error;
      if (type === 'profile') {
        error = id ? (await supabase.from('profiles').delete().eq('id', id)).error : (await supabase.from('profiles').delete().eq('email', email)).error;
      } else if (type === 'project' && id) {
        error = (await supabase.from('projects').delete().eq('id', id)).error;
      } else if (type === 'deliverable' && id) {
        error = (await supabase.from('deliverables').delete().eq('id', id)).error;
      } else if (type === 'single' && id) {
        error = (await supabase.from('tasks').delete().eq('id', id)).error;
      } else if (type === 'bulk_tasks') {
        error = (await supabase.from('tasks').delete().in('id', Array.from(selectedTaskIds))).error;
      }

      if (error) throw error;
      
      addLog("Operação concluída com sucesso.", "success");
      setConfirmDelete(null);
      if (type === 'bulk_tasks') setSelectedTaskIds(new Set());
      if (type === 'project' && id === selectedProject?.id) setSelectedProject(null);
      
      await fetchInitialData();
      if (selectedProject) fetchProjectDetails(selectedProject.id);
    } catch (err: any) { 
      setLastError(err);
      addLog(`Erro na operação: ${err.message}`, "error");
    } finally { 
      setIsAiLoading(false); 
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setIsAiLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: editProjectData.name,
          objectives: editProjectData.objectives,
          start_date: editProjectData.start_date
        })
        .eq('id', selectedProject.id)
        .select();

      if (error) throw error;
      if (data) {
        addLog(`Projeto ${data[0].name} atualizado.`, "success");
        const updatedProjects = projects.map(p => p.id === data[0].id ? data[0] : p);
        setProjects(updatedProjects);
        setSelectedProject(data[0]);
        setIsEditingProject(false);
      }
    } catch (err: any) { 
      setLastError(err); 
      addLog(`Erro ao atualizar: ${err.message}`, "error");
    } finally { 
      setIsAiLoading(false); 
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.email || !editingClient?.full_name) return;
    setIsAiLoading(true);
    try {
      const payload = {
        full_name: editingClient.full_name,
        email: editingClient.email.toLowerCase().trim(),
        role: 'client'
      };

      let res;
      if (editingClient.id) {
        res = await supabase.from('profiles').update(payload).eq('id', editingClient.id);
      } else {
        res = await supabase.from('profiles').insert([payload]);
      }

      if (res.error) throw res.error;
      
      addLog(`Cliente ${payload.full_name} salvo.`, "success");
      await fetchProfiles();
      setIsClientModalOpen(false);
      setEditingClient(null);
    } catch (err: any) {
      addLog(`Erro ao salvar cliente: ${err.message}`, "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const sqlRepair = `-- SCRIPT DE REPARO DE ACESSOS JM DIGITAL (2025)
-- Este script corrige o problema de e-mails cadastrados que não conseguem logar.

-- 1. Cria a função de verificação de Admin
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpa as políticas que podem estar causando bloqueio
DROP POLICY IF EXISTS "Visualização por Email ou Admin" ON profiles;
DROP POLICY IF EXISTS "Atualização por Email ou Admin" ON profiles;
DROP POLICY IF EXISTS "Admin Full Management" ON profiles;

-- 3. PERMISSÃO DE LEITURA (Resolve o erro do e-mail não encontrado)
CREATE POLICY "Visualização por Email ou Admin"
ON profiles FOR SELECT
TO authenticated
USING (
  (email = (auth.jwt() ->> 'email')) OR 
  (auth.uid() = id) OR 
  check_is_admin()
);

-- 4. PERMISSÃO DE VÍNCULO (Permite que o sistema salve o ID do usuário no primeiro login)
CREATE POLICY "Atualização por Email ou Admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  (email = (auth.jwt() ->> 'email')) OR 
  (auth.uid() = id) OR 
  check_is_admin()
)
WITH CHECK (
  (email = (auth.jwt() ->> 'email')) OR 
  (auth.uid() = id) OR 
  check_is_admin()
);

-- 5. ACESSO TOTAL PARA O ADMIN
CREATE POLICY "Admin Full Management"
ON profiles FOR ALL
TO authenticated
USING (check_is_admin())
WITH CHECK (check_is_admin());`;

  const renderSidebar = () => (
    <aside className="lg:col-span-1 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operações</h3>
        <button onClick={() => { setIsCreatingProject(true); setSelectedProject(null); }} className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-md font-bold text-lg">+</button>
      </div>
      <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
        {projects.map(p => (
          <div key={p.id} onClick={() => { setSelectedProject(p); setIsCreatingProject(false); }} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedProject?.id === p.id && !isCreatingProject ? 'bg-white border-indigo-600 shadow-lg' : 'bg-white border-slate-50'}`}>
            <h4 className="font-bold text-[11px] text-slate-800 leading-tight truncate">{p.name}</h4>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{p.status}</span>
              <span className="text-[8px] font-bold text-indigo-500">{new Date(p.start_date).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );

  const renderDashboardContent = () => {
    if (view === 'settings') return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
        <header>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Infraestrutura e Diagnóstico</h2>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Configurações Avançadas JM Digital</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg">🔧</div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Script de Reparo SQL</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execute para corrigir problemas de acesso de clientes</p>
                </div>
              </div>
              
              <div className="relative group">
                <pre className="bg-slate-900 text-indigo-300 p-6 rounded-2xl text-[10px] font-mono overflow-x-auto shadow-inner leading-relaxed max-h-[400px]">
                  {sqlRepair}
                </pre>
                <button 
                  onClick={() => { navigator.clipboard.writeText(sqlRepair); addLog("Script SQL copiado.", "success"); }}
                  className="absolute top-4 right-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all"
                >
                  Copiar Script
                </button>
              </div>
              
              <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3">Como usar:</h4>
                <ol className="text-[11px] text-slate-500 space-y-2 font-medium">
                  <li>1. Acesse seu Dashboard do <strong>Supabase</strong>.</li>
                  <li>2. Vá no menu lateral <strong>"SQL Editor"</strong>.</li>
                  <li>3. Clique em <strong>"New Query"</strong> e cole o script acima.</li>
                  <li>4. Clique em <strong>"Run"</strong> para aplicar as correções.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Logs do Sistema</h3>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <p className="text-[10px] text-slate-300 italic text-center py-20">Nenhuma atividade registrada.</p>
                ) : auditLogs.map((log, i) => (
                  <div key={i} className={`p-3 rounded-xl border-l-4 text-[10px] font-medium leading-tight ${
                    log.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
                    log.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
                    'bg-slate-50 border-indigo-400 text-slate-600'
                  }`}>
                    <span className="block text-[8px] font-black opacity-50 mb-1">{log.t}</span>
                    {log.m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
    if (view === 'clients') return <div className="max-w-5xl mx-auto">{renderClientsTable()}</div>;
    if (view === 'reports') return <div className="max-w-7xl mx-auto">{renderReports()}</div>;
    if (view === 'kanban') return <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">{renderSidebar()}<main className="lg:col-span-3">{renderKanban()}</main></div>;
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {renderSidebar()}
        <main className="lg:col-span-3">
          {isCreatingProject ? (
            <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100">
               <h3 className="text-xl font-black mb-8 text-slate-900">Novo Setup Estratégico</h3>
               <form onSubmit={handleCreateProject} className="space-y-6">
                  <input required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Nome da Empresa" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Data de Início</label>
                      <input required type="date" value={newProject.start_date} onChange={e => setNewProject({...newProject, start_date: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Stakeholders</label>
                      <input required value={newProject.client_emails} onChange={e => setNewProject({...newProject, client_emails: e.target.value})} placeholder="email@exemplo.com" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
                    </div>
                  </div>
                  <textarea required value={newProject.objectives} onChange={e => setNewProject({...newProject, objectives: e.target.value})} placeholder="Objetivos e KPIs..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold min-h-[140px] resize-none" />
                  <div className="flex gap-4">
                    <button type="submit" disabled={isAiLoading} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl">Criar</button>
                    <button type="button" onClick={() => setIsCreatingProject(false)} className="px-10 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">Cancelar</button>
                  </div>
               </form>
            </div>
          ) : selectedProject ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-6">
              <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 leading-none">{selectedProject.name}</h2>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-2 block">Início: {new Date(selectedProject.start_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditProjectData({ name: selectedProject.name, objectives: selectedProject.objectives, start_date: selectedProject.start_date.split('T')[0] }); setIsEditingProject(true); }} className="p-2.5 bg-slate-50 text-indigo-600 rounded-xl">✏️</button>
                      <button onClick={handleGeneratePremiumStrategy} disabled={isAiLoading} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">✨ IA Estratégia</button>
                      <button onClick={() => setConfirmDelete({ type: 'project', id: selectedProject.id, title: 'Apagar Projeto', message: 'Deseja excluir tudo desta operação?' })} className="p-2.5 bg-red-50 text-red-500 rounded-xl">🗑️</button>
                    </div>
                 </div>
                 <textarea className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] min-h-[300px] font-medium text-slate-700 outline-none focus:border-indigo-600 text-sm md:text-base leading-relaxed" value={selectedProject.client_message || ''} readOnly placeholder="Gere a estratégia acima..." />
                 <button onClick={handlePrepareTasks} disabled={isAiLoading || !selectedProject.client_message} className="w-full mt-6 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg">🎯 Gerar Kanban via IA</button>
              </div>

              <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
                <h3 className="text-base font-black mb-6 text-slate-900">📂 Ativos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {deliverables.map(d => (
                    <div key={d.id} className="p-4 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                      <p className="font-bold text-slate-800 text-xs truncate flex-1 pr-4">{d.name}</p>
                      <button onClick={() => setConfirmDelete({ type: 'deliverable', id: d.id, title: 'Remover Link', message: 'Remover este ativo?' })} className="text-red-400 text-lg">×</button>
                    </div>
                  ))}
                  <button onClick={() => setIsDeliverableModalOpen(true)} className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 font-bold text-xs">+ Novo Link</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-40 text-center bg-white rounded-[3rem] border border-slate-100 shadow-xl">
               <h3 className="text-xl font-black text-slate-900">Selecione uma Operação</h3>
               <p className="text-slate-400 text-[10px] mt-2 font-medium uppercase tracking-widest">Painel Administrativo JM Digital</p>
            </div>
          )}
        </main>
      </div>
    );
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiLoading(true);
    try {
      const { data, error } = await supabase.from('projects').insert([{
        name: newProject.name,
        objectives: newProject.objectives,
        client_emails: newProject.client_emails.split(',').map(e => e.trim().toLowerCase()),
        start_date: newProject.start_date,
        status: 'planning'
      }]).select();
      if (error) throw error;
      if (data) {
        setProjects([data[0], ...projects]);
        setSelectedProject(data[0]);
        setIsCreatingProject(false);
        addLog(`Novo projeto criado: ${data[0].name}`, "success");
      }
    } catch (err: any) { addLog(err.message, "error"); } finally { setIsAiLoading(false); }
  };

  const handleGeneratePremiumStrategy = async () => {
    if (!selectedProject) return;
    setIsAiLoading(true);
    try {
      addLog("Gerando estratégia IA...");
      const strategy = await geminiService.generatePremiumProposal(selectedProject);
      const { error } = await supabase.from('projects').update({ client_message: strategy }).eq('id', selectedProject.id);
      if (error) throw error;
      setSelectedProject({ ...selectedProject, client_message: strategy });
      setProjects(projects.map(p => p.id === selectedProject.id ? { ...p, client_message: strategy } : p));
      addLog("Estratégia gerada com sucesso.", "success");
    } catch (err: any) { addLog(err.message, "error"); } finally { setIsAiLoading(false); }
  };

  const handlePrepareTasks = async () => {
    if (!selectedProject?.client_message) return;
    setIsAiLoading(true);
    try {
      addLog("Extraindo tarefas do plano...");
      const extracted = await geminiService.extractTasksFromStrategy(selectedProject.client_message);
      const baseDate = new Date(selectedProject.start_date);
      const newTasks = extracted.map((t: any) => {
        const due = new Date(baseDate);
        due.setDate(baseDate.getDate() + (t.day_offset || 0));
        return {
          project_id: selectedProject.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: 'todo',
          due_date: due.toISOString(),
          assigned_to: 'Agência',
          description: t.description || ''
        };
      });
      const { data, error } = await supabase.from('tasks').insert(newTasks).select();
      if (error) throw error;
      if (data) {
        setTasks([...tasks, ...data]);
        addLog(`${data.length} tarefas integradas ao Kanban.`, "success");
      }
    } catch (err: any) { addLog(err.message, "error"); } finally { setIsAiLoading(false); }
  };

  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const { data, error } = await supabase.from('deliverables').insert([{ project_id: selectedProject.id, name: newDeliverable.name, file_url: newDeliverable.file_url }]).select();
    if (data) { 
      setDeliverables([data[0], ...deliverables]); 
      setIsDeliverableModalOpen(false); 
      setNewDeliverable({ name: '', file_url: '' });
      addLog("Novo ativo catalogado.", "success");
    }
  };

  const handleSaveManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setIsAiLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').insert([{
        project_id: selectedProject.id,
        title: newTaskData.title,
        category: newTaskData.category,
        priority: newTaskData.priority,
        status: newTaskData.status,
        due_date: new Date(newTaskData.due_date).toISOString(),
        assigned_to: 'Agência',
        description: ''
      }]).select();
      if (error) throw error;
      if (data) {
        setTasks([...tasks, data[0]]);
        setIsTaskModalOpen(false);
        setNewTaskData({ title: '', category: 'Geral', priority: 'medium', status: 'todo', due_date: new Date().toISOString().split('T')[0] });
        addLog(`Tarefa "${data[0].title}" adicionada.`, "success");
      }
    } catch (err: any) { addLog(err.message, "error"); } finally { setIsAiLoading(false); }
  };

  const renderReports = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning').length;
    
    return (
      <div className="space-y-8 animate-in fade-in">
        <header>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cockpit de Performance</h2>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Visão Geral da Operação JM Digital</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Eficiência Global</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-indigo-600">{completionRate}%</span>
              <span className="text-xs font-bold text-slate-400">Done Rate</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-6 overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Projetos Ativos</p>
            <span className="text-4xl font-black text-slate-900">{activeProjects}</span>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total de Tarefas</p>
            <span className="text-4xl font-black text-slate-900">{totalTasks}</span>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Stakeholders</p>
            <span className="text-4xl font-black text-slate-900">{profiles.length}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderClientsTable = () => (
    <div className="space-y-6 animate-in fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Clientes</h2>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Controle de Stakeholders</p>
        </div>
        <button onClick={() => { setEditingClient({ full_name: '', email: '' }); setIsClientModalOpen(true); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-[11px] uppercase tracking-wider">
          + Novo Cliente
        </button>
      </header>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">Nome</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">E-mail</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {profiles.map(p => (
              <tr key={p.email} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-6 font-bold text-slate-800 text-sm">{p.full_name}</td>
                <td className="p-6 text-xs text-slate-500 font-medium">{p.email}</td>
                <td className="p-6 text-right space-x-4">
                  <button onClick={() => { setEditingClient(p); setIsClientModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase">Editar</button>
                  <button onClick={() => setConfirmDelete({ type: 'profile', id: p.id, email: p.email, title: 'Remover Cliente', message: `Excluir acesso de ${p.full_name}?` })} className="text-red-400 font-black text-[10px] uppercase">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderKanban = () => {
    const projectTasks = tasks.filter(t => t.project_id === selectedProject?.id);
    return (
      <div className="space-y-6 animate-in fade-in">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quadro Kanban</h2>
            <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">{selectedProject?.name || 'Selecione um projeto'}</p>
          </div>
          {selectedProject && (
            <button onClick={() => setIsTaskModalOpen(true)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
              + Nova Tarefa
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['todo', 'in_progress', 'done'].map(status => (
            <div key={status} className="bg-slate-100/50 rounded-[2rem] p-5 border border-slate-200 min-h-[500px]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6 px-1">
                {status === 'todo' ? 'A Fazer' : status === 'in_progress' ? 'Execução' : 'Concluído'}
              </h3>
              <div className="space-y-3">
                {projectTasks.filter(t => t.status === status).map(task => (
                  <div key={task.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[7px] font-black text-indigo-500 uppercase block mb-1">{task.category}</span>
                    <h4 className="font-bold text-slate-800 text-[11px] leading-tight mb-3">{task.title}</h4>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                      <span className="text-[8px] text-slate-400 font-bold">{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${task.priority === 'high' ? 'bg-red-400' : 'bg-green-400'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      {renderDashboardContent()}

      {confirmDelete && (
        <div className="fixed inset-0 bg-indigo-950/90 z-[10000] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl">
            <h3 className="text-lg font-black mb-2">{confirmDelete.title}</h3>
            <p className="text-slate-500 text-xs mb-8">{confirmDelete.message}</p>
            <div className="flex gap-3">
              <button onClick={executeDelete} className="flex-1 py-4 bg-red-500 text-white font-black rounded-xl text-[10px] uppercase">Excluir</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {isEditingProject && selectedProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-10">
            <h3 className="text-xl font-black mb-8">Editar Projeto</h3>
            <form onSubmit={handleUpdateProject} className="space-y-5">
              <input required value={editProjectData.name} onChange={e => setEditProjectData({...editProjectData, name: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold" />
              <input required type="date" value={editProjectData.start_date} onChange={e => setEditProjectData({...editProjectData, start_date: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold" />
              <textarea required value={editProjectData.objectives} onChange={e => setEditProjectData({...editProjectData, objectives: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold min-h-[120px] resize-none" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase">Salvar</button>
                <button type="button" onClick={() => setIsEditingProject(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10">
            <h3 className="text-xl font-black mb-6">Gestão de Stakeholder</h3>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <input required value={editingClient?.full_name} onChange={e => setEditingClient({...editingClient, full_name: e.target.value})} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
              <input required type="email" value={editingClient?.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} placeholder="E-mail de Acesso" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest">Salvar Perfil</button>
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase">Sair</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10">
            <h3 className="text-xl font-black mb-6">Nova Tarefa Manual</h3>
            <form onSubmit={handleSaveManualTask} className="space-y-4">
              <input required value={newTaskData.title} onChange={e => setNewTaskData({...newTaskData, title: e.target.value})} placeholder="Título" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
              <div className="grid grid-cols-2 gap-4">
                <input required value={newTaskData.category} onChange={e => setNewTaskData({...newTaskData, category: e.target.value})} placeholder="Categoria" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold" />
                <select value={newTaskData.priority} onChange={e => setNewTaskData({...newTaskData, priority: e.target.value as any})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold">
                  <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
                </select>
              </div>
              <input type="date" value={newTaskData.due_date} onChange={e => setNewTaskData({...newTaskData, due_date: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px]">Criar</button>
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Sair</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeliverableModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
            <h3 className="text-lg font-black mb-6">Novo Ativo</h3>
            <form onSubmit={handleSaveDeliverable} className="space-y-4">
              <input required value={newDeliverable.name} onChange={e => setNewDeliverable({...newDeliverable, name: e.target.value})} placeholder="Nome" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl" />
              <input required value={newDeliverable.file_url} onChange={e => setNewDeliverable({...newDeliverable, file_url: e.target.value})} placeholder="URL" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl" />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase">Adicionar</button>
              <button type="button" onClick={() => setIsDeliverableModalOpen(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">Sair</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
