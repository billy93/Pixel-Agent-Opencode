import { User, Permission, Layout } from '@prisma/client';

export type { User, Permission, Layout };

// GameAgent type - works with both old and new schema during migration
// This type is used across components to avoid Prisma client regeneration issues
export interface GameAgent {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  status: string;
  sessionId?: string | null;
  model?: string;
  currentTask?: string | null;
  deskIndex?: number | null;
  workspaceId?: string | null;
  userId?: string;
  activeTaskCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  // Workspace relation (new schema)
  workspace?: {
    id: string;
    name: string;
    path: string;
    color: string;
  } | null;
}

// Workspace type for the new workspace room concept
export interface WorkspaceRoom {
  id: string;
  path: string;
  name: string;
  color: string;
  roomIndex: number | null;
  positionX: number | null; // Custom X position in tiles (null = use default)
  positionY: number | null; // Custom Y position in tiles (null = use default)
  userId: string;
  agents: GameAgent[];
  // Owner info (for multiplayer - showing who owns which workspace)
  user?: {
    id: string;
    username: string;
  };
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  type: string;
  workspaceId: string;
  tasks: KanbanTask[];
}

export interface KanbanTask {
  id: string;
  content: string;
  description?: string | null;
  order: number;
  columnId: string;
  agentId?: string | null;
  agent?: GameAgent | null;
  
  // Agent automation
  agentMode?: 'NEW' | 'EXISTING';
  agentModel?: string | null;
  agentRole?: 'PLAN' | 'BUILD' | null;
  targetAgentId?: string | null;
  sessionId?: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  x: number;
  y: number;
}

export interface Direction {
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface Character extends Position, Direction {
  id: string;
  username?: string;
  name?: string;
  avatar: string;
  isAgent?: boolean;
  workspace?: string;
  color?: string;
  model?: string; // AI model being used (e.g., "claude-sonnet-4")
  currentTask?: string; // Current task the agent is working on
  needsAction?: boolean; // True when agent has pending permission or question
}

export type AgentStatus = 
  | 'IDLE'
  | 'SPAWNING'
  | 'TYPING'
  | 'READING'
  | 'RUNNING'
  | 'WAITING'
  | 'PERMISSION'
  | 'ERROR';

// Chat types
export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessageType = 
  | 'text'
  | 'thinking'
  | 'step'
  | 'tool_call'
  | 'tool_result'
  | 'permission_request'
  | 'permission_response'
  | 'question'
  | 'question_response'
  | 'error'
  | 'status';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type: ChatMessageType;
  content: string;
  timestamp: number;
  metadata?: {
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: string;
    permissionType?: string;
    permissionStatus?: 'pending' | 'approved' | 'denied';
    isStreaming?: boolean;
    // Step indicator metadata
    stepNumber?: number;
    // Question-related metadata
    questionRequestId?: string;
    questionHeader?: string;
    questionOptions?: QuestionOption[];
    questionMultiple?: boolean;
    questionCustom?: boolean;
    questionAnswered?: boolean;
    questionAnswers?: string[];
  };
}

// OpenCode Human-in-the-Loop Question types
export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean; // Default true - allows typing custom answer
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface AgentChatState {
  agentId: string;
  messages: ChatMessage[];
  isTyping: boolean;
  hasPermissionPending: boolean;
  hasQuestionPending: boolean;
  pendingQuestions: QuestionRequest[];
}

// Global chat types (user-to-user messaging)
export type GlobalChatMessageType = 'text' | 'system' | 'emote';

export interface GlobalChatMsg {
  id: string;
  content: string;
  type: GlobalChatMessageType;
  userId: string;
  username: string;
  createdAt: string;
}

export interface GameState {
  users: Map<string, Character>;
  agents: Map<string, Character & { status: AgentStatus }>;
  layout: Layout[];
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export interface UserMoveMessage extends WSMessage {
  type: 'user:move';
  payload: {
    userId: string;
    x: number;
    y: number;
    direction: string;
  };
}

export interface AgentStatusMessage extends WSMessage {
  type: 'agent:status';
  payload: {
    agentId: string;
    status: AgentStatus;
  };
}
