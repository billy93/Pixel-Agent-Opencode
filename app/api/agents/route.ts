import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { createAgent } from '@/lib/agents/agent-service';

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

    const updatedAgent = await createAgent({
      name,
      userId: authUser.userId,
      workspaceId,
      model,
      task,
    });

    return NextResponse.json({ agent: updatedAgent }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.error('Create agent error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);

    // Get ALL agents from ALL users (shared office, multiplayer)
    const agents = await prisma.agent.findMany({
      include: {
        workspace: true,
        user: {
          select: { id: true, username: true },
        },
        _count: {
          select: {
            kanbanTasks: {
              where: {
                column: {
                  type: 'IN_PROGRESS'
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const agentsWithCount = agents.map(agent => ({
      ...agent,
      activeTaskCount: agent._count.kanbanTasks,
      _count: undefined
    }));

    return NextResponse.json({ agents: agentsWithCount });
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
