import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

async function testRealScenario() {
  console.log('🧪 Testing Real Agent Scenario...\n');
  
  const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
  const testWorkspace = join(process.cwd(), 'test-agent-workspace');
  
  try {
    // Setup workspace
    console.log('1️⃣  Setting up test workspace...');
    if (!existsSync(testWorkspace)) {
      await mkdir(testWorkspace, { recursive: true });
    }
    console.log(`   ✓ Workspace: ${testWorkspace}\n`);
    
    // Create session (simulating agent creation)
    console.log('2️⃣  Creating agent session...');
    const session = await client.session.create({
      directory: testWorkspace,
      title: 'Agent: TestBot',
    });
    const sessionId = session.data?.id;
    console.log(`   ✓ Session ID: ${sessionId}\n`);
    
    // List sessions to verify
    console.log('3️⃣  Verifying session exists...');
    const sessions = await client.session.list({
      directory: testWorkspace,
    });
    console.log(`   ✓ Total sessions: ${sessions.data?.sessions?.length || 0}`);
    const foundSession = sessions.data?.sessions?.find(s => s.id === sessionId);
    console.log(`   ✓ Our session found: ${foundSession ? 'YES' : 'NO'}\n`);
    
    // Send prompt (simulating task)
    console.log('4️⃣  Sending task to agent...');
    console.log('   Task: "Create a file called test.txt with content Hello World"');
    
    const promptResult = await client.session.prompt({
      sessionID: sessionId,
      directory: testWorkspace,
      agent: 'Create a file called test.txt with content "Hello World"',
    });
    
    console.log('   ✓ Prompt sent');
    console.log('   Response:', promptResult);
    console.log('   Response data:', promptResult.data);
    console.log('   Response status:', promptResult.status);
    console.log('');
    
    // Wait for processing
    console.log('5️⃣  Waiting 5 seconds for OpenCode to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');
    
    // Check session messages
    console.log('6️⃣  Checking session messages...');
    try {
      const messages = await client.session.messages({
        sessionID: sessionId,
        directory: testWorkspace,
      });
      
      const messageCount = messages.data?.messages?.length || 0;
      console.log(`   ✓ Messages in session: ${messageCount}`);
      
      if (messages.data?.messages && messages.data.messages.length > 0) {
        console.log('\n   📝 Messages:');
        messages.data.messages.forEach((msg, i) => {
          console.log(`\n   Message ${i + 1}:`);
          console.log(`   - Role: ${msg.role}`);
          console.log(`   - Content: ${JSON.stringify(msg.content).substring(0, 300)}`);
        });
      } else {
        console.log('   ⚠️  No messages found!');
      }
    } catch (error) {
      console.log('   ⚠️  Error fetching messages:', error.message);
    }
    console.log('');
    
    // Check session info
    console.log('7️⃣  Getting detailed session info...');
    try {
      const sessionInfo = await client.session.get({
        sessionID: sessionId,
        directory: testWorkspace,
      });
      console.log('   Session Info:', JSON.stringify(sessionInfo.data, null, 2));
    } catch (error) {
      console.log('   ⚠️  Error getting session info:', error.message);
    }
    console.log('');
    
    console.log('📋 Instructions:');
    console.log('   1. Open OpenCode UI: http://localhost:4096');
    console.log(`   2. Look for session: "${sessionId}"`);
    console.log(`   3. Check if the prompt appears in the session`);
    console.log('   4. The session will remain open for inspection');
    console.log('');
    console.log('⚠️  Session NOT deleted - you can inspect it in OpenCode UI');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Workspace: ${testWorkspace}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testRealScenario();
