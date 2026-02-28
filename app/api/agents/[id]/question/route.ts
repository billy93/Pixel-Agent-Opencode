import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getOpencodeClient } from '@/lib/opencode/client';
import { QuestionRequest } from '@/types';

// GET - Get pending questions for an agent's session
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
      return NextResponse.json({
        questions: [],
        hasQuestionPending: false,
      });
    }

    try {
      const client = getOpencodeClient();
      const workspacePath = agent.workspace?.path || process.cwd();
      
      // Get all pending questions
      const response = await client.question.list({
        directory: workspacePath,
      });

      // Filter questions for this agent's session
      const allQuestions = (response.data || []) as QuestionRequest[];
      const agentQuestions = allQuestions.filter(
        (q: QuestionRequest) => q.sessionID === agent.sessionId
      );

      return NextResponse.json({
        questions: agentQuestions,
        hasQuestionPending: agentQuestions.length > 0,
      });
    } catch (error) {
      console.error('Failed to get questions:', error);
      return NextResponse.json({
        questions: [],
        hasQuestionPending: false,
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

    console.error('Get questions error:', error);
    return NextResponse.json(
      { error: 'Failed to get questions' },
      { status: 500 }
    );
  }
}

// POST - Reply to a question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;
    const { requestId, answers, reject } = await request.json();

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
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

    try {
      const client = getOpencodeClient();
      const workspacePath = agent.workspace?.path || process.cwd();

      if (reject) {
        // Reject the question
        await client.question.reject({
          requestID: requestId,
          directory: workspacePath,
        });

        console.log(`[Question API] Question ${requestId} rejected for agent ${agentId}`);

        return NextResponse.json({
          success: true,
          action: 'rejected',
        });
      } else {
        // Reply to the question
        // Answers should be Array<Array<string>> - one array per question in the request
        // Each inner array contains the selected option labels or custom text
        if (!answers || !Array.isArray(answers)) {
          return NextResponse.json(
            { error: 'answers array is required when not rejecting' },
            { status: 400 }
          );
        }

        await client.question.reply({
          requestID: requestId,
          directory: workspacePath,
          answers: answers, // Array<Array<string>>
        });

        // Update agent status back to RUNNING
        await prisma.agent.update({
          where: { id: agentId },
          data: { status: 'RUNNING' },
        });

        console.log(`[Question API] Question ${requestId} answered for agent ${agentId}:`, answers);

        return NextResponse.json({
          success: true,
          action: 'replied',
          answers,
        });
      }
    } catch (error) {
      console.error('Failed to respond to question:', error);
      return NextResponse.json(
        { error: 'Failed to respond to question' },
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

    console.error('Question response error:', error);
    return NextResponse.json(
      { error: 'Failed to process question response' },
      { status: 500 }
    );
  }
}
