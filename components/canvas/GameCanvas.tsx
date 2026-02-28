'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Character, AgentStatus, WorkspaceRoom } from '@/types';
import { createGameEngine, startGameLoop, stopGameLoop, centerCameraOnCharacter, GameEngine, TILE_SIZE } from '@/lib/game/engine';
import { createInputHandler, applyMovement, InputState } from '@/lib/game/input';
import { renderOffice, renderCharacters, renderDebugInfo } from '@/lib/game/renderer';
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
  agentsNeedingAction?: Set<string>; // Set of agent IDs that need user action
  onMove?: (x: number, y: number, direction: string) => void;
  onAgentProximity?: (agent: GameAgent | null) => void;
  proximityThreshold?: number; // Distance in tiles to trigger proximity
}

export default function GameCanvas({ 
  currentUser, 
  agents = [], 
  workspaces = [],
  agentsNeedingAction = new Set(),
  onMove,
  onAgentProximity,
  proximityThreshold = 2 // Default 2 tiles (64 pixels at 32px per tile)
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
  
  // Store agents, workspaces, and callbacks in refs to avoid useEffect re-runs
  const agentsRef = useRef<GameAgent[]>(agents);
  const workspacesRef = useRef<WorkspaceRoom[]>(workspaces);
  const agentsNeedingActionRef = useRef<Set<string>>(agentsNeedingAction);
  const onMoveRef = useRef(onMove);
  const onAgentProximityRef = useRef(onAgentProximity);
  const proximityThresholdRef = useRef(proximityThreshold);
  const fpsRef = useRef(fps);

  // Update refs when props change (without triggering useEffect)
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

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

    // Create all sprites (including animated ones)
    const sprites = createAllSprites();
    spritesRef.current = sprites;

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
      renderOffice(engineRef.current, spritesRef.current, workspacesRef.current);

      // Convert agents to characters for rendering (use ref to get latest agents)
      const currentAgents = agentsRef.current;
      const needingAction = agentsNeedingActionRef.current;
      const agentCharacters: (Character & { status: AgentStatus })[] = currentAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        x: agent.x,
        y: agent.y,
        direction: agent.direction as 'up' | 'down' | 'left' | 'right',
        avatar: 'agent',
        isAgent: true,
        status: agent.status as AgentStatus,
        workspace: agent.workspace?.path || undefined,
        color: agent.workspace?.color || '#4a9eff',
        currentTask: agent.currentTask || undefined,
        needsAction: needingAction.has(agent.id),
      }));

      // Render all characters (player + agents)
      const allCharacters = [player, ...agentCharacters];
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
