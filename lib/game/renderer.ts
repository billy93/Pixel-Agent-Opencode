import { Character, AgentStatus, WorkspaceRoom } from '@/types';
import { GameEngine, TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT, worldToScreen } from './engine';
import { 
  AllSprites, 
  CHAR_SIZE, 
  Direction, 
  createActionBubble, 
  createAttentionIndicator,
  CharacterSpriteSheet,
  RobotSpriteSheet,
} from './animated-sprites';

// Animation state tracking
interface AnimationState {
  currentFrame: number;
  lastFrameTime: number;
  isMoving: boolean;
  lastDirection: Direction;
}

const animationStates: Map<string, AnimationState> = new Map();

function getAnimationState(id: string): AnimationState {
  if (!animationStates.has(id)) {
    animationStates.set(id, {
      currentFrame: 0,
      lastFrameTime: 0,
      isMoving: false,
      lastDirection: 'down',
    });
  }
  return animationStates.get(id)!;
}

// Office layout configuration
interface OfficeLayout {
  floorType: 'wood' | 'carpet';
  furniture: { type: 'desk' | 'plant' | 'sofa'; x: number; y: number }[];
}

// Define office zones
const CARPET_ZONES = [
  // Meeting area in bottom-right
  { x1: 35, y1: 20, x2: 45, y2: 28 },
  // Lounge area top-left
  { x1: 3, y1: 3, x2: 12, y2: 10 },
];

// Workspace Room Configuration
// Each workspace (folder path) = 1 shared room
// Room size is DYNAMIC based on number of agents
// No limit on agents per workspace
export const BASE_ROOM_HEIGHT = 8;   // Room height (tiles)
const ROOM_MARGIN = 2;        // tiles between rooms
const AGENT_SPACING = 6;      // tiles between each agent (center to center) - 192px apart
const DESK_WIDTH = 2;         // Each desk sprite is 2 tiles wide
const ROOM_PADDING = 2;       // Extra padding on each side of the room

// Calculate dynamic room width based on agent count
export function getDynamicRoomWidth(agentCount: number): number {
  if (agentCount <= 0) agentCount = 1;
  // Width = padding + (agents * spacing) + padding
  // Each agent needs AGENT_SPACING tiles of space
  const agentsWidth = agentCount * AGENT_SPACING;
  return agentsWidth + ROOM_PADDING * 2;
}

// Calculate default room position (used when no custom position is set)
export function getDefaultRoomPosition(roomIndex: number): { x: number; y: number } {
  const startX = 3;
  const startY = 6;
  
  // Calculate Y position by summing heights of previous rooms
  let currentY = startY;
  for (let i = 0; i < roomIndex; i++) {
    currentY += BASE_ROOM_HEIGHT + ROOM_MARGIN;
  }
  
  return {
    x: startX,
    y: currentY,
  };
}

// Calculate room positions - uses custom position if available, otherwise default stacked layout
export function getRoomPosition(roomIndex: number, workspaces: WorkspaceRoom[] = []): { x: number; y: number } {
  // Find the workspace with this roomIndex to check for custom position
  const workspace = workspaces.find(ws => ws.roomIndex === roomIndex);
  
  if (workspace?.positionX != null && workspace?.positionY != null) {
    // Use custom stored position
    return {
      x: workspace.positionX,
      y: workspace.positionY,
    };
  }
  
  // Fall back to default calculated position
  return getDefaultRoomPosition(roomIndex);
}

// Get the SHARED DESK position in a workspace room - DYNAMIC width
// Each agent gets one desk, desks are spaced apart
export function getSharedDeskPosition(roomIndex: number, agentCount: number, workspaces: WorkspaceRoom[] = []): { x: number; y: number; width: number } {
  const roomPos = getRoomPosition(roomIndex, workspaces);
  
  // Total desk width = number of desks * spacing between them
  const totalDeskWidth = agentCount * AGENT_SPACING;
  
  return {
    x: roomPos.x + ROOM_PADDING,  // Start at left padding
    y: roomPos.y + BASE_ROOM_HEIGHT - 3, // Lower part of room (in front)
    width: totalDeskWidth,
  };
}

// Get desk positions for rendering - one desk per agent, spaced apart
export function getDeskPositionsInRoom(roomIndex: number, agentCount: number, workspaces: WorkspaceRoom[] = []): { x: number; y: number }[] {
  const roomPos = getRoomPosition(roomIndex, workspaces);
  const positions: { x: number; y: number }[] = [];
  
  const deskY = roomPos.y + BASE_ROOM_HEIGHT - 3; // Lower part of room
  const startX = roomPos.x + ROOM_PADDING + (AGENT_SPACING - DESK_WIDTH) / 2; // Center desk in each agent slot
  
  for (let i = 0; i < agentCount; i++) {
    positions.push({
      x: startX + i * AGENT_SPACING,
      y: deskY,
    });
  }
  
  return positions;
}

