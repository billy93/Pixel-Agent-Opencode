// Available AI models - fetched from OpenCode server
// This file provides types and a fallback list for when server is unavailable

export interface ProviderModel {
  id: string; // format: providerId/modelId
  modelId: string;
  name: string;
  providerId: string;
  providerName: string;
  capabilities: {
    reasoning: boolean;
    toolcall: boolean;
    attachment: boolean;
  };
  contextWindow: number;
  outputLimit: number;
  status: 'alpha' | 'beta' | 'deprecated' | 'active';
}

export interface ProviderInfo {
  id: string;
  name: string;
  source: string;
  modelCount: number;
}

// Fallback models when OpenCode server is not available
export const FALLBACK_MODELS: ProviderModel[] = [
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    modelId: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    capabilities: { reasoning: true, toolcall: true, attachment: true },
    contextWindow: 200000,
    outputLimit: 64000,
    status: 'active',
  },
  {
    id: 'anthropic/claude-opus-4-20250514',
    modelId: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    capabilities: { reasoning: true, toolcall: true, attachment: true },
    contextWindow: 200000,
    outputLimit: 64000,
    status: 'active',
  },
  {
    id: 'openai/gpt-4o',
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    providerName: 'OpenAI',
    capabilities: { reasoning: false, toolcall: true, attachment: true },
    contextWindow: 128000,
    outputLimit: 16384,
    status: 'active',
  },
  {
    id: 'github-copilot/claude-sonnet-4',
    modelId: 'claude-sonnet-4',
    name: 'Claude Sonnet 4 (Copilot)',
    providerId: 'github-copilot',
    providerName: 'GitHub Copilot',
    capabilities: { reasoning: true, toolcall: true, attachment: true },
    contextWindow: 200000,
    outputLimit: 64000,
    status: 'active',
  },
  {
    id: 'github-copilot/gpt-4o',
    modelId: 'gpt-4o',
    name: 'GPT-4o (Copilot)',
    providerId: 'github-copilot',
    providerName: 'GitHub Copilot',
    capabilities: { reasoning: false, toolcall: true, attachment: true },
    contextWindow: 128000,
    outputLimit: 16384,
    status: 'active',
  },
];

// Default model when none selected
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';

// Helper functions
export function getModelById(models: ProviderModel[], id: string): ProviderModel | undefined {
  return models.find(m => m.id === id);
}

export function getModelsByProvider(models: ProviderModel[], providerId: string): ProviderModel[] {
  return models.filter(m => m.providerId === providerId);
}

export function getProviders(models: ProviderModel[]): string[] {
  return [...new Set(models.map(m => m.providerId))];
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  return tokens.toString();
}

export function getModelDisplayName(model: ProviderModel): string {
  return `${model.name} (${model.providerName})`;
}
