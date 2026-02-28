import { createOpencode } from '@opencode-ai/sdk';

async function startOpencodeServer() {
  try {
    console.log('Starting OpenCode server on port 4096...');
    
    const { server, client } = await createOpencode({
      port: 4096,
    });
    
    console.log('✓ OpenCode server started successfully!');
    console.log('  URL:', server.url);
    console.log('  You can now spawn agents in the Pixel Agents app.');
    console.log('\nPress Ctrl+C to stop the server.');
    
    // Test the connection
    const health = await client.global.health();
    console.log('  Health check:', health.data ? 'OK' : 'FAILED');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\nStopping OpenCode server...');
      server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start OpenCode server:', error.message);
    process.exit(1);
  }
}

startOpencodeServer();
