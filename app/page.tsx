'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import GameCanvas from '@/components/canvas/GameCanvas';
import AuthForm from '@/components/auth/AuthForm';
import AgentPanel from '@/components/game/AgentPanel';
import ChatPanel from '@/components/game/ChatPanel';
import GlobalChat from '@/components/game/GlobalChat';
import FileManager from '@/components/game/FileManager';
import MobileControls from '@/components/game/MobileControls';
import OpenCodeServerWarning from '@/components/ui/OpenCodeServerWarning';
import { WorkspaceRoom, GameAgent } from '@/types';
import { LogOut, Users, User as UserIcon, MessageSquare, MessageCircle, Cpu, X, CheckCircle, Bot, FolderOpen } from 'lucide-react';
import { useModels } from '@/lib/models/use-models';
import { useOpenCodeServer } from '@/lib/opencode/use-opencode-server';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { useSocket } from '@/lib/hooks/use-socket';
import { useGlobalChat } from '@/lib/hooks/use-global-chat';
import { ProviderModel, formatContextWindow } from '@/lib/models/available-models';
import { InputState, setTouchDirection } from '@/lib/game/input';

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
  const isMobile = useIsMobile();
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<GameAgent[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgentPanel, setShowAgentPanel] = useState(false); // Default closed on mobile
  const [activeChat, setActiveChat] = useState<GameAgent | null>(null);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [nearbyAgent, setNearbyAgent] = useState<GameAgent | null>(null);
  const [agentsNeedingAction, setAgentsNeedingAction] = useState<Set<string>>(new Set());
  const [showQuickModelSelector, setShowQuickModelSelector] = useState(false);
  const [dismissedServerWarning, setDismissedServerWarning] = useState(false);
  const [showGlobalChat, setShowGlobalChat] = useState(false);
  const [activeFileManager, setActiveFileManager] = useState<{
    id: string;
    name: string;
    path: string;
    color: string;
  } | null>(null);
  
  // Ref for throttling handleMove
  const lastMoveRef = useRef<{ x: number; y: number; direction: string } | null>(null);
  const moveThrottleRef = useRef<number | null>(null);
  const wasServerConnectedRef = useRef(false);
  const gameInputRef = useRef<InputState | null>(null);

  // Multiplayer socket connection
  const { isConnected: socketConnected, otherPlayers, onlineCount, sendPosition } = useSocket({
    userId: user?.id || null,
    initialPosition: user ? { x: user.x, y: user.y, direction: user.direction, avatar: user.avatar } : undefined,
  });

  // Global chat
  const {
    messages: globalChatMessages,
    sendMessage: sendGlobalMessage,
    sendEmote: sendGlobalEmote,
    unreadCount: chatUnreadCount,
    clearUnread: clearChatUnread,
    isConnected: chatConnected,
  } = useGlobalChat({
    userId: user?.id || null,
    isOpen: showGlobalChat,
  });

  // Set agent panel open by default on desktop
  useEffect(() => {
    if (!isMobile) {
      setShowAgentPanel(true);
    }
  }, [isMobile]);

  // Reset dismissed warning when server goes from connected to disconnected
  useEffect(() => {
    if (isServerRunning) {
      wasServerConnectedRef.current = true;
    } else if (wasServerConnectedRef.current && !isServerRunning) {
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

  // Check which agents need user action
  const checkAgentsNeedingAction = useCallback(async () => {
    if (agents.length === 0) return;
    
    const needingAction = new Set<string>();
    
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
    
    checkAgentsNeedingAction();
    
    const interval = setInterval(checkAgentsNeedingAction, 5000);
    return () => clearInterval(interval);
  }, [user, agents.length, checkAgentsNeedingAction]);

  // Throttled handleMove — also broadcasts position via socket
  const handleMove = useCallback((x: number, y: number, direction: string) => {
    const last = lastMoveRef.current;
    
    if (last && Math.abs(last.x - x) < 0.1 && Math.abs(last.y - y) < 0.1 && last.direction === direction) {
      return;
    }
    
    lastMoveRef.current = { x, y, direction };
    
    // Send position to other players via socket
    sendPosition(x, y, direction);
    
    if (moveThrottleRef.current) {
      return;
    }
    
    moveThrottleRef.current = window.setTimeout(() => {
      moveThrottleRef.current = null;
    }, 100);
  }, [sendPosition]);

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
        setAgents(prev => prev.map(a => 
          a.id === nearbyAgent.id ? { ...a, model: modelId } : a
        ));
        setShowQuickModelSelector(false);
      }
    } catch (err) {
      console.error('Failed to change model:', err);
    }
  }, [nearbyAgent]);

  // Open chat with a specific agent
  const handleOpenChat = useCallback((agent: GameAgent) => {
    setActiveChat(agent);
    setIsChatMinimized(false);
  }, []);

  // Open file manager for a workspace
  const handleOpenFiles = useCallback((workspace: { id: string; name: string; path: string; color: string }) => {
    setActiveFileManager(workspace);
  }, []);

  // Toggle global chat
  const handleToggleGlobalChat = useCallback(() => {
    setShowGlobalChat(prev => {
      if (!prev) clearChatUnread();
      return !prev;
    });
  }, [clearChatUnread]);

  // Mobile touch controls
  const handleTouchDirection = useCallback((direction: string | null) => {
    if (gameInputRef.current) {
      setTouchDirection(gameInputRef.current, direction);
    }
  }, []);

  // Handle workspace drag move — persist to server
  const handleWorkspaceMoved = useCallback(async (workspaceId: string, positionX: number, positionY: number) => {
    try {
      // Optimistically update local state
      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, positionX, positionY } 
          : ws
      ));

      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX, positionY }),
      });
      
      if (response.ok) {
        // Refetch to get updated agent positions
        fetchAgents();
        fetchWorkspaces();
      } else {
        console.error('Failed to save workspace position');
        // Revert on error
        fetchWorkspaces();
      }
    } catch (error) {
      console.error('Failed to save workspace position:', error);
      fetchWorkspaces();
    }
  }, [fetchAgents, fetchWorkspaces]);

  const handleMobileAction = useCallback((action: 'chat' | 'model') => {
    if (!nearbyAgent) return;
    if (action === 'chat') {
      setActiveChat(nearbyAgent);
      setIsChatMinimized(false);
    } else if (action === 'model') {
      setShowQuickModelSelector(prev => !prev);
    }
  }, [nearbyAgent]);

  // Handle keyboard events for chat interaction (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key.toLowerCase() === 'e' && nearbyAgent && !activeChat && !showQuickModelSelector) {
        setActiveChat(nearbyAgent);
        setIsChatMinimized(false);
      }
      if (e.key.toLowerCase() === 'm' && nearbyAgent && !activeChat) {
        setShowQuickModelSelector(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (showQuickModelSelector) {
          setShowQuickModelSelector(false);
        } else if (showGlobalChat) {
          setShowGlobalChat(false);
        } else if (activeFileManager) {
          setActiveFileManager(null);
        } else if (activeChat) {
          setActiveChat(null);
          setIsChatMinimized(false);
        } else if (showAgentPanel && isMobile) {
          setShowAgentPanel(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyAgent, activeChat, showQuickModelSelector, showGlobalChat, activeFileManager, showAgentPanel, isMobile]);

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

  // Check if any fullscreen panel is open (mobile)
  const hasFullscreenPanel = isMobile && (!!currentActiveChat || !!activeFileManager || showAgentPanel || showQuickModelSelector || showGlobalChat);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#1e272e]">
      <div className="absolute inset-0 z-0">
        <GameCanvas 
          currentUser={user} 
          agents={agents}
          workspaces={workspaces}
          otherPlayers={otherPlayers}
          agentsNeedingAction={agentsNeedingAction}
          onMove={handleMove}
          onAgentProximity={handleAgentProximity}
          onWorkspaceMoved={handleWorkspaceMoved}
          proximityThreshold={2.5}
          inputRef={gameInputRef}
        />
      </div>
      
      {/* ========== DESKTOP LAYOUT ========== */}
      {!isMobile && (
        <>
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

          {/* File Manager - Left side, offset when chat is open */}
          {activeFileManager && (
            <div 
              style={{ 
                position: 'absolute', 
                top: '24px', 
                left: currentActiveChat ? '440px' : '24px', 
                zIndex: 99999,
              }}
            >
              <FileManager
                workspaceId={activeFileManager.id}
                workspaceName={activeFileManager.name}
                workspacePath={activeFileManager.path}
                workspaceColor={activeFileManager.color}
                onClose={() => setActiveFileManager(null)}
              />
            </div>
          )}
          
          {/* Nearby Agent Indicator (desktop only — mobile uses action buttons) */}
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
                
                <div className="px-4 py-2 border-t border-slate-700/50 text-center">
                  <p className="text-[10px] text-slate-500">Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[9px]">ESC</kbd> to close</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Global Chat Panel - Bottom Left */}
          {showGlobalChat && (
            <div
              style={{
                position: 'absolute',
                bottom: '70px',
                left: '24px',
                zIndex: 99999,
              }}
            >
              <GlobalChat
                messages={globalChatMessages}
                currentUserId={user.id}
                currentUsername={user.username}
                onSendMessage={sendGlobalMessage}
                onSendEmote={sendGlobalEmote}
                onClose={() => setShowGlobalChat(false)}
                isConnected={chatConnected}
                onlineCount={onlineCount}
              />
            </div>
          )}

          {/* HUD - Bottom Left (Control Info) */}
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

          {/* UI Controls - Bottom Right */}
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
                <AgentPanel onAgentCreated={fetchAgents} onOpenFiles={handleOpenFiles} currentUserId={user?.id} />
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
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2ed573] inline-block animate-pulse"></span> 
                      {socketConnected ? `${onlineCount} online` : 'Connecting...'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleGlobalChat}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      showGlobalChat 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                        : 'bg-[#57606f]/50 hover:bg-[#57606f] text-gray-200'
                    }`}
                    title="Global Chat"
                  >
                    <MessageCircle size={16} />
                    <span>Chat</span>
                    {chatUnreadCount > 0 && !showGlobalChat && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center px-1 font-bold animate-pulse">
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </span>
                    )}
                  </button>

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
        </>
      )}

      {/* ========== MOBILE LAYOUT ========== */}
      {isMobile && (
        <>
          {/* Mobile Touch Controls (joystick + action buttons) — only show when no fullscreen panel open */}
          {!hasFullscreenPanel && (
            <MobileControls
              onDirectionChange={handleTouchDirection}
              onAction={handleMobileAction}
              showActionButtons={!!currentNearbyAgent && !activeChat && !showQuickModelSelector}
              agentName={currentNearbyAgent?.name}
            />
          )}

          {/* Mobile Bottom Navigation Bar — always visible unless fullscreen panel */}
          {!hasFullscreenPanel && (
            <div 
              className="fixed bottom-0 left-0 right-0 z-[99995] bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 safe-area-bottom"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="flex items-center justify-around px-2 py-2">
                {/* User */}
                <div className="flex items-center gap-2 px-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                    <UserIcon size={14} className="text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[11px] text-gray-100 leading-tight">{user.username}</span>
                    <span className="text-[9px] text-[#2ed573] font-medium leading-tight flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#2ed573] inline-block animate-pulse"></span> 
                      {socketConnected ? `${onlineCount} online` : '...'}
                    </span>
                  </div>
                </div>

                {/* Agents button */}
                <button
                  onClick={() => setShowAgentPanel(!showAgentPanel)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                    showAgentPanel 
                      ? 'bg-indigo-500/30 text-indigo-300' 
                      : 'text-slate-400 active:bg-slate-700/50'
                  }`}
                >
                  <Bot size={18} />
                  <span>Agents</span>
                  {agents.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[8px] text-white flex items-center justify-center">
                      {agents.length}
                    </span>
                  )}
                </button>

                {/* Files button (if any workspace available) */}
                {workspaces.length > 0 && (
                  <button
                    onClick={() => {
                      if (activeFileManager) {
                        setActiveFileManager(null);
                      } else if (workspaces.length > 0) {
                        // Open first workspace file manager
                        const ws = workspaces[0];
                        setActiveFileManager({ id: ws.id, name: ws.name, path: ws.path, color: ws.color || '#6366f1' });
                      }
                    }}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                      activeFileManager 
                        ? 'bg-amber-500/30 text-amber-300' 
                        : 'text-slate-400 active:bg-slate-700/50'
                    }`}
                  >
                    <FolderOpen size={18} />
                    <span>Files</span>
                  </button>
                )}

                {/* Global Chat button */}
                <button
                  onClick={handleToggleGlobalChat}
                  className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                    showGlobalChat 
                      ? 'bg-emerald-500/30 text-emerald-300' 
                      : 'text-slate-400 active:bg-slate-700/50'
                  }`}
                >
                  <MessageCircle size={18} />
                  <span>Chat</span>
                  {chatUnreadCount > 0 && !showGlobalChat && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center px-0.5 font-bold animate-pulse">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold text-red-400 active:bg-red-500/20 transition-all"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Global Chat — Fullscreen overlay */}
          {showGlobalChat && (
            <div className="fixed inset-0 z-[99999] bg-slate-900/98">
              <GlobalChat
                messages={globalChatMessages}
                currentUserId={user.id}
                currentUsername={user.username}
                onSendMessage={sendGlobalMessage}
                onSendEmote={sendGlobalEmote}
                onClose={() => setShowGlobalChat(false)}
                isConnected={chatConnected}
                onlineCount={onlineCount}
                isMobile
              />
            </div>
          )}

          {/* Mobile Chat Panel — Fullscreen overlay */}
          {currentActiveChat && (
            <div className="fixed inset-0 z-[99999] bg-slate-900/98">
              <ChatPanel
                agent={currentActiveChat}
                onClose={handleChatClose}
                isMinimized={isChatMinimized}
                onToggleMinimize={handleChatToggleMinimize}
                isMobile
              />
            </div>
          )}

          {/* Mobile File Manager — Fullscreen overlay */}
          {activeFileManager && (
            <div className="fixed inset-0 z-[99999] bg-slate-900/98">
              <FileManager
                workspaceId={activeFileManager.id}
                workspaceName={activeFileManager.name}
                workspacePath={activeFileManager.path}
                workspaceColor={activeFileManager.color}
                onClose={() => setActiveFileManager(null)}
                isMobile
              />
            </div>
          )}

          {/* Mobile Agent Panel — Fullscreen overlay */}
          {showAgentPanel && (
            <div className="fixed inset-0 z-[99999] bg-slate-900/98">
              <div className="h-full flex flex-col">
                {/* Close bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bot size={16} className="text-indigo-400" />
                    Workspaces & Agents
                  </h2>
                  <button
                    onClick={() => setShowAgentPanel(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <AgentPanel onAgentCreated={fetchAgents} onOpenFiles={(ws) => {
                    setActiveFileManager(ws);
                    setShowAgentPanel(false);
                  }} isMobile currentUserId={user?.id} />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Quick Model Selector — Fullscreen overlay */}
          {currentNearbyAgent && showQuickModelSelector && !activeChat && (
            <div className="fixed inset-0 z-[99999] bg-slate-900/98 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-purple-400" />
                  <span className="font-semibold text-white text-sm">Change Model for {currentNearbyAgent.name}</span>
                </div>
                <button 
                  onClick={() => setShowQuickModelSelector(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {models.map((model: ProviderModel) => {
                  const isSelected = (currentNearbyAgent as any).model === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleQuickModelChange(model.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors flex items-center justify-between ${
                        isSelected 
                          ? 'bg-purple-500/20 border border-purple-500/30' 
                          : 'active:bg-slate-700/50 border border-transparent'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white">{model.name}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{model.providerName}</span>
                          {model.capabilities.reasoning && (
                            <span className="text-[9px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">Reasoning</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                          <span>Context: {formatContextWindow(model.contextWindow)}</span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle size={18} className="text-purple-400 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

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
