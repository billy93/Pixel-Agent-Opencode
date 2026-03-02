import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { validateWorkspace, getWorkspaceColor } from '@/lib/workspace/validator';
import { getRoomPosition, getAgentPositionInRoom } from '@/lib/game/renderer';

const TILE_SIZE = 32;
const MAX_WORKSPACES = 10; // Maximum workspaces (rooms stack vertically, so more allowed)
const ORPHAN_WORKSPACE_PATH = '__orphan_agents__'; // Special path for orphan agents
const ORPHAN_WORKSPACE_NAME = 'Unassigned Agents';

// Helper function to create or get orphan workspace and assign orphan agents to it
async function assignOrphanAgentsToWorkspace(userId: string): Promise<void> {
  // Find agents without workspace
  const orphanAgents = await prisma.agent.findMany({
    where: {
      userId,
      workspaceId: null,
    },
  });

  if (orphanAgents.length === 0) {
    return; // No orphan agents
  }

  // Get or create orphan workspace
  let orphanWorkspace = await prisma.workspace.findUnique({
    where: {
      userId_path: {
        userId,
        path: ORPHAN_WORKSPACE_PATH,
      },
    },
  });

  if (!orphanWorkspace) {
    // Find next available room index
    const existingRooms = await prisma.workspace.findMany({
      where: { userId },
      select: { roomIndex: true },
    });
    const occupiedRooms = new Set(existingRooms.map(w => w.roomIndex).filter(r => r !== null));
    
    let roomIndex: number | null = null;
    for (let i = 0; i < MAX_WORKSPACES; i++) {
      if (!occupiedRooms.has(i)) {
        roomIndex = i;
        break;
      }
    }

    // Create orphan workspace
    orphanWorkspace = await prisma.workspace.create({
      data: {
        path: ORPHAN_WORKSPACE_PATH,
        name: ORPHAN_WORKSPACE_NAME,
        color: '#6b7280', // Gray color for orphan workspace
        roomIndex,
        userId,
      },
    });
  }

  // Assign orphan agents to the workspace - no limit
  // Get existing agents in orphan workspace to find next available slot
  const existingAgentsInOrphan = await prisma.agent.findMany({
    where: { workspaceId: orphanWorkspace.id },
    select: { deskIndex: true },
  });
  const occupiedSlots = new Set(existingAgentsInOrphan.map(a => a.deskIndex).filter(d => d !== null));
  const totalAgentsAfterAssign = existingAgentsInOrphan.length + orphanAgents.length;

  let nextSlot = 0;
  for (const agent of orphanAgents) {
    // Find next available slot (no limit)
    while (occupiedSlots.has(nextSlot)) {
      nextSlot++;
    }

    const pos = getAgentPositionInRoom(orphanWorkspace.roomIndex ?? 0, nextSlot, totalAgentsAfterAssign);
    
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        workspaceId: orphanWorkspace.id,
        deskIndex: nextSlot,
        x: pos.x,
        y: pos.y,
      },
    });

    occupiedSlots.add(nextSlot);
    nextSlot++;
  }
}

// GET - List all workspaces (shared across all users for multiplayer)
export async function GET(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);

    // Auto-assign orphan agents for current user
    await assignOrphanAgentsToWorkspace(authUser.userId);

    // Return ALL workspaces from ALL users (shared office, multiplayer)
    const workspaces = await prisma.workspace.findMany({
      include: {
        agents: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Reassign roomIndex globally to avoid collisions between users
    // Each workspace gets a unique sequential room index
    // Workspaces with custom positions (positionX/positionY) keep their positions
    const workspacesWithGlobalIndex = workspaces.map((ws, index) => ({
      ...ws,
      roomIndex: index,
      // Preserve custom position if set, otherwise null (renderer will calculate default)
      positionX: ws.positionX,
      positionY: ws.positionY,
    }));

    return NextResponse.json({ workspaces: workspacesWithGlobalIndex });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('List workspaces error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);
    const { path, name } = await request.json();

    if (!path) {
      return NextResponse.json(
        { error: 'Workspace path is required' },
        { status: 400 }
      );
    }

    // Validate workspace path
    const validation = await validateWorkspace(path);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') || 'Invalid workspace' },
        { status: 400 }
      );
    }

    // Check if workspace already exists for this user
    const existingWorkspace = await prisma.workspace.findUnique({
      where: {
        userId_path: {
          userId: authUser.userId,
          path,
        },
      },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace already exists' },
        { status: 400 }
      );
    }

    // Check workspace limit
    const workspaceCount = await prisma.workspace.count({
      where: { userId: authUser.userId },
    });

    if (workspaceCount >= MAX_WORKSPACES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WORKSPACES} workspaces allowed` },
        { status: 400 }
      );
    }

    // Find next available room index
    const existingRooms = await prisma.workspace.findMany({
      where: { userId: authUser.userId },
      select: { roomIndex: true },
    });
    const occupiedRooms = new Set(existingRooms.map(w => w.roomIndex).filter(r => r !== null));
    
    let roomIndex: number | null = null;
    for (let i = 0; i < MAX_WORKSPACES; i++) {
      if (!occupiedRooms.has(i)) {
        roomIndex = i;
        break;
      }
    }

    // Generate workspace name from path if not provided
    const workspaceName = name || path.split(/[\\/]/).pop() || 'Workspace';
    
    // Generate workspace color
    const workspaceColor = getWorkspaceColor(path);

    const workspace = await prisma.workspace.create({
      data: {
        path,
        name: workspaceName,
        color: workspaceColor,
        roomIndex,
        userId: authUser.userId,
      },
      include: {
        agents: true,
      },
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
