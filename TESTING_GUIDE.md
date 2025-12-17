# WebRTC Voice Call Testing Guide

This guide will help you test the WebRTC voice call implementation.

## Prerequisites

1. **Backend running** - The Socket.IO server must be running
2. **MongoDB running** - Database connection required
3. **Two browser tabs/windows** - To simulate two users
4. **Microphone access** - Browser needs microphone permissions

## Setup

### 1. Environment Configuration

Make sure your `.env.local` file has the correct settings:

```env
MONGODB_URI=mongodb://localhost:27017/bap-workspace
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:3000

# Optional: TURN server for better connectivity
# TURN_SERVER=turn:turn.example.com:3478
# TURN_USERNAME=username
# TURN_CREDENTIAL=credential
```

### 2. Start the Backend Server

```bash
cd D:\BAP\bap-backend
npm run dev
```

The server should start on `http://localhost:3001` (or your configured port).

Verify Socket.IO is running by checking the console output:
```
> Ready on http://localhost:3001
> Socket.IO server running
```

### 3. Get User Tokens

You need valid JWT tokens for two different users. You can get these by:

**Option A: Using existing users**
- Log in to your frontend as User 1, copy the token from localStorage
- Log in as User 2 in incognito mode, copy that token

**Option B: Using the API**
```bash
# Register/login user 1
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user1@test.com", "password": "password123"}'

# Register/login user 2
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user2@test.com", "password": "password123"}'
```

Save the tokens from the response.

### 4. Get or Create a Chat

You need a chat ID where both users are participants:

