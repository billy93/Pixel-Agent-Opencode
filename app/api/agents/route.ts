import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { createSession } from '@/lib/opencode/client';
import { addRecentWorkspace } from '@/lib/workspace/recent';
import { getAgentPositionInRoom } from '@/lib/game/renderer';

// No limit on agents per workspace - workspace room grows dynamically

// Get the next available slot in a workspace room
async function getNextAvailableSlotInWorkspace(workspaceId: string, roomIndex: number): Promise<{ deskIndex: number; x: number; y: number }> {
  // Get all agents in this workspace
  const existingAgents = await prisma.agent.findMany({
    where: { workspaceId },
    select: { deskIndex: true },
  });

  const occupiedSlots = new Set(existingAgents.map(a => a.deskIndex).filter(d => d !== null));
  const totalAgentsAfterAdd = existingAgents.length + 1;

  // Find first available slot (no limit)
  let slotIndex = 0;
  while (occupiedSlots.has(slotIndex)) {
    slotIndex++;
  }
  
  // Get position for this slot, considering total agents for proper spacing
  const pos = getAgentPositionInRoom(roomIndex, slotIndex, totalAgentsAfterAdd);
  return {
    deskIndex: slotIndex,
    x: pos.x,
    y: pos.y,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);
    const { name, task, workspaceId, model } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // workspaceId is REQUIRED - agents must be created inside a workspace
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace is required. Please create a workspace first, then add agents to it.' },
        { status: 400 }
      );
    }

    // Get workspace and validate ownership
    const workspaceRecord = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { agents: true },
    });

    if (!workspaceRecord) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspaceRecord.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // No agent limit per workspace - room grows dynamically

    // Get agent position in workspace room
    const slotAssignment = await getNextAvailableSlotInWorkspace(
      workspaceId, 
      workspaceRecord.roomIndex ?? 0
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
        userId: authUser.userId,
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

      // Update agent with session ID
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
      await addRecentWorkspace(authUser.userId, workspaceRecord.path);

      if (task) {
        console.log(`Agent ${name} created with task:`, task);
      }

      return NextResponse.json({ agent: updatedAgent }, { status: 201 });
    } catch (opencodeError) {
      // If OpenCode session creation fails, delete the agent from DB
      await prisma.agent.delete({ where: { id: agent.id } });
      
      console.error('OpenCode session creation failed:', opencodeError);
      return NextResponse.json(
        { error: 'Failed to create OpenCode session. Is OpenCode server running?' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.error('Create agent error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);

    // Get user's agents with workspace info
    const agents = await prisma.agent.findMany({
      where: { userId: authUser.userId },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ agents });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('List agents error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
