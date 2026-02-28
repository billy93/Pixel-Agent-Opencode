import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        username: true,
        x: true,
        y: true,
        direction: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
