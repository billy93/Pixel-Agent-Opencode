import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getRecentWorkspaces } from '@/lib/workspace/recent';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    const workspaces = await getRecentWorkspaces(authUser.userId);

    return NextResponse.json({ workspaces });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching recent workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent workspaces' },
      { status: 500 }
    );
  }
}
