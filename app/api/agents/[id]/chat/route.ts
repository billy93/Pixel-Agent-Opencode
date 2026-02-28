import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getOpencodeClient } from '@/lib/opencode/client';
import { ChatMessage, QuestionRequest } from '@/types';

// GET - Get chat messages for an agent session
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
      include: {
        permissions: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        },
        workspace: true,
      },
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

    // If no session, return empty messages
    if (!agent.sessionId) {
      return NextResponse.json({
        messages: [],
        hasPermissionPending: false,
        hasQuestionPending: false,
        pendingQuestions: [],
        agentStatus: agent.status,
        agentModel: agent.model,
      });
    }

    try {
      // Get session messages from OpenCode using the messages endpoint
      const client = getOpencodeClient();
      const workspacePath = agent.workspace?.path || process.cwd();
      const messagesResponse = await client.session.messages({
        sessionID: agent.sessionId,
        directory: workspacePath,
      });

      const messages: ChatMessage[] = [];
      const rawMessages = messagesResponse.data || [];
      
      // Structure: Array<{ info: Message, parts: Part[] }>
      for (const msgContainer of rawMessages) {
        const msgInfo = msgContainer.info;
        const parts = msgContainer.parts || [];
        
        // Check role from info object
        if (msgInfo.role === 'user') {
          // User messages - extract text from parts
          const textContent = parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n') || '';
          
          if (textContent) {
            messages.push({
              id: msgInfo.id || `user-${Date.now()}-${Math.random()}`,
              role: 'user',
              type: 'text',
              content: textContent,
              timestamp: msgInfo.time?.created || Date.now(),
            });
          }
        } else if (msgInfo.role === 'assistant') {
          // Track step number within this assistant message for labeling
          let stepNumber = 0;
          
          // Assistant messages - handle different part types
          for (const part of parts) {
            const partAny = part as any;
            
            if (partAny.type === 'reasoning' && partAny.text) {
              // Reasoning/thinking content from the model (extended thinking)
              messages.push({
                id: `${msgInfo.id}-reasoning-${partAny.id || Math.random()}`,
                role: 'assistant',
                type: 'thinking',
                content: partAny.text,
                timestamp: partAny.time?.start || msgInfo.time?.created || Date.now(),
              });
            } else if (partAny.type === 'text' && partAny.text) {
              messages.push({
                id: `${msgInfo.id}-text-${partAny.id || Math.random()}`,
                role: 'assistant',
                type: 'text',
                content: partAny.text,
                timestamp: partAny.time?.start || msgInfo.time?.created || Date.now(),
              });
            } else if (partAny.type === 'step-start') {
              stepNumber++;
              messages.push({
                id: `${msgInfo.id}-step-${partAny.id || Math.random()}`,
                role: 'assistant',
                type: 'step',
                content: `Processing step ${stepNumber}`,
                timestamp: msgInfo.time?.created || Date.now(),
                metadata: {
                  stepNumber,
                },
              });
            } else if (partAny.type === 'step-finish') {
              // Update the corresponding step-start message with token/cost info
              const tokens = partAny.tokens;
              const cost = partAny.cost || 0;
              if (tokens) {
                // Find the last step message and enrich it
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].type === 'step' && messages[i].id.startsWith(`${msgInfo.id}-step-`)) {
                    const stepNum = messages[i].metadata?.stepNumber || stepNumber;
                    const totalTokens = (tokens.input || 0) + (tokens.output || 0);
                    const reasoningTokens = tokens.reasoning || 0;
                    let stepLabel = `Step ${stepNum} completed`;
                    if (totalTokens > 0) {
                      stepLabel += ` · ${totalTokens.toLocaleString()} tokens`;
                    }
                    if (reasoningTokens > 0) {
                      stepLabel += ` (${reasoningTokens.toLocaleString()} reasoning)`;
                    }
                    if (cost > 0) {
                      stepLabel += ` · $${cost.toFixed(4)}`;
                    }
                    messages[i].content = stepLabel;
                    break;
                  }
                }
              }
            } else if (partAny.type === 'tool-invocation' || partAny.type === 'tool-result' || partAny.type === 'tool') {
              // Tool call - handle both old format (toolName/name) and new SDK format (tool)
              const toolName = partAny.toolName || partAny.name || partAny.tool || 'unknown';
              const toolInput = partAny.input || (typeof partAny.state === 'object' && partAny.state?.input);
              
              messages.push({
                id: `${msgInfo.id}-tool-${partAny.id || Math.random()}`,
                role: 'assistant',
                type: 'tool_call',
                content: `Using tool: ${toolName}`,
                timestamp: msgInfo.time?.created || Date.now(),
                metadata: {
                  toolName: toolName,
                  toolInput: toolInput,
                },
              });

              // Tool result if available - handle both formats
              const stateObj = typeof partAny.state === 'object' ? partAny.state : null;
              const isCompleted = partAny.state === 'completed' || stateObj?.status === 'completed' || stateObj?.type === 'completed';
              const output = partAny.output || stateObj?.output;
              
              if (isCompleted && output) {
                const outputStr = typeof output === 'string' 
                  ? output 
                  : JSON.stringify(output);
                messages.push({
                  id: `${msgInfo.id}-result-${partAny.id || Math.random()}`,
                  role: 'assistant',
                  type: 'tool_result',
                  content: outputStr.length > 500 ? outputStr.substring(0, 500) + '...' : outputStr,
                  timestamp: msgInfo.time?.created || Date.now(),
                  metadata: {
                    toolName: toolName,
                    toolOutput: outputStr,
                  },
                });
              }
            }
          }
        }
      }

      // Add pending permission requests as messages
      for (const permission of agent.permissions) {
        messages.push({
          id: `permission-${permission.id}`,
          role: 'system',
          type: 'permission_request',
          content: permission.description,
          timestamp: permission.createdAt.getTime(),
          metadata: {
            permissionType: permission.type,
            permissionStatus: 'pending',
          },
        });
      }

      // Fetch pending questions from OpenCode
      let pendingQuestions: QuestionRequest[] = [];
      let hasQuestionPending = false;
      
      try {
        const questionsResponse = await client.question.list({
          directory: workspacePath,
        });
        
        const allQuestions = (questionsResponse.data || []) as QuestionRequest[];
        pendingQuestions = allQuestions.filter(
          (q: QuestionRequest) => q.sessionID === agent.sessionId
        );
        hasQuestionPending = pendingQuestions.length > 0;
        
        // Add pending questions as messages
        for (const questionReq of pendingQuestions) {
          for (let i = 0; i < questionReq.questions.length; i++) {
            const q = questionReq.questions[i];
            messages.push({
              id: `question-${questionReq.id}-${i}`,
              role: 'system',
              type: 'question',
              content: q.question,
              timestamp: Date.now(), // Questions don't have timestamps
              metadata: {
                questionRequestId: questionReq.id,
                questionHeader: q.header,
                questionOptions: q.options,
                questionMultiple: q.multiple || false,
                questionCustom: q.custom !== false, // Default true
                questionAnswered: false,
              },
            });
          }
        }
      } catch (questionError) {
        console.error('Failed to fetch questions:', questionError);
        // Continue without questions if fetch fails
      }

      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      return NextResponse.json({
        messages,
        hasPermissionPending: agent.permissions.length > 0,
        hasQuestionPending,
        pendingQuestions,
        agentStatus: agent.status,
        agentModel: agent.model,
      });
    } catch (error) {
      console.error('Failed to get session messages:', error);
      // Return empty messages if OpenCode is not available
      return NextResponse.json({
        messages: [],
        hasPermissionPending: agent.permissions.length > 0,
        hasQuestionPending: false,
        pendingQuestions: [],
        agentStatus: agent.status,
        agentModel: agent.model,
        error: 'Failed to connect to OpenCode',
      });
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get chat error:', error);
    return NextResponse.json(
      { error: 'Failed to get chat messages' },
      { status: 500 }
    );
  }
}

