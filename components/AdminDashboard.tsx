
import React, { useState, useEffect } from 'react';
import { UserProfile, Project, Task, Deliverable } from '../types';
import { geminiService } from '../services/gemini';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  user: UserProfile;
  view: string;
}

interface DraftTask {
  tempId: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  day_offset: number;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, view }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [showDraftReview, setShowDraftReview] = useState(false);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<UserProfile> | null>(null);

  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({ name: '', file_url: '' });
  
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'single' | 'all' | 'project' | 'profile' | 'deliverable';
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

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectDetails(selectedProject.id);
      setShowDraftReview(false);
    } else {
      setTasks([]);
      setDeliverables([]);
    }
  }, [selectedProject?.id]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    await Promise.all([fetchProjects(), fetchProfiles()]);
    setIsLoading(false);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setProjects(data);
      if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (!error && data) setProfiles(data);
  };

  const fetchProjectDetails = async (projectId: string) => {
    const [tRes, dRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
      supabase.from('deliverables').select('*').eq('project_id', projectId).order('created_at', { descending: true })
    ]);
    if (!tRes.error) setTasks(tRes.data || []);
    if (!dRes.error) setDeliverables(dRes.data || []);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.objectives || !newProject.client_emails) return;
    setIsAiLoading(true);
    try {
      const clientEmails = newProject.client_emails.split(',').map(e => e.trim().toLowerCase());
      const { data, error } = await supabase.from('projects').insert([{
        name: newProject.name,
        description: newProject.description || '',
        objectives: newProject.objectives,
        client_emails: clientEmails,
        start_date: newProject.start_date,
        status: 'planning'
      }]).select();

      if (error) throw error;
      if (data) {
        setProjects([data[0], ...projects]);
        setSelectedProject(data[0]);
        setIsCreatingProject(false);
        setNewProject({ name: '', description: '', objectives: '', client_emails: '', start_date: new Date().toISOString().split('T')[0] });
      }
    } catch (err: any) {
      alert("Erro ao criar projeto: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGeneratePremiumStrategy = async () => {
    if (!selectedProject) return;
    setIsAiLoading(true);
    try {
      const strategy = await geminiService.generatePremiumProposal(selectedProject);
      if (strategy) {
        const { error } = await supabase.from('projects').update({ client_message: strategy }).eq('id', selectedProject.id);
        if (error) throw error;
        setSelectedProject({ ...selectedProject, client_message: strategy });
        setProjects(projects.map(p => p.id === selectedProject.id ? { ...p, client_message: strategy } : p));
      }
    } catch (err: any) {
      alert("Erro IA: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePrepareTasks = async () => {
    if (!selectedProject?.client_message) return;
    setIsAiLoading(true);
    try {
      const extractedTasks = await geminiService.extractTasksFromStrategy(selectedProject.client_message);
      const startDate = new Date(selectedProject.start_date);
      
      const newTasks = extractedTasks.map((t: any) => {
        const dueDate = new Date(startDate);
        dueDate.setDate(startDate.getDate() + (t.day_offset || 0));
        return {
          project_id: selectedProject.id,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: 'todo',
          due_date: dueDate.toISOString(),
          assigned_to: user.full_name
        };
      });

      const { data, error } = await supabase.from('tasks').insert(newTasks).select();
      if (error) throw error;
      if (data) {
        setTasks([...tasks, ...data]);
        alert("Cronograma gerado com sucesso!");
      }
    } catch (err: any) {
      alert("Erro ao extrair tarefas: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editingTask?.title) return;
    setIsAiLoading(true);
    try {
      const payload = {
        project_id: selectedProject.id,
        title: editingTask.title,
        description: editingTask.description || '',
        status: editingTask.status || 'todo',
        priority: editingTask.priority || 'medium',
        category: editingTask.category || 'Geral',
        due_date: editingTask.due_date || new Date().toISOString(),
        assigned_to: editingTask.assigned_to || user.full_name
      };

      if (editingTask.id) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...payload } : t));
      } else {
        const { data, error } = await supabase.from('tasks').insert([payload]).select();
        if (error) throw error;
        if (data) setTasks([...tasks, data[0]]);
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
    } catch (err: any) {
      alert("Erro ao salvar tarefa: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.email || !editingClient?.full_name) return;
    setIsAiLoading(true);
    try {
      const payload: any = {
        full_name: editingClient.full_name,
        email: editingClient.email.toLowerCase(),
        role: editingClient.role || 'client'
      };
      if (editingClient.id) payload.id = editingClient.id;

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'email' });
      if (error) throw error;
      
      await fetchProfiles();
      setIsClientModalOpen(false);
      setEditingClient(null);
      alert("Perfil salvo com sucesso!");
    } catch (err: any) { 
      alert("Erro ao salvar perfil: " + err.message); 
    } finally { 
      setIsAiLoading(false); 
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setIsAiLoading(true);
    try {
      let error;
      if (confirmDelete.type === 'single' && confirmDelete.id) {
        const { error: err } = await supabase.from('tasks').delete().eq('id', confirmDelete.id);
        error = err;
      } else if (confirmDelete.type === 'deliverable' && confirmDelete.id) {
        const { error: err } = await supabase.from('deliverables').delete().eq('id', confirmDelete.id);
        error = err;
      } else if (confirmDelete.type === 'project' && confirmDelete.id) {
        const { error: err } = await supabase.from('projects').delete().eq('id', confirmDelete.id);
        error = err;
      } else if (confirmDelete.type === 'profile') {
        const query = supabase.from('profiles').delete();
        if (confirmDelete.id) {
          const { error: err } = await query.eq('id', confirmDelete.id);
          error = err;
        } else if (confirmDelete.email) {
          const { error: err } = await query.eq('email', confirmDelete.email);
          error = err;
        }
      }

      if (error) throw error;
      
      if (confirmDelete.type === 'profile') await fetchProfiles();
      if (confirmDelete.type === 'project') await fetchProjects();
      if (confirmDelete.type === 'single') fetchProjectDetails(selectedProject!.id);
      if (confirmDelete.type === 'deliverable') fetchProjectDetails(selectedProject!.id);

      setConfirmDelete(null);
    } catch (err: any) { 
      alert("Erro ao excluir: " + err.message); 
    } finally { 
      setIsAiLoading(false); 
    }
  };

  const handleMaintenanceCleanup = async () => {
    setIsAiLoading(true);
    try {
      const pIds = projects.map(p => p.id);
      if (pIds.length > 0) {
        await supabase.from('tasks').delete().not('project_id', 'in', `(${pIds.join(',')})`);
        await supabase.from('deliverables').delete().not('project_id', 'in', `(${pIds.join(',')})`);
        await supabase.from('messages').delete().not('project_id', 'in', `(${pIds.join(',')})`);
      }
      alert("Limpeza concluída.");
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExportData = () => {
    const data = { projects, tasks, profiles, deliverables };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newDeliverable.name || !newDeliverable.file_url) return;
    setIsAiLoading(true);
    try {
      const { data, error } = await supabase.from('deliverables').insert([{
        project_id: selectedProject.id,
        name: newDeliverable.name,
        file_url: newDeliverable.file_url
      }]).select();
      if (error) throw error;
      if (data) {
        setDeliverables([data[0], ...deliverables]);
        setNewDeliverable({ name: '', file_url: '' });
        setIsDeliverableModalOpen(false);
      }
    } catch (err: any) { alert("Erro: " + err.message); } finally { setIsAiLoading(false); }
  };

  const renderConfirmationModal = () => {
    if (!confirmDelete) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-300">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">⚠️</div>
          <h3 className="text-xl font-black text-center mb-2">{confirmDelete.title}</h3>
          <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed font-medium">{confirmDelete.message}</p>
          <div className="flex flex-col gap-3">
            <button onClick={executeDelete} className="w-full py-4 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-colors shadow-lg">Confirmar</button>
            <button onClick={() => setConfirmDelete(null)} className="w-full py-4 bg-slate-100 text-slate-500 font-black rounded-xl">Cancelar</button>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'clients') {
    return (
      <div className="space-y-8 animate-in fade-in">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 leading-tight">Diretório de Clientes</h2>
            <p className="text-slate-500 font-medium">Gestão centralizada de perfis</p>
          </div>
          <button onClick={() => { setEditingClient({ role: 'client' }); setIsClientModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all text-xs uppercase">+ Novo Perfil</button>
        </header>
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-8 text-[11px] font-black uppercase text-slate-400">Nome</th>
                <th className="p-8 text-[11px] font-black uppercase text-slate-400">E-mail</th>
                <th className="p-8 text-[11px] font-black uppercase text-slate-400">Função</th>
                <th className="p-8 text-[11px] font-black uppercase text-slate-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {profiles.map(p => (
                <tr key={p.id || p.email} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-8 font-bold text-slate-800">{p.full_name}</td>
                  <td className="p-8 text-sm text-slate-500">{p.email}</td>
                  <td className="p-8 text-[10px] font-black uppercase text-indigo-600">{p.role}</td>
                  <td className="p-8 text-right space-x-4">
                    <button onClick={() => { setEditingClient(p); setIsClientModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 font-black text-[10px] uppercase">Editar</button>
                    <button onClick={() => setConfirmDelete({ type: 'profile', id: p.id, email: p.email, title: 'Remover Cliente', message: `Remover ${p.full_name}?` })} className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in">
              <h3 className="text-2xl font-black mb-8">{editingClient?.email ? 'Editar Perfil' : 'Novo Cliente'}</h3>
              <form onSubmit={handleSaveClient} className="space-y-6">
                <input required value={editingClient?.full_name || ''} onChange={e => setEditingClient({...editingClient, full_name: e.target.value})} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                <input required type="email" value={editingClient?.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} placeholder="E-mail" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                <select value={editingClient?.role || 'client'} onChange={e => setEditingClient({...editingClient, role: e.target.value as any})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold">
                  <option value="client">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-4">
                  <button type="submit" disabled={isAiLoading} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl">{isAiLoading ? "Salvando..." : "Salvar"}</button>
                  <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-6 py-4 bg-slate-100 rounded-2xl font-bold">Fechar</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderConfirmationModal()}
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="space-y-10 animate-in fade-in pb-20">
        <header><h2 className="text-4xl font-black text-slate-900 leading-tight">Painel de Controle</h2></header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white p-12 rounded-[3rem] border shadow-xl">
             <h3 className="text-2xl font-black mb-4">Reparo de Dados</h3>
             <button onClick={handleMaintenanceCleanup} disabled={isAiLoading} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl">Executar Varredura</button>
          </div>
          <div className="bg-white p-12 rounded-[3rem] border shadow-xl">
             <h3 className="text-2xl font-black mb-4">Backup Master</h3>
             <button onClick={handleExportData} className="w-full py-5 bg-green-600 text-white font-black rounded-2xl">Download JSON</button>
          </div>
        </div>
      </div>
    );
  }

  // Kanban view
  if (view === 'kanban') {
    const columns = [
      { id: 'todo', title: 'A Fazer', color: 'bg-slate-300' },
      { id: 'in_progress', title: 'Execução', color: 'bg-indigo-600' },
      { id: 'done', title: 'Pronto', color: 'bg-green-500' }
    ];
    return (
      <div className="space-y-8 animate-in fade-in">
        <header className="flex justify-between items-center">
          <h2 className="text-4xl font-black tracking-tighter">Workflow JM</h2>
          <div className="flex gap-4">
            <select className="bg-white border p-3 rounded-xl font-bold" value={selectedProject?.id || ''} onChange={(e) => setSelectedProject(projects.find(x => x.id === e.target.value) || null)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => { setEditingTask({ status: 'todo' as any }); setIsTaskModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase">+ Tarefa</button>
          </div>
        </header>
        <div className="flex md:grid md:grid-cols-3 gap-8 min-h-[600px] overflow-x-auto">
          {columns.map(col => (
            <div key={col.id} className="flex-1 bg-slate-100/50 rounded-[3rem] p-8 border">
              <h3 className="flex items-center gap-4 text-[12px] font-black uppercase text-slate-400 mb-10">
                <div className={`w-4 h-4 rounded-full ${col.color}`}></div>{col.title}
              </h3>
              <div className="space-y-6">
                {tasks.filter(t => t.status === col.id).map(task => (
                  <div key={task.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border group">
                    <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-1 rounded-full">{task.category}</span>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }} className="text-indigo-400">✎</button>
                        <button onClick={() => setConfirmDelete({ type: 'single', id: task.id, title: 'Excluir', message: 'Deseja excluir?' })} className="text-red-400">×</button>
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-4 text-xl leading-tight">{task.title}</h4>
                    <p className="text-[11px] font-bold text-indigo-600">{new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl p-10 animate-in zoom-in">
              <h3 className="text-2xl font-black mb-8">Gestão de Entrega</h3>
              <form onSubmit={handleSaveTask} className="space-y-6">
                <input required value={editingTask?.title || ''} onChange={e => setEditingTask({...editingTask, title: e.target.value})} placeholder="Título" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                <textarea value={editingTask?.description || ''} onChange={e => setEditingTask({...editingTask, description: e.target.value})} placeholder="Descrição" className="w-full p-4 bg-slate-50 rounded-2xl outline-none min-h-[100px]" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={editingTask?.status || 'todo'} onChange={e => setEditingTask({...editingTask, status: e.target.value as any})} className="p-4 bg-slate-50 rounded-2xl font-bold"><option value="todo">A Fazer</option><option value="in_progress">Execução</option><option value="done">Pronto</option></select>
                  <input type="date" value={editingTask?.due_date ? editingTask.due_date.split('T')[0] : ''} onChange={e => setEditingTask({...editingTask, due_date: e.target.value})} className="p-4 bg-slate-50 rounded-2xl font-bold" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-3xl">Salvar</button>
                  <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-8 py-4 bg-slate-100 rounded-3xl font-bold">Fechar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default view (Projects)
  return (
    <div className="animate-in fade-in duration-500 space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <aside className="lg:col-span-1 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contratos</h3>
            <button onClick={() => setIsCreatingProject(true)} className="bg-indigo-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg font-bold text-xl">+</button>
          </div>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
            {projects.map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setIsCreatingProject(false); }} className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer ${selectedProject?.id === p.id && !isCreatingProject ? 'bg-white border-indigo-600 shadow-xl' : 'bg-white border-slate-100'}`}>
                <h4 className="font-black text-sm text-slate-800">{p.name}</h4>
                <p className="text-[8px] font-black uppercase text-slate-400 mt-2">{p.status}</p>
              </div>
            ))}
          </div>
        </aside>
        <main className="lg:col-span-3">
          {isCreatingProject ? (
            <div className="bg-white p-12 rounded-[3rem] shadow-xl">
               <h3 className="text-3xl font-black mb-8 leading-tight">Nova Operação Digital</h3>
               <form onSubmit={handleCreateProject} className="space-y-6">
                  <input required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Nome" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold" />
                  <input required type="date" value={newProject.start_date} onChange={e => setNewProject({...newProject, start_date: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold" />
                  <input required value={newProject.client_emails} onChange={e => setNewProject({...newProject, client_emails: e.target.value})} placeholder="E-mails autorizados (vírgula)" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold" />
                  <textarea required value={newProject.objectives} onChange={e => setNewProject({...newProject, objectives: e.target.value})} placeholder="Objetivos do Contrato" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold min-h-[150px]" />
                  <div className="flex gap-4">
                    <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-2xl">Criar Contrato</button>
                    <button type="button" onClick={() => setIsCreatingProject(false)} className="px-10 py-5 bg-slate-100 rounded-2xl font-bold">Voltar</button>
                  </div>
               </form>
            </div>
          ) : selectedProject ? (
            <div className="space-y-10">
              <div className="bg-white p-12 rounded-[3rem] border relative overflow-hidden">
                 <div className="flex justify-between items-center mb-12">
                    <h2 className="text-4xl font-black tracking-tighter">{selectedProject.name}</h2>
                    <div className="flex gap-3">
                      <button onClick={handleGeneratePremiumStrategy} disabled={isAiLoading} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase">✨ IA Strategy</button>
                      <button onClick={() => setIsDeliverableModalOpen(true)} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">📂 Ativos</button>
                      <button onClick={() => setConfirmDelete({ type: 'project', id: selectedProject.id, title: 'Encerrar Projeto', message: 'Deseja apagar todos os dados?' })} className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-xl">🗑️</button>
                    </div>
                 </div>
                 <textarea className="w-full p-8 bg-slate-50 border-2 rounded-[2.5rem] min-h-[400px] font-medium text-slate-700 outline-none text-lg" value={selectedProject.client_message || ''} onChange={(e) => setSelectedProject({...selectedProject, client_message: e.target.value})} />
                 <button onClick={handlePrepareTasks} disabled={isAiLoading || !selectedProject.client_message} className="w-full mt-8 py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase text-xs">🎯 Gerar Cronograma IA</button>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border">
                <h3 className="text-2xl font-black mb-8">Repositório de Ativos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {deliverables.map(d => (
                    <div key={d.id} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center group">
                      <p className="font-bold truncate">{d.name}</p>
                      <button onClick={() => setConfirmDelete({ type: 'deliverable', id: d.id, title: 'Remover', message: 'Remover ativo?' })} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-40 text-center bg-white rounded-[4rem] border">
               <div className="text-6xl mb-6">📁</div>
               <h3 className="text-2xl font-black">Central Estratégica</h3>
               <p className="text-slate-400">Selecione uma empresa na barra lateral.</p>
            </div>
          )}
        </main>
      </div>
      {isDeliverableModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in">
            <h3 className="text-2xl font-black mb-8">Novo Ativo</h3>
            <form onSubmit={handleSaveDeliverable} className="space-y-6">
              <input required value={newDeliverable.name} onChange={e => setNewDeliverable({...newDeliverable, name: e.target.value})} placeholder="Nome do Arquivo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
              <input required value={newDeliverable.file_url} onChange={e => setNewDeliverable({...newDeliverable, file_url: e.target.value})} placeholder="Link (Drive/Notion)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl">Salvar</button>
                <button type="button" onClick={() => setIsDeliverableModalOpen(false)} className="px-6 py-4 bg-slate-100 rounded-2xl font-bold">Fechar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {renderConfirmationModal()}
    </div>
  );
};

export default AdminDashboard;
