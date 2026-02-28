import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

// Ensure the requested path is within the workspace (prevent path traversal)
function resolveSafePath(workspacePath: string, relativePath: string): string | null {
  const resolved = path.resolve(workspacePath, relativePath);
  const normalizedWorkspace = path.resolve(workspacePath);
  if (!resolved.startsWith(normalizedWorkspace)) {
    return null;
  }
  return resolved;
}

// Get file stats with type info
async function getFileInfo(filePath: string, name: string) {
  try {
    const stat = await fs.stat(filePath);
    return {
      name,
      path: filePath,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      modified: stat.mtime.getTime(),
      extension: stat.isDirectory() ? null : path.extname(name).toLowerCase(),
    };
  } catch {
    return null;
  }
}

// GET - List files in workspace directory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get relative path from query params (default: root)
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path') || '.';

    const targetPath = resolveSafePath(workspace.path, relativePath);
    if (!targetPath) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if path exists
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) {
        // Return file content for single files
        const content = await fs.readFile(targetPath, 'utf-8').catch(() => null);
        const fileInfo = await getFileInfo(targetPath, path.basename(targetPath));
        return NextResponse.json({
          type: 'file',
          file: fileInfo,
          content: content,
          isBinary: content === null,
        });
      }
    } catch {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    // Read directory
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    // Build file list, skip hidden files starting with . (except .gitignore etc)
    const files = [];
    for (const entry of entries) {
      // Skip .git directory internals but show .gitignore etc
      if (entry.name === '.git') continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === '.next') continue;

      const entryPath = path.join(targetPath, entry.name);
      const info = await getFileInfo(entryPath, entry.name);
      if (info) {
        files.push({
          ...info,
          // Make path relative to workspace root
          relativePath: path.relative(workspace.path, entryPath).replace(/\\/g, '/'),
        });
      }
    }

    // Sort: directories first, then alphabetically
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      type: 'directory',
      path: path.relative(workspace.path, targetPath).replace(/\\/g, '/') || '.',
      workspacePath: workspace.path,
      files,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// POST - Create file/folder or upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle multipart upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const targetDir = (formData.get('path') as string) || '.';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const dirPath = resolveSafePath(workspace.path, targetDir);
      if (!dirPath) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }

      const filePath = path.join(dirPath, file.name);
      const safePath = resolveSafePath(workspace.path, path.relative(workspace.path, filePath));
      if (!safePath) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(safePath, buffer);

      return NextResponse.json({
        success: true,
        file: {
          name: file.name,
          relativePath: path.relative(workspace.path, safePath).replace(/\\/g, '/'),
          size: buffer.length,
        },
      });
    }

    // Handle JSON requests (create file/folder)
    const body = await request.json();
    const { action, filePath: relativePath, content, name } = body;

    if (action === 'createFile') {
      const targetPath = resolveSafePath(workspace.path, relativePath || name);
      if (!targetPath) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content || '');

      return NextResponse.json({
        success: true,
        file: {
          name: path.basename(targetPath),
          relativePath: path.relative(workspace.path, targetPath).replace(/\\/g, '/'),
        },
      });
    }

    if (action === 'createFolder') {
      const targetPath = resolveSafePath(workspace.path, relativePath || name);
      if (!targetPath) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }

      await fs.mkdir(targetPath, { recursive: true });

      return NextResponse.json({
        success: true,
        folder: {
          name: path.basename(targetPath),
          relativePath: path.relative(workspace.path, targetPath).replace(/\\/g, '/'),
        },
      });
    }

    if (action === 'rename') {
      const { newName } = body;
      if (!relativePath || !newName) {
        return NextResponse.json({ error: 'Path and newName required' }, { status: 400 });
      }

      const oldPath = resolveSafePath(workspace.path, relativePath);
      if (!oldPath) {
        return NextResponse.json({ error: 'Invalid source path' }, { status: 400 });
      }

      const newPath = resolveSafePath(workspace.path, path.join(path.dirname(relativePath), newName));
      if (!newPath) {
        return NextResponse.json({ error: 'Invalid target path' }, { status: 400 });
      }

      await fs.rename(oldPath, newPath);

      return NextResponse.json({
        success: true,
        newRelativePath: path.relative(workspace.path, newPath).replace(/\\/g, '/'),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('File operation error:', error);
    return NextResponse.json({ error: 'File operation failed' }, { status: 500 });
  }
}

// DELETE - Delete file or folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(request);
    const { id: workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.userId !== authUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Prevent deleting workspace root
    if (relativePath === '.' || relativePath === '' || relativePath === '/') {
      return NextResponse.json({ error: 'Cannot delete workspace root' }, { status: 400 });
    }

    const targetPath = resolveSafePath(workspace.path, relativePath);
    if (!targetPath) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if exists
    try {
      await fs.stat(targetPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete (recursive for directories)
    await fs.rm(targetPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      deleted: relativePath,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
