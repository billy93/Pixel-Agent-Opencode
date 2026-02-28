import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getSessionStatus, getOpencodeClient } from '@/lib/opencode/client';

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);

    // Get all active agents for this user
    const agents = await prisma.agent.findMany({
      where: { 
        userId: authUser.userId,
        sessionId: { not: null },
      },
      include: { workspace: true },
    });

    const client = getOpencodeClient();
    const updates = [];

    for (const agent of agents) {
      if (!agent.sessionId) continue;

      try {
        // Check if there are messages
        const messagesResponse = await client.session.messages({
          sessionID: agent.sessionId,
          directory: agent.workspace?.path || undefined,
        });

        // The response is { data: Array<{info: Message, parts: Part[]}> }
        const allMessages = (messagesResponse.data as any) || [];
        const messageCount = Array.isArray(allMessages) ? allMessages.length : 0;
        
        // Determine status based on messages
        let newStatus = agent.status;
        
        if (messageCount === 0) {
          // No messages yet, agent is idle
          newStatus = 'IDLE';
        } else {
          const lastMessage = allMessages[messageCount - 1];
          
          if (lastMessage && lastMessage.info) {
            // Check if last message is from assistant
            if (lastMessage.info.role === 'assistant') {
              // If finish is 'stop', task is complete, agent is idle
              if (lastMessage.info.finish === 'stop') {
                newStatus = 'IDLE';
              } else {
                // Still generating
                newStatus = 'RUNNING';
              }
            } else if (lastMessage.info.role === 'user') {
              // User just sent a message, agent should be working
              newStatus = 'RUNNING';
            }
          }
        }

        // Update agent status if changed
        if (newStatus !== agent.status) {
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status: newStatus },
          });
          updates.push({ agentId: agent.id, oldStatus: agent.status, newStatus });
          console.log(`[Sync] Updated agent ${agent.id}: ${agent.status} -> ${newStatus}`);
        }

      } catch (error) {
        console.error(`Failed to sync agent ${agent.id}:`, error);
        // If session doesn't exist anymore, mark as ERROR
        if ((error as any).response?.status === 404) {
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status: 'ERROR' },
          });
          updates.push({ agentId: agent.id, oldStatus: agent.status, newStatus: 'ERROR' });
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      synced: agents.length,
      updates,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Sync agents error:', error);
    return NextResponse.json(
      { error: 'Failed to sync agents' },
      { status: 500 }
    );
  }
}
