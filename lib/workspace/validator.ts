import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, basename } from 'path';

export interface WorkspaceValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  gitRepo: boolean;
  absolutePath: string;
  displayName: string;
}

/**
 * Validate a workspace path
 * - Must exist
 * - Must be a git repository
 */
export async function validateWorkspace(
  workspacePath: string
): Promise<WorkspaceValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Convert to absolute path
  const absolutePath = resolve(workspacePath);
  const displayName = basename(absolutePath);
  
  // Check if folder exists
  if (!existsSync(absolutePath)) {
    errors.push('Folder does not exist');
    return { 
      isValid: false, 
      errors, 
      warnings,
      gitRepo: false, 
      absolutePath,
      displayName,
    };
  }
  
  // Check if it's a git repository
  const gitPath = join(absolutePath, '.git');
  const gitRepo = existsSync(gitPath);
  
  if (!gitRepo) {
    errors.push('Not a git repository (missing .git folder)');
  }
  
  // Optional: Check read/write permissions
  try {
    await readdir(absolutePath);
  } catch (error) {
    errors.push('Cannot read directory (permission denied)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gitRepo,
    absolutePath,
    displayName,
  };
}

/**
 * Get display name from workspace path (just the folder name)
 */
export function getWorkspaceDisplayName(workspacePath: string): string {
  return basename(workspacePath);
}

/**
 * Determine UI color for workspace (deterministic hash)
 * User can override this later
 */
export function getWorkspaceColor(workspacePath: string): string {
  const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan'];
  
  // Simple hash based on path
  const hash = workspacePath.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return colors[hash % colors.length];
}

/**
 * Auto-detect git repositories in common locations
 * Returns list of valid git repo paths
 */
export async function autoDetectGitRepos(
  searchPaths?: string[]
): Promise<string[]> {
  const defaultSearchPaths = [
    'C:\\projects',
    'C:\\Users\\' + (process.env.USERNAME || 'Lenovo') + '\\Documents',
    'C:\\Users\\' + (process.env.USERNAME || 'Lenovo') + '\\Documents\\GitHub',
    'C:\\workspace',
    'C:\\dev',
  ];
  
  const paths = searchPaths || defaultSearchPaths;
  const gitRepos: string[] = [];
  
  for (const searchPath of paths) {
    try {
      if (!existsSync(searchPath)) continue;
      
      const entries = await readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = join(searchPath, entry.name);
        const gitPath = join(fullPath, '.git');
        
        if (existsSync(gitPath)) {
          gitRepos.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      continue;
    }
  }
  
  return gitRepos;
}

/**
 * Recursively find git repos up to certain depth
 */
export async function findGitReposRecursive(
  basePath: string,
  maxDepth: number = 2,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth > maxDepth) return [];
  if (!existsSync(basePath)) return [];
  
  const repos: string[] = [];
  
  try {
    // Check if current path is a git repo
    const gitPath = join(basePath, '.git');
    if (existsSync(gitPath)) {
      repos.push(basePath);
      return repos; // Don't recurse into git repos
    }
    
    // Recurse into subdirectories
    const entries = await readdir(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // Skip hidden folders
      if (entry.name === 'node_modules') continue; // Skip common large folders
      
      const fullPath = join(basePath, entry.name);
      const subRepos = await findGitReposRecursive(fullPath, maxDepth, currentDepth + 1);
      repos.push(...subRepos);
    }
  } catch (error) {
    // Skip if we can't read
  }
  
  return repos;
}
