// Quick test to verify OpenCode SDK connectivity
import { getOpencodeClient } from './lib/opencode/client.js';

async function testOpenCodeConnection() {
  try {
    console.log('Testing OpenCode SDK connection...');
    
    const client = getOpencodeClient();
    
    // Try to get health status
    const health = await client.global.health();
    console.log('✓ OpenCode server is healthy:', health.data);
    
    // Try to list sessions
    const sessions = await client.session.list();
    console.log('✓ Connected successfully. Active sessions:', sessions.data?.sessions?.length || 0);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ OpenCode connection failed:', error.message);
    console.error('\nMake sure OpenCode server is running:');
    console.error('  opencode server --port 4096');
    process.exit(1);
  }
}

testOpenCodeConnection();
