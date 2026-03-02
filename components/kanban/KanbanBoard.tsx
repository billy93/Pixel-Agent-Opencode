
'use client';

import { useState, useEffect } from 'react';
import { KanbanColumn as IKanbanColumn, KanbanTask as IKanbanTask } from '@/types';
import KanbanColumn from './KanbanColumn';
import TaskSidebar from './TaskSidebar';
import { X, Plus, Layout, AlertCircle, Bot, User, CheckCircle2, Circle } from 'lucide-react';
import { useModels } from '@/lib/models/use-models';
import { DEFAULT_MODEL } from '@/lib/models/available-models';

interface KanbanBoardProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
  initialAgentFilter?: string;
  onOpenChat?: (agent: any, sessionId?: string) => void;
}

export default function KanbanBoard({ workspaceId, workspaceName, onClose, initialAgentFilter, onOpenChat }: KanbanBoardProps) {
  const [columns, setColumns] = useState<IKanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Add Task Modal State
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agent Configuration State
  const { models, getModelById } = useModels();
  const [agentMode, setAgentMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [agentRole, setAgentRole] = useState<'PLAN' | 'BUILD'>('PLAN');
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  // Filter State
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(initialAgentFilter || null);

  // Edit Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const editingTask = columns.flatMap(c => c.tasks).find(t => t.id === editingTaskId) || null;

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        // Filter agents by workspaceId
        const workspaceAgents = data.agents.filter((a: any) => a.workspaceId === workspaceId);
        setAvailableAgents(workspaceAgents);
        if (workspaceAgents.length > 0 && !targetAgentId) {
            setTargetAgentId(workspaceAgents[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchKanban = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/kanban?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const newColumns = data.columns || [];
        setColumns(prev => {
            // Simple deep comparison to avoid unnecessary re-renders/drag interruptions
            if (JSON.stringify(prev) !== JSON.stringify(newColumns)) {
                return newColumns;
            }
            return prev;
        });
      } else {
        const data = await response.json();
        if (!silent) setError(data.error || 'Failed to load kanban board');
      }
    } catch (err) {
      if (!silent) setError('Network error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Filter columns based on selectedAgentFilter AND sort/filter types
  const filteredColumns = columns
    .filter(col => ['TODO', 'IN_PROGRESS', 'DONE'].includes(col.type))
    .sort((a, b) => {
      const order = { 'TODO': 0, 'IN_PROGRESS': 1, 'DONE': 2 };
      return (order[a.type as keyof typeof order] || 0) - (order[b.type as keyof typeof order] || 0);
    })
    .map(col => ({
      ...col,
      tasks: selectedAgentFilter 
        ? col.tasks.filter(task => task.agentId === selectedAgentFilter)
        : col.tasks
    }));

  const syncAgents = async () => {
    try {
      await fetch('/api/agents/sync', { method: 'POST' });
    } catch (err) {
      console.error('Failed to sync agents', err);
    }
  };

  useEffect(() => {
    fetchKanban();
    syncAgents();

    const interval = setInterval(() => {
      syncAgents();
      fetchKanban(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [workspaceId]);

  const handleTaskDrop = async (taskId: string, newColumnId: string) => {
    // Check if moving to IN_PROGRESS without an agent assigned
    const task = columns.flatMap(c => c.tasks).find(t => t.id === taskId);
    const targetColumn = columns.find(c => c.id === newColumnId);
    
    if (task && targetColumn?.type === 'IN_PROGRESS') {
      // Check if task has agent assigned or configuration to create/assign one
      const hasAgent = task.agentId;
      const hasAgentConfig = 
        (task.agentMode === 'NEW' && task.agentModel) || 
        (task.agentMode === 'EXISTING' && task.targetAgentId);

      if (!hasAgent && !hasAgentConfig) {
        // Force user to open details to assign agent
        alert('Please assign an agent to this task before moving it to In Progress.');
        return; // Prevent the drop
      }
    }

    // Optimistic update
    const previousColumns = JSON.parse(JSON.stringify(columns));
    
    setColumns(prev => {
      const newCols = JSON.parse(JSON.stringify(prev));
      
      // Find source column and task
      let task: IKanbanTask | undefined;
      let sourceCol: IKanbanColumn | undefined;
      
      for (const col of newCols) {
        const tIndex = col.tasks.findIndex((t: IKanbanTask) => t.id === taskId);
        if (tIndex !== -1) {
          task = col.tasks[tIndex];
          col.tasks.splice(tIndex, 1); // Remove from source
          sourceCol = col;
          break;
        }
      }
      
      if (task) {
        // Add to destination
        const destCol = newCols.find((c: IKanbanColumn) => c.id === newColumnId);
        if (destCol) {
          task.columnId = newColumnId;
          destCol.tasks.push(task);
        }
      }
      
      return newCols;
    });

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: newColumnId }),
      });

      if (!response.ok) {
        // Revert on error
        setColumns(previousColumns);
        const data = await response.json();
        alert(data.error || 'Failed to move task');
      } else {
        // Update the task with new data (including agent info)
        const data = await response.json();
        if (data.task) {
            setColumns(prev => prev.map(col => ({
                ...col,
                tasks: col.tasks.map(t => t.id === taskId ? data.task : t)
            })));
            
            // If we are currently editing this task, it will update automatically via derived state
            // if (editingTask && editingTask.id === taskId) {
            //    setEditingTask(data.task);
            // }
        }
      }
    } catch (err) {
      setColumns(previousColumns);
      alert('Network error');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskContent.trim() || !targetColumnId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/kanban/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newTaskContent,
          description: newTaskDescription,
          columnId: targetColumnId,
          agentMode,
          agentModel: agentMode === 'NEW' ? selectedModel : undefined,
          agentRole: agentMode === 'NEW' ? agentRole : undefined,
          targetAgentId: agentMode === 'EXISTING' ? targetAgentId : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTask = data.task;
        
        setColumns(prev => prev.map(col => {
          if (col.id === targetColumnId) {
            return { ...col, tasks: [...col.tasks, newTask] };
          }
          return col;
        }));

        setShowAddTask(false);
        setNewTaskContent('');
        setNewTaskDescription('');
      } else {
        alert('Failed to create task');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddTask = (columnId: string) => {
    setTargetColumnId(columnId);
    setShowAddTask(true);
  };

  const handleEditTask = (task: IKanbanTask) => {
    setEditingTaskId(task.id);
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<IKanbanTask>) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedTask = data.task;
        
        setColumns(prev => prev.map(col => ({
          ...col,
          tasks: col.tasks.map(t => t.id === taskId ? updatedTask : t)
        })));
        
        // Update editing task if it's the same (handled by derived state)
        // if (editingTask && editingTask.id === taskId) {
        //    setEditingTask(updatedTask);
        // }
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update task');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Network error');
      throw err;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/kanban/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setColumns(prev => prev.map(col => ({
          ...col,
          tasks: col.tasks.filter(t => t.id !== taskId)
        })));
        setEditingTaskId(null);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Network error');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleChat = (task: IKanbanTask) => {
    if (task.agent && onOpenChat) {
       onOpenChat(task.agent, task.sessionId || undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 border-b border-slate-700/50 bg-slate-900/50 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Layout className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{workspaceName}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Updates
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent Filter Dropdown */}
          <div className="relative group">
            <select
              value={selectedAgentFilter || ''}
              onChange={(e) => setSelectedAgentFilter(e.target.value || null)}
              className="appearance-none bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Agents</option>
              {availableAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <Bot size={14} />
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full gap-6 min-w-max">
          {filteredColumns.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={column.tasks}
              onTaskDrop={handleTaskDrop}
              onAddTask={() => openAddTask(column.id)}
              onEditTask={handleEditTask}
              onChat={handleChat}
              getModelById={getModelById}
            />
          ))}
        </div>
      </div>

      {/* Task Details Sidebar */}
      {editingTask && (
        <TaskSidebar
          task={editingTask}
          workspaceId={workspaceId}
          isOpen={!!editingTask}
          onClose={() => setEditingTaskId(null)}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <h3 className="text-white font-semibold">New Task</h3>
              <button onClick={() => setShowAddTask(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Task Content</label>
                <textarea
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (Optional)</label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 min-h-[60px]"
                  placeholder="Details about the task..."
                />
              </div>

              {/* Agent Configuration */}
              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                <label className="block text-xs font-medium text-slate-400">Agent Assignment</label>
                
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="agentMode" 
                      checked={agentMode === 'NEW'} 
                      onChange={() => setAgentMode('NEW')}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-slate-300">New Agent</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="agentMode" 
                      checked={agentMode === 'EXISTING'} 
                      onChange={() => setAgentMode('EXISTING')}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-slate-300">Existing Agent</span>
                  </label>
                </div>

                {agentMode === 'NEW' ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Model</label>
                      <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 appearance-none"
                      >
                        {models.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Role</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAgentRole('PLAN')}
                          className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                            agentRole === 'PLAN' 
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgentRole('BUILD')}
                          className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                            agentRole === 'BUILD' 
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          Build
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Select Agent</label>
                    {availableAgents.length > 0 ? (
                      <select 
                        value={targetAgentId}
                        onChange={(e) => setTargetAgentId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 appearance-none"
                      >
                        {availableAgents.map(agent => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-amber-400/80 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        No agents available in this workspace.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTaskContent.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
