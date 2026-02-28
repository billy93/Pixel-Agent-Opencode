import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// Simple polling endpoint - get all agent statuses
export async function GET(request: NextRequest) {
  try {
    const authUser = await requireAuth(request);

    // Get all user's agents with current status
    const agents = await prisma.agent.findMany({
      where: { 
        userId: authUser.userId,
      },
      include: {
        workspace: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ 
      agents,
      timestamp: Date.now(),
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get agents error:', error);
    return NextResponse.json(
      { error: 'Failed to get agents' },
      { status: 500 }
    );
  }
}
