import { prisma } from '@/lib/db/prisma';

const MAX_RECENT_WORKSPACES = 10;

/**
 * Get recent workspaces for a user
 */
export async function getRecentWorkspaces(userId: string): Promise<string[]> {
  const settings = await prisma.settings.findUnique({
    where: { userId },
    select: { recentWorkspaces: true },
  });

  if (!settings || !settings.recentWorkspaces) {
    return [];
  }

  try {
    const workspaces = JSON.parse(settings.recentWorkspaces as string);
    return Array.isArray(workspaces) ? workspaces : [];
  } catch (error) {
    console.error('Failed to parse recent workspaces:', error);
    return [];
  }
}

/**
 * Add a workspace to recent workspaces
 * Moves it to the front if already exists, limits to MAX_RECENT_WORKSPACES
 */
export async function addRecentWorkspace(
  userId: string,
  workspace: string
): Promise<void> {
  const current = await getRecentWorkspaces(userId);

  // Remove if already exists (we'll add it to front)
  const filtered = current.filter((w) => w !== workspace);

  // Add to front
  const updated = [workspace, ...filtered].slice(0, MAX_RECENT_WORKSPACES);

  // Upsert settings
  await prisma.settings.upsert({
    where: { userId },
    create: {
      userId,
      recentWorkspaces: JSON.stringify(updated),
    },
    update: {
      recentWorkspaces: JSON.stringify(updated),
    },
  });
}

/**
 * Remove a workspace from recent workspaces
 */
export async function removeRecentWorkspace(
  userId: string,
  workspace: string
): Promise<void> {
  const current = await getRecentWorkspaces(userId);
  const filtered = current.filter((w) => w !== workspace);

  await prisma.settings.upsert({
    where: { userId },
    create: {
      userId,
      recentWorkspaces: JSON.stringify(filtered),
    },
    update: {
      recentWorkspaces: JSON.stringify(filtered),
    },
  });
}
