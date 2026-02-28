import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';

// POST - Approve or deny a permission request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: agentId } = await params;
    const { permissionId, approved } = await request.json();

    if (!permissionId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'permissionId and approved are required' },
        { status: 400 }
      );
    }

    // Find agent and verify ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
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

    // Find and update the permission
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    if (permission.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Permission does not belong to this agent' },
        { status: 400 }
      );
    }

    if (permission.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Permission already processed' },
        { status: 400 }
      );
    }

    // Update permission status
    const updatedPermission = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        status: approved ? 'APPROVED' : 'DENIED',
      },
    });

    // Update agent status back to RUNNING if approved, or IDLE if denied
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: approved ? 'RUNNING' : 'IDLE',
      },
    });

    console.log(`[Permission API] Permission ${permissionId} ${approved ? 'approved' : 'denied'} for agent ${agentId}`);

    return NextResponse.json({
      success: true,
      permission: updatedPermission,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Permission response error:', error);
    return NextResponse.json(
      { error: 'Failed to process permission response' },
      { status: 500 }
    );
  }
}

// GET - Get pending permissions for an agent
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

    // Get pending permissions
    const permissions = await prisma.permission.findMany({
      where: {
        agentId,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      permissions,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get permissions error:', error);
    return NextResponse.json(
      { error: 'Failed to get permissions' },
      { status: 500 }
    );
  }
}
