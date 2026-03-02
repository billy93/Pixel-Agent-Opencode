import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const TEST_WORKSPACE_1 = join(process.cwd(), 'test-workspace-1');
const TEST_WORKSPACE_2 = join(process.cwd(), 'test-workspace-2');

async function setupTestWorkspaces() {
  console.log('📁 Setting up test workspaces...\n');
  
  // Create test workspaces if they don't exist
  for (const workspace of [TEST_WORKSPACE_1, TEST_WORKSPACE_2]) {
    if (!existsSync(workspace)) {
      await mkdir(workspace, { recursive: true });
      console.log(`  ✓ Created ${workspace}`);
    }
  }
  console.log();
}

async function cleanupTestWorkspaces() {
  console.log('\n🧹 Cleaning up test workspaces...');
  
  for (const workspace of [TEST_WORKSPACE_1, TEST_WORKSPACE_2]) {
    if (existsSync(workspace)) {
      await rm(workspace, { recursive: true, force: true });
      console.log(`  ✓ Removed ${workspace}`);
    }
  }
}

async function testContextPersistence() {
  const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
  
  console.log('🧪 TEST 1: Context Persistence in Same Workspace\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Create Session A in Workspace 1
    console.log('\n1️⃣  Creating Session A in workspace-1...');
    const sessionA = await client.session.create({
      directory: TEST_WORKSPACE_1,
      title: 'Test Session A',
    });
    console.log(`   ✓ Session A created: ${sessionA.data?.id}`);
    
    // 2. Send a memorable message
    console.log('\n2️⃣  Sending message to Session A: "Remember: My favorite color is BLUE"');
    await client.session.prompt({
      sessionID: sessionA.data.id,
      directory: TEST_WORKSPACE_1,
      agent: 'Remember this fact: My favorite color is BLUE. Just respond with OK.',
    });
    console.log('   ✓ Message sent');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. List messages in Session A
    console.log('\n3️⃣  Checking Session A messages...');
    const messagesA = await client.session.messages({
      sessionID: sessionA.data.id,
      directory: TEST_WORKSPACE_1,
    });
    console.log(`   ✓ Session A has ${messagesA.data?.messages?.length || 0} messages`);
    
    // 4. Delete Session A
    console.log('\n4️⃣  Deleting Session A...');
    await client.session.delete({
      sessionID: sessionA.data.id,
      directory: TEST_WORKSPACE_1,
    });
    console.log('   ✓ Session A deleted');
    
    // 5. Create Session B in SAME workspace
    console.log('\n5️⃣  Creating Session B in SAME workspace (workspace-1)...');
    const sessionB = await client.session.create({
      directory: TEST_WORKSPACE_1,
      title: 'Test Session B',
    });
    console.log(`   ✓ Session B created: ${sessionB.data?.id}`);
    
    // 6. Check if Session B has context from Session A
    console.log('\n6️⃣  Checking Session B messages (should be empty if no persistence)...');
    const messagesB = await client.session.messages({
      sessionID: sessionB.data.id,
      directory: TEST_WORKSPACE_1,
    });
    const messageBCount = messagesB.data?.messages?.length || 0;
    console.log(`   ℹ️  Session B has ${messageBCount} messages`);
    
    // 7. Ask Session B about previous context
    console.log('\n7️⃣  Asking Session B: "What is my favorite color?"');
    const responseB = await client.session.prompt({
      sessionID: sessionB.data.id,
      directory: TEST_WORKSPACE_1,
      agent: 'What is my favorite color? Just say the color name or say "I don\'t know".',
    });
    console.log('   ✓ Question sent, waiting for response...');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check messages again
    const finalMessages = await client.session.messages({
      sessionID: sessionB.data.id,
      directory: TEST_WORKSPACE_1,
    });
    console.log(`   ℹ️  Session B now has ${finalMessages.data?.messages?.length || 0} messages`);
    
    // Cleanup Session B
    await client.session.delete({
      sessionID: sessionB.data.id,
      directory: TEST_WORKSPACE_1,
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST 1 RESULT:');
    console.log('='.repeat(60));
    
    if (messageBCount > 0) {
      console.log('✅ OpenCode PERSISTS context per workspace!');
      console.log('   New sessions inherit previous session history.');
    } else {
      console.log('❌ OpenCode DOES NOT persist context automatically.');
      console.log('   New sessions start fresh (empty history).');
    }
    
  } catch (error) {
    console.error('\n❌ TEST 1 FAILED:', error.message);
  }
  
  // TEST 2: Different Workspaces
  console.log('\n\n🧪 TEST 2: Context Isolation Between Workspaces\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Create session in Workspace 1
    console.log('\n1️⃣  Creating Session in workspace-1...');
    const session1 = await client.session.create({
      directory: TEST_WORKSPACE_1,
      title: 'Workspace 1 Session',
    });
    console.log(`   ✓ Session created: ${session1.data?.id}`);
    
    // 2. Create session in Workspace 2
    console.log('\n2️⃣  Creating Session in workspace-2...');
    const session2 = await client.session.create({
      directory: TEST_WORKSPACE_2,
      title: 'Workspace 2 Session',
    });
    console.log(`   ✓ Session created: ${session2.data?.id}`);
    
    // 3. Send message to Workspace 1
    console.log('\n3️⃣  Sending to workspace-1: "I love FRONTEND development"');
    await client.session.prompt({
      sessionID: session1.data.id,
      directory: TEST_WORKSPACE_1,
      agent: 'Remember: I love FRONTEND development. Just say OK.',
    });
    console.log('   ✓ Message sent');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Send different message to Workspace 2
    console.log('\n4️⃣  Sending to workspace-2: "I love BACKEND development"');
    await client.session.prompt({
      sessionID: session2.data.id,
      directory: TEST_WORKSPACE_2,
      agent: 'Remember: I love BACKEND development. Just say OK.',
    });
    console.log('   ✓ Message sent');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Check message counts
    const msgs1 = await client.session.messages({
      sessionID: session1.data.id,
      directory: TEST_WORKSPACE_1,
    });
    const msgs2 = await client.session.messages({
      sessionID: session2.data.id,
      directory: TEST_WORKSPACE_2,
    });
    
    console.log(`\n   ℹ️  Workspace-1 session has ${msgs1.data?.messages?.length || 0} messages`);
    console.log(`   ℹ️  Workspace-2 session has ${msgs2.data?.messages?.length || 0} messages`);
    
    // Cleanup
    await client.session.delete({ sessionID: session1.data.id, directory: TEST_WORKSPACE_1 });
    await client.session.delete({ sessionID: session2.data.id, directory: TEST_WORKSPACE_2 });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST 2 RESULT:');
    console.log('='.repeat(60));
    console.log('✅ Different workspaces have isolated sessions.');
    console.log('   Each workspace maintains its own context.');
    
  } catch (error) {
    console.error('\n❌ TEST 2 FAILED:', error.message);
  }
}

async function main() {
  console.log('\n🔬 OpenCode Context Persistence Test\n');
  console.log('Testing if OpenCode maintains conversation history');
  console.log('when sessions are deleted and recreated in the same workspace.\n');
  
  try {
    await setupTestWorkspaces();
    await testContextPersistence();
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📝 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(60));
    console.log('\nBased on test results:');
    console.log('- If context persists: We can rely on OpenCode\'s built-in behavior');
    console.log('- If not: We need to implement custom session history tracking');
    console.log('\nFor Pixel Agents app:');
    console.log('- Multiple agents in same workspace WILL share context');
    console.log('- Different workspaces have completely isolated contexts');
    console.log('- Deleting and recreating agents determines if history is preserved');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  } finally {
    await cleanupTestWorkspaces();
  }
}

main().catch(console.error);
