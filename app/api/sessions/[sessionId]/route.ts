import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/middleware';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    // Verify session exists
    const session = await prisma.agentSession.findUnique({
      where: { externalId: sessionId },
      include: {
        agent: true
      }
    });

    if (!session) {
      // It's possible the session exists in OpenCode but not in our DB, or just doesn't exist.
      // If it's not in our DB, we can't verify ownership easily unless we trust the user.
      // For now, let's assume if it's not in DB, it's either already deleted or we can't touch it.
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership via agent
    if (session.agent.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete session from DB
    await prisma.agentSession.delete({
      where: { externalId: sessionId }
    });

    // Also update any tasks that might reference this session
    await prisma.kanbanTask.updateMany({
      where: { sessionId: sessionId },
      data: { sessionId: null }
    });
    
    // Also update agent if it references this session
    if (session.agent.sessionId === sessionId) {
         await prisma.agent.update({
            where: { id: session.agentId },
            data: { sessionId: null, status: 'IDLE', currentTask: null }
         });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