// Get agent positions within a workspace room - DYNAMIC based on agent count
// Agents stand BEHIND (ABOVE) their desk - same X as desk, smaller Y
export function getAgentPositionsInRoom(roomIndex: number, agentCount: number, workspaces: WorkspaceRoom[] = []): { x: number; y: number }[] {
  const roomPos = getRoomPosition(roomIndex, workspaces);
  const positions: { x: number; y: number }[] = [];
  
  // Agent Y = desk Y - 2 tiles (above desk)
  const agentY = (roomPos.y + BASE_ROOM_HEIGHT - 5) * TILE_SIZE;
  
  // Agent X = center of each agent slot (same as desk center)
  const startX = (roomPos.x + ROOM_PADDING) * TILE_SIZE + (AGENT_SPACING * TILE_SIZE) / 2 - TILE_SIZE / 2;
  
  for (let i = 0; i < agentCount; i++) {
    positions.push({
      x: startX + i * AGENT_SPACING * TILE_SIZE,
      y: agentY,
    });
  }
  
  return positions;
}

// Get agent position for a specific slot in a room - DYNAMIC
export function getAgentPositionInRoom(roomIndex: number, slotIndex: number, totalAgents: number = 1, workspaces: WorkspaceRoom[] = []): { x: number; y: number } {
  const positions = getAgentPositionsInRoom(roomIndex, Math.max(totalAgents, slotIndex + 1), workspaces);
  
  if (slotIndex < positions.length) {
    return positions[slotIndex];
  }
  
  // Fallback position
  const roomPos = getRoomPosition(roomIndex, workspaces);
  const startX = (roomPos.x + ROOM_PADDING) * TILE_SIZE + (AGENT_SPACING * TILE_SIZE) / 2 - TILE_SIZE / 2;
  return {
    x: startX + slotIndex * AGENT_SPACING * TILE_SIZE,
    y: (roomPos.y + BASE_ROOM_HEIGHT - 5) * TILE_SIZE,
  };
}

// Legacy desk positions removed - all agents now use workspace rooms

function isInCarpetZone(x: number, y: number): boolean {
  return CARPET_ZONES.some(zone => 
    x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2
  );
}

// Legacy desk position check removed - all agents now use workspace rooms

// Check if a tile is inside a workspace room
function isInWorkspaceRoom(x: number, y: number, workspaces: WorkspaceRoom[]): WorkspaceRoom | null {
  for (const ws of workspaces) {
    if (ws.roomIndex === null) continue;
    const agentCount = ws.agents?.length || 1;
    const roomPos = getRoomPosition(ws.roomIndex, workspaces);
    const roomWidth = getDynamicRoomWidth(agentCount);
    if (x >= roomPos.x && x < roomPos.x + roomWidth &&
        y >= roomPos.y && y < roomPos.y + BASE_ROOM_HEIGHT) {
      return ws;
    }
  }
  return null;
}

// Drag state for workspace rooms
export interface WorkspaceDragState {
  isDragging: boolean;
  workspaceId: string | null;
  startWorldX: number;
  startWorldY: number;
  startRoomX: number; // Room position in tiles at drag start
  startRoomY: number;
  currentWorldX: number;
  currentWorldY: number;
  hoveredWorkspaceId: string | null; // For cursor feedback
}

export function createDragState(): WorkspaceDragState {
  return {
    isDragging: false,
    workspaceId: null,
    startWorldX: 0,
    startWorldY: 0,
    startRoomX: 0,
    startRoomY: 0,
    currentWorldX: 0,
    currentWorldY: 0,
    hoveredWorkspaceId: null,
  };
}

// Hit test: find which workspace room is at a given world position (in pixels)
export function hitTestWorkspaceRoom(
  worldX: number,
  worldY: number,
  workspaces: WorkspaceRoom[]
): WorkspaceRoom | null {
  const tileX = worldX / TILE_SIZE;
  const tileY = worldY / TILE_SIZE;
  return isInWorkspaceRoom(tileX, tileY, workspaces);
}

// Get the current drag-adjusted room position for a workspace
export function getDragAdjustedRoomPosition(
  ws: WorkspaceRoom,
  dragState: WorkspaceDragState,
  workspaces: WorkspaceRoom[]
): { x: number; y: number } {
  if (dragState.isDragging && dragState.workspaceId === ws.id && ws.roomIndex !== null) {
    // Calculate offset in tiles from drag start to current mouse position
    const deltaX = (dragState.currentWorldX - dragState.startWorldX) / TILE_SIZE;
    const deltaY = (dragState.currentWorldY - dragState.startWorldY) / TILE_SIZE;
    
    return {
      x: Math.round(dragState.startRoomX + deltaX),
      y: Math.round(dragState.startRoomY + deltaY),
    };
  }
  
  return getRoomPosition(ws.roomIndex ?? 0, workspaces);
}