```bash
# Get user's chats
curl http://localhost:3001/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or create a new chat between the two users using your frontend.

## Testing Methods

### Method 1: Using the Test HTML Client (Recommended)

I've created a simple HTML test client. See `test-webrtc-client.html` in the backend directory.

**Steps:**

1. Open `test-webrtc-client.html` in two browser tabs
2. In Tab 1 (User 1):
   - Enter User 1's token
   - Enter the chat ID
   - Click "Connect"
   - Click "Initiate Call"

3. In Tab 2 (User 2):
   - Enter User 2's token
   - Enter the same chat ID
   - Click "Connect"
   - You should see "Incoming call from User 1"
   - Click "Accept Call"

4. Both users should now be connected in a voice call
5. Test the features:
   - Click "Toggle Mute" to mute/unmute
   - Check the connection status
   - Click "End Call" to disconnect

### Method 2: Using Browser Console

Open two browser tabs and run this code in the console:

**Tab 1 (Caller):**
```javascript
// Connect to Socket.IO
const socket = io('http://localhost:3001', {
  auth: { token: 'USER_1_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

// Listen for events
socket.on('call:ringing', (data) => {
  console.log('Call ringing:', data);
});

socket.on('call:accepted', async (data) => {
  console.log('Call accepted:', data);
  // Now create WebRTC connection (see full example in test client)
});

// Initiate call
socket.emit('call:initiate', {
  chatId: 'YOUR_CHAT_ID',
  callType: 'voice',
  targetUserIds: ['USER_2_ID']
}, (response) => {
  console.log('Call initiated:', response);
  window.sessionId = response.sessionId; // Save for later
});
```

**Tab 2 (Receiver):**
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'USER_2_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

// Listen for incoming call
socket.on('call:incoming', (data) => {
  console.log('Incoming call:', data);
  window.incomingCall = data; // Save for accepting

  // Accept the call
  socket.emit('call:accept', {
    sessionId: data.sessionId,
    chatId: data.chatId
  }, (response) => {
    console.log('Call accepted:', response);
  });
});
```

### Method 3: Using Postman + Browser

1. **Test Socket Events with Postman:**
   - Postman supports WebSocket testing
   - Connect to `ws://localhost:3001`
   - Send authentication in handshake
   - Send call events as JSON

2. **Test API Endpoints:**

```bash
# Get call history
curl http://localhost:3001/api/calls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get call statistics
curl http://localhost:3001/api/calls/stats?timeframe=30d \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific call
curl http://localhost:3001/api/calls/CALL_SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Test Scenarios

### Basic Call Flow

1. ✅ **Initiate Call**
   - User 1 initiates call
   - Verify User 2 receives `call:incoming` event
   - Check database has CallSession with status 'initiated'

2. ✅ **Accept Call**
   - User 2 accepts call
   - Verify User 1 receives `call:accepted` event
   - WebRTC offer/answer exchange
   - ICE candidates exchanged
   - Audio connection established

3. ✅ **Active Call**
   - Both users can hear each other
   - Mute/unmute works
   - Call quality metrics are tracked

4. ✅ **End Call**
   - Either user ends call
   - Both receive `call:ended` event
   - CallSession updated with duration
   - Cleanup happens correctly

### Edge Cases to Test

1. ✅ **Reject Call**
   ```javascript
   socket.emit('call:reject', {
     sessionId: 'SESSION_ID',
     chatId: 'CHAT_ID',
     reason: 'busy'
   });
   ```
   - Verify caller receives `call:rejected`
   - Check CallSession status is 'rejected'

2. ✅ **Missed Call**
   - Initiate call but don't answer
   - Wait 45 seconds
   - Verify `call:missed` event is emitted
   - Check CallSession status is 'missed'

3. ✅ **User Disconnects During Call**
   - Start a call
   - Close browser tab of one user
   - Verify other user receives `call:ended` or `call:participant-left`
   - Check call is properly cleaned up

4. ✅ **Multiple Participants** (Group Call)
   ```javascript
   socket.emit('call:initiate', {
     chatId: 'GROUP_CHAT_ID',
     callType: 'voice',
     targetUserIds: ['USER_2_ID', 'USER_3_ID']
   });
   ```
   - All participants receive call
   - Multiple users can join
   - Audio mixing works

5. ✅ **Duplicate Call Prevention**
   - Try to initiate second call in same chat
   - Should receive error: "Call already in progress"

6. ✅ **Call History**
   - Make several calls (accept, reject, miss some)
   - Query `/api/calls`
   - Verify all calls are logged correctly
   - Check statistics endpoint

## Debugging

### Check Socket Connection

```javascript
socket.on('connect', () => console.log('Connected'));
socket.on('connect_error', (err) => console.error('Connection error:', err));
socket.on('disconnect', () => console.log('Disconnected'));
```

### Monitor WebRTC Connection

```javascript
peerConnection.onconnectionstatechange = () => {
  console.log('Connection state:', peerConnection.connectionState);
};

peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE connection state:', peerConnection.iceConnectionState);
};

peerConnection.onicegatheringstatechange = () => {
  console.log('ICE gathering state:', peerConnection.iceGatheringState);
};
```

### Check Database

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/bap-workspace

# Check call sessions
db.callsessions.find().pretty()

# Check recent calls
db.callsessions.find().sort({createdAt: -1}).limit(5).pretty()

# Check call by session ID
db.callsessions.findOne({_id: ObjectId("SESSION_ID")})
```

### Server Logs

The backend logs helpful information:
- Socket connections/disconnections
- Call initiations
- Errors

Watch the server console for:
```
User connected: USER_ID (socket: SOCKET_ID)
Call initiated: SESSION_ID
Call accepted: SESSION_ID
```

## Common Issues

### No Audio

**Problem:** WebRTC connection established but no audio

**Solutions:**
1. Check microphone permissions in browser
2. Verify audio tracks are added to peer connection
3. Check browser console for media device errors
4. Test with `navigator.mediaDevices.getUserMedia({ audio: true })`

### Connection Fails

**Problem:** WebRTC connection fails to establish

**Solutions:**
1. Check STUN servers are accessible
2. Add TURN server credentials (required for restrictive networks)
3. Check firewall settings
4. Verify both clients can connect to Socket.IO server
5. Check browser console for ICE connection failures

### Call Not Ringing

**Problem:** Receiver doesn't get incoming call notification

**Solutions:**
1. Verify both users are in the same chat
2. Check Socket.IO connection is active
3. Verify receiver is connected to correct user room
4. Check server logs for event emission

### Database Errors

**Problem:** CallSession not being created

**Solutions:**
1. Verify MongoDB is running
2. Check database connection in server logs
3. Verify user IDs and chat IDs exist
4. Check for validation errors in server console

## Performance Testing

### Load Testing

Test with multiple concurrent calls:

```bash
# Use a tool like artillery or k6
# Example artillery config:
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: 'Voice Call'
    engine: 'socketio'
    flow:
      - emit:
          channel: 'call:initiate'
          data:
            chatId: 'CHAT_ID'
            callType: 'voice'
```

### Quality Metrics

Monitor call quality in real-time:

```javascript
// Get stats every second
setInterval(async () => {
  const stats = await peerConnection.getStats();
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      console.log('Packets lost:', report.packetsLost);
      console.log('Jitter:', report.jitter);
      console.log('Bitrate:', report.bytesReceived);
    }
  });
}, 1000);
```

## Success Criteria

✅ Call initiates successfully
✅ Receiver gets notification
✅ Call can be accepted/rejected
✅ Audio is clear and bidirectional
✅ Mute/unmute works
✅ Call ends cleanly
✅ Call history is recorded
✅ Disconnect handling works
✅ Multiple participants supported
✅ API endpoints return correct data

## Next Steps

After successful testing:

1. Integrate into your frontend application
2. Add UI components for call interface
3. Implement notification system
4. Add ringtone/sound effects
5. Configure TURN server for production
6. Set up call analytics dashboard
7. Add call recording (if needed)
8. Implement call quality feedback

## Support

If you encounter issues:

1. Check server logs
2. Check browser console
3. Verify MongoDB has CallSession documents
4. Test with the simple HTML client first
5. Ensure Socket.IO connection is stable
6. Try with TURN server configured
