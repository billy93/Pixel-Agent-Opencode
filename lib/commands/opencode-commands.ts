// OpenCode slash commands that can be used in chat
export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  category: 'navigation' | 'editing' | 'tools' | 'config' | 'help';
  args?: {
    name: string;
    description: string;
    required: boolean;
  }[];
}

export const OPENCODE_COMMANDS: SlashCommand[] = [
  // Navigation & Context
  {
    name: '/goto',
    description: 'Navigate to a specific file or location',
    usage: '/goto <file:line>',
    category: 'navigation',
    args: [{ name: 'location', description: 'File path and optional line number', required: true }],
  },
  {
    name: '/find',
    description: 'Search for files or content in the workspace',
    usage: '/find <pattern>',
    category: 'navigation',
    args: [{ name: 'pattern', description: 'Search pattern or keyword', required: true }],
  },
  {
    name: '/tree',
    description: 'Show directory tree structure',
    usage: '/tree [path]',
    category: 'navigation',
    args: [{ name: 'path', description: 'Directory path (optional)', required: false }],
  },
  
  // Editing & Code
  {
    name: '/edit',
    description: 'Edit a specific file',
    usage: '/edit <file>',
    category: 'editing',
    args: [{ name: 'file', description: 'File path to edit', required: true }],
  },
  {
    name: '/create',
    description: 'Create a new file',
    usage: '/create <file>',
    category: 'editing',
    args: [{ name: 'file', description: 'File path to create', required: true }],
  },
  {
    name: '/delete',
    description: 'Delete a file (with confirmation)',
    usage: '/delete <file>',
    category: 'editing',
    args: [{ name: 'file', description: 'File path to delete', required: true }],
  },
  {
    name: '/refactor',
    description: 'Refactor code in a file or selection',
    usage: '/refactor <instruction>',
    category: 'editing',
    args: [{ name: 'instruction', description: 'What to refactor', required: true }],
  },
  {
    name: '/fix',
    description: 'Fix errors or issues in code',
    usage: '/fix [file]',
    category: 'editing',
    args: [{ name: 'file', description: 'File to fix (optional)', required: false }],
  },
  
  // Tools & Actions
  {
    name: '/run',
    description: 'Run a shell command',
    usage: '/run <command>',
    category: 'tools',
    args: [{ name: 'command', description: 'Shell command to execute', required: true }],
  },
  {
    name: '/test',
    description: 'Run tests',
    usage: '/test [pattern]',
    category: 'tools',
    args: [{ name: 'pattern', description: 'Test file pattern (optional)', required: false }],
  },
  {
    name: '/build',
    description: 'Build the project',
    usage: '/build',
    category: 'tools',
  },
  {
    name: '/lint',
    description: 'Run linter on the project',
    usage: '/lint [file]',
    category: 'tools',
    args: [{ name: 'file', description: 'File to lint (optional)', required: false }],
  },
  {
    name: '/git',
    description: 'Execute git commands',
    usage: '/git <command>',
    category: 'tools',
    args: [{ name: 'command', description: 'Git command to run', required: true }],
  },
  {
    name: '/commit',
    description: 'Create a git commit with AI-generated message',
    usage: '/commit [message]',
    category: 'tools',
    args: [{ name: 'message', description: 'Commit message (optional, AI generates if empty)', required: false }],
  },
  {
    name: '/pr',
    description: 'Create a pull request',
    usage: '/pr [title]',
    category: 'tools',
    args: [{ name: 'title', description: 'PR title (optional)', required: false }],
  },
  
  // Configuration
  {
    name: '/model',
    description: 'Change the AI model',
    usage: '/model <model-id>',
    category: 'config',
    args: [{ name: 'model', description: 'Model ID to switch to', required: true }],
  },
  {
    name: '/config',
    description: 'View or update agent configuration',
    usage: '/config [key] [value]',
    category: 'config',
    args: [
      { name: 'key', description: 'Config key (optional)', required: false },
      { name: 'value', description: 'Config value (optional)', required: false },
    ],
  },
  {
    name: '/context',
    description: 'Manage conversation context',
    usage: '/context [add|remove|clear] [file]',
    category: 'config',
    args: [
      { name: 'action', description: 'Action to perform', required: false },
      { name: 'file', description: 'File to add/remove', required: false },
    ],
  },
  
  // Help & Info
  {
    name: '/help',
    description: 'Show available commands',
    usage: '/help [command]',
    category: 'help',
    args: [{ name: 'command', description: 'Specific command to get help for', required: false }],
  },
  {
    name: '/status',
    description: 'Show agent status and current task',
    usage: '/status',
    category: 'help',
  },
  {
    name: '/clear',
    description: 'Clear chat history',
    usage: '/clear',
    category: 'help',
  },
  {
    name: '/stop',
    description: 'Stop the current task',
    usage: '/stop',
    category: 'help',
  },
];

export function getCommandsByCategory(category: SlashCommand['category']): SlashCommand[] {
  return OPENCODE_COMMANDS.filter(c => c.category === category);
}

export function getCommandByName(name: string): SlashCommand | undefined {
  const normalizedName = name.startsWith('/') ? name : `/${name}`;
  return OPENCODE_COMMANDS.find(c => c.name.toLowerCase() === normalizedName.toLowerCase());
}

export function searchCommands(query: string): SlashCommand[] {
  const lowerQuery = query.toLowerCase().replace(/^\//, '');
  return OPENCODE_COMMANDS.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) || 
    c.description.toLowerCase().includes(lowerQuery)
  );
}

export function formatCommandHelp(command: SlashCommand): string {
  let help = `**${command.name}** - ${command.description}\n`;
  help += `Usage: \`${command.usage}\`\n`;
  if (command.args && command.args.length > 0) {
    help += '\nArguments:\n';
    command.args.forEach(arg => {
      help += `  - ${arg.name}${arg.required ? ' (required)' : ' (optional)'}: ${arg.description}\n`;
    });
  }
  return help;
}

export function getAllCategories(): SlashCommand['category'][] {
  return ['navigation', 'editing', 'tools', 'config', 'help'];
}

export function getCategoryLabel(category: SlashCommand['category']): string {
  const labels: Record<SlashCommand['category'], string> = {
    navigation: 'Navigation',
    editing: 'Editing & Code',
    tools: 'Tools & Actions',
    config: 'Configuration',
    help: 'Help & Info',
  };
  return labels[category];
}
