import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { autoDetectGitRepos } from '@/lib/workspace/validator';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const repos = await autoDetectGitRepos();

    return NextResponse.json({ workspaces: repos });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error detecting git repos:', error);
    return NextResponse.json(
      { error: 'Failed to detect git repositories' },
      { status: 500 }
    );
  }
}
