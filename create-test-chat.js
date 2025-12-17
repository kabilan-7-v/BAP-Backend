#!/usr/bin/env node
/**
 * Create a test chat between current user and another user
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('🔧 Create Test Chat\n');

  const token = await question('Your JWT token: ');
  const serverUrl = 'http://localhost:3001';

  // Get current user
  console.log('\n📡 Fetching your user info...');
  const userRes = await fetch(`${serverUrl}/api/user/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const userData = await userRes.json();
  if (!userData.success) {
    console.log('❌ Failed to get user info:', userData.error);
    rl.close();
    return;
  }

  console.log(`✅ Logged in as: ${userData.data.fullName} (${userData.data.email})`);
  const myId = userData.data._id;

  // Get all users
  console.log('\n📡 Fetching all users...');
  const usersRes = await fetch(`${serverUrl}/api/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const usersData = await usersRes.json();
  if (!usersData.success) {
    console.log('❌ Failed to get users:', usersData.error);
    rl.close();
    return;
  }

  if (usersData.data.users.length === 0) {
    console.log('❌ No other users found. Create another user first!');
    rl.close();
    return;
  }

  console.log(`\n✅ Found ${usersData.data.users.length} user(s):`);
  usersData.data.users.forEach((user, i) => {
    console.log(`  ${i + 1}. ${user.name} (${user.email})`);
  });

  const choice = await question('\nSelect user number to create chat with (or press Enter for user 1): ');
  const index = choice ? parseInt(choice) - 1 : 0;
  const otherUser = usersData.data.users[index];

  if (!otherUser) {
    console.log('❌ Invalid selection');
    rl.close();
    return;
  }

  console.log(`\n🔧 Creating chat with ${otherUser.name}...`);

  const chatRes = await fetch(`${serverUrl}/api/chats`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'individual',
      participantIds: [otherUser.id]
    })
  });

  const chatData = await chatRes.json();

  if (chatData.success) {
    console.log('\n✅ Chat created successfully!');
    console.log(`📋 Chat ID: ${chatData.data.chat._id}`);
    console.log(`👥 Participants: ${chatData.data.chat.participants.length}`);
    console.log('\n🎉 You can now test WebRTC calls with this chat!');
    console.log(`\nUse Chat ID in debug-calls.html: ${chatData.data.chat._id}`);
  } else {
    console.log('\n❌ Failed to create chat:', chatData.error);
  }

  rl.close();
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

main().catch(console.error);
