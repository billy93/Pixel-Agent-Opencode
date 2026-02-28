import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { validateWorkspace } from '@/lib/workspace/validator';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const { workspace } = body;

    if (!workspace || typeof workspace !== 'string') {
      return NextResponse.json(
        { error: 'Workspace path is required' },
        { status: 400 }
      );
    }

    const result = await validateWorkspace(workspace);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error validating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to validate workspace' },
      { status: 500 }
    );
  }
}
