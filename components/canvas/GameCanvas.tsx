'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Character, AgentStatus, WorkspaceRoom } from '@/types';
import { createGameEngine, startGameLoop, stopGameLoop, centerCameraOnCharacter, GameEngine, TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT, screenToWorld } from '@/lib/game/engine';
import { createInputHandler, applyMovement, InputState, setTouchDirection } from '@/lib/game/input';
import { renderOffice, renderCharacters, renderDebugInfo, hitTestWorkspaceRoom, createDragState, getDragAdjustedRoomPosition, getRoomPosition as getRoomPositionImport, WorkspaceDragState, BASE_ROOM_HEIGHT, getDynamicRoomWidth, isInWorkspaceRoom } from '@/lib/game/renderer';
import { createAllSprites, AllSprites } from '@/lib/game/animated-sprites';

// Agent type for GameCanvas (compatible with both old and new schema)
interface GameAgent {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  status: string;
  sessionId?: string | null;
  model?: string;
  currentTask?: string | null;
  activeTaskCount?: number;
  deskIndex?: number | null;
  workspaceId?: string | null;
  // Workspace relation (new schema)
  workspace?: {
    id: string;
    name: string;
    path: string;
    color: string;
  } | null;
}

// Other online player (from multiplayer)
interface OtherPlayer {
  userId: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  avatar?: string;
}

interface GameCanvasProps {
  currentUser: {
    id: string;
    username: string;
    x: number;
    y: number;
    direction: string;
    avatar: string;
  };
  agents?: GameAgent[];
  workspaces?: WorkspaceRoom[]; // Workspace rooms to render
  otherPlayers?: OtherPlayer[]; // Other online players for multiplayer
  agentsNeedingAction?: Set<string>; // Set of agent IDs that need user action
  onMove?: (x: number, y: number, direction: string) => void;
  onAgentProximity?: (agent: GameAgent | null) => void;
  onWorkspaceEnter?: (workspace: WorkspaceRoom | null) => void;
  onWorkspaceMoved?: (workspaceId: string, positionX: number, positionY: number) => void; // Called when workspace is dragged to new position
  proximityThreshold?: number; // Distance in tiles to trigger proximity
  inputRef?: React.MutableRefObject<InputState | null>; // Expose input for touch controls
}

