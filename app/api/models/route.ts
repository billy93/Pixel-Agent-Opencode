import { NextRequest, NextResponse } from 'next/server';
import { getOpencodeClient } from '@/lib/opencode/client';

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

// GET /api/models - Fetch all available models from OpenCode server
export async function GET(request: NextRequest) {
  try {
    const client = getOpencodeClient();
    
    // Get providers from OpenCode
    const response = await client.config.providers({});
    
    if (!response.data) {
      return NextResponse.json(
        { error: 'Failed to fetch providers from OpenCode' },
        { status: 500 }
      );
    }

    const { providers, default: defaultModels } = response.data;
    
    // Transform providers and models into a flat list
    const models: ProviderModel[] = [];
    const providerList: ProviderInfo[] = [];

    for (const provider of providers) {
      // Add provider info
      providerList.push({
        id: provider.id,
        name: provider.name,
        source: provider.source,
        modelCount: Object.keys(provider.models).length,
      });

      // Add models from this provider
      for (const [modelKey, model] of Object.entries(provider.models)) {
        models.push({
          id: `${provider.id}/${model.id}`,
          modelId: model.id,
          name: model.name,
          providerId: provider.id,
          providerName: provider.name,
          capabilities: {
            reasoning: model.capabilities?.reasoning ?? false,
            toolcall: model.capabilities?.toolcall ?? false,
            attachment: model.capabilities?.attachment ?? false,
          },
          contextWindow: model.limit?.context ?? 0,
          outputLimit: model.limit?.output ?? 0,
          status: model.status ?? 'active',
        });
      }
    }

    // Sort models: active first, then by provider name, then by model name
    models.sort((a, b) => {
      // Active status first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // Then by provider
      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;
      
      // Then by name
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      models,
      providers: providerList,
      defaultModels,
    });
  } catch (error: any) {
    console.error('Fetch models error:', error);
    
    // Return a helpful error message
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      return NextResponse.json(
        { 
          error: 'Cannot connect to OpenCode server. Is it running?',
          hint: 'Run "opencode serve" to start the server',
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
