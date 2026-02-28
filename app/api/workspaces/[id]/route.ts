import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getAgentPositionInRoom } from '@/lib/game/renderer';

// DELETE - Delete a workspace and all its agents
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id } = await params;

    // Find the workspace and verify ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { agents: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete all agents in the workspace first (cascade)
    await prisma.agent.deleteMany({
      where: { workspaceId: id },
    });

    // Delete the workspace
    await prisma.workspace.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get a single workspace with its agents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        agents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update workspace position (for drag-and-drop)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id } = await params;
    const { positionX, positionY } = await request.json();

    // Validate position values
    if (typeof positionX !== 'number' || typeof positionY !== 'number') {
      return NextResponse.json(
        { error: 'positionX and positionY must be numbers' },
        { status: 400 }
      );
    }

    // Find the workspace and verify ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { agents: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update workspace position
    const updatedWorkspace = await prisma.workspace.update({
      where: { id },
      data: {
        positionX: Math.round(positionX),
        positionY: Math.round(positionY),
      },
      include: {
        agents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Update agent positions relative to the new workspace position
    const totalAgents = updatedWorkspace.agents.length;
    for (let i = 0; i < totalAgents; i++) {
      const agent = updatedWorkspace.agents[i];
      const slotIndex = agent.deskIndex ?? i;
      // getAgentPositionInRoom uses getRoomPosition which now reads positionX/positionY
      // But we need to pass the workspace data, so we calculate manually here
      const ROOM_PADDING = 2;
      const AGENT_SPACING = 6;
      const BASE_ROOM_HEIGHT = 8;
      const TILE_SIZE = 32;

      const agentY = (Math.round(positionY) + BASE_ROOM_HEIGHT - 5) * TILE_SIZE;
      const startX = (Math.round(positionX) + ROOM_PADDING) * TILE_SIZE + (AGENT_SPACING * TILE_SIZE) / 2 - TILE_SIZE / 2;
      const agentX = startX + slotIndex * AGENT_SPACING * TILE_SIZE;

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          x: agentX,
          y: agentY,
        },
      });
    }

    return NextResponse.json({ workspace: updatedWorkspace });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Update workspace position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
