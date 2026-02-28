'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProviderModel, ProviderInfo, FALLBACK_MODELS, DEFAULT_MODEL } from './available-models';

interface UseModelsResult {
  models: ProviderModel[];
  providers: ProviderInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getModelById: (id: string) => ProviderModel | undefined;
}

export function useModels(): UseModelsResult {
  const [models, setModels] = useState<ProviderModel[]>(FALLBACK_MODELS);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch models');
      }

      const data = await response.json();
      
      if (data.models && data.models.length > 0) {
        setModels(data.models);
        setProviders(data.providers || []);
      } else {
        // No models returned, use fallback
        setModels(FALLBACK_MODELS);
        setError('No models available from server, using fallback');
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err);
      setError(err.message || 'Failed to fetch models');
      // Keep using fallback models
      setModels(FALLBACK_MODELS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getModelById = useCallback((id: string): ProviderModel | undefined => {
    return models.find(m => m.id === id);
  }, [models]);

  return {
    models,
    providers,
    loading,
    error,
    refresh: fetchModels,
    getModelById,
  };
}

// Get default model ID
export function getDefaultModelId(): string {
  return DEFAULT_MODEL;
}
