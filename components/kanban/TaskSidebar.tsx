'use client';

import { useState, useEffect } from 'react';
import { KanbanTask as IKanbanTask, GameAgent } from '@/types';
import { X, Bot, Trash2, Save, Cpu, Terminal, MessageSquare, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useModels } from '@/lib/models/use-models';
import ChatPanel from '@/components/game/ChatPanel';

interface TaskSidebarProps {
  task: IKanbanTask | null;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<IKanbanTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export default function TaskSidebar({ task, workspaceId, isOpen, onClose, onSave, onDelete }: TaskSidebarProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<GameAgent[]>([]);
  const { getModelById } = useModels();

  useEffect(() => {
    if (task) {
      setContent(task.content);
      setDescription(task.description || '');
      setSelectedAgentId(task.agentId || '');
    }
  }, [task]);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
    }
  }, [isOpen, workspaceId]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        const workspaceAgents = data.agents.filter((a: any) => a.workspaceId === workspaceId);
        setAvailableAgents(workspaceAgents);
      }
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  if (!isOpen || !task) return null;

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(task.id, {
        content,
        description,
        agentId: selectedAgentId || null,
        // If agent changed to empty, we might want to clear agent-related fields?
        // But the backend might handle it.
        // For now, just sending agentId is enough as the backend updates the relationship.
        // However, we might need to handle agentMode if it was NEW before.
        // Assuming we are just reassigning existing agents here.
        agentMode: 'EXISTING',
        targetAgentId: selectedAgentId || undefined
      });
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    setIsDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const agent = task.agent; // This is the *current* agent on the task object. 
  // If we changed selectedAgentId but haven't saved, this is still the old agent.
  // For the chat, we should probably show the chat of the *assigned* agent (saved one).
  
  // If user changes agent in dropdown, we don't switch chat immediately until save.
  
  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-slate-900 shadow-2xl border-l border-slate-700/50 transform transition-transform duration-300 z-[10000] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'details' 
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText size={16} />
            Details
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'chat' 
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <MessageSquare size={16} />
            Chat
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'details' ? (
          <div className="absolute inset-0 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Title Edit */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Task Title
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="Enter task title..."
              />
            </div>

            {/* Description Edit */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[120px] resize-y transition-all"
                placeholder="Enter task description..."
              />
            </div>

            {/* Agent Assignment */}
            <div className="space-y-3 pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <Bot size={14} />
                Assigned Agent
              </div>
              
              <div className="space-y-3">
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                >
                  <option value="">-- No Agent Assigned --</option>
                  {availableAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.status})
                    </option>
                  ))}
                </select>

                {selectedAgentId && (
                  <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
                     {availableAgents.find(a => a.id === selectedAgentId) ? (
                        (() => {
                          const a = availableAgents.find(a => a.id === selectedAgentId)!;
                          const modelInfo = a.model ? getModelById(a.model) : null;
                          return (
                            <div className="flex items-start gap-3">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${a.workspace?.color || '#6366f1'}30` }}
                              >
                                <Bot size={16} style={{ color: a.workspace?.color || '#6366f1' }} />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-white">{a.name}</div>
                                <div className="text-xs text-slate-400 mt-1 flex flex-col gap-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      a.status === 'RUNNING' ? 'bg-emerald-400' : 
                                      a.status === 'IDLE' ? 'bg-slate-400' : 'bg-amber-400'
                                    }`} />
                                    {a.status}
                                  </span>
                                  {modelInfo && (
                                    <span className="opacity-75">{modelInfo.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                     ) : (
                       <div className="text-xs text-amber-400 flex items-center gap-1.5">
                         <AlertCircle size={12} />
                         Agent not found in list (might be loading)
                       </div>
                     )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-8 flex items-center justify-between gap-4">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete Task
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col">
            {agent ? (
              <ChatPanel 
                agent={agent} 
                onClose={() => setActiveTab('details')} 
                isMobile={true} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <Bot size={32} className="opacity-20" />
                </div>
                <h3 className="text-lg font-medium text-slate-300">No Agent Assigned</h3>
                <p className="text-sm max-w-[200px]">
                  Please assign an agent in the Details tab to start a chat session.
                </p>
                <button
                  onClick={() => setActiveTab('details')}
                  className="mt-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Details
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
