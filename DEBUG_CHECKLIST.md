# 🔍 Debug Checklist - Voice-to-Text Not Working

## Quick Diagnostic Steps

### Step 1: Check Backend Server is Running

**Run this command:**
```bash
cd D:\BAP\BAP-Backend
npm run dev
```

**Expected output:**
```
Socket.IO handlers initialized
Input Agent socket handlers initialized
Socket.IO server running on port 3002
```

**If you see this, backend is ✅ GOOD**

---

### Step 2: Check Frontend Server is Running

**Run this command (in a new terminal):**
```bash
cd D:\BAP\bap-workspace\bap-frontend
npm run dev
```

**Expected output:**
```
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

**If you see this, frontend is ✅ GOOD**

---

### Step 3: Check Browser Console for Errors

1. Open browser: `http://localhost:3000`
2. Press **F12** to open developer tools
3. Go to **Console** tab
4. Look for errors (red text)

**Common errors and fixes:**

❌ **"WebSocket connection failed"**
- Backend not running
- Fix: Start backend with `npm run dev`

❌ **"Authentication required"**
- Not logged in
- Fix: Log in to your account first

❌ **"Microphone permission denied"**
- Browser blocked microphone
- Fix: Click lock icon in address bar → Allow microphone

---

### Step 4: Test Socket Connection

**Open browser console (F12) and run:**
```javascript
// Check if socket is connected
console.log('Socket connected:', window.socketConnected);
```

If `undefined` or `false`, socket not connected.

---

### Step 5: Manual Test - Check if Web Speech API Works

**Open browser console (F12) and run this test:**
```javascript
// Test Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  console.log('✅ Web Speech API is supported!');
  const recognition = new SpeechRecognition();
  recognition.onresult = (event) => {
    console.log('Transcript:', event.results[0][0].transcript);
  };
  recognition.start();
  console.log('🎤 Speak now...');
} else {
  console.log('❌ Web Speech API NOT supported in this browser');
}
```

**If you see "Speak now...", try speaking and check if transcript appears.**

---

## Detailed Debugging

### Check 1: Are you logged in?

The socket requires authentication. Make sure you're logged in to your BAP account.

**Steps:**
1. Go to `http://localhost:3000`
2. If not logged in, log in
3. Then go to Super Assistant

---

### Check 2: Is backend socket server running?

**Check terminal where backend is running:**

You should see:
```
Socket.IO server running on port 3002
```

If not, run:
```bash
cd D:\BAP\BAP-Backend
npm run dev
```

---

### Check 3: Is frontend connecting to correct WebSocket URL?

**Check file:** `D:\BAP\bap-workspace\bap-frontend\.env.local`

Should have:
```env
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

If missing, add it and restart frontend.

---

### Check 4: Browser Support

**Supported browsers:**
- ✅ Chrome
- ✅ Edge (Chromium)
- ✅ Safari
- ❌ Firefox (Web Speech API not supported)

**If using Firefox, switch to Chrome!**

---

### Check 5: Network Tab - WebSocket Connection

1. Open browser dev tools (F12)
2. Go to **Network** tab
3. Filter by **WS** (WebSocket)
4. Refresh page
5. Look for connection to `ws://localhost:3002`

**If you see:**
- Green checkmark → ✅ Connected
- Red X → ❌ Failed to connect

---

## Quick Fix Commands

### Backend Not Starting?

```bash
cd D:\BAP\BAP-Backend
# Kill any existing process on port 3002
npx kill-port 3002
# Start fresh
npm run dev
```

### Frontend Not Starting?

```bash
cd D:\BAP\bap-workspace\bap-frontend
# Kill any existing process on port 3000
npx kill-port 3000
# Start fresh
npm run dev
```

### Clear Browser Cache

1. Press **Ctrl+Shift+Delete**
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh page

---

## Verification Test

Let's test step by step:

### Test 1: Backend Console Log Test

**Add a simple test to backend:**

Open `D:\BAP\BAP-Backend\src\socket\input-agent-handlers.ts` and find line 296.

Add this **above** line 296:
```typescript
// TEST LOG
console.log('🔥 VOICE HANDLER READY - Waiting for transcripts...');
```

Restart backend. You should see this message when backend starts.

### Test 2: Frontend Button Click Test

1. Open Super Assistant page
2. Open browser console (F12)
3. Click the microphone/voice button
4. Check console for any errors

### Test 3: Microphone Permission Test

