'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, Plus, Trash2, Send, FolderGit2, ChevronDown, Zap, Clock, AlertCircle, Pencil, Check, X, Cpu, Users, Home, FolderPlus, Brain } from 'lucide-react';
import { GameAgent, WorkspaceRoom } from '@/types';
import { useModels, getDefaultModelId } from '@/lib/models/use-models';
import { ProviderModel, formatContextWindow, getModelsByProvider } from '@/lib/models/available-models';

interface AgentPanelProps {
  onAgentCreated?: () => void;
}

// Workspace with agents
interface WorkspaceWithAgents {
  id: string;
  name: string;
  path: string;
  color: string;
  roomIndex: number | null;
  agents: GameAgent[];
}

export default function AgentPanel({ onAgentCreated }: AgentPanelProps) {
  const { models, loading: modelsLoading, getModelById } = useModels();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithAgents[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Create workspace state
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspacePath, setNewWorkspacePath] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<'recent' | 'manual'>('recent');
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  
  // Add agent to workspace state
  const [addToWorkspaceId, setAddToWorkspaceId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentModel, setNewAgentModel] = useState(getDefaultModelId());
  const [newAgentTask, setNewAgentTask] = useState('');
  const [addingAgent, setAddingAgent] = useState(false);
  
  // Editing state
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTask, setEditTask] = useState('');
  const [editModel, setEditModel] = useState('');
  const [showAddModelDropdown, setShowAddModelDropdown] = useState(false);
  const [showEditModelDropdown, setShowEditModelDropdown] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addModelDropdownRef = useRef<HTMLDivElement>(null);
  const editModelDropdownRef = useRef<HTMLDivElement>(null);

  const totalAgents = useMemo(() => {
    return workspaces.reduce((sum, ws) => sum + ws.agents.length, 0);
  }, [workspaces]);

  // Group models by provider for display
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, { providerName: string; models: ProviderModel[] }> = {};
    for (const model of models) {
      if (!grouped[model.providerId]) {
        grouped[model.providerId] = { providerName: model.providerName, models: [] };
      }
      grouped[model.providerId].models.push(model);
    }
    return grouped;
  }, [models]);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces/recent');
      if (response.ok) {
        const data = await response.json();
        setRecentWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent workspaces:', err);
    }
  };

  const syncAgentStatus = async () => {
    try {
      await fetch('/api/agents/sync', { method: 'POST' });
    } catch (err) {
      console.error('Failed to sync agent status:', err);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchWorkspaces();
    fetchRecentWorkspaces();
    
    const pollInterval = setInterval(() => {
      fetchWorkspaces();
      syncAgentStatus();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingAgentId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingAgentId]);

  // Close model dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addModelDropdownRef.current && !addModelDropdownRef.current.contains(e.target as Node)) {
        setShowAddModelDropdown(false);
      }
      if (editModelDropdownRef.current && !editModelDropdownRef.current.contains(e.target as Node)) {
        setShowEditModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Create new workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspacePath.trim()) return;
    
    setError('');
    setCreatingWorkspace(true);

    try {
      // Validate workspace
      const validateResponse = await fetch('/api/workspaces/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: newWorkspacePath }),
      });

      const validateData = await validateResponse.json();
      if (!validateData.isValid) {
        setError(validateData.errors?.join(', ') || 'Invalid workspace path');
        setCreatingWorkspace(false);
        return;
      }

      // Create workspace
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newWorkspacePath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create workspace');
        setCreatingWorkspace(false);
        return;
      }

      // Reset form and refresh
      setNewWorkspacePath('');
      setShowCreateWorkspace(false);
      await fetchWorkspaces();
      await fetchRecentWorkspaces();
      
      if (onAgentCreated) onAgentCreated();
    } catch (err) {
      setError('Network error');
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // Add agent to workspace
  const handleAddAgentToWorkspace = async (workspaceId: string) => {
    if (!newAgentName.trim()) return;
    
    setAddingAgent(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          workspaceId,
          model: newAgentModel,
          task: newAgentTask.trim() || undefined,
        }),
      });

      if (response.ok) {
        setAddToWorkspaceId(null);
        setNewAgentName('');
        setNewAgentModel(getDefaultModelId());
        setNewAgentTask('');
        await fetchWorkspaces();
        if (onAgentCreated) onAgentCreated();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add agent');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setAddingAgent(false);
    }
  };

  const cancelAddAgent = () => {
    setAddToWorkspaceId(null);
    setNewAgentName('');
    setNewAgentModel(getDefaultModelId());
    setNewAgentTask('');
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Delete this agent?')) return;

    try {
      const response = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchWorkspaces();
        if (onAgentCreated) onAgentCreated();
      }
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Delete this workspace and all its agents?')) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchWorkspaces();
        if (onAgentCreated) onAgentCreated();
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const handleSendTask = async (agentId: string) => {
    const task = prompt('Enter task for agent:');
    if (!task) return;

    try {
      const response = await fetch(`/api/agents/${agentId}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });

      if (response.ok) {
        await fetch(`/api/agents/${agentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentTask: task }),
        });
        await fetchWorkspaces();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send task');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const startEditing = (agent: GameAgent) => {
    setEditingAgentId(agent.id);
    setEditName(agent.name);
    setEditTask(agent.currentTask || '');
    setEditModel(agent.model || getDefaultModelId());
  };

  const cancelEditing = () => {
    setEditingAgentId(null);
    setEditName('');
    setEditTask('');
    setEditModel('');
  };

  const saveEditing = async () => {
    if (!editingAgentId || !editName.trim()) return;

    try {
      const response = await fetch(`/api/agents/${editingAgentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          currentTask: editTask.trim() || null,
          model: editModel,
        }),
      });

      if (response.ok) {
        await fetchWorkspaces();
        cancelEditing();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update agent');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
      IDLE: { color: 'text-slate-400', bgColor: 'bg-slate-500/20', icon: <Clock size={10} />, label: 'Idle' },
      SPAWNING: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: <Zap size={10} />, label: 'Spawning' },
      TYPING: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: <Zap size={10} className="animate-pulse" />, label: 'Typing' },
      READING: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: <Zap size={10} />, label: 'Reading' },
      RUNNING: { color: 'text-violet-400', bgColor: 'bg-violet-500/20', icon: <Zap size={10} className="animate-spin" />, label: 'Running' },
      WAITING: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: <Clock size={10} />, label: 'Waiting' },
      PERMISSION: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: <AlertCircle size={10} />, label: 'Permission' },
      ERROR: { color: 'text-red-500', bgColor: 'bg-red-500/20', icon: <AlertCircle size={10} />, label: 'Error' },
    };
    return statusMap[status] || statusMap.IDLE;
  };

  return (
    <div className="bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl w-[380px] max-h-[70vh] flex flex-col border border-slate-600/40 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Workspaces & Agents</h2>
            <p className="text-[10px] text-slate-400">{workspaces.length} workspaces, {totalAgents} agents</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateWorkspace(!showCreateWorkspace)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            showCreateWorkspace 
              ? 'bg-indigo-500 text-white' 
              : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <FolderPlus size={14} />
          New Workspace
        </button>
      </div>

      {/* Create Workspace Form */}
      {showCreateWorkspace && (
        <form onSubmit={handleCreateWorkspace} className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/30 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <FolderGit2 size={12} />
              Workspace Path
            </label>
            <div className="flex bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/50">
              <button
                type="button"
                onClick={() => setWorkspaceMode('recent')}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-all font-medium ${
                  workspaceMode === 'recent' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('manual')}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-all font-medium ${
                  workspaceMode === 'manual' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {workspaceMode === 'recent' ? (
            <div className="relative">
              <select
                value={newWorkspacePath}
                onChange={(e) => setNewWorkspacePath(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700/50 text-white rounded-xl border border-slate-600/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none cursor-pointer"
                required
                disabled={creatingWorkspace}
              >
                <option value="" disabled className="bg-slate-800">Select project folder...</option>
                {recentWorkspaces.map((ws) => (
                  <option key={ws} value={ws} className="bg-slate-800">
                    {ws.split(/[\\/]/).pop()} - {ws}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              value={newWorkspacePath}
              onChange={(e) => setNewWorkspacePath(e.target.value)}
              placeholder="C:\path\to\project"
              className="w-full px-4 py-2.5 bg-slate-700/50 text-white rounded-xl border border-slate-600/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm placeholder:text-slate-500"
              required
              disabled={creatingWorkspace}
            />
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 p-2 rounded-lg">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creatingWorkspace || !newWorkspacePath.trim()}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
            >
              {creatingWorkspace ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FolderPlus size={14} />
                  Create Workspace
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateWorkspace(false); setError(''); }}
              className="px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && workspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
            <span className="text-xs">Loading...</span>
          </div>
        )}
        
        {!loading && workspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <FolderGit2 size={28} className="text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">No workspaces yet</p>
            <p className="text-xs text-slate-500 mb-4">Create a workspace to get started</p>
            <button
              onClick={() => setShowCreateWorkspace(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-sm font-medium transition-colors"
            >
              <FolderPlus size={14} />
              Create First Workspace
            </button>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="p-3 space-y-3">
            {workspaces.map((ws) => {
              const workspaceColor = ws.color || '#6366f1';
              const isAddingToThis = addToWorkspaceId === ws.id;
              
              return (
                <div
                  key={ws.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: `${workspaceColor}40`, backgroundColor: `${workspaceColor}08` }}
                >
                  {/* Workspace Header */}
                  <div 
                    className="px-3.5 py-2.5 flex items-center justify-between"
                    style={{ backgroundColor: `${workspaceColor}15` }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${workspaceColor}25` }}
                      >
                        <Home size={14} style={{ color: workspaceColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-white truncate">{ws.name}</div>
                        <div className="text-[10px] text-slate-400 truncate" title={ws.path}>
                          {ws.path.split(/[\\/]/).slice(-2).join('/')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${workspaceColor}20`, color: workspaceColor }}
                      >
                        <Users size={10} className="inline mr-1" />
                        {ws.agents.length}
                      </span>
                      {!isAddingToThis && (
                        <button
                          onClick={() => setAddToWorkspaceId(ws.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                          style={{ color: workspaceColor }}
                          title="Add agent to this workspace"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteWorkspace(ws.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete workspace"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Add Agent Form */}
                  {isAddingToThis && (
                    <div className="px-3.5 py-3 border-t border-slate-700/30 bg-slate-800/50 space-y-2">
                      <input
                        type="text"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600/50 focus:outline-none focus:border-indigo-500 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newAgentName.trim()) handleAddAgentToWorkspace(ws.id);
                          if (e.key === 'Escape') cancelAddAgent();
                        }}
                      />
                      <input
                        type="text"
                        value={newAgentTask}
                        onChange={(e) => setNewAgentTask(e.target.value)}
                        placeholder="Initial task (optional)..."
                        className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600/50 focus:outline-none focus:border-indigo-500 text-xs"
                      />
                      <div className="relative" ref={addModelDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowAddModelDropdown(!showAddModelDropdown)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600/50 hover:border-slate-500/50 text-xs cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Cpu size={11} className="text-purple-400 shrink-0" />
                            <span className="truncate">{getModelById(newAgentModel)?.name || 'Select model'}</span>
                            {getModelById(newAgentModel)?.providerName && (
                              <span className="text-[9px] text-slate-500 shrink-0">{getModelById(newAgentModel)?.providerName}</span>
                            )}
                          </div>
                          <ChevronDown size={10} className={`text-slate-400 shrink-0 transition-transform ${showAddModelDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showAddModelDropdown && (
                          <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600/50 rounded-xl p-1.5 max-h-[200px] overflow-y-auto custom-scrollbar shadow-xl">
                            {Object.entries(modelsByProvider).map(([providerId, group]) => (
                              <div key={providerId}>
                                <div className="px-2 py-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{group.providerName}</div>
                                {group.models.map((model) => (
                                  <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => { setNewAgentModel(model.id); setShowAddModelDropdown(false); }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                                      newAgentModel === model.id
                                        ? 'bg-indigo-500/20 text-indigo-300'
                                        : 'hover:bg-slate-700/50 text-slate-300'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium truncate">{model.name}</span>
                                        {model.capabilities.reasoning && (
                                          <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[8px] shrink-0 flex items-center gap-0.5">
                                            <Brain size={7} />R
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[9px] text-slate-500 mt-0.5">Ctx: {formatContextWindow(model.contextWindow)}</div>
                                    </div>
                                    {newAgentModel === model.id && <Check size={12} className="text-indigo-400 shrink-0" />}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddAgentToWorkspace(ws.id)}
                          disabled={!newAgentName.trim() || addingAgent}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-500/80 hover:bg-indigo-500 disabled:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          {addingAgent ? (
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Bot size={12} />
                              Add Agent
                            </>
                          )}
                        </button>
                        <button
                          onClick={cancelAddAgent}
                          className="px-3 py-1.5 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Agents in this workspace */}
                  {ws.agents.length > 0 && (
                    <div className="p-2 space-y-2">
                      {ws.agents.map((agent) => {
                        const statusInfo = getStatusInfo(agent.status);
                        const isEditing = editingAgentId === agent.id;
                        
                        return (
                          <div
                            key={agent.id}
                            className="bg-slate-700/40 hover:bg-slate-700/60 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 overflow-hidden group"
                          >
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <div 
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${workspaceColor}20`, border: `1.5px solid ${workspaceColor}40` }}
                                  >
                                    <Bot size={14} style={{ color: workspaceColor }} />
                                  </div>
                                  
                                  <div className="min-w-0 flex-1">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <input
                                          ref={editInputRef}
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onKeyDown={handleEditKeyDown}
                                          placeholder="Agent name"
                                          className="w-full px-2 py-1 bg-slate-600/50 text-white rounded-lg border border-slate-500/50 focus:outline-none focus:border-indigo-500 text-xs"
                                        />
                                        <input
                                          type="text"
                                          value={editTask}
                                          onChange={(e) => setEditTask(e.target.value)}
                                          onKeyDown={handleEditKeyDown}
                                          placeholder="Current task (optional)"
                                          className="w-full px-2 py-1 bg-slate-600/50 text-white rounded-lg border border-slate-500/50 focus:outline-none focus:border-indigo-500 text-[10px]"
                                        />
                                        <div className="relative" ref={editModelDropdownRef}>
                                          <button
                                            type="button"
                                            onClick={() => setShowEditModelDropdown(!showEditModelDropdown)}
                                            className="w-full flex items-center justify-between px-2 py-1 bg-slate-600/50 text-white rounded-lg border border-slate-500/50 hover:border-slate-400/50 text-[10px] cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <Cpu size={9} className="text-purple-400 shrink-0" />
                                              <span className="truncate">{getModelById(editModel)?.name || 'Select model'}</span>
                                              {getModelById(editModel)?.providerName && (
                                                <span className="text-[8px] text-slate-500 shrink-0">{getModelById(editModel)?.providerName}</span>
                                              )}
                                            </div>
                                            <ChevronDown size={9} className={`text-slate-400 shrink-0 transition-transform ${showEditModelDropdown ? 'rotate-180' : ''}`} />
                                          </button>
                                          {showEditModelDropdown && (
                                            <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600/50 rounded-xl p-1.5 max-h-[180px] overflow-y-auto custom-scrollbar shadow-xl">
                                              {Object.entries(modelsByProvider).map(([providerId, group]) => (
                                                <div key={providerId}>
                                                  <div className="px-2 py-1 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{group.providerName}</div>
                                                  {group.models.map((model) => (
                                                    <button
                                                      key={model.id}
                                                      type="button"
                                                      onClick={() => { setEditModel(model.id); setShowEditModelDropdown(false); }}
                                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] transition-colors flex items-center justify-between gap-1 ${
                                                        editModel === model.id
                                                          ? 'bg-indigo-500/20 text-indigo-300'
                                                          : 'hover:bg-slate-700/50 text-slate-300'
                                                      }`}
                                                    >
                                                      <div className="min-w-0">
                                                        <div className="flex items-center gap-1">
                                                          <span className="font-medium truncate">{model.name}</span>
                                                          {model.capabilities.reasoning && (
                                                            <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[7px] shrink-0 flex items-center gap-0.5">
                                                              <Brain size={6} />R
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="text-[8px] text-slate-500">Ctx: {formatContextWindow(model.contextWindow)}</div>
                                                      </div>
                                                      {editModel === model.id && <Check size={10} className="text-indigo-400 shrink-0" />}
                                                    </button>
                                                  ))}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={saveEditing} className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] hover:bg-emerald-500/30 transition-colors">
                                            <Check size={10} /> Save
                                          </button>
                                          <button onClick={cancelEditing} className="flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-[10px] hover:bg-slate-500/30 transition-colors">
                                            <X size={10} /> Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <span className="font-medium text-xs text-white truncate">{agent.name}</span>
                                          <button
                                            onClick={() => startEditing(agent)}
                                            className="p-0.5 text-slate-500 hover:text-indigo-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Edit agent"
                                          >
                                            <Pencil size={10} />
                                          </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 text-[10px] text-purple-400 mb-1">
                                          <Cpu size={9} className="shrink-0" />
                                          <span className="truncate">{getModelById(agent.model || '')?.name || 'Default'}</span>
                                          {getModelById(agent.model || '')?.providerName && (
                                            <span className="text-[9px] text-slate-500">({getModelById(agent.model || '')?.providerName})</span>
                                          )}
                                          {getModelById(agent.model || '')?.capabilities.reasoning && (
                                            <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[7px] flex items-center gap-0.5 shrink-0">
                                              <Brain size={6} />R
                                            </span>
                                          )}
                                        </div>
                                        
                                        {agent.currentTask && (
                                          <div className="text-[10px] text-slate-400 truncate mb-1" title={agent.currentTask}>
                                            {agent.currentTask}
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2">
                                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                                            {statusInfo.icon}
                                            <span>{statusInfo.label}</span>
                                          </div>
                                          <button
                                            onClick={() => handleSendTask(agent.id)}
                                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded text-[9px] font-medium transition-all"
                                          >
                                            <Send size={9} /> Task
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {!isEditing && (
                                  <button
                                    onClick={() => handleDeleteAgent(agent.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete Agent"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Empty workspace message */}
                  {ws.agents.length === 0 && !isAddingToThis && (
                    <div className="px-3.5 py-4 text-center">
                      <p className="text-[10px] text-slate-500 mb-2">No agents in this workspace</p>
                      <button
                        onClick={() => setAddToWorkspaceId(ws.id)}
                        className="flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Plus size={12} />
                        Add First Agent
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
