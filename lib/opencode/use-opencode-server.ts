'use client';

import { useState, useEffect, useCallback } from 'react';

export interface OpenCodeServerStatus {
  status: 'checking' | 'connected' | 'disconnected' | 'error';
  message?: string;
  serverUrl?: string;
  lastChecked?: Date;
}

interface UseOpenCodeServerResult {
  serverStatus: OpenCodeServerStatus;
  checkServer: () => Promise<void>;
  isServerRunning: boolean;
}

export function useOpenCodeServer(checkInterval: number = 30000): UseOpenCodeServerResult {
  const [serverStatus, setServerStatus] = useState<OpenCodeServerStatus>({
    status: 'checking',
  });

  const checkServer = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      setServerStatus({
        status: data.status,
        message: data.message,
        serverUrl: data.serverUrl,
        lastChecked: new Date(),
      });
    } catch (error: any) {
      setServerStatus({
        status: 'error',
        message: 'Failed to check server status',
        lastChecked: new Date(),
      });
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkServer();
  }, [checkServer]);

  // Periodic check
  useEffect(() => {
    if (checkInterval <= 0) return;

    const interval = setInterval(checkServer, checkInterval);
    return () => clearInterval(interval);
  }, [checkServer, checkInterval]);

  const isServerRunning = serverStatus.status === 'connected';

  return {
    serverStatus,
    checkServer,
    isServerRunning,
  };
}
