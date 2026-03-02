import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';

async function testConnection() {
  try {
    console.log('Testing OpenCode server connection on http://localhost:4096...\n');
    
    const client = createOpencodeClient({
      baseUrl: 'http://localhost:4096',
    });
    
    // Test health
    console.log('Checking server health...');
    const health = await client.global.health();
    console.log('✓ Server is healthy!\n');
    
    // List sessions
    console.log('Listing sessions...');
    const sessions = await client.session.list();
    const count = sessions.data?.sessions?.length || 0;
    console.log(`✓ Found ${count} active session(s)\n`);
    
    console.log('🎉 OpenCode server is ready!');
    console.log('You can now spawn agents in Pixel Agents app.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nMake sure OpenCode server is running:');
    console.error('  opencode serve --port 4096');
  }
}

testConnection();
