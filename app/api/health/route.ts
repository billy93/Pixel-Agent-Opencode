import { NextRequest, NextResponse } from 'next/server';
import { getOpencodeClient } from '@/lib/opencode/client';

export interface HealthStatus {
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
  serverUrl?: string;
}

// GET /api/health - Check if OpenCode server is running
export async function GET(request: NextRequest): Promise<NextResponse<HealthStatus>> {
  const serverUrl = process.env.OPENCODE_HOST 
    ? `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT || 4096}`
    : 'http://localhost:4096';

  try {
    const client = getOpencodeClient();
    
    // Try to fetch providers - this is a lightweight call to check connectivity
    const response = await client.config.providers({});
    
    if (response.data) {
      return NextResponse.json({
        status: 'connected',
        message: 'OpenCode server is running',
        serverUrl,
      });
    }
    
    return NextResponse.json({
      status: 'error',
      message: 'OpenCode server returned empty response',
      serverUrl,
    });
  } catch (error: any) {
    console.error('OpenCode health check failed:', error.message);
    
    // Check for connection refused error
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      return NextResponse.json({
        status: 'disconnected',
        message: 'Cannot connect to OpenCode server',
        serverUrl,
      });
    }
    
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Unknown error connecting to OpenCode server',
      serverUrl,
    });
  }
}