// POST - Send a message to the agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;
    const { message, mode = 'plan' } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
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

    const workspacePath = agent.workspace?.path || process.cwd();

    try {
      // Send message to OpenCode
      const client = getOpencodeClient();
      
      // Parse model ID to get provider and model parts
      // Format: "provider/model" e.g. "anthropic/claude-sonnet-4-20250514"
      const modelParts = (agent.model || 'anthropic/claude-sonnet-4-20250514').split('/');
      const providerID = modelParts[0];
      const modelID = modelParts.slice(1).join('/'); // Handle model IDs with slashes
      
      // Create mode-specific prefix for the message
      let messageWithMode = message;
      if (mode === 'plan') {
        messageWithMode = `[PLAN MODE - Research and analyze only, do NOT make any changes to files]\n\n${message}`;
      } else if (mode === 'build') {
        messageWithMode = `[BUILD MODE - Implement the requested changes]\n\n${message}`;
      }
      
      const response = await client.session.prompt({
        sessionID: agent.sessionId,
        directory: workspacePath,
        model: {
          providerID,
          modelID,
        },
        parts: [
          {
            type: 'text',
            text: messageWithMode,
          }
        ],
      });

      // Determine new status based on response
      let newStatus = 'RUNNING';
      if (response.data?.info?.finish === 'stop') {
        newStatus = 'IDLE';
      }

      // Update agent status
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: newStatus },
      });

      return NextResponse.json({
        success: true,
        status: newStatus,
        response: response.data,
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

    console.error('Send chat error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
