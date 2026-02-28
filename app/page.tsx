'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import GameCanvas from '@/components/canvas/GameCanvas';
import AuthForm from '@/components/auth/AuthForm';
import AgentPanel from '@/components/game/AgentPanel';
import ChatPanel from '@/components/game/ChatPanel';
import OpenCodeServerWarning from '@/components/ui/OpenCodeServerWarning';
import { WorkspaceRoom, GameAgent } from '@/types';
import { LogOut, Users, User as UserIcon, MessageSquare, Cpu, X, CheckCircle } from 'lucide-react';
import { useModels } from '@/lib/models/use-models';
import { useOpenCodeServer } from '@/lib/opencode/use-opencode-server';
import { ProviderModel, formatContextWindow } from '@/lib/models/available-models';

interface User {
  id: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  avatar: string;
}

export default function Home() {
  const { models, getModelById } = useModels();
  const { serverStatus, checkServer, isServerRunning } = useOpenCodeServer(30000);
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<GameAgent[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [activeChat, setActiveChat] = useState<GameAgent | null>(null);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [nearbyAgent, setNearbyAgent] = useState<GameAgent | null>(null);
  const [agentsNeedingAction, setAgentsNeedingAction] = useState<Set<string>>(new Set());
  const [showQuickModelSelector, setShowQuickModelSelector] = useState(false);
  const [dismissedServerWarning, setDismissedServerWarning] = useState(false);
  
  // Ref for throttling handleMove
  const lastMoveRef = useRef<{ x: number; y: number; direction: string } | null>(null);
  const moveThrottleRef = useRef<number | null>(null);
  const wasServerConnectedRef = useRef(false);

  // Reset dismissed warning when server goes from connected to disconnected
  useEffect(() => {
    if (isServerRunning) {
      wasServerConnectedRef.current = true;
    } else if (wasServerConnectedRef.current && !isServerRunning) {
      // Server was connected before but now disconnected - show warning again
      setDismissedServerWarning(false);
    }
  }, [isServerRunning]);

  // Check if user is authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const handleAuthSuccess = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  }, []);

  // Check which agents need user action (have pending questions/permissions)
  const checkAgentsNeedingAction = useCallback(async () => {
    if (agents.length === 0) return;
    
    const needingAction = new Set<string>();
    
    // Check each agent for pending questions or permissions
    await Promise.all(agents.map(async (agent) => {
      try {
        const response = await fetch(`/api/agents/${agent.id}/chat`);
        if (response.ok) {
          const data = await response.json();
          if (data.hasPermissionPending || data.hasQuestionPending) {
            needingAction.add(agent.id);
          }
        }
      } catch (error) {
        // Ignore errors for individual agents
      }
    }));
    
    setAgentsNeedingAction(needingAction);
  }, [agents]);

  // Fetch agents and workspaces once when user is authenticated
  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchWorkspaces();
    }
  }, [user, fetchAgents, fetchWorkspaces]);

  // Poll for agent status updates every 3 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchAgents();
      fetchWorkspaces();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [user, fetchAgents, fetchWorkspaces]);

  // Poll for agents needing action every 5 seconds
  useEffect(() => {
    if (!user || agents.length === 0) return;
    
    // Initial check
    checkAgentsNeedingAction();
    
    const interval = setInterval(checkAgentsNeedingAction, 5000);
    return () => clearInterval(interval);
  }, [user, agents.length, checkAgentsNeedingAction]);

  // Throttled handleMove - only update state if position actually changed
  // and throttle updates to max 10 times per second
  const handleMove = useCallback((x: number, y: number, direction: string) => {
    const last = lastMoveRef.current;
    
    // Skip if position hasn't changed significantly
    if (last && Math.abs(last.x - x) < 0.1 && Math.abs(last.y - y) < 0.1 && last.direction === direction) {
      return;
    }
    
    lastMoveRef.current = { x, y, direction };
    
    // Throttle state updates to max 10 times per second
    if (moveThrottleRef.current) {
      return;
    }
    
    moveThrottleRef.current = window.setTimeout(() => {
      moveThrottleRef.current = null;
      // Don't update state for movement - it causes too many re-renders
      // The game canvas handles its own rendering via refs
    }, 100);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (response.ok) {
        setUser(null);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  // Handle agent proximity detection from GameCanvas
  const handleAgentProximity = useCallback((agent: GameAgent | null) => {
    setNearbyAgent(agent);
    // Don't auto-open chat - wait for user to press E
  }, []);

  // Get the latest version of nearbyAgent from agents array
  const currentNearbyAgent = nearbyAgent 
    ? agents.find(a => a.id === nearbyAgent.id) || nearbyAgent 
    : null;

  // Get the latest version of activeChat from agents array
  const currentActiveChat = activeChat
    ? agents.find(a => a.id === activeChat.id) || activeChat
    : null;

  // Handle chat close
  const handleChatClose = useCallback(() => {
    setActiveChat(null);
    setIsChatMinimized(false);
  }, []);

  // Handle chat minimize toggle
  const handleChatToggleMinimize = useCallback(() => {
    setIsChatMinimized(prev => !prev);
  }, []);

  // Handle quick model change for nearby agent
  const handleQuickModelChange = useCallback(async (modelId: string) => {
    if (!nearbyAgent) return;
    try {
      const response = await fetch(`/api/agents/${nearbyAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
      });
      if (response.ok) {
        // Update local state
        setAgents(prev => prev.map(a => 
          a.id === nearbyAgent.id ? { ...a, model: modelId } : a
        ));
        setShowQuickModelSelector(false);
      }
    } catch (err) {
      console.error('Failed to change model:', err);
    }
  }, [nearbyAgent]);

  // Open chat with a specific agent (from UI button or proximity)
  const handleOpenChat = useCallback((agent: GameAgent) => {
    setActiveChat(agent);
    setIsChatMinimized(false);
  }, []);

  // Handle keyboard events for chat interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Press E to open chat when near an agent
      if (e.key.toLowerCase() === 'e' && nearbyAgent && !activeChat && !showQuickModelSelector) {
        setActiveChat(nearbyAgent);
        setIsChatMinimized(false);
      }
      // Press M to open quick model selector when near an agent
      if (e.key.toLowerCase() === 'm' && nearbyAgent && !activeChat) {
        setShowQuickModelSelector(prev => !prev);
      }
      // Press Escape to close chat or model selector
      if (e.key === 'Escape') {
        if (showQuickModelSelector) {
          setShowQuickModelSelector(false);
        } else if (activeChat) {
          setActiveChat(null);
          setIsChatMinimized(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyAgent, activeChat, showQuickModelSelector]);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (moveThrottleRef.current) {
        clearTimeout(moveThrottleRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#282c34]">
        <div className="text-white text-xl animate-pulse font-semibold">Loading Virtual World...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#1e272e]">
      <div className="absolute inset-0 z-0">
        <GameCanvas 
          currentUser={user} 
          agents={agents}
          workspaces={workspaces}
          agentsNeedingAction={agentsNeedingAction}
          onMove={handleMove}
          onAgentProximity={handleAgentProximity}
          proximityThreshold={2.5}
        />
      </div>
      
      {/* Chat Panel - Left side */}
      {currentActiveChat && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '24px', 
            left: '24px', 
            zIndex: 99999,
          }}
        >
          <ChatPanel
            agent={currentActiveChat}
            onClose={handleChatClose}
            isMinimized={isChatMinimized}
            onToggleMinimize={handleChatToggleMinimize}
          />
        </div>
      )}
      
      {/* Nearby Agent Indicator */}
      {currentNearbyAgent && !activeChat && !showQuickModelSelector && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 99998,
            pointerEvents: 'none'
          }}
        >
          <div className="bg-slate-800/90 backdrop-blur-md text-white px-4 py-3 rounded-xl border border-slate-600/50 shadow-lg">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-400" />
                <span className="text-sm font-medium">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">E</kbd> to chat with {currentNearbyAgent.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-purple-400" />
                <span className="text-sm font-medium">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">M</kbd> to change model
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-1">
                <span>Current model:</span>
                <span className="text-purple-300">{getModelById((currentNearbyAgent as any).model)?.name || 'Default'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Model Selector Popup */}
      {currentNearbyAgent && showQuickModelSelector && !activeChat && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 99999,
          }}
        >
          <div className="bg-slate-800/95 backdrop-blur-md text-white rounded-2xl border border-slate-600/50 shadow-2xl w-[400px] max-h-[500px] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-purple-400" />
                <span className="font-semibold">Change Model for {currentNearbyAgent.name}</span>
              </div>
              <button 
                onClick={() => setShowQuickModelSelector(false)}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Model List */}
            <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {models.map((model: ProviderModel) => {
                const isSelected = (currentNearbyAgent as any).model === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => handleQuickModelChange(model.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between mb-1 ${
                      isSelected 
                        ? 'bg-purple-500/20 border border-purple-500/30' 
                        : 'hover:bg-slate-700/50 border border-transparent'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{model.providerName}</span>
                        {model.capabilities.reasoning && (
                          <span className="text-[9px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">Reasoning</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span>Context: {formatContextWindow(model.contextWindow)}</span>
                        <span>Status: {model.status}</span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle size={18} className="text-purple-400 ml-2" />}
                  </button>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500">Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[9px]">ESC</kbd> to close</p>
            </div>
          </div>
        </div>
      )}
      
      {/* HUD - Kiri Bawah (Control Info) */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: '24px', 
          left: '24px', 
          zIndex: 99998,
          pointerEvents: 'none'
        }}
      >
        <div className="bg-white/10 backdrop-blur-md text-white/80 p-3 rounded-2xl border border-white/10 shadow-lg text-sm font-medium flex flex-col gap-1.5">
          <div className="flex items-center gap-2"><span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">W A S D</span> or <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">Arrow Keys</span> to walk</div>
        </div>
      </div>

      {/* UI Controls - Kanan Bawah */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '16px'
        }}
      >
        {/* Panel Agent */}
        {showAgentPanel && (
          <div className="shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-300 transform origin-bottom-right">
            <AgentPanel onAgentCreated={fetchAgents} />
          </div>
        )}

        {/* Action Bar */}
        <div className="bg-[#2f3542]/95 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-[#57606f]/50 w-[380px]">
          <div className="flex justify-between items-center gap-2">
            
            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-inner">
                <UserIcon size={18} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-gray-100 leading-tight">{user.username}</span>
                <span className="text-[10px] text-[#2ed573] font-medium leading-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2ed573] inline-block animate-pulse"></span> Online
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAgentPanel(!showAgentPanel)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  showAgentPanel 
                    ? 'bg-[#3742fa] hover:bg-[#5352ed] text-white shadow-[0_0_15px_rgba(55,66,250,0.4)]' 
                    : 'bg-[#57606f]/50 hover:bg-[#57606f] text-gray-200'
                }`}
              >
                <Users size={16} />
                <span>Agents</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${showAgentPanel ? 'bg-white/20' : 'bg-black/30'}`}>
                  {agents.length}
                </span>
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all duration-200"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* OpenCode Server Warning Popup */}
      {!dismissedServerWarning && (
        <OpenCodeServerWarning
          serverStatus={serverStatus}
          onRetry={checkServer}
          onDismiss={() => setDismissedServerWarning(true)}
        />
      )}
    </div>
  );
}
