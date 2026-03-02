
'use client';

import { useState, useEffect } from 'react';
import { KanbanTask as IKanbanTask, GameAgent } from '@/types';
import { X, Bot, Trash2, Save, Cpu, Terminal } from 'lucide-react';
import { useModels } from '@/lib/models/use-models';

interface TaskDetailsModalProps {
  task: IKanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<IKanbanTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export default function TaskDetailsModal({ task, isOpen, onClose, onSave, onDelete }: TaskDetailsModalProps) {
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { getModelById } = useModels();

  useEffect(() => {
    if (task) {
      setContent(task.content);
      setDescription(task.description || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(task.id, {
        content,
        description,
      });
      onClose();
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

  const agent = task.agent;
  const agentModelInfo = agent?.model ? getModelById(agent.model) : null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Task Details
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Title Edit */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Task Title
            </label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[100px] resize-y transition-all"
              placeholder="Enter task description..."
            />
          </div>

          {/* Agent Info Section */}
          <div className="bg-slate-900/30 rounded-lg border border-slate-700/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
              <Bot size={14} />
              Assigned Agent
            </div>
            
            {agent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                    <Bot size={20} />
                  </div>
                  <div>
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        agent.status === 'RUNNING' ? 'bg-emerald-400 animate-pulse' : 
                        agent.status === 'IDLE' ? 'bg-slate-400' : 'bg-amber-400'
                      }`} />
                      {agent.status}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/30">
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                    <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                      <Cpu size={10} /> Model
                    </div>
                    <div className="text-xs text-slate-300 truncate" title={agent.model}>
                      {agentModelInfo?.name || agent.model || 'Unknown Model'}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                    <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                      <Terminal size={10} /> Provider
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      {agentModelInfo?.providerName || 'Unknown Provider'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic py-2">
                No agent assigned to this task.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700/50 bg-slate-800/50 flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all text-sm font-medium disabled:opacity-50"
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
      </div>
    </div>
  );
}
