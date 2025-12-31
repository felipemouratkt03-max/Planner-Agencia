
import React, { useState, useEffect } from 'react';
import { UserProfile, Project, Task, Message, Deliverable } from '../types';
import { supabase } from '../lib/supabase';

interface ClientDashboardProps {
  user: UserProfile;
  view: string;
  onViewChange?: (view: string) => void;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, view, onViewChange }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [newObs, setNewObs] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchClientData();
  }, [user.email]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetails(selectedProject.id);
    }
  }, [selectedProject?.id]);

  const fetchClientData = async () => {
    setIsLoading(true);
    const lowerEmail = user.email.toLowerCase();
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .contains('client_emails', [lowerEmail]);

    if (!error && projectsData && projectsData.length > 0) {
      setProjects(projectsData);
      setSelectedProject(projectsData[0]);
    }
    setIsLoading(false);
  };

  const fetchProjectDetails = async (projectId: string) => {
    const { data: tData } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { ascending: true });
    if (tData) setTasks(tData);
    const { data: mData } = await supabase.from('messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    if (mData) setMessages(mData);
    const { data: dData } = await supabase.from('deliverables').select('*').eq('project_id', projectId).order('created_at', { descending: true });
    if (dData) setDeliverables(dData);
  };

  const handleSendObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObs.trim() || !selectedProject) return;
    setIsSending(true);
    const { data, error } = await supabase.from('messages').insert([{
      project_id: selectedProject.id,
      content: newObs,
      sender_name: user.full_name
    }]).select();
    if (!error && data) {
      setMessages([...messages, data[0]]);
      setNewObs('');
    }
    setIsSending(false);
  };

  const parseContent = (text: string) => {
    if (!text) return null;
    const cleanText = text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: cleanText }} />;
  };

  const renderProjectSelector = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight tracking-tighter">
          Olá, <span className="text-indigo-600">{user.full_name.split(' ')[0]}</span>
        </h1>
        <p className="text-slate-500 font-bold mt-2 text-base md:text-lg">Painel Estratégico & Transparência</p>
      </div>
      {projects.length > 0 && (
        <div className="bg-white p-3 rounded-[2.5rem] shadow-2xl border border-indigo-100 flex items-center gap-4 w-full md:w-auto">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-lg shadow-lg">🎯</div>
          <div className="flex-1 md:min-w-[200px]">
             <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">PROJETO ATIVO</span>
             <select 
                className="bg-transparent border-none p-0 font-black outline-none text-slate-800 cursor-pointer w-full text-sm"
                value={selectedProject?.id || ''}
                onChange={(e) => setSelectedProject(projects.find(x => x.id === e.target.value) || null)}
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          </div>
        </div>
      )}
    </div>
  );

  const renderStrategy = () => {
    if (!selectedProject?.client_message) return (
      <div className="animate-in fade-in max-w-7xl mx-auto">
        {renderProjectSelector()}
        <div className="text-center py-20 md:py-32 bg-white rounded-[3rem] md:rounded-[4rem] shadow-sm border border-slate-100 p-6">
          <div className="text-5xl md:text-6xl mb-6 shadow-inner w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto">⚙️</div>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">Sincronizando Ecossistema Estratégico...</p>
        </div>
      </div>
    );

    const lines = selectedProject.client_message.split('\n');

    return (
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
        {renderProjectSelector()}

        <div className="bg-white p-6 md:p-20 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-t-[4rem]"></div>
          
          <div className="space-y-6 md:space-y-8 prose prose-indigo max-w-none">
            {lines.map((line, i) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('# ')) return <h1 key={i} className="text-3xl md:text-5xl font-black text-slate-900 border-b border-slate-100 pb-8 mb-10 tracking-tight leading-tight">{trimmed.replace('# ', '')}</h1>;
              if (trimmed.startsWith('## ')) {
                const title = trimmed.replace('## ', '');
                return (
                  <div key={i} className="mt-12 md:mt-16 mb-8">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-4">
                      <span className="w-1.5 h-7 md:h-9 bg-indigo-600 rounded-full"></span>
                      {title}
                    </h2>
                  </div>
                );
              }
              if (trimmed.startsWith('|') && trimmed.includes('-')) return null;
              if (trimmed.startsWith('|')) {
                const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());
                return (
                  <div key={i} className="overflow-x-auto my-6 -mx-6 px-6 md:mx-0 md:px-0">
                    <table className="w-full border-separate border-spacing-0 min-w-[500px]">
                      <tbody>
                        <tr className="hover:bg-slate-50 transition-colors">
                          {cells.map((cell, idx) => (
                            <td key={idx} className={`p-4 md:p-5 text-sm md:text-base border-b border-slate-100 ${idx === 0 ? 'font-black text-indigo-600 w-1/4' : 'font-medium text-slate-600'}`}>
                              {parseContent(cell)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              }
              if (trimmed === '') return null;
              return <p key={i} className="text-lg md:text-xl font-medium text-slate-600 leading-relaxed mb-6">{parseContent(trimmed)}</p>;
            })}
          </div>
        </div>

        <div className="bg-white p-8 md:p-14 rounded-[3rem] md:rounded-[4rem] shadow-xl border border-slate-100">
           <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl">📂</div>
             Repositório de Ativos
           </h3>
           {deliverables.length === 0 ? (
             <div className="py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-6">
               <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] leading-relaxed">Aguardando ativos para revisão</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {deliverables.map(file => (
                 <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 md:p-8 bg-slate-50 rounded-[2.5rem] hover:bg-indigo-600 hover:text-white transition-all group shadow-sm border border-slate-100 overflow-hidden">
                   <div className="flex items-center gap-4 md:gap-5 min-w-0">
                     <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">📂</div>
                     <div className="min-w-0">
                       <p className="font-black text-lg md:text-xl leading-tight truncate">{file.name}</p>
                       <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mt-1">{new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                     </div>
                   </div>
                   <div className="w-10 h-10 rounded-full border-2 border-indigo-100 group-hover:border-indigo-400 flex items-center justify-center font-bold flex-shrink-0 ml-4">↓</div>
                 </a>
               ))}
             </div>
           )}
        </div>

        <div className="bg-slate-950 rounded-[3rem] md:rounded-[4rem] p-8 md:p-16 text-white shadow-3xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 blur-[120px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
           <h3 className="text-2xl md:text-3xl font-black mb-10 md:mb-12 relative">Central de Feedback</h3>
           <div className="space-y-6 md:space-y-8 mb-12 md:mb-14 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar relative">
              {messages.length === 0 ? (
                <div className="py-16 text-center bg-white/5 rounded-[2rem] border border-white/10 p-6">
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs leading-relaxed">Sua mesa de diálogo estratégico está pronta...</p>
                </div>
              ) : messages.map((m) => (
                 <div key={m.id} className={`flex flex-col ${m.sender_name === user.full_name ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[75%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl ${m.sender_name === user.full_name ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-300 rounded-tl-none border border-white/5'}`}>
                       <p className="font-medium text-lg md:text-xl leading-snug">{m.content}</p>
                       <p className="text-[9px] font-black uppercase tracking-widest mt-5 opacity-40">{m.sender_name} • {new Date(m.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
                    </div>
                 </div>
              ))}
           </div>
           <form onSubmit={handleSendObservation} className="relative">
              <textarea value={newObs} onChange={(e) => setNewObs(e.target.value)} placeholder="Dúvida ou sugestão operacional?" className="w-full bg-slate-900 border-2 border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 pr-6 md:pr-48 outline-none focus:border-indigo-500 transition-all font-medium text-white min-h-[140px] md:min-h-[180px] text-lg md:text-xl shadow-inner placeholder:opacity-30" />
              <button type="submit" disabled={isSending || !newObs.trim()} className="md:absolute md:bottom-8 md:right-8 w-full md:w-auto mt-4 md:mt-0 px-8 py-4 md:px-10 md:py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl md:rounded-3xl shadow-2xl transition-all disabled:opacity-50 text-xs uppercase tracking-[0.2em]">Sincronizar Feedback</button>
           </form>
        </div>
      </div>
    );
  };

  const renderKanban = () => {
    const columns = [
      { id: 'todo', title: 'Em Planejamento', color: 'bg-slate-300' },
      { id: 'in_progress', title: 'Executando Agora', color: 'bg-indigo-600' },
      { id: 'done', title: 'Concluído', color: 'bg-green-500' }
    ];
    return (
      <div className="animate-in fade-in max-w-7xl mx-auto space-y-10 pb-20 px-2 md:px-0">
        {renderProjectSelector()}
        <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 pb-6">
          <div className="flex md:grid md:grid-cols-3 gap-8 md:gap-10 min-w-[900px] md:min-w-full">
            {columns.map(col => (
              <div key={col.id} className="flex-1 bg-white/60 backdrop-blur-2xl rounded-[3rem] md:rounded-[3.5rem] border border-slate-200/50 p-6 md:p-10 min-h-[600px] shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                   <div className={`w-3.5 h-3.5 rounded-full ${col.color} shadow-lg shadow-indigo-500/20`}></div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">{col.title}</h3>
                   <span className="ml-auto bg-white px-4 py-1.5 rounded-2xl text-[10px] font-black shadow-sm border border-slate-50">{tasks.filter(t => t.status === col.id).length}</span>
                </div>
                <div className="space-y-6">
                  {tasks.filter(t => t.status === col.id).map(task => (
                    <div key={task.id} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-50 hover:-translate-y-1.5 transition-all duration-300 group">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block mb-2">{task.category}</span>
                      <h4 className="font-black text-slate-800 leading-snug mb-5 text-xl md:text-2xl group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Previsão</span>
                        <p className="text-slate-500 text-[10px] font-black uppercase bg-slate-50 px-3 py-1 rounded-full">{new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = tasks.filter(t => t.status !== 'done' && new Date(t.due_date) < new Date()).length;
    
    return (
       <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in pb-20">
          {renderProjectSelector()}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
             <div className="bg-slate-950 p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600 blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <p className="text-[11px] font-black uppercase opacity-60 mb-6 tracking-[0.3em]">Saúde da Operação</p>
                <div className="flex items-end gap-4">
                  <span className="text-6xl md:text-7xl font-black leading-none">{percent}%</span>
                  <span className="text-[11px] font-black uppercase mb-3 text-green-400">Eficiência</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full mt-10 overflow-hidden shadow-inner">
                  <div className="bg-indigo-500 h-full transition-all duration-1000 ease-out" style={{ width: `${percent}%` }}></div>
                </div>
             </div>

             <div className="bg-white p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-slate-100 shadow-xl flex flex-col justify-center">
                <p className="text-[11px] font-black uppercase text-slate-400 mb-6 tracking-[0.3em]">Processos Ativos</p>
                <div className="flex items-center gap-5">
                  <span className="text-6xl md:text-7xl font-black text-slate-900 leading-none">{inProgress}</span>
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-indigo-50 rounded-[1.5rem] md:rounded-3xl flex items-center justify-center text-3xl shadow-sm">🚀</div>
                </div>
             </div>

             <div className="bg-white p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-slate-100 shadow-xl flex flex-col justify-center">
                <p className="text-[11px] font-black uppercase text-slate-400 mb-6 tracking-[0.3em]">Alertas de Prazo</p>
                <div className="flex items-center gap-5">
                  <span className={`text-6xl md:text-7xl font-black leading-none ${overdue > 0 ? 'text-red-500' : 'text-slate-900'}`}>{overdue}</span>
                  <div className={`w-14 h-14 md:w-16 md:h-16 ${overdue > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'} rounded-[1.5rem] md:rounded-3xl flex items-center justify-center text-3xl shadow-sm`}>
                    {overdue > 0 ? '⚠️' : '🛡️'}
                  </div>
                </div>
             </div>
          </div>
       </div>
    );
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
      <div className="w-14 h-14 border-[5px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Sincronizando Ecossistema Estratégico...</p>
    </div>
  );

  if (projects.length === 0) return (
    <div className="max-w-2xl mx-auto mt-20 md:mt-32 bg-white p-10 md:p-20 rounded-[3rem] md:rounded-[4rem] text-center shadow-2xl border border-slate-100 animate-in zoom-in duration-500">
      <div className="text-5xl md:text-6xl mb-8 shadow-inner w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto">🔍</div>
      <h2 className="text-2xl md:text-3xl font-black mb-4 leading-tight">Nenhuma Operação Detectada</h2>
      <p className="text-slate-500 font-bold leading-relaxed text-sm md:text-base">Não encontramos projetos vinculados ao e-mail <strong>{user.email}</strong>.<br/>Por favor, aguarde a ativação pelo seu consultor JM Digital ou solicite acesso.</p>
    </div>
  );

  switch (view) {
    case 'kanban': return renderKanban();
    case 'reports': return renderReports();
    default: return renderStrategy();
  }
};

export default ClientDashboard;