export default function GameCanvas({ 
  currentUser, 
  agents = [], 
  workspaces = [],
  otherPlayers = [],
  agentsNeedingAction = new Set(),
  onMove,
  onAgentProximity,
  onWorkspaceEnter,
  onWorkspaceMoved,
  proximityThreshold = 2, // Default 2 tiles (64 pixels at 32px per tile)
  inputRef: externalInputRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputState | null>(null);
  const playerRef = useRef<Character>({
    id: currentUser.id,
    username: currentUser.username,
    x: currentUser.x,
    y: currentUser.y,
    direction: currentUser.direction as 'up' | 'down' | 'left' | 'right',
    avatar: currentUser.avatar,
    isAgent: false,
  });
  const spritesRef = useRef<AllSprites | null>(null);
  const [fps, setFps] = useState(60);
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 });
  const nearbyAgentRef = useRef<GameAgent | null>(null);
  const lastWorkspaceRef = useRef<WorkspaceRoom | null>(null);
  
  // Store agents, workspaces, and callbacks in refs to avoid useEffect re-runs
  const agentsRef = useRef<GameAgent[]>(agents);
  const workspacesRef = useRef<WorkspaceRoom[]>(workspaces);
  const otherPlayersRef = useRef<OtherPlayer[]>(otherPlayers);
  const agentsNeedingActionRef = useRef<Set<string>>(agentsNeedingAction);
  const onMoveRef = useRef(onMove);
  const onAgentProximityRef = useRef(onAgentProximity);
  const onWorkspaceEnterRef = useRef(onWorkspaceEnter);
  const onWorkspaceMovedRef = useRef(onWorkspaceMoved);
  const proximityThresholdRef = useRef(proximityThreshold);
  const fpsRef = useRef(fps);
  const dragStateRef = useRef<WorkspaceDragState>(createDragState());

  // Update refs when props change (without triggering useEffect)
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

  useEffect(() => {
    otherPlayersRef.current = otherPlayers;
  }, [otherPlayers]);

  useEffect(() => {
    agentsNeedingActionRef.current = agentsNeedingAction;
  }, [agentsNeedingAction]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onAgentProximityRef.current = onAgentProximity;
  }, [onAgentProximity]);

  useEffect(() => {
    onWorkspaceEnterRef.current = onWorkspaceEnter;
  }, [onWorkspaceEnter]);

  useEffect(() => {
    onWorkspaceMovedRef.current = onWorkspaceMoved;
  }, [onWorkspaceMoved]);

  useEffect(() => {
    proximityThresholdRef.current = proximityThreshold;
  }, [proximityThreshold]);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HD rendering - use devicePixelRatio for crisp display
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    
    // Set canvas internal resolution to match display resolution
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    // Scale canvas CSS size to match display size
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Initialize game engine
    const engine = createGameEngine(canvas);
    engineRef.current = engine;
    
    // Scale context for HD rendering
    engine.ctx.scale(dpr, dpr);

    // Initialize input handler
    const input = createInputHandler();
    inputRef.current = input;

    // Expose input ref for external touch controls
    if (externalInputRef) {
      externalInputRef.current = input;
    }

    // Create all sprites (including animated ones)
    const sprites = createAllSprites();
    spritesRef.current = sprites;

    // --- Workspace drag handling ---
    const dragState = dragStateRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      if (!engineRef.current) return;
      const worldPos = screenToWorld(screenX, screenY, engineRef.current.camera);
      
      const hitWs = hitTestWorkspaceRoom(worldPos.x, worldPos.y, workspacesRef.current);
      if (hitWs && hitWs.roomIndex !== null) {
        const roomPos = getRoomPositionImport(hitWs.roomIndex, workspacesRef.current);
        
        dragState.isDragging = true;
        dragState.workspaceId = hitWs.id;
        dragState.startWorldX = worldPos.x;
        dragState.startWorldY = worldPos.y;
        dragState.startRoomX = roomPos.x;
        dragState.startRoomY = roomPos.y;
        dragState.currentWorldX = worldPos.x;
        dragState.currentWorldY = worldPos.y;
        
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      if (!engineRef.current) return;
      const worldPos = screenToWorld(screenX, screenY, engineRef.current.camera);
      
      if (dragState.isDragging) {
        dragState.currentWorldX = worldPos.x;
        dragState.currentWorldY = worldPos.y;
        e.preventDefault();
      } else {
        // Update hover state for cursor feedback
        const hitWs = hitTestWorkspaceRoom(worldPos.x, worldPos.y, workspacesRef.current);
        const newHoveredId = hitWs?.id || null;
        
        if (dragState.hoveredWorkspaceId !== newHoveredId) {
          dragState.hoveredWorkspaceId = newHoveredId;
          canvas.style.cursor = newHoveredId ? 'grab' : 'default';
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      
      // Calculate final position in tiles
      const deltaX = (dragState.currentWorldX - dragState.startWorldX) / TILE_SIZE;
      const deltaY = (dragState.currentWorldY - dragState.startWorldY) / TILE_SIZE;
      const finalX = Math.round(dragState.startRoomX + deltaX);
      const finalY = Math.round(dragState.startRoomY + deltaY);
      
      // Clamp to valid bounds (keep inside office walls)
      const ws = workspacesRef.current.find(w => w.id === dragState.workspaceId);
      const agentCount = ws?.agents?.length || 1;
      const roomWidth = getDynamicRoomWidth(agentCount);
      const clampedX = Math.max(1, Math.min(finalX, OFFICE_WIDTH - roomWidth - 1));
      const clampedY = Math.max(1, Math.min(finalY, OFFICE_HEIGHT - BASE_ROOM_HEIGHT - 1));
      
      // Only persist if position actually changed
      const hasMoved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
      
      if (hasMoved && dragState.workspaceId && onWorkspaceMovedRef.current) {
        onWorkspaceMovedRef.current(dragState.workspaceId, clampedX, clampedY);
      }
      
      // Reset drag state
      dragState.isDragging = false;
      dragState.workspaceId = null;
      canvas.style.cursor = dragState.hoveredWorkspaceId ? 'grab' : 'default';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Game render loop
    const render = (deltaTime: number) => {
      if (!engineRef.current || !inputRef.current || !spritesRef.current) return;

      const player = playerRef.current;

      // Apply keyboard input to player movement
      applyMovement(player, inputRef.current, deltaTime);

      // Center camera on player (use display size, not internal canvas size)
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      centerCameraOnCharacter(
        engineRef.current.camera,
        player,
        displayWidth,
        displayHeight
      );

      // Render office with new sprites and workspace rooms
      renderOffice(engineRef.current, spritesRef.current, workspacesRef.current, dragStateRef.current);

      // Convert agents to characters for rendering (use ref to get latest agents)
      const currentAgents = agentsRef.current;
      const needingAction = agentsNeedingActionRef.current;
      const currentDragState = dragStateRef.current;
      const currentWorkspaces = workspacesRef.current;
      
      const agentCharacters: (Character & { status: AgentStatus })[] = currentAgents.map(agent => {
        let agentX = agent.x;
        let agentY = agent.y;
        
        // If the agent's workspace is being dragged, offset agent position accordingly
        if (currentDragState.isDragging && agent.workspaceId) {
          const ws = currentWorkspaces.find(w => w.id === agent.workspaceId);
          if (ws && currentDragState.workspaceId === ws.id && ws.roomIndex !== null) {
            const originalRoomPos = getRoomPositionImport(ws.roomIndex, currentWorkspaces);
            const draggedRoomPos = getDragAdjustedRoomPosition(ws, currentDragState, currentWorkspaces);
            const deltaX = (draggedRoomPos.x - originalRoomPos.x) * TILE_SIZE;
            const deltaY = (draggedRoomPos.y - originalRoomPos.y) * TILE_SIZE;
            agentX += deltaX;
            agentY += deltaY;
          }
        }
        
        return {
          id: agent.id,
          name: agent.name,
          x: agentX,
          y: agentY,
          direction: agent.direction as 'up' | 'down' | 'left' | 'right',
          avatar: 'agent',
          isAgent: true,
          status: agent.status as AgentStatus,
          workspace: agent.workspace?.path || undefined,
          color: agent.workspace?.color || '#4a9eff',
          model: agent.model || undefined,
          currentTask: agent.currentTask || undefined,
          needsAction: needingAction.has(agent.id),
        };
      });

      // Convert other online players to characters for rendering
      const currentOtherPlayers = otherPlayersRef.current;
      const otherPlayerCharacters: Character[] = currentOtherPlayers.map(p => ({
        id: p.userId,
        username: p.username,
        x: p.x,
        y: p.y,
        direction: (p.direction || 'down') as 'up' | 'down' | 'left' | 'right',
        avatar: p.avatar || 'default',
        isAgent: false,
      }));

      // Render all characters (player + other players + agents)
      const allCharacters = [player, ...otherPlayerCharacters, ...agentCharacters];
      renderCharacters(engineRef.current, allCharacters, spritesRef.current);

      // Render debug info (use ref to get latest fps)
      renderDebugInfo(engineRef.current, player, fpsRef.current);

      // Check proximity to agents (use tile-based distance)
      const threshold = proximityThresholdRef.current * TILE_SIZE;
      let closestAgent: GameAgent | null = null;
      let closestDistance = Infinity;
      
      for (const agent of currentAgents) {
        const dx = player.x - agent.x;
        const dy = player.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= threshold && distance < closestDistance) {
          closestAgent = agent;
          closestDistance = distance;
        }
      }
      
      // Only notify if proximity state changed
      if (nearbyAgentRef.current?.id !== closestAgent?.id) {
        nearbyAgentRef.current = closestAgent;
        if (onAgentProximityRef.current) {
          onAgentProximityRef.current(closestAgent);
        }
      }

      // Check workspace proximity
      if (onWorkspaceEnterRef.current) {
        // Player position is in pixels, convert to tiles for isInWorkspaceRoom
        const tileX = player.x / TILE_SIZE;
        const tileY = player.y / TILE_SIZE;
        const currentWorkspace = isInWorkspaceRoom(tileX, tileY, currentWorkspaces);
        
        if (lastWorkspaceRef.current?.id !== currentWorkspace?.id) {
          lastWorkspaceRef.current = currentWorkspace;
          onWorkspaceEnterRef.current(currentWorkspace);
        }
      }

      // Update FPS counter
      fpsCounterRef.current.frames++;
      const now = performance.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      // Notify parent of movement (use ref to get latest callback)
      if (onMoveRef.current) {
        onMoveRef.current(player.x, player.y, player.direction);
      }
    };

    // Start game loop
    startGameLoop(engine, render);

    // Handle window resize with HD support
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      // Re-scale context after resize
      if (engineRef.current) {
        engineRef.current.ctx.scale(dpr, dpr);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      stopGameLoop(engine);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentUser.id]); // Only re-run when user ID changes

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full"
      style={{ imageRendering: 'pixelated', position: 'relative', zIndex: 1 }}
    />
  );
}