export function renderOffice(engine: GameEngine, sprites: AllSprites, workspaces: WorkspaceRoom[] = [], dragState?: WorkspaceDragState) {
  const { ctx, camera } = engine;

  // Calculate visible tiles with some padding
  const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
  const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
  const endX = Math.min(OFFICE_WIDTH, Math.ceil((camera.x + ctx.canvas.width) / TILE_SIZE) + 1);
  const endY = Math.min(OFFICE_HEIGHT, Math.ceil((camera.y + ctx.canvas.height) / TILE_SIZE) + 1);

  // Draw background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Pre-compute workspace room bounds for tile rendering (use drag-adjusted positions)
  const workspaceRoomBounds = workspaces
    .filter(ws => ws.roomIndex !== null)
    .map(ws => {
      const agentCount = ws.agents?.length || 1;
      const roomPos = dragState
        ? getDragAdjustedRoomPosition(ws, dragState, workspaces)
        : getRoomPosition(ws.roomIndex!, workspaces);
      const roomWidth = getDynamicRoomWidth(agentCount);
      return { ws, roomPos, roomWidth };
    });

  // Render floor tiles
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const screenPos = worldToScreen(x * TILE_SIZE, y * TILE_SIZE, camera);
      
      // Skip if outside visible area
      if (screenPos.x < -TILE_SIZE || screenPos.x > ctx.canvas.width ||
          screenPos.y < -TILE_SIZE || screenPos.y > ctx.canvas.height) {
        continue;
      }

      // Determine tile type
      const isWall = x === 0 || x === OFFICE_WIDTH - 1 || y === 0 || y === OFFICE_HEIGHT - 1;
      const isGlassWall = !isWall && (x === 1 || x === OFFICE_WIDTH - 2) && y > 1 && y < OFFICE_HEIGHT - 2;
      const isCarpet = isInCarpetZone(x, y);
      
      // Check workspace room using drag-adjusted bounds
      let workspaceRoom: WorkspaceRoom | null = null;
      for (const { ws, roomPos, roomWidth } of workspaceRoomBounds) {
        if (x >= roomPos.x && x < roomPos.x + roomWidth &&
            y >= roomPos.y && y < roomPos.y + BASE_ROOM_HEIGHT) {
          workspaceRoom = ws;
          break;
        }
      }

      if (isWall) {
        ctx.drawImage(sprites.wall, screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
      } else if (isGlassWall) {
        ctx.drawImage(sprites.glassWall, screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
      } else if (workspaceRoom) {
        // Workspace room floor - use carpet with workspace color tint
        ctx.drawImage(sprites.carpet, screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
        // Add subtle color overlay for workspace
        const isDraggingThis = dragState?.isDragging && dragState.workspaceId === workspaceRoom.id;
        ctx.fillStyle = workspaceRoom.color + (isDraggingThis ? '30' : '15'); // More visible when dragging
        ctx.fillRect(screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
      } else if (isCarpet) {
        ctx.drawImage(sprites.carpet, screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.drawImage(sprites.floor, screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Render workspace room borders and labels
  renderWorkspaceRooms(ctx, camera, sprites, workspaces, dragState);

  // Render desks inside workspace rooms - one desk per agent, spaced apart
  for (const ws of workspaces) {
    if (ws.roomIndex === null) continue;
    const agentCount = ws.agents?.length || 1;
    
    // Use drag-adjusted position for desk rendering
    const roomPos = dragState
      ? getDragAdjustedRoomPosition(ws, dragState, workspaces)
      : getRoomPosition(ws.roomIndex, workspaces);
    
    const deskY = roomPos.y + BASE_ROOM_HEIGHT - 3;
    const startDeskX = roomPos.x + ROOM_PADDING + (AGENT_SPACING - DESK_WIDTH) / 2;
    
    for (let i = 0; i < agentCount; i++) {
      const deskX = (startDeskX + i * AGENT_SPACING) * TILE_SIZE;
      const deskPosY = deskY * TILE_SIZE;
      const screenPos = worldToScreen(deskX, deskPosY, camera);
      
      if (screenPos.x < -TILE_SIZE * 2 || screenPos.x > ctx.canvas.width ||
          screenPos.y < -TILE_SIZE * 2 || screenPos.y > ctx.canvas.height) {
        continue;
      }

      // Add transparency when dragging
      if (dragState?.isDragging && dragState.workspaceId === ws.id) {
        ctx.globalAlpha = 0.7;
      }
      ctx.drawImage(sprites.desk, screenPos.x, screenPos.y, TILE_SIZE * 2, TILE_SIZE * 2);
      ctx.globalAlpha = 1.0;
    }
  }

  // Legacy desks removed - all agents now use workspace rooms only

  // Render decorative elements
  renderDecorations(ctx, camera, sprites);
}

// Render workspace room borders and labels
function renderWorkspaceRooms(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  sprites: AllSprites,
  workspaces: WorkspaceRoom[],
  dragState?: WorkspaceDragState
) {
  for (const ws of workspaces) {
    if (ws.roomIndex === null) continue;
    
    const agentCount = ws.agents?.length || 1;
    const roomPos = dragState
      ? getDragAdjustedRoomPosition(ws, dragState, workspaces)
      : getRoomPosition(ws.roomIndex, workspaces);
    const roomWidth = getDynamicRoomWidth(agentCount);
    const screenPos = worldToScreen(roomPos.x * TILE_SIZE, roomPos.y * TILE_SIZE, camera);
    const roomWidthPx = roomWidth * TILE_SIZE;
    const roomHeightPx = BASE_ROOM_HEIGHT * TILE_SIZE;

    // Skip if room is not visible
    if (screenPos.x + roomWidthPx < 0 || screenPos.x > ctx.canvas.width ||
        screenPos.y + roomHeightPx < 0 || screenPos.y > ctx.canvas.height) {
      continue;
    }

    // Draw room border
    const isDraggingThis = dragState?.isDragging && dragState.workspaceId === ws.id;
    const isHovered = dragState?.hoveredWorkspaceId === ws.id && !dragState?.isDragging;
    
    if (isDraggingThis) {
      // Dragging: bright glow border
      ctx.save();
      ctx.shadowColor = ws.color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = ws.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(screenPos.x, screenPos.y, roomWidthPx, roomHeightPx);
      ctx.setLineDash([]);
      ctx.restore();
    } else if (isHovered) {
      // Hovered: subtle highlight
      ctx.save();
      ctx.shadowColor = ws.color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = ws.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(screenPos.x, screenPos.y, roomWidthPx, roomHeightPx);
      ctx.restore();
      
      // Draw move cursor icon hint
      const moveIconX = screenPos.x + roomWidthPx - 20;
      const moveIconY = screenPos.y + 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(moveIconX - 2, moveIconY - 2, 18, 18, 4);
      ctx.fill();
      
      // Draw move arrows icon
      ctx.strokeStyle = ws.color;
      ctx.lineWidth = 1.5;
      const cx = moveIconX + 7;
      const cy = moveIconY + 7;
      const arrowLen = 5;
      // Horizontal arrow
      ctx.beginPath();
      ctx.moveTo(cx - arrowLen, cy);
      ctx.lineTo(cx + arrowLen, cy);
      ctx.stroke();
      // Vertical arrow
      ctx.beginPath();
      ctx.moveTo(cx, cy - arrowLen);
      ctx.lineTo(cx, cy + arrowLen);
      ctx.stroke();
      // Arrow heads
      ctx.beginPath();
      ctx.moveTo(cx + arrowLen - 2, cy - 2);
      ctx.lineTo(cx + arrowLen, cy);
      ctx.lineTo(cx + arrowLen - 2, cy + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - arrowLen + 2, cy - 2);
      ctx.lineTo(cx - arrowLen, cy);
      ctx.lineTo(cx - arrowLen + 2, cy + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - arrowLen + 2);
      ctx.lineTo(cx, cy - arrowLen);
      ctx.lineTo(cx + 2, cy - arrowLen + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + arrowLen - 2);
      ctx.lineTo(cx, cy + arrowLen);
      ctx.lineTo(cx + 2, cy + arrowLen - 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = ws.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(screenPos.x, screenPos.y, roomWidthPx, roomHeightPx);
    }

    // Draw corner accents
    const cornerSize = 12;
    ctx.fillStyle = ws.color;
    // Top-left corner
    ctx.fillRect(screenPos.x - 1, screenPos.y - 1, cornerSize, 4);
    ctx.fillRect(screenPos.x - 1, screenPos.y - 1, 4, cornerSize);
    // Top-right corner
    ctx.fillRect(screenPos.x + roomWidthPx - cornerSize + 1, screenPos.y - 1, cornerSize, 4);
    ctx.fillRect(screenPos.x + roomWidthPx - 3, screenPos.y - 1, 4, cornerSize);
    // Bottom-left corner
    ctx.fillRect(screenPos.x - 1, screenPos.y + roomHeightPx - 3, cornerSize, 4);
    ctx.fillRect(screenPos.x - 1, screenPos.y + roomHeightPx - cornerSize + 1, 4, cornerSize);
    // Bottom-right corner
    ctx.fillRect(screenPos.x + roomWidthPx - cornerSize + 1, screenPos.y + roomHeightPx - 3, cornerSize, 4);
    ctx.fillRect(screenPos.x + roomWidthPx - 3, screenPos.y + roomHeightPx - cornerSize + 1, 4, cornerSize);

    // Draw workspace label at top of room
    ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    const labelX = screenPos.x + roomWidthPx / 2;
    const labelY = screenPos.y - 8;
    
    // Label with owner username
    const ownerLabel = ws.user?.username ? ` (${ws.user.username})` : '';
    const labelText = ws.name + ownerLabel;
    const labelWidth = ctx.measureText(labelText).width + 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(labelX - labelWidth / 2, labelY - 12, labelWidth, 18, 6);
    ctx.fill();
    
    // Label border
    ctx.strokeStyle = ws.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Label text
    ctx.fillStyle = ws.color;
    ctx.fillText(labelText, labelX, labelY + 2);

    // Draw agent count badge
    const badgeAgentCount = ws.agents?.length || 0;
    if (badgeAgentCount > 0) {
      const badgeX = screenPos.x + roomWidthPx - 12;
      const badgeY = screenPos.y - 8;
      
      ctx.fillStyle = ws.color;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badgeAgentCount.toString(), badgeX, badgeY + 3);
    }
  }
}

function renderDecorations(
  ctx: CanvasRenderingContext2D, 
  camera: { x: number; y: number },
  sprites: AllSprites
) {
  // Add some ambient lighting effects
  const now = performance.now();
  
  // Subtle pulsing ambient light in corners (simulating overhead lights)
  const lightPositions = [
    { x: 10, y: 10 },
    { x: 38, y: 10 },
    { x: 10, y: 24 },
    { x: 38, y: 24 },
  ];

  for (const light of lightPositions) {
    const screenPos = worldToScreen(light.x * TILE_SIZE, light.y * TILE_SIZE, camera);
    
    const pulse = Math.sin(now / 2000) * 0.1 + 0.9;
    const gradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, TILE_SIZE * 4
    );
    gradient.addColorStop(0, `rgba(255, 250, 230, ${0.15 * pulse})`);
    gradient.addColorStop(1, 'rgba(255, 250, 230, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(
      screenPos.x - TILE_SIZE * 4,
      screenPos.y - TILE_SIZE * 4,
      TILE_SIZE * 8,
      TILE_SIZE * 8
    );
  }
}

function getStatusActionText(status: AgentStatus): string {
  const actions: Record<AgentStatus, string> = {
    IDLE: 'Idle',
    SPAWNING: 'Spawning...',
    TYPING: 'Typing...',
    READING: 'Reading...',
    RUNNING: 'Working...',
    WAITING: 'Waiting...',
    PERMISSION: 'Needs Permission',
    ERROR: 'Error',
  };
  return actions[status] || 'Unknown';
}

function isAgentWorking(status?: AgentStatus): boolean {
  return status === 'TYPING' || status === 'READING' || status === 'RUNNING' || status === 'SPAWNING';
}

export function renderCharacter(
  engine: GameEngine,
  character: Character & { status?: AgentStatus },
  sprites: AllSprites,
  prevPosition?: { x: number; y: number }
) {
  const { ctx, camera } = engine;
  const screenPos = worldToScreen(character.x, character.y, camera);
  const now = performance.now();
  
  // Get animation state
  const animState = getAnimationState(character.id);
  const direction = (character.direction || 'down') as Direction;
  
  // Detect movement
  const isMoving = prevPosition ? 
    (Math.abs(character.x - prevPosition.x) > 0.1 || Math.abs(character.y - prevPosition.y) > 0.1) :
    false;
  
  animState.isMoving = isMoving;
  animState.lastDirection = direction;

  // Calculate sprite offset (larger sprites need centering)
  const offsetX = (CHAR_SIZE - TILE_SIZE) / 2;
  const offsetY = CHAR_SIZE - TILE_SIZE;
  const drawX = screenPos.x - offsetX;
  const drawY = screenPos.y - offsetY;

  if (character.isAgent) {
    // Render robot agent
    const robotSprites = sprites.robot as RobotSpriteSheet;
    const isWorking = isAgentWorking(character.status);
    
    if (isWorking && robotSprites.working) {
      // Animate working robot
      const frameDuration = robotSprites.working.frameDuration;
      if (now - animState.lastFrameTime > frameDuration) {
        animState.currentFrame = (animState.currentFrame + 1) % robotSprites.working.frameCount;
        animState.lastFrameTime = now;
      }
      ctx.drawImage(robotSprites.working.frames[animState.currentFrame], drawX, drawY, CHAR_SIZE, CHAR_SIZE);
    } else {
      ctx.drawImage(robotSprites.idle, drawX, drawY, CHAR_SIZE, CHAR_SIZE);
    }
  } else {
    // Render player character
    const playerSprites = sprites.player as CharacterSpriteSheet;
    
    if (isMoving && playerSprites.walk[direction]) {
      // Animate walking player
      const walkAnim = playerSprites.walk[direction];
      if (now - animState.lastFrameTime > walkAnim.frameDuration) {
        animState.currentFrame = (animState.currentFrame + 1) % walkAnim.frameCount;
        animState.lastFrameTime = now;
      }
      ctx.drawImage(walkAnim.frames[animState.currentFrame], drawX, drawY, CHAR_SIZE, CHAR_SIZE);
    } else {
      // Idle
      animState.currentFrame = 0;
      ctx.drawImage(playerSprites.idle[direction], drawX, drawY, CHAR_SIZE, CHAR_SIZE);
    }
  }

  // Draw workspace color indicator for agents (accent line at bottom)
  if (character.isAgent && character.color) {
    const badgeY = screenPos.y + TILE_SIZE - 2;
    const badgeWidth = TILE_SIZE;
    const badgeHeight = 4;
    
    // Glow effect
    ctx.shadowColor = character.color;
    ctx.shadowBlur = 6;
    
    ctx.fillStyle = character.color;
    ctx.fillRect(screenPos.x, badgeY, badgeWidth, badgeHeight);
    
    ctx.shadowBlur = 0;
    
    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenPos.x, badgeY, badgeWidth, badgeHeight);
  }

  // For agents: Draw info panel with name, workspace, task, and status
  if (character.isAgent) {
    renderAgentInfoPanel(ctx, character, screenPos, drawY, character.needsAction || false, now);
  } else {
    // For player: just draw the username
    const name = character.username || character.name || '';
    if (name) {
      ctx.font = 'bold 12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      const nameY = drawY - 8;

      // Text shadow/outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, screenPos.x + TILE_SIZE / 2, nameY);
      
      // Text fill
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, screenPos.x + TILE_SIZE / 2, nameY);
    }
  }
}

/**
 * Render agent info panel showing name, workspace, task, and status
 * When needsAction is true, the panel shows a pulsing attention border with
 * an integrated alert badge instead of a separate bouncing indicator
 */
function renderAgentInfoPanel(
  ctx: CanvasRenderingContext2D,
  character: Character & { status?: AgentStatus },
  screenPos: { x: number; y: number },
  drawY: number,
  needsAction: boolean,
  now: number = performance.now()
) {
  const name = character.name || 'Agent';
  const modelInfo = character.model ? getModelInfo(character.model) : { provider: '', model: '' };
  const model = modelInfo.model;
  const provider = modelInfo.provider;
  const workspace = character.workspace ? getShortWorkspaceName(character.workspace) : '';
  const task = character.currentTask ? truncateText(character.currentTask, 20) : '';
  const status = character.status ? getStatusActionText(character.status) : '';
  const agentColor = character.color || '#4a9eff';

  // Calculate panel dimensions
  ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
  const nameWidth = ctx.measureText(name).width;
  
  ctx.font = '10px "Inter", system-ui, sans-serif';
  const providerWidth = provider ? ctx.measureText(provider).width + 8 : 0;
  const modelWidth = model ? ctx.measureText(model).width + (provider ? 0 : 14) : 0;
  const workspaceWidth = workspace ? ctx.measureText(workspace).width + 14 : 0;
  const taskWidth = task ? ctx.measureText(task).width + 14 : 0;
  const statusWidth = ctx.measureText(status).width + 12;
  const actionLabelWidth = needsAction ? ctx.measureText('Action Required').width + 20 : 0;

  const maxTextWidth = Math.max(nameWidth, providerWidth + modelWidth, workspaceWidth, taskWidth, statusWidth, actionLabelWidth);
  const panelWidth = Math.max(110, maxTextWidth + 28);
  
  // Calculate panel height based on content
  let panelHeight = 20; // Top padding + Name
  if (model) panelHeight += provider ? 22 : 14; // Model line (22 if provider shown, 14 otherwise)
  if (workspace) panelHeight += 14;
  if (task) panelHeight += 14;
  panelHeight += 16; // Status line
  if (needsAction) panelHeight += 18; // Action required badge
  panelHeight += 6; // Bottom padding

  const panelX = screenPos.x + TILE_SIZE / 2 - panelWidth / 2;
  // Always position directly above the character (no big offset for needsAction)
  const panelY = drawY - panelHeight - 10;

  // --- Pulsing glow effect when needs action ---
  if (needsAction) {
    const pulse = Math.sin(now / 300) * 0.3 + 0.7; // 0.4 to 1.0
    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.beginPath();
    ctx.roundRect(panelX - 2, panelY - 2, panelWidth + 4, panelHeight + 4, 10);
    ctx.fill();
    ctx.restore();
  }

  // Draw panel background with rounded corners
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
  ctx.fill();

  // Panel border - pulsing red when needs action, agent color otherwise
  if (needsAction) {
    const pulse = Math.sin(now / 300) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = agentColor + '80'; // 50% opacity
    ctx.lineWidth = 1.5;
  }
  ctx.stroke();

  // Draw pointer triangle
  const triangleCenterX = screenPos.x + TILE_SIZE / 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.moveTo(triangleCenterX - 5, panelY + panelHeight);
  ctx.lineTo(triangleCenterX, panelY + panelHeight + 5);
  ctx.lineTo(triangleCenterX + 5, panelY + panelHeight);
  ctx.closePath();
  ctx.fill();
  // Draw triangle border matching panel border
  if (needsAction) {
    const pulse = Math.sin(now / 300) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
  } else {
    ctx.strokeStyle = agentColor + '80';
  }
  ctx.lineWidth = needsAction ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(triangleCenterX - 5, panelY + panelHeight);
  ctx.lineTo(triangleCenterX, panelY + panelHeight + 5);
  ctx.lineTo(triangleCenterX + 5, panelY + panelHeight);
  ctx.stroke();

  // --- Draw content ---
  let textY = panelY + 14;
  const centerX = screenPos.x + TILE_SIZE / 2;

  // Agent name (bold, colored)
  ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = agentColor;
  ctx.fillText(name, centerX, textY);
  textY += 14;

  // Model (if exists) — badge with provider + model
  if (model) {
    const providerColors: Record<string, string> = {
      'Anthropic': '#f59e0b',
      'OpenAI': '#10b981',
      'Google': '#3b82f6',
      'Mistral': '#f43f5e',
      'OpenRouter': '#8b5cf6',
      'GitHub': '#9ca3af',
      'OpenCode': '#f97316',
      'xAI': '#ec4899',
      'DeepSeek': '#06b6d4',
      'Ollama': '#84cc16',
    };
    const color = providerColors[provider] || '#a78bfa';
    
    // Display: "Provider" on top, "Model" below
    const line1 = provider || '';
    const line2 = model;
    ctx.font = 'bold 8px "Inter", system-ui, sans-serif';
    const line1Width = ctx.measureText(line1).width;
    const line2Width = ctx.measureText(line2).width;
    const badgeWidth = Math.max(line1Width, line2Width) + 16;
    const badgeX = centerX - badgeWidth / 2;
    const badgeY = textY - 8;
    const badgeHeight = provider ? 22 : 14;
    
    // Badge background
    ctx.fillStyle = 'rgba(30, 30, 46, 0.9)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
    ctx.fill();
    
    // Left colored border
    ctx.fillStyle = color;
    ctx.fillRect(badgeX, badgeY, 3, badgeHeight);
    
    // Line 1: Provider (if exists)
    ctx.textAlign = 'center';
    if (provider) {
      ctx.fillStyle = color;
      ctx.fillText(line1, centerX, textY);
      textY += 10;
    }
    
    // Line 2: Model
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(line2, centerX, textY);
    textY += 14;
  }

  // Workspace (if exists) — subtle, no emoji for cleaner look
  if (workspace) {
    ctx.font = '9px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(workspace, centerX, textY);
    textY += 14;
  }

  // Current task (if exists)
  if (task) {
    ctx.font = '9px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(task, centerX, textY);
    textY += 14;
  }

  // Status line with colored dot
  ctx.font = '9px "Inter", system-ui, sans-serif';
  const statusColor = getStatusColor(character.status);
  
  // Status dot
  ctx.fillStyle = statusColor;
  const dotRadius = 3;
  const statusTextWidth = ctx.measureText(status).width;
  const statusTotalWidth = dotRadius * 2 + 4 + statusTextWidth;
  const statusStartX = centerX - statusTotalWidth / 2;
  
  ctx.beginPath();
  ctx.arc(statusStartX + dotRadius, textY - 3, dotRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Status text
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText(status, statusStartX + dotRadius * 2 + 4, textY);
  ctx.textAlign = 'center';
  textY += 16;

  // --- Action Required badge (integrated, no separate bouncing indicator) ---
  if (needsAction) {
    const badgeWidth = 90;
    const badgeHeight = 14;
    const badgeX = centerX - badgeWidth / 2;
    const badgeY = textY - 10;
    
    // Pulsing badge background
    const pulse = Math.sin(now / 400) * 0.15 + 0.85;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.2 * pulse})`;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
    ctx.fill();
    
    // Badge border
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 * pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Badge text
    ctx.font = 'bold 8px "Inter", system-ui, sans-serif';
    ctx.fillStyle = `rgba(248, 113, 113, ${pulse})`;
    ctx.textAlign = 'center';
    ctx.fillText('! ACTION NEEDED', centerX, badgeY + 10);
  }
}

/**
 * Get short workspace name (last folder name)
 */
function getShortWorkspaceName(workspace: string): string {
  const parts = workspace.split(/[\\/]/);
  return parts[parts.length - 1] || workspace;
}

/**
 * Get provider and model info from full model ID
 */
function getModelInfo(modelId: string): { provider: string; model: string } {
  const parts = modelId.split('/');
  const provider = parts[0] || '';
  const modelIdOnly = parts.slice(1).join('/') || modelId;
  
  // Map provider IDs to display names
  const providerNames: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'mistralai': 'Mistral',
    'cohere': 'Cohere',
    'xai': 'xAI',
    'deepseek': 'DeepSeek',
    'openrouter': 'OpenRouter',
    'github': 'GitHub',
    'opencode': 'OpenCode',
    'ollama': 'Ollama',
    'azure': 'Azure',
    'aws': 'AWS',
    'vertex': 'Vertex',
  };
  
  const providerDisplay = providerNames[provider] || provider;
  
  // Map common model IDs to short names
  const modelShortNames: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Sonnet 4',
    'claude-4-sonnet-20250514': 'Sonnet 4',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-4-haiku-20250514': 'Haiku 4',
    'claude-3-5-sonnet-20240620': 'Sonnet 3.5',
    'claude-3-opus-20240229': 'Opus 3',
    'claude-3-sonnet-20240229': 'Sonnet 3',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o mini',
    'gpt-4o-mini-20240718': 'GPT-4o mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5',
    'gpt-3.5-turbo-0125': 'GPT-3.5',
    'o1': 'O1',
    'o1-mini': 'O1 Mini',
    'o1-preview': 'O1 Preview',
    'o3-mini': 'O3 Mini',
    'o4-mini': 'O4 Mini',
    'gemini-1.5-pro': 'Gemini Pro',
    'gemini-1.5-flash': 'Gemini Flash',
    'gemini-2.0-flash': 'Gemini 2.0',
    'llama-3.1-405b': 'Llama 3.1 405B',
    'llama-3.1-70b': 'Llama 3.1 70B',
    'llama-3.1-8b': 'Llama 3.1 8B',
    'llama-3-70b': 'Llama 3 70B',
    'llama-3-8b': 'Llama 3 8B',
    'mixtral-8x7b': 'Mixtral 8x7B',
    'mixtral-8x22b': 'Mixtral 8x22B',
  };
  
  const modelDisplay = modelShortNames[modelIdOnly] || modelIdOnly.charAt(0).toUpperCase() + modelIdOnly.slice(1);
  
  return { provider: providerDisplay, model: modelDisplay };
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get status color
 */
function getStatusColor(status?: AgentStatus): string {
  const colors: Record<AgentStatus, string> = {
    IDLE: '#94a3b8',
    SPAWNING: '#fbbf24',
    TYPING: '#60a5fa',
    READING: '#34d399',
    RUNNING: '#a78bfa',
    WAITING: '#fb923c',
    PERMISSION: '#f87171',
    ERROR: '#ef4444',
  };
  return status ? colors[status] : '#94a3b8';
}

// Track previous positions for movement detection
const previousPositions: Map<string, { x: number; y: number }> = new Map();

export function renderCharacters(
  engine: GameEngine,
  characters: Character[],
  sprites: AllSprites
) {
  // Sort characters by Y position for proper layering
  const sortedCharacters = [...characters].sort((a, b) => a.y - b.y);

  sortedCharacters.forEach((character) => {
    const prevPos = previousPositions.get(character.id);
    renderCharacter(engine, character, sprites, prevPos);
    previousPositions.set(character.id, { x: character.x, y: character.y });
  });
}

export function renderDebugInfo(
  engine: GameEngine,
  playerPos: { x: number; y: number },
  fps: number
) {
  const { ctx } = engine;

  // Background panel for debug info
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(8, 8, 160, 50);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, 160, 50);

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';

  const debugText = [
    `Position: (${Math.round(playerPos.x)}, ${Math.round(playerPos.y)})`,
    `FPS: ${Math.round(fps)}`,
    `Tile: (${Math.floor(playerPos.x / TILE_SIZE)}, ${Math.floor(playerPos.y / TILE_SIZE)})`,
  ];

  debugText.forEach((text, i) => {
    const y = 24 + i * 14;
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText(text, 16, y);
  });
}
