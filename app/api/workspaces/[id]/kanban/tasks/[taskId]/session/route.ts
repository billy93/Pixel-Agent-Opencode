import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/middleware';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, taskId } = await params;
    const workspaceId = id;

    // Verify task existence and ownership
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        column: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.column.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Task does not belong to this workspace' }, { status: 400 });
    }

    if (task.column.workspace.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!task.sessionId) {
      return NextResponse.json({ message: 'No session to delete' });
    }

    // Delete the session
    try {
      await prisma.agentSession.delete({
        where: { externalId: task.sessionId },
      });
      console.log(`Deleted session ${task.sessionId} for task ${taskId}`);
    } catch (e) {
      console.error("Failed to delete session from DB (might not exist):", e);
    }

    // Update task to remove sessionId
    const updatedTask = await prisma.kanbanTask.update({
      where: { id: taskId },
      data: { sessionId: null },
    });

    // If the agent is currently using this session, clear it from the agent too
    if (task.agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: task.agentId } });
      if (agent && agent.sessionId === task.sessionId) {
        // Find another session or set to null?
        // For now, set to null to indicate no active session
        await prisma.agent.update({
          where: { id: task.agentId },
          data: { sessionId: null, status: 'IDLE', currentTask: null }
        });
      }
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
