import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

async function testFixed() {
  console.log('🧪 Testing FIXED Prompt Sending...\n');
  
  const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
  const testWorkspace = join(process.cwd(), 'test-agent-workspace');
  
  try {
    // Setup workspace
    console.log('1️⃣  Setting up test workspace...');
    if (!existsSync(testWorkspace)) {
      await mkdir(testWorkspace, { recursive: true });
    }
    console.log(`   ✓ Workspace: ${testWorkspace}\n`);
    
    // Create session
    console.log('2️⃣  Creating agent session...');
    const session = await client.session.create({
      directory: testWorkspace,
      title: 'Agent: TestBot FIXED',
    });
    const sessionId = session.data?.id;
    console.log(`   ✓ Session ID: ${sessionId}\n`);
    
    // Send prompt WITH CORRECT FORMAT
    console.log('3️⃣  Sending task with CORRECT format (parts array)...');
    console.log('   Task: "Just respond with HELLO WORLD"');
    
    const promptResult = await client.session.prompt({
      sessionID: sessionId,
      directory: testWorkspace,
      parts: [
        {
          type: 'text',
          text: 'Just respond with HELLO WORLD and nothing else.',
        }
      ],
    });
    
    console.log('   ✓ Prompt sent successfully!');
    console.log('   Response:', promptResult);
    console.log('');
    
    // Wait for processing
    console.log('4️⃣  Waiting 5 seconds for OpenCode to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');
    
    // Check messages
    console.log('5️⃣  Checking session messages...');
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
        const content = JSON.stringify(msg.content);
        console.log(`   - Content: ${content.substring(0, 500)}`);
      });
    } else {
      console.log('   ℹ️  No messages found yet (still processing)');
    }
    console.log('');
    
    console.log('📋 Instructions:');
    console.log('   1. Open OpenCode UI: http://localhost:4096');
    console.log(`   2. Look for session: "Agent: TestBot FIXED"`);
    console.log(`   3. Session ID: ${sessionId}`);
    console.log('   4. You should now see the prompt in the session!');
    console.log('');
    console.log('✅ Test completed - session kept open for inspection');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
    process.exit(1);
  }
}

testFixed();
