import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';

async function testSendPrompt() {
  console.log('🧪 Testing OpenCode Prompt Sending...\n');
  
  const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
  
  try {
    // 1. Check health
    console.log('1️⃣  Checking OpenCode health...');
    const health = await client.global.health();
    console.log('   ✓ Server is healthy\n');
    
    // 2. Create session in current directory
    console.log('2️⃣  Creating test session...');
    const session = await client.session.create({
      directory: process.cwd(),
      title: 'Test Prompt Session',
    });
    console.log(`   ✓ Session created: ${session.data?.id}\n`);
    
    // 3. Send a simple prompt
    console.log('3️⃣  Sending prompt: "Echo back the word HELLO"');
    const response = await client.session.prompt({
      sessionID: session.data.id,
      directory: process.cwd(),
      agent: 'Just respond with the word HELLO and nothing else.',
    });
    console.log('   ✓ Prompt sent successfully');
    console.log('   📝 Response:', response.data);
    console.log('');
    
    // 4. Wait a bit for processing
    console.log('4️⃣  Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Check messages
    console.log('\n5️⃣  Checking session messages...');
    const messages = await client.session.messages({
      sessionID: session.data.id,
      directory: process.cwd(),
    });
    console.log(`   ✓ Found ${messages.data?.messages?.length || 0} messages`);
    
    if (messages.data?.messages) {
      messages.data.messages.forEach((msg, i) => {
        console.log(`\n   Message ${i + 1}:`);
        console.log(`   Role: ${msg.role}`);
        console.log(`   Content: ${JSON.stringify(msg.content).substring(0, 200)}`);
      });
    }
    
    // 6. Cleanup
    console.log('\n\n6️⃣  Cleaning up session...');
    await client.session.delete({
      sessionID: session.data.id,
      directory: process.cwd(),
    });
    console.log('   ✓ Session deleted\n');
    
    console.log('✅ Test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testSendPrompt();