When you click "Speak", browser should show:
```
localhost wants to:
[x] Use your microphone
[Block] [Allow]
```

**Click Allow!**

---

## Common Issues & Solutions

### Issue 1: "Nothing shows in backend console"

**Possible causes:**
1. Socket not connected
2. Not logged in
3. Backend not running
4. Wrong WebSocket URL

**Solution:**
1. Check backend terminal is running
2. Check you're logged in
3. Check browser console for WebSocket errors
4. Verify `.env.local` has correct `NEXT_PUBLIC_WS_URL`

---

### Issue 2: "Microphone permission denied"

**Solution:**
1. Click lock icon in address bar
2. Find "Microphone" setting
3. Change to "Allow"
4. Refresh page

---

### Issue 3: "Web Speech API not working"

**Check browser:**
- Must use Chrome, Edge, or Safari
- Firefox doesn't support Web Speech API

**Solution:**
Switch to Chrome or Edge

---

### Issue 4: "Socket authentication failed"

**Check:**
1. Are you logged in?
2. Is JWT_SECRET set in backend `.env.local`?

**Solution:**
1. Log out and log back in
2. Check backend `.env.local` has `JWT_SECRET`

---

## Enable Detailed Logging

Let's add more verbose logging to see what's happening.

### Backend: Add Debug Logs

Edit `D:\BAP\BAP-Backend\src\socket\input-agent-handlers.ts`

Find line 33 (in the connection handler) and add:
```typescript
console.log('🔵 Input Agent: User connected for input processing', userId);
```

Find line 296 (voice transcript handler) and add at the start:
```typescript
console.log('🟢 Received voice transcript event:', data);
```

### Frontend: Add Debug Logs

Edit `D:\BAP\bap-workspace\bap-frontend\lib\hooks\useInputAgent.ts`

Find line 306 (in recognition.onresult) and add:
```typescript
console.log('🟣 Web Speech API result:', {
    transcript,
    isFinal: result.isFinal,
    confidence
});
```

**Restart both servers and check BOTH consoles!**

---

## Manual Socket Test

Let's manually test the socket connection.

### Backend: Create Test Endpoint

Create file `D:\BAP\BAP-Backend\test-socket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3002', {
  auth: { token: 'test-token' },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Socket connected!');

  // Send test transcript
  socket.emit('input:voice:realtime-transcript', {
    session_id: 'test-session',
    text: 'This is a test message',
    is_final: true,
    confidence: 0.95
  });

  console.log('📤 Test transcript sent');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

setTimeout(() => {
  socket.disconnect();
  console.log('🔌 Disconnected');
  process.exit(0);
}, 3000);
```

**Run:**
```bash
cd D:\BAP\BAP-Backend
node test-socket.js
```

**Check backend console** - should see the test message logged!

---

## Final Verification Checklist

- [ ] Backend running on port 3002
- [ ] Frontend running on port 3000
- [ ] Logged in to BAP account
- [ ] Using Chrome/Edge/Safari (not Firefox)
- [ ] Microphone permission granted
- [ ] No errors in browser console
- [ ] WebSocket shows connected in Network tab
- [ ] `.env.local` has correct NEXT_PUBLIC_WS_URL

**If all checked, it should work!**

---

## Still Not Working?

Try this **complete restart**:

```bash
# 1. Stop all servers (Ctrl+C in both terminals)

# 2. Kill ports
npx kill-port 3000 3001 3002

# 3. Start backend
cd D:\BAP\BAP-Backend
npm run dev

# 4. Start frontend (new terminal)
cd D:\BAP\bap-workspace\bap-frontend
npm run dev

# 5. Clear browser cache and refresh
# Press Ctrl+Shift+Delete, clear cache, refresh page

# 6. Log in fresh

# 7. Go to Super Assistant

# 8. Click Voice Mode

# 9. Click Speak and allow microphone

# 10. Speak clearly and watch BOTH consoles!
```

---

## Contact Points for Debugging

**Check these locations for output:**

1. **Backend Terminal** (`D:\BAP\BAP-Backend`)
   - Should show socket connections
   - Should show voice transcripts with 🎤 emoji

2. **Frontend Terminal** (`D:\BAP\bap-workspace\bap-frontend`)
   - May show compilation warnings (ignore these)

3. **Browser Console** (F12 → Console tab)
   - Should show Web Speech API logs
   - Should show socket connection status

**All three should show activity when you speak!**
