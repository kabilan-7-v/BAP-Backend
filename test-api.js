#!/usr/bin/env node
/**
 * API Testing Script
 * Tests various endpoints to find issues
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🧪 API Testing Tool\n');

rl.question('Enter your JWT token: ', async (token) => {
  rl.question('Server URL (default: http://localhost:3001): ', async (url) => {
    const serverUrl = url || 'http://localhost:3001';

    console.log('\n📡 Testing endpoints...\n');

    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    try {
      const healthRes = await fetch(`${serverUrl}/api/health`);
      const healthData = await healthRes.json();
      console.log('   ✅ Health:', healthData.database);
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // Test 2: User info
    console.log('\n2. Testing user info endpoint...');
    try {
      const userRes = await fetch(`${serverUrl}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      if (userData.success) {
        console.log('   ✅ User:', userData.data.email);
        console.log('   👤 User ID:', userData.data._id);
        console.log('   📛 Name:', userData.data.fullName);
      } else {
        console.log('   ❌ Error:', userData.error);
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // Test 3: Chats
    console.log('\n3. Testing chats endpoint...');
    try {
      const chatsRes = await fetch(`${serverUrl}/api/chats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('   Status:', chatsRes.status);

      const chatsText = await chatsRes.text();

      try {
        const chatsData = JSON.parse(chatsText);
        if (chatsData.success) {
          console.log('   ✅ Chats found:', chatsData.data.chats.length);
          if (chatsData.data.chats.length > 0) {
            console.log('\n   📋 Your Chats:');
            chatsData.data.chats.forEach((chat, i) => {
              console.log(`      ${i + 1}. ID: ${chat._id}`);
              console.log(`         Type: ${chat.type}`);
              console.log(`         Participants: ${chat.participants.length}`);
            });
          } else {
            console.log('   ℹ️  No chats found. Create one first!');
          }
        } else {
          console.log('   ❌ Error:', chatsData.error);
        }
      } catch (parseError) {
        console.log('   ❌ Response is not JSON:');
        console.log('   ', chatsText.substring(0, 200));
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // Test 4: Create test chat
    console.log('\n4. Would you like to create a test chat? (y/n)');
    rl.question('   ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        rl.question('   Enter other user ID: ', async (otherUserId) => {
          try {
            const createRes = await fetch(`${serverUrl}/api/chats`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'individual',
                participantIds: [otherUserId]
              })
            });

            const createData = await createRes.json();

            if (createData.success) {
              console.log('   ✅ Chat created!');
              console.log('   📋 Chat ID:', createData.data.chat._id);
              console.log('\n   Use this Chat ID for testing WebRTC calls!');
            } else {
              console.log('   ❌ Error:', createData.error);
            }
          } catch (error) {
            console.log('   ❌ Error:', error.message);
          }

          rl.close();
        });
      } else {
        rl.close();
      }
    });
  });
});
