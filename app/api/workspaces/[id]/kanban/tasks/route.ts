
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/middleware';
import { createAgent } from '@/lib/agents/agent-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = id;
    const body = await request.json();
    const { content, columnId, description, agentMode, agentModel, agentRole, targetAgentId } = body;

    if (!content || !columnId) {
      return NextResponse.json({ error: 'Content and columnId are required' }, { status: 400 });
    }

    // Verify workspace access (and implicitly column ownership)
    const column = await prisma.kanbanColumn.findUnique({
      where: { id: columnId },
      include: {
        workspace: true,
      },
    });

    if (!column) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    if (column.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Column does not belong to this workspace' }, { status: 400 });
    }

    if (column.workspace.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get max order in the column
    const lastTask = await prisma.kanbanTask.findFirst({
      where: { columnId },
      orderBy: { order: 'desc' },
    });

    const newTask = await prisma.kanbanTask.create({
      data: {
        content,
        description,
        columnId,
        order: (lastTask?.order ?? -1) + 1,
        agentMode,
        agentModel,
        agentRole,
        targetAgentId,
        // If existing agent selected, link it immediately
        agentId: (agentMode === 'EXISTING' && targetAgentId) ? targetAgentId : undefined,
      },
    });

    // Check if created in "IN_PROGRESS" and trigger agent creation
    if (column.type === 'IN_PROGRESS') {
      try {
        if (newTask.agentMode === 'NEW') {
          const agentName = newTask.content.substring(0, 30); // Truncate name
          const agentTask = newTask.agentRole 
            ? `[${newTask.agentRole}] ${newTask.description || newTask.content}`
            : (newTask.description || newTask.content);

          const agent = await createAgent({
            name: agentName,
            userId: user.userId,
            workspaceId: column.workspaceId,
            model: newTask.agentModel || undefined,
            task: agentTask,
          });

          // Create dedicated session
          let sessionIdToUse = null;
          try {
             const { createSession } = await import('@/lib/opencode/client');
             const newSession = await createSession({
               title: `Agent: ${agentName} - ${newTask.content.substring(0, 20)}...`,
               directory: column.workspace.path
             });
             sessionIdToUse = newSession.sessionID;
             
             // Create AgentSession
             await prisma.agentSession.create({
               data: {
                 externalId: newSession.sessionID,
                 agentId: agent.id,
                 status: 'RUNNING',
                 currentTask: agentTask
               }
             });
             
             // Update Agent
             await prisma.agent.update({
               where: { id: agent.id },
               data: { 
                 sessionId: sessionIdToUse,
                 status: 'RUNNING'
               }
             });

             // Send initial prompt
             if (sessionIdToUse) {
               const { sendPrompt } = await import('@/lib/opencode/client');
               await sendPrompt(sessionIdToUse, agentTask, column.workspace.path);
             }
          } catch (e) {
             console.error("Failed to create session/prompt for new agent", e);
          }

          // Update task with agentId and sessionId
          const updatedTask = await prisma.kanbanTask.update({
            where: { id: newTask.id },
            data: { 
              agentId: agent.id,
              sessionId: sessionIdToUse
            },
            include: { agent: true } // Include agent for immediate frontend update
          });

          return NextResponse.json({ task: updatedTask });
        } else if (newTask.agentMode === 'EXISTING' && newTask.targetAgentId) {
          // Verify agent exists and belongs to workspace
          const agent = await prisma.agent.findUnique({
            where: { id: newTask.targetAgentId },
          });
          
          if (agent && agent.workspaceId === workspaceId) {
            // Always create a new session for a new task
            let sessionIdToUse = null;
            try {
               const { createSession, sendPrompt } = await import('@/lib/opencode/client');
               const newSession = await createSession({
                 title: `Agent: ${agent.name} - ${newTask.content.substring(0, 20)}...`,
                 directory: column.workspace.path
               });
               sessionIdToUse = newSession.sessionID;
               
               // Create AgentSession
               await prisma.agentSession.create({
                 data: {
                   externalId: newSession.sessionID,
                   agentId: agent.id,
                   status: 'RUNNING',
                   currentTask: newTask.description || newTask.content
                 }
               });
               
               // Send prompt to new session
               if (sessionIdToUse) {
                 await sendPrompt(sessionIdToUse, newTask.description || newTask.content, column.workspace.path);
               }
            } catch (e) {
               console.error("Failed to create/use session for existing agent", e);
               // Fallback to existing session if create fails (though not ideal for separation)
               sessionIdToUse = agent.sessionId;
            }

            // Update task with agentId and sessionId
            await prisma.kanbanTask.update({
              where: { id: newTask.id },
              data: { 
                agentId: agent.id,
                sessionId: sessionIdToUse
              },
            });
            
            // Update agent's task and switch focus
            await prisma.agent.update({
              where: { id: agent.id },
              data: { 
                currentTask: newTask.description || newTask.content,
                status: 'RUNNING',
                sessionId: sessionIdToUse
              },
            });
            
            // Return updated task with agent
            const updatedTask = await prisma.kanbanTask.findUnique({
                where: { id: newTask.id },
                include: { agent: true }
            });
            return NextResponse.json({ task: updatedTask });
          }
        }
      } catch (e) {
        console.error("Error creating/assigning agent for new task:", e);
        // Don't fail the task creation if agent creation fails, just return the task without agent
      }
    }

    return NextResponse.json({ task: newTask });
  } catch (error) {
    console.error('Failed to create kanban task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
