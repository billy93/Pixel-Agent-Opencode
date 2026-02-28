import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk/v2/client';

let clientInstance: OpencodeClient | null = null;

export function getOpencodeClient(): OpencodeClient {
  if (!clientInstance) {
    const baseUrl = process.env.OPENCODE_HOST 
      ? `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT || 4096}`
      : 'http://localhost:4096';
    
    clientInstance = createOpencodeClient({
      baseUrl,
    });
  }
  
  return clientInstance;
}

export interface CreateSessionOptions {
  title?: string;
  directory?: string;
}

export interface SessionInfo {
  sessionID: string;
  title: string;
  directory?: string;
}

export async function createSession(options: CreateSessionOptions = {}): Promise<SessionInfo> {
  const client = getOpencodeClient();
  
  console.log('[OpenCode] Creating session with options:', {
    directory: options.directory || process.cwd(),
    title: options.title || 'Agent Session',
  });
  
  try {
    const response = await client.session.create({
      directory: options.directory || process.cwd(),
      title: options.title || 'Agent Session',
    });
    
    console.log('[OpenCode] Session create response:', response);
    
    if (!response.data) {
      console.error('[OpenCode] No data in response:', response);
      throw new Error('Failed to create session: No data in response');
    }
    
    return {
      sessionID: response.data.id,
      title: response.data.title || options.title || 'Agent Session',
      directory: options.directory,
    };
  } catch (error: any) {
    console.error('[OpenCode] Session create error:', error);
    console.error('[OpenCode] Error message:', error?.message);
    console.error('[OpenCode] Error stack:', error?.stack);
    throw error;
  }
}

export async function deleteSession(sessionID: string, directory?: string): Promise<void> {
  const client = getOpencodeClient();
  
  await client.session.delete({
    sessionID,
    directory: directory || process.cwd(),
  });
}

export async function sendPrompt(
  sessionID: string,
  prompt: string,
  directory?: string
): Promise<any> {
  const client = getOpencodeClient();
  
  console.log(`[OpenCode] Sending prompt to session ${sessionID} in ${directory}`);
  console.log(`[OpenCode] Prompt: ${prompt.substring(0, 100)}...`);
  
  const response = await client.session.prompt({
    sessionID,
    directory: directory || process.cwd(),
    parts: [
      {
        type: 'text',
        text: prompt,
      }
    ],
  });
  
  console.log(`[OpenCode] Response received:`, response.data);
  
  return response.data;
}

export async function getSessionStatus(sessionID: string, directory?: string) {
  const client = getOpencodeClient();
  
  const response = await client.session.get({
    sessionID,
    directory: directory || process.cwd(),
  });
  
  return response.data;
}

export async function listSessions(directory?: string) {
  const client = getOpencodeClient();
  
  const response = await client.session.list({
    directory: directory || process.cwd(),
  });
  
  return response.data;
}
