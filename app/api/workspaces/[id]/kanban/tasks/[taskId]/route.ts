
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/middleware';
import { createAgent } from '@/lib/agents/agent-service';
import { createSession, sendPrompt } from '@/lib/opencode/client';

export async function PATCH(
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
    const body = await request.json();
    const { columnId, order, content, description, agentId, agentMode, targetAgentId, agentModel, agentRole } = body;

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

    // Prepare update data
    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = order;
    
    // Agent configuration updates
    if (agentId !== undefined) updateData.agentId = agentId;
    if (agentMode !== undefined) updateData.agentMode = agentMode;
    if (targetAgentId !== undefined) updateData.targetAgentId = targetAgentId;
    if (agentModel !== undefined) updateData.agentModel = agentModel;
    if (agentRole !== undefined) updateData.agentRole = agentRole;
    
    let targetColumn = null;
    if (columnId && columnId !== task.columnId) {
      updateData.columnId = columnId;
      targetColumn = await prisma.kanbanColumn.findUnique({
        where: { id: columnId },
      });
      
      if (!targetColumn) {
        return NextResponse.json({ error: 'Target column not found' }, { status: 404 });
      }
    }

    // Update the task
    const updatedTask = await prisma.kanbanTask.update({
      where: { id: taskId },
      data: updateData,
    });

    // Check if moved to "IN_PROGRESS" and trigger agent creation/activation
    if (targetColumn && targetColumn.type === 'IN_PROGRESS') {
      try {
        // CASE 1: Create NEW agent if needed
        if (updatedTask.agentMode === 'NEW' && !updatedTask.agentId) {
          const agentName = updatedTask.content.substring(0, 30); // Truncate name
          const agentTask = updatedTask.agentRole 
            ? `[${updatedTask.agentRole}] ${updatedTask.description || updatedTask.content}`
            : (updatedTask.description || updatedTask.content);

          const agent = await createAgent({
            name: agentName,
            userId: user.userId,
            workspaceId: task.column.workspaceId,
            model: updatedTask.agentModel || undefined,
            task: agentTask,
          });

          // Create dedicated session for this task
          let sessionIdToUse = null;
          try {
            const newSession = await createSession({
              title: `Agent: ${agentName} - ${updatedTask.content.substring(0, 20)}...`,
              directory: task.column.workspace.path
            });
            sessionIdToUse = newSession.sessionID;

            // Create AgentSession record
            await prisma.agentSession.create({
              data: {
                externalId: newSession.sessionID,
                agentId: agent.id,
                status: 'RUNNING',
                currentTask: agentTask
              }
            });

            // Update Agent with session
            await prisma.agent.update({
              where: { id: agent.id },
              data: { 
                sessionId: sessionIdToUse,
                status: 'RUNNING'
              }
            });

            // Send initial prompt to agent
            if (sessionIdToUse) {
              await sendPrompt(sessionIdToUse, agentTask, task.column.workspace.path);
            }
          } catch (e) {
            console.error("Failed to create session/prompt for new agent", e);
          }

          // Update task with agentId and sessionId
          await prisma.kanbanTask.update({
            where: { id: taskId },
            data: { 
              agentId: agent.id,
              sessionId: sessionIdToUse
            },
          });
        } 
        // CASE 2: Activate EXISTING agent (or previously created dedicated agent)
        // Check if we have an agent assigned (either explicitly via targetAgentId or already assigned agentId)
        else if (updatedTask.targetAgentId || updatedTask.agentId) {
          const agentIdToUse = updatedTask.targetAgentId || updatedTask.agentId;
          
          if (agentIdToUse) {
            // Verify agent exists and belongs to workspace
            const agent = await prisma.agent.findUnique({
              where: { id: agentIdToUse },
            });
            
            if (agent && agent.workspaceId === workspaceId) {
              // Determine session to use:
              // 1. Task already has a session? Use it.
              // 2. Task doesn't have a session? Create one.
              let sessionIdToUse = updatedTask.sessionId;

              if (!sessionIdToUse) {
                 try {
                   console.log(`[MultiTask] Spawning new session for task ${taskId}`);
                   // Create new OpenCode session
                   const newSession = await createSession({
                      title: `Agent: ${agent.name} - ${updatedTask.content.substring(0, 20)}...`,
                      directory: task.column.workspace.path
                   });
                   
                   sessionIdToUse = newSession.sessionID;
                   
                   // Save to AgentSession
                   await prisma.agentSession.create({
                      data: {
                        externalId: newSession.sessionID,
                        agentId: agent.id,
                        status: 'RUNNING',
                        currentTask: updatedTask.description || updatedTask.content
                      }
                   });
                 } catch (err) {
                    console.error("Failed to create new session for multi-tasking", err);
                    // Fallback to agent's current session if creation fails
                    sessionIdToUse = agent.sessionId;
                 }
              } else {
                // Ensure AgentSession record exists/is updated
                try {
                  const existingSession = await prisma.agentSession.findUnique({
                    where: { externalId: sessionIdToUse }
                  });
                  
                  if (!existingSession) {
                     await prisma.agentSession.create({
                        data: {
                          externalId: sessionIdToUse,
                          agentId: agent.id,
                          status: 'RUNNING',
                          currentTask: updatedTask.description || updatedTask.content
                        }
                     });
                  } else {
                     await prisma.agentSession.update({
                        where: { externalId: sessionIdToUse },
                        data: { status: 'RUNNING', currentTask: updatedTask.description || updatedTask.content }
                     });
                  }
                } catch (e) {
                  console.error("Failed to update AgentSession", e);
                }
              }

              // Update task with confirmed agentId and sessionId
              await prisma.kanbanTask.update({
                where: { id: taskId },
                data: { 
                  agentId: agent.id,
                  sessionId: sessionIdToUse
                },
              });
              
              // Update agent's task and status (and switch focus to this session)
              await prisma.agent.update({
                where: { id: agent.id },
                data: { 
                  sessionId: sessionIdToUse, 
                  currentTask: updatedTask.description || updatedTask.content,
                  status: 'RUNNING' 
                },
              });
              
              // Send prompt to agent (if session is valid)
              try {
                 if (sessionIdToUse) {
                   await sendPrompt(sessionIdToUse, updatedTask.description || updatedTask.content, task.column.workspace.path);
                 }
              } catch (e) {
                 console.error("Failed to send prompt to agent", e);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error creating/assigning agent for task:", e);
        // Don't fail the task update if agent creation fails
      }
    }
    // Check if moved OUT of "IN_PROGRESS" (to TODO or DONE)
    else if (targetColumn && (targetColumn.type === 'TODO' || targetColumn.type === 'DONE') && task.agentId) {
      try {
        if (updatedTask.agentMode === 'NEW') {
          // Delete the agent if it was created for this task
          await prisma.agent.delete({
            where: { id: task.agentId }
          });
          
          // Clear agentId from task since agent is deleted
          await prisma.kanbanTask.update({
            where: { id: taskId },
            data: { agentId: null }
          });
        } else {
          // Just clear the task from the agent (set to IDLE)
          await prisma.agent.update({
            where: { id: task.agentId },
            data: { currentTask: null, status: 'IDLE' }
          });
          // For EXISTING mode, we keep the agentId on the task so it stays assigned
        }
      } catch (e) {
        console.error("Error removing agent from task:", e);
      }
    }

    // Fetch agent details if assigned
    // Refetch the task to get the latest state including agentId changes
    const finalTask = await prisma.kanbanTask.findUnique({
      where: { id: taskId }
    });

    let agentDetails = null;
    if (finalTask?.agentId) {
      agentDetails = await prisma.agent.findUnique({
        where: { id: finalTask.agentId }
      });
    }

    return NextResponse.json({ 
      task: {
        ...finalTask,
        agent: agentDetails
      }
    });
  } catch (error) {
    console.error('Failed to update kanban task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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

    // If task has an agent assigned, clean up
    if (task.agentId) {
      if (task.agentMode === 'NEW') {
        try {
          const agent = await prisma.agent.findUnique({ where: { id: task.agentId } });
          if (agent) {
             await prisma.agent.delete({ where: { id: task.agentId } });
          }
        } catch (e) {
          console.error("Error deleting agent for task:", e);
        }
      } else {
        try {
          await prisma.agent.update({
            where: { id: task.agentId },
            data: { currentTask: null, status: 'IDLE' }
          });
        } catch (e) {
          console.error("Error updating agent for task:", e);
        }
      }
    }

    // Explicitly delete the session associated with this task if it exists
    if (task.sessionId) {
      try {
        await prisma.agentSession.delete({
          where: { externalId: task.sessionId }
        });
        console.log(`Deleted session ${task.sessionId} for task ${taskId}`);
      } catch (e) {
        // Session might have been deleted by cascade (if agent was deleted) or doesn't exist
        console.log("Session already deleted or not found:", e);
      }
    }

    // Delete the task
    await prisma.kanbanTask.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete kanban task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
