
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/auth/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = id;

    // Verify workspace access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        kanbanColumns: {
          include: {
            tasks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Helper to attach agents
    const attachAgents = async (columns: any[]) => {
      const agentIds = columns
        .flatMap(col => col.tasks)
        .map((task: any) => task.agentId)
        .filter((id: string | null) => id !== null) as string[];

      if (agentIds.length === 0) return columns;

      const agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } }
      });
      
      const agentMap = new Map(agents.map(a => [a.id, a]));

      return columns.map(col => ({
        ...col,
        tasks: col.tasks.map((task: any) => ({
          ...task,
          agent: task.agentId ? agentMap.get(task.agentId) || null : null
        }))
      }));
    };

    // Check for duplicates and handle initialization
    let columns = workspace.kanbanColumns;
    let needsRefetch = false;

    // Group columns by type
    const columnsByType: Record<string, typeof columns> = {};
    for (const col of columns) {
      if (!columnsByType[col.type]) columnsByType[col.type] = [];
      columnsByType[col.type].push(col);
    }

    // 1. Handle Initialization (No columns)
    if (columns.length === 0) {
      const defaultColumns = [
        { title: 'To Do', type: 'TODO', order: 0 },
        { title: 'In Progress', type: 'IN_PROGRESS', order: 1 },
        { title: 'Done', type: 'DONE', order: 2 },
      ];

      for (const col of defaultColumns) {
        await prisma.kanbanColumn.create({
          data: {
            ...col,
            workspaceId,
          },
        });
      }
      needsRefetch = true;
    }
    // 2. Handle Duplicates
    else {
      for (const type of ['TODO', 'IN_PROGRESS', 'DONE']) {
        const typeColumns = columnsByType[type];
        if (typeColumns && typeColumns.length > 1) {
          // Keep the one with the most tasks, or arbitrarily the first one
          // Sorting by task count descending ensures we keep the one with data
          typeColumns.sort((a, b) => b.tasks.length - a.tasks.length);
          
          const [keep, ...remove] = typeColumns;
          
          // Move tasks and delete duplicates
          for (const colToRemove of remove) {
             // Move tasks
             await prisma.kanbanTask.updateMany({
                where: { columnId: colToRemove.id },
                data: { columnId: keep.id }
             });
             // Delete column
             await prisma.kanbanColumn.delete({
                where: { id: colToRemove.id }
             });
          }
          needsRefetch = true;
        }
      }
    }

    if (needsRefetch) {
      // Fetch again to get the updated columns
      const updatedWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          kanbanColumns: {
            include: {
              tasks: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });
      columns = updatedWorkspace?.kanbanColumns || [];
    }

    const columnsWithAgents = await attachAgents(columns);
    return NextResponse.json({ columns: columnsWithAgents });
  } catch (error) {
    console.error('Failed to fetch kanban columns:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = id;
    const body = await request.json();
    const { title, type = 'custom' } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get max order
    const lastColumn = await prisma.kanbanColumn.findFirst({
      where: { workspaceId },
      orderBy: { order: 'desc' },
    });

    const newColumn = await prisma.kanbanColumn.create({
      data: {
        title,
        type,
        order: (lastColumn?.order ?? -1) + 1,
        workspaceId,
      },
      include: {
        tasks: true,
      },
    });

    return NextResponse.json({ column: newColumn });
  } catch (error) {
    console.error('Failed to create kanban column:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
