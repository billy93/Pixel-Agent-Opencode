import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { deleteSession } from '@/lib/opencode/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;

    // Find agent and verify ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete OpenCode session if it exists
    if (agent.sessionId) {
      try {
        await deleteSession(agent.sessionId, process.cwd());
      } catch (error) {
        console.error('Failed to delete OpenCode session:', error);
        // Continue with database deletion even if OpenCode deletion fails
      }
    }

    // Delete agent from database
    await prisma.agent.delete({
      where: { id: agentId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Delete agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;

    // Find agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ agent });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update agent (rename, update task, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;
    const body = await request.json();

    // Find agent and verify ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.userId !== authUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Build update data based on provided fields
    const updateData: {
      name?: string;
      currentTask?: string | null;
      status?: string;
      model?: string;
    } = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Agent name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.currentTask !== undefined) {
      updateData.currentTask = body.currentTask || null;
    }

    if (body.model !== undefined) {
      updateData.model = body.model;
    }

    if (body.status !== undefined) {
      const validStatuses = ['IDLE', 'SPAWNING', 'TYPING', 'READING', 'RUNNING', 'WAITING', 'PERMISSION', 'ERROR'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update agent
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    return NextResponse.json({ agent: updatedAgent });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Update agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
