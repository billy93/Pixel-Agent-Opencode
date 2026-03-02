
import { prisma } from '@/lib/db/prisma';
import { createSession, sendPrompt } from '@/lib/opencode/client';
import { addRecentWorkspace } from '@/lib/workspace/recent';

// Layout constants (must match renderer.ts)
const ROOM_PADDING = 3;
const AGENT_SPACING = 6;
const BASE_ROOM_HEIGHT = 10;
const ROOM_MARGIN = 2;
const TILE_SIZE = 32;

// Calculate the actual room position, respecting custom workspace positions
function getWorkspaceRoomPosition(workspace: { positionX: number | null; positionY: number | null; roomIndex: number | null }): { x: number; y: number } {
  if (workspace.positionX != null && workspace.positionY != null) {
    return { x: workspace.positionX, y: workspace.positionY };
  }
  // Default position calculation (matches renderer.ts getDefaultRoomPosition)
  const roomIndex = workspace.roomIndex ?? 0;
  const startX = 3;
  const startY = 6;
  let currentY = startY;
  for (let i = 0; i < roomIndex; i++) {
    currentY += BASE_ROOM_HEIGHT + ROOM_MARGIN;
  }
  return { x: startX, y: currentY };
}

// Calculate agent position for a specific slot using the workspace's actual position
function calcAgentPosition(roomPos: { x: number; y: number }, slotIndex: number): { x: number; y: number } {
  const agentY = (roomPos.y + BASE_ROOM_HEIGHT - 3) * TILE_SIZE;
  const startX = (roomPos.x + ROOM_PADDING) * TILE_SIZE + (AGENT_SPACING * TILE_SIZE) / 2 - TILE_SIZE / 2;
  return {
    x: startX + slotIndex * AGENT_SPACING * TILE_SIZE,
    y: agentY,
  };
}

// Get the next available slot in a workspace room
async function getNextAvailableSlotInWorkspace(
  workspaceId: string,
  workspace: { positionX: number | null; positionY: number | null; roomIndex: number | null }
): Promise<{ deskIndex: number; x: number; y: number }> {
  // Get all agents in this workspace
  const existingAgents = await prisma.agent.findMany({
    where: { workspaceId },
    select: { deskIndex: true },
  });

  const occupiedSlots = new Set(existingAgents.map(a => a.deskIndex).filter(d => d !== null));

  // Find first available slot (no limit)
  let slotIndex = 0;
  while (occupiedSlots.has(slotIndex)) {
    slotIndex++;
  }
  
  // Get position using workspace's actual current position
  const roomPos = getWorkspaceRoomPosition(workspace);
  const pos = calcAgentPosition(roomPos, slotIndex);
  return {
    deskIndex: slotIndex,
    x: pos.x,
    y: pos.y,
  };
}

interface CreateAgentParams {
  name: string;
  userId: string;
  workspaceId: string;
  model?: string;
  task?: string;
}

export async function createAgent({ name, userId, workspaceId, model, task }: CreateAgentParams) {
  // Get workspace and validate ownership
  const workspaceRecord = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { agents: true },
  });

  if (!workspaceRecord) {
    throw new Error('Workspace not found');
  }

  // Note: Ownership check should be done by the caller if needed, 
  // but here we just ensure the workspace exists. 
  // If we want strict ownership check here, we can add it, 
  // but usually service functions might be used by admin or internal processes too.
  // For now, let's assume the caller checks permissions.

  // Get agent position in workspace room (uses workspace's actual current position)
  const slotAssignment = await getNextAvailableSlotInWorkspace(
    workspaceId, 
    workspaceRecord
  );
  const agentX = slotAssignment.x;
  const agentY = slotAssignment.y;
  const deskIndex = slotAssignment.deskIndex;

  // Default model if not provided
  const agentModel = model || 'anthropic/claude-sonnet-4-20250514';

  // Create agent in database first (status: SPAWNING)
  const agent = await prisma.agent.create({
    data: {
      name,
      userId,
      workspaceId: workspaceRecord.id,
      status: 'SPAWNING',
      model: agentModel,
      currentTask: task || null,
      x: agentX,
      y: agentY,
      deskIndex,
    },
  });

  try {
    // Create OpenCode session with workspace directory
    const session = await createSession({
      title: `Agent: ${name}`,
      directory: workspaceRecord.path,
    });

    // Create AgentSession record
    await prisma.agentSession.create({
      data: {
        externalId: session.sessionID,
        agentId: agent.id,
        status: task ? 'RUNNING' : 'IDLE',
        currentTask: task || null,
      },
    });

    // Update agent with session ID (primary session)
    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        sessionId: session.sessionID,
        status: task ? 'RUNNING' : 'IDLE',
      },
      include: {
        workspace: true,
      },
    });

    // Add workspace to recent workspaces
    await addRecentWorkspace(userId, workspaceRecord.path);

    if (task) {
      console.log(`Agent ${name} created with task:`, task);
      
      // Send the initial task prompt to the agent
      // We don't await this to keep the UI responsive, or we can if we want to ensure it's sent
      // For now, let's await it to be safe, but catch errors so we don't fail the whole creation
      try {
        await sendPrompt(session.sessionID, task, workspaceRecord.path);
      } catch (promptError) {
        console.error('Failed to send initial prompt to agent:', promptError);
        // We don't throw here, as the agent is created and running, just the prompt failed
        // User can retry sending the prompt manually or we can have a retry mechanism
      }
    }

    return updatedAgent;
  } catch (opencodeError) {
    // If OpenCode session creation fails, delete the agent from DB
    await prisma.agent.delete({ where: { id: agent.id } });
    
    console.error('OpenCode session creation failed:', opencodeError);
    throw new Error('Failed to create OpenCode session. Is OpenCode server running?');
  }
}
