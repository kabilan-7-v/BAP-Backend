#!/usr/bin/env node
/**
 * WebRTC Setup Verification Script
 *
 * This script checks if all WebRTC components are properly set up
 *
 * Usage: node check-webrtc-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking WebRTC Implementation Setup...\n');

let allChecks = true;
let warnings = [];

// Check functions
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  const exists = fs.existsSync(fullPath);

  console.log(
    exists ? '✅' : '❌',
    description,
    exists ? '(Found)' : '(Missing)'
  );

  if (!exists) allChecks = false;
  return exists;
}

function checkDirectory(dirPath, description) {
  const fullPath = path.join(__dirname, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();

  console.log(
    exists ? '✅' : '❌',
    description,
    exists ? '(Found)' : '(Missing)'
  );

  if (!exists) allChecks = false;
  return exists;
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log('❌', description, '(File not found)');
    allChecks = false;
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const contains = content.includes(searchString);

  console.log(
    contains ? '✅' : '❌',
    description,
    contains ? '(Found)' : '(Missing)'
  );

  if (!contains) allChecks = false;
  return contains;
}

function checkEnvVariable(envFile, varName, description) {
  const fullPath = path.join(__dirname, envFile);

  if (!fs.existsSync(fullPath)) {
    console.log('⚠️ ', description, `(${envFile} not found - will use defaults)`);
    warnings.push(`${envFile} not found. Copy from .env.example if needed.`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const hasVar = content.includes(varName);

  console.log(
    hasVar ? '✅' : '⚠️ ',
    description,
    hasVar ? '(Configured)' : '(Optional - not set)'
  );

  if (!hasVar && varName.includes('TURN')) {
    warnings.push(`${varName} not configured. TURN server improves connectivity but is optional for testing.`);
  }

  return hasVar;
}

// Run checks
console.log('📁 Core Files:\n');
checkFile('src/models/CallSession.ts', 'CallSession Model');
checkFile('src/lib/webrtc-config.ts', 'WebRTC Configuration');
checkFile('src/utils/callManager.ts', 'Call Manager Utility');
checkFile('src/types/webrtc.ts', 'WebRTC TypeScript Types');

console.log('\n📡 Socket Implementation:\n');
checkFileContains('src/socket/index.ts', 'CallManager', 'CallManager imported in socket handlers');
checkFileContains('src/socket/index.ts', 'call:initiate', 'Call initiate event handler');
checkFileContains('src/socket/index.ts', 'webrtc:offer', 'WebRTC offer event handler');
checkFileContains('src/socket/index.ts', 'webrtc:answer', 'WebRTC answer event handler');
checkFileContains('src/socket/index.ts', 'webrtc:ice-candidate', 'ICE candidate event handler');

console.log('\n🌐 API Endpoints:\n');
checkFile('src/app/api/calls/route.ts', 'Call History API');
checkFile('src/app/api/calls/[id]/route.ts', 'Call Details API');
checkFile('src/app/api/calls/stats/route.ts', 'Call Statistics API');

console.log('\n⚙️  Environment Configuration:\n');
checkEnvVariable('.env.local', 'MONGODB_URI', 'MongoDB connection');
checkEnvVariable('.env.local', 'JWT_SECRET', 'JWT secret');
checkEnvVariable('.env.local', 'TURN_SERVER', 'TURN server (optional)');
checkEnvVariable('.env.local', 'TURN_USERNAME', 'TURN username (optional)');
checkEnvVariable('.env.local', 'TURN_CREDENTIAL', 'TURN credential (optional)');

console.log('\n📚 Documentation:\n');
checkFile('WEBRTC_IMPLEMENTATION.md', 'Implementation Documentation');
checkFile('TESTING_GUIDE.md', 'Testing Guide');
checkFile('QUICKSTART_TEST.md', 'Quick Start Guide');
checkFile('test-webrtc-client.html', 'HTML Test Client');

console.log('\n📦 Dependencies:\n');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  const requiredDeps = {
    'socket.io': 'Socket.IO server',
    'mongoose': 'MongoDB ODM',
    'next': 'Next.js framework',
  };

  for (const [dep, description] of Object.entries(requiredDeps)) {
    const installed = dep in deps;
    console.log(
      installed ? '✅' : '❌',
      description,
      installed ? `(v${deps[dep]})` : '(Not installed)'
    );
    if (!installed) allChecks = false;
  }
} else {
  console.log('❌ package.json not found');
  allChecks = false;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

if (allChecks && warnings.length === 0) {
  console.log('✅ All checks passed! Your WebRTC implementation is properly set up.\n');
  console.log('Next steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Open test-webrtc-client.html in two browser windows');
  console.log('3. Follow QUICKSTART_TEST.md for testing\n');
} else if (warnings.length > 0 && allChecks) {
  console.log('✅ Core implementation is complete!\n');
  console.log('⚠️  Warnings:\n');
  warnings.forEach((warning, i) => {
    console.log(`   ${i + 1}. ${warning}`);
  });
  console.log('\nYou can still test the implementation. These are optional configurations.\n');
} else {
  console.log('❌ Some required files are missing!\n');
  console.log('Please ensure all WebRTC implementation files are created.');
  console.log('Refer to WEBRTC_IMPLEMENTATION.md for the complete file structure.\n');
}

if (warnings.length > 0) {
  console.log('\nℹ️  Notes:');
  console.log('   - TURN server is optional for local testing');
  console.log('   - STUN servers (Google\'s public STUN) are configured by default');
  console.log('   - TURN is recommended for production to improve connectivity\n');
}

console.log('📖 Documentation:');
console.log('   - WEBRTC_IMPLEMENTATION.md - Complete implementation guide');
console.log('   - TESTING_GUIDE.md - Detailed testing instructions');
console.log('   - QUICKSTART_TEST.md - Quick start testing\n');

process.exit(allChecks ? 0 : 1);
