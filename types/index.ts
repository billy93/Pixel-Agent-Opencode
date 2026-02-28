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
  userId: string;
  agents: GameAgent[];
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
