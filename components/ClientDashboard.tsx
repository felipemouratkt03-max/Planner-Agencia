
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
    const [tRes, mRes, dRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
      supabase.from('messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('deliverables').select('*').eq('project_id', projectId).order('created_at', { descending: true })
    ]);
    if (tRes.data) setTasks(tRes.data);
    if (mRes.data) setMessages(mRes.data);
    if (dRes.data) setDeliverables(dRes.data);
  };

  const handleSendObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObs.trim() || !selectedProject) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.from('messages').insert([{
        project_id: selectedProject.id,
        content: newObs,
        sender_name: user.full_name
      }]).select();
      if (!error && data) {
        setMessages([...messages, data[0]]);
        setNewObs('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 animate-in fade-in">
      <div className="max-w-md">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 leading-tight tracking-tight">
          Olá, <span className="text-indigo-600">{user.full_name.split(' ')[0]}</span>
        </h1>
        <p className="text-slate-500 font-medium mt-1 text-xs md:text-sm tracking-wide">Portal Estratégico • JM Digital</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
        {selectedProject?.start_date && (
          <div className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-200 flex items-center gap-2">
            <span className="text-sm">🚀</span>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-80 leading-none">Início da Operação</span>
              <span className="text-[11px] font-bold">{new Date(selectedProject.start_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        )}
        {projects.length > 1 && (
          <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-sm flex-shrink-0">🎯</div>
            <select 
              className="bg-transparent border-none p-0 font-bold outline-none text-slate-800 cursor-pointer w-full text-xs md:text-sm"
              value={selectedProject?.id || ''}
              onChange={(e) => setSelectedProject(projects.find(x => x.id === e.target.value) || null)}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const renderObservationField = (title: string, subtitle: string) => (
    <div className="bg-slate-50 p-6 md:p-10 rounded-[2.5rem] border border-slate-200 mt-12 shadow-inner">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-[10px] text-slate-400 font-medium mb-6 uppercase tracking-wider">{subtitle}</p>
      
      <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {messages.length === 0 ? (
          <p className="text-[10px] text-slate-300 italic">Nenhuma observação registrada ainda.</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`p-4 rounded-2xl ${m.sender_name === user.full_name ? 'bg-indigo-600 text-white ml-8' : 'bg-white text-slate-700 border border-slate-200 mr-8'} shadow-sm`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{m.sender_name}</span>
                <span className="text-[8px] opacity-50">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs md:text-sm font-medium leading-relaxed">{m.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendObservation} className="relative group">
        <textarea 
          value={newObs}
          onChange={(e) => setNewObs(e.target.value)}
          placeholder="Deseja acrescentar alguma observação sobre este ponto?"
          className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] min-h-[120px] font-medium text-slate-700 outline-none focus:border-indigo-600 transition-all text-sm md:text-base leading-relaxed shadow-sm resize-none"
        />
        <button 
          disabled={isSending || !newObs.trim()}
          type="submit"
          className="absolute bottom-4 right-4 px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSending ? 'Enviando...' : 'Enviar Nota'}
        </button>
      </form>
    </div>
  );

  const renderStrategy = () => {
    if (!selectedProject?.client_message) return (
      <div className="animate-in fade-in max-w-7xl mx-auto px-4 py-24 text-center">
        {renderProjectSelector()}
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">⚙️</div>
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando diretrizes IA...</p>
      </div>
    );

    const lines = selectedProject.client_message.split('\n');

    return (
      <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in pb-20 px-4 md:px-0">
        {renderProjectSelector()}

        <div className="bg-white p-6 md:p-12 lg:p-16 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600/10"></div>
          <article className="max-w-4xl mx-auto space-y-8 prose prose-slate">
            {lines.map((line, i) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl md:text-4xl font-black text-slate-900 border-b border-slate-100 pb-6 mb-12 tracking-tighter leading-tight">{trimmed.replace('# ', '')}</h1>;
              if (trimmed.startsWith('## ')) return <div key={i} className="mt-12 mb-6"><h2 className="text-lg md:text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>{trimmed.replace('## ', '')}</h2></div>;
              if (trimmed.startsWith('|') && trimmed.includes('-')) return null;
              if (trimmed.startsWith('|')) {
                const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());
                return (
                  <div key={i} className="overflow-x-auto my-8 -mx-6 px-6 sm:mx-0 sm:px-0">
                    <table className="w-full border-separate border-spacing-0 min-w-[350px]">
                      <tbody>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          {cells.map((cell, idx) => (
                            <td key={idx} className={`py-4 px-4 text-xs md:text-sm border-b border-slate-50 ${idx === 0 ? 'font-black text-indigo-600 w-1/4' : 'font-medium text-slate-600'}`}>{parseContent(cell)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              }
              if (trimmed === '') return null;
              return <p key={i} className="text-sm md:text-base font-medium text-slate-600 leading-relaxed mb-5">{parseContent(trimmed)}</p>;
            })}
          </article>
          
          {renderObservationField("Alinhamento Estratégico", "Tem alguma sugestão sobre o plano acima?")}
        </div>

        <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-sm">
           <h3 className="text-base md:text-lg font-black text-slate-900 mb-8 flex items-center gap-4">
             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl">📁</div>
             Biblioteca de Ativos
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
             {deliverables.length === 0 ? (
               <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] text-center py-12 col-span-2 border-2 border-dashed border-slate-50 rounded-2xl">Aguardando primeiros ativos...</p>
             ) : deliverables.map(file => (
               <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-600 transition-all group overflow-hidden shadow-sm hover:shadow-md">
                 <div className="flex items-center gap-4 min-w-0">
                   <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">📂</div>
                   <div className="min-w-0">
                     <p className="font-bold text-xs md:text-sm text-slate-800 truncate">{file.name}</p>
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                   </div>
                 </div>
                 <div className="w-8 h-8 rounded-full bg-white border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-xs transition-all flex-shrink-0">↓</div>
               </a>
             ))}
           </div>
        </div>
      </div>
    );
  };

  const renderKanban = () => (
    <div className="animate-in fade-in max-w-7xl mx-auto space-y-10 pb-20 px-4">
      {renderProjectSelector()}
      
      {selectedProject && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">📅</div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Jornada</p>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Iniciada em {new Date(selectedProject.start_date).toLocaleDateString('pt-BR')}</h3>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <span className="block text-[8px] font-black text-slate-400 uppercase">Tarefas</span>
              <span className="text-sm font-black text-slate-900">{tasks.length}</span>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <span className="block text-[8px] font-black text-slate-400 uppercase">Concluídas</span>
              <span className="text-sm font-black text-green-600">{tasks.filter(t => t.status === 'done').length}</span>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-6 min-w-[900px] md:min-w-full">
          {['todo', 'in_progress', 'done'].map(status => (
            <div key={status} className="flex-1 bg-slate-100/50 backdrop-blur-sm rounded-3xl border border-slate-100 p-5 min-h-[500px]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 px-2 flex justify-between items-center">
                {status === 'todo' ? 'Plano de Ativação' : status === 'in_progress' ? 'Execução Tática' : 'Marco Concluído'}
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">{tasks.filter(t => t.status === status).length}</span>
              </h3>
              <div className="space-y-4">
                {tasks.filter(t => t.status === status).map(task => (
                  <div key={task.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest block mb-2">{task.category}</span>
                    <h4 className="font-bold text-slate-800 leading-snug text-xs md:text-sm mb-4">{task.title}</h4>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                         <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Entrega:</span>
                         <p className="text-indigo-600 text-[10px] font-black">{new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-red-400' : 'bg-green-400'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-sm max-w-5xl mx-auto">
        {renderObservationField("Feedback sobre Tarefas", "Tem alguma dúvida específica sobre o andamento operacional?")}
      </div>
    </div>
  );

  const renderReports = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    
    return (
       <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in pb-20 px-4">
          {renderProjectSelector()}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="md:col-span-2 bg-slate-950 p-10 md:p-14 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 blur-[120px] opacity-10"></div>
                <p className="text-[10px] font-black uppercase opacity-50 mb-8 tracking-[0.2em]">Desempenho da Operação</p>
                <div className="flex items-baseline gap-4">
                   <span className="text-6xl md:text-8xl font-black tracking-tighter">{percent}%</span>
                   <div className="flex flex-col">
                      <span className="text-indigo-400 font-black text-lg uppercase leading-none">Concluído</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Status Geral</span>
                   </div>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full mt-12 overflow-hidden shadow-inner border border-white/5">
                  <div className="bg-indigo-500 h-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(99,102,241,0.5)]" style={{ width: `${percent}%` }}></div>
                </div>
             </div>
             
             <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50"></div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Marcos</p>
                   <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500">Total</span>
                        <span className="text-xl font-black text-slate-900">{total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500">Ativas</span>
                        <span className="text-xl font-black text-indigo-600">{inProgress}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500">Entregues</span>
                        <span className="text-xl font-black text-green-500">{done}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
             {renderObservationField("Observação de Progresso", "Deseja comentar algo sobre a velocidade ou os marcos atingidos?")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-base font-black text-slate-900 mb-8">Ativos de Valor Entregues</h3>
                <div className="flex items-center gap-6">
                   <div className="text-6xl font-black text-slate-900 tracking-tighter">{deliverables.length}</div>
                   <div className="flex-1 space-y-2">
                      <div className="h-1.5 bg-slate-100 rounded-full w-full overflow-hidden">
                        <div className="bg-indigo-600 h-full" style={{width: '100%'}}></div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Roadmaps, Copy e <br/>Criativos entregues</p>
                   </div>
                </div>
             </div>

             <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-[0.02] transition-opacity"></div>
                <h3 className="text-base font-black text-slate-900 mb-8">Fluxo de Entrega</h3>
                <div className="flex justify-between items-end gap-2 h-24">
                   {[30, 65, 45, 80, 55, 90, 75].map((h, i) => (
                      <div key={i} className="flex-1 bg-slate-100 rounded-lg relative overflow-hidden">
                         <div 
                           className="absolute bottom-0 left-0 w-full bg-indigo-600 rounded-lg transition-all duration-1000 delay-[200ms]" 
                           style={{ height: `${h}%`, opacity: 0.1 + (i * 0.15) }}
                         ></div>
                      </div>
                   ))}
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-6 tracking-[0.2em] text-center">Desempenho da Agência</p>
             </div>
          </div>
       </div>
    );
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Sincronizando...</p>
    </div>
  );

  if (projects.length === 0) return (
    <div className="max-w-md mx-auto mt-20 bg-white p-12 rounded-3xl text-center shadow-2xl border border-slate-100">
      <div className="text-4xl mb-6">🚀</div>
      <h2 className="text-xl font-black mb-3 tracking-tight text-slate-900 leading-tight">Configurando seu Acesso</h2>
      <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">Seu projeto está sendo preparado pela agência.<br/>Em breve sua estratégia personalizada aparecerá aqui.</p>
    </div>
  );

  switch (view) {
    case 'kanban': return renderKanban();
    case 'reports': return renderReports();
    default: return renderStrategy();
  }
};

export default ClientDashboard;
