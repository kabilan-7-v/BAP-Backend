# Quick Start Testing Guide

Follow these steps to quickly test the WebRTC voice call implementation:

## Step 1: Start the Server

```bash
cd D:\BAP\bap-backend
npm run dev
```

Wait for:
```
> Ready on http://localhost:3001
> Socket.IO server running
```

## Step 2: Get Test Users

You need 2 users and a chat between them. If you don't have them:

### Option A: Use Existing Users
1. Log in to your frontend as User 1
2. Open browser DevTools (F12) → Application/Storage → Local Storage
3. Copy the JWT token
4. Repeat in incognito mode for User 2

### Option B: Create Test Users via API

```bash
# Create User 1
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@example.com",
    "password": "Test123!",
    "fullName": "Test User 1"
  }'

# Create User 2
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser2@example.com",
    "password": "Test123!",
    "fullName": "Test User 2"
  }'
```

Save both tokens from the responses.

## Step 3: Create a Chat (if needed)

```bash
# Get User 1's ID first
curl http://localhost:3001/api/user/me \
  -H "Authorization: Bearer USER_1_TOKEN"

# Create chat from User 1's account with User 2
curl -X POST http://localhost:3001/api/chats \
  -H "Authorization: Bearer USER_1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "participantId": "USER_2_ID"
  }'
```

Save the chat ID from the response.

## Step 4: Open Test Client

1. Open `test-webrtc-client.html` in **Chrome or Firefox** (recommended for WebRTC)
2. Open it in **two separate browser windows** (or use one normal + one incognito)

## Step 5: Test the Call

### Window 1 (User 1 - Caller):
1. Enter Server URL: `http://localhost:3001`
2. Paste User 1's JWT token
3. Enter the Chat ID
4. Click **"Connect"** - should see "Connected to Socket.IO server"
5. Click **"Initiate Call"** - browser will ask for microphone permission
6. Allow microphone access
7. You should see "Call is ringing..."

### Window 2 (User 2 - Receiver):
1. Enter Server URL: `http://localhost:3001`
2. Paste User 2's JWT token
3. Enter the **same Chat ID**
4. Click **"Connect"**
5. You should immediately see an **incoming call notification**
6. Click **"Accept Call"** - allow microphone access
7. WebRTC connection will establish

### Both Windows:
- You should see "Connection state: connected"
- Both users should be able to hear each other
- Test "Toggle Mute" button
- Check the Event Log for all socket events
- Click "End Call" to disconnect

## Expected Event Flow

In the Event Log, you should see:

### User 1 (Caller):
```
[time] Connecting to server...
[time] Connected to Socket.IO server
[time] Received WebRTC config
[time] Requesting microphone access...
[time] Microphone access granted
[time] Initiating call...
[time] Call initiated. Session ID: xxx
[time] Call is ringing...
[time] Call accepted by user xxx
[time] Sending ICE candidate
[time] Received WebRTC answer
[time] Connection state: connected
[time] WebRTC connection established!
```

### User 2 (Receiver):
```
[time] Connecting to server...
[time] Connected to Socket.IO server
[time] Received WebRTC config
[time] Incoming call from Test User 1
[time] Accepting call...
[time] Call accepted
[time] Received WebRTC offer
[time] Sending ICE candidate
[time] Connection state: connected
[time] WebRTC connection established!
```

## Troubleshooting

### "Connection error: Authentication required"
- Check your JWT token is valid and not expired
- Make sure you're logged in and the token is correct

### "No audio"
1. Check microphone permissions in browser settings
2. Try a different browser (Chrome recommended)
3. Check system audio settings
4. Verify microphone is not muted in system settings

### "Connection fails"
1. Check both users are using the same Chat ID
2. Verify both users are participants in that chat
3. Check server logs for errors
4. Try refreshing both windows and reconnecting

### "Call already in progress" error
- End the existing call first
- Wait a few seconds and try again
- Check database: `db.callsessions.find({status: 'ongoing'})`

## Test Scenarios

### 1. Basic Call
- ✅ User 1 calls User 2
- ✅ User 2 accepts
- ✅ Both can hear each other
- ✅ Either user can end call

### 2. Reject Call
- User 1 calls User 2
- User 2 clicks "Reject"
- User 1 should see "Call rejected"

### 3. Missed Call
- User 1 calls User 2
- User 2 doesn't answer
- Wait 45 seconds
- Both should see "Call was missed"

### 4. Mute/Unmute
- During active call
- Click "Toggle Mute"
- Check "Muted" status changes
- Other user should not hear you

### 5. Disconnect During Call
- Start a call
- Close one browser window
- Other user should see "Call ended"

## Check Database

After testing, verify calls are logged:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/bap-workspace

# View all call sessions
db.callsessions.find().pretty()

# View latest 5 calls
db.callsessions.find().sort({createdAt: -1}).limit(5).pretty()
```

You should see CallSession documents with:
- `callType: 'voice'`
- `status: 'ended'` (or 'missed', 'rejected')
- `duration` (in seconds)
- `participants` array
- `quality` metrics (if tracked)

## Test API Endpoints

```bash
# Get call history
curl http://localhost:3001/api/calls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get call stats
curl http://localhost:3001/api/calls/stats?timeframe=7d \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific call
curl http://localhost:3001/api/calls/CALL_SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Success Criteria

✅ Both users connect to Socket.IO
✅ Call initiates successfully
✅ Receiver gets incoming call notification
✅ Call can be accepted
✅ Audio works both ways
✅ Mute/unmute functions correctly
✅ Call ends properly
✅ Events logged correctly
✅ Database records call session
✅ API endpoints return call data

## Video Tutorial (Manual Steps)

1. **Prepare:**
   - Backend running
   - Two browser windows open with test client
   - Two valid JWT tokens ready
   - Chat ID ready

2. **User 1 (Left Window):**
   - Fill credentials → Connect → Initiate Call

3. **User 2 (Right Window):**
   - Fill credentials → Connect → See incoming call → Accept

4. **Verify:**
   - Both see "connected"
   - Can hear each other
   - Events logged

5. **Test Features:**
   - Mute/unmute
   - Check duration timer
   - End call

## Next Steps

After successful testing:
1. ✅ Integration works
2. → Integrate into your React/Next.js frontend
3. → Build proper UI components
4. → Add notifications
5. → Deploy with TURN server for production

## Need Help?

Common issues and solutions in `TESTING_GUIDE.md`

Full implementation details in `WEBRTC_IMPLEMENTATION.md`
