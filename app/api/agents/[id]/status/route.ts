import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getSessionStatus } from '@/lib/opencode/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;

    // Find agent and verify ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { workspace: true },
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

    if (!agent.sessionId) {
      return NextResponse.json(
        { error: 'Agent has no active session' },
        { status: 400 }
      );
    }

    try {
      // Get session status from OpenCode
      const sessionStatus = await getSessionStatus(
        agent.sessionId,
        agent.workspace?.path || undefined
      );

      return NextResponse.json({ 
        agent,
        sessionStatus 
      });
    } catch (error) {
      console.error('Get session status error:', error);
      return NextResponse.json(
        { error: 'Failed to get session status' },
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

    console.error('Get agent status error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent status' },
      { status: 500 }
    );
  }
}
