import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { sendPrompt } from '@/lib/opencode/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;
    const { task } = await request.json();

    if (!task) {
      return NextResponse.json(
        { error: 'Task is required' },
        { status: 400 }
      );
    }

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

    // Update agent status to TYPING
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'TYPING' },
    });

    try {
      // Send prompt to OpenCode session with agent's workspace
      const workspacePath = agent.workspace?.path || process.cwd();
      console.log(`[Task API] Sending task to agent ${agentId} (session: ${agent.sessionId})`);
      console.log(`[Task API] Workspace: ${workspacePath}`);
      console.log(`[Task API] Task: ${task}`);
      
      const response = await sendPrompt(agent.sessionId, task, workspacePath);
      
      console.log(`[Task API] Response from OpenCode:`, response);

      // Check if the response indicates completion
      let newStatus = 'RUNNING';
      
      if (response && response.info) {
        // If finish is 'stop', task is complete
        if (response.info.finish === 'stop') {
          newStatus = 'IDLE';
          console.log(`[Task API] Task completed immediately`);
        } else {
          console.log(`[Task API] Task still running (finish: ${response.info.finish})`);
        }
      }

      // Update agent status based on response
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: newStatus },
      });
      
      return NextResponse.json({ 
        success: true,
        message: newStatus === 'IDLE' ? 'Task completed' : 'Task sent to agent',
        status: newStatus,
        response: response 
      });
    } catch (error) {
      // Reset status on error
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'ERROR' },
      });
      
      throw error;
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Send task error:', error);
    return NextResponse.json(
      { error: 'Failed to send task to agent' },
      { status: 500 }
    );
  }
}
