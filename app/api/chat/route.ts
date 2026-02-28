import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';

// GET /api/chat — fetch recent global chat messages
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const before = searchParams.get('before'); // cursor for pagination

    const where = before
      ? { createdAt: { lt: new Date(before) } }
      : {};

    const messages = await prisma.globalChatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    // Reverse to chronological order
    const formatted = messages.reverse().map((msg: typeof messages[number]) => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      userId: msg.user.id,
      username: msg.user.username,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      messages: formatted,
      hasMore: messages.length === limit,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch chat messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
