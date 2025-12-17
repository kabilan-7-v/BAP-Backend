# WebRTC Voice Call Implementation

This document describes the WebRTC voice call implementation for the chat application.

## Overview

The implementation provides:
- **Voice calls** with high-quality audio
- **Video calls** support (infrastructure ready)
- **Call history** tracking and management
- **Call quality** monitoring
- **Multi-participant** support (group calls)
- **STUN/TURN** server configuration for NAT traversal

## Architecture

### Backend Components

1. **CallSession Model** (`src/models/CallSession.ts`)
   - Tracks call sessions in MongoDB
   - Stores call metadata, participants, duration, quality metrics
   - Automatic duration calculation

2. **CallManager** (`src/utils/callManager.ts`)
   - Manages active call sessions
   - Handles call lifecycle (initiate, accept, reject, end)
   - Tracks participants and call state
   - Implements ring timeout and missed call detection

3. **WebRTC Config** (`src/lib/webrtc-config.ts`)
   - STUN/TURN server configuration
   - Media constraints for voice/video
   - Quality thresholds
   - Timeout configurations

4. **Socket Handlers** (`src/socket/index.ts`)
   - WebRTC signaling events
   - Call state management
   - Participant notifications

5. **API Endpoints**
   - `GET /api/calls` - Fetch call history
   - `GET /api/calls/[id]` - Get specific call details
   - `GET /api/calls/stats` - Get call statistics

## Socket Events

### Client → Server Events

#### 1. Get WebRTC Configuration
```typescript
socket.emit('webrtc:config:get', (response) => {
  console.log(response.config); // RTCConfiguration object
});
```

#### 2. Initiate a Call
```typescript
socket.emit('call:initiate', {
  chatId: 'chat-id',
  callType: 'voice', // or 'video'
  targetUserIds: ['user-id-1', 'user-id-2'] // optional, defaults to all chat participants
}, (response) => {
  if (response.success) {
    console.log('Call initiated:', response.sessionId);
  } else {
    console.error('Error:', response.error);
  }
});
```

#### 3. Accept a Call
```typescript
socket.emit('call:accept', {
  sessionId: 'call-session-id',
  chatId: 'chat-id'
}, (response) => {
  if (response.success) {
    console.log('Call accepted');
  }
});
```

#### 4. Reject a Call
```typescript
socket.emit('call:reject', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  reason: 'busy' // optional
}, (response) => {
  if (response.success) {
    console.log('Call rejected');
  }
});
```

#### 5. Send WebRTC Offer
```typescript
socket.emit('webrtc:offer', {
  sessionId: 'call-session-id',
  targetUserId: 'target-user-id',
  offer: rtcOffer, // RTCSessionDescriptionInit
  chatId: 'chat-id'
});
```

#### 6. Send WebRTC Answer
```typescript
socket.emit('webrtc:answer', {
  sessionId: 'call-session-id',
  targetUserId: 'target-user-id',
  answer: rtcAnswer, // RTCSessionDescriptionInit
  chatId: 'chat-id'
});
```

#### 7. Send ICE Candidate
```typescript
socket.emit('webrtc:ice-candidate', {
  sessionId: 'call-session-id',
  targetUserId: 'target-user-id',
  candidate: iceCandidate, // RTCIceCandidateInit
  chatId: 'chat-id'
});
```

#### 8. Update Call Quality
```typescript
socket.emit('call:quality', {
  sessionId: 'call-session-id',
  quality: {
    avgBitrate: 128000,
    packetLoss: 0.5,
    jitter: 20
  }
});
```

#### 9. Toggle Audio
```typescript
socket.emit('call:toggle-audio', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  muted: true
});
```

#### 10. Toggle Video
```typescript
socket.emit('call:toggle-video', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  enabled: false
});
```

#### 11. End Call
```typescript
socket.emit('call:end', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  reason: 'completed' // optional
}, (response) => {
  if (response.success) {
    console.log('Call ended');
  }
});
```

#### 12. Leave Call (without ending for others)
```typescript
socket.emit('call:leave', {
  sessionId: 'call-session-id',
  chatId: 'chat-id'
}, (response) => {
  if (response.success) {
    console.log('Left call');
  }
});
```

### Server → Client Events

#### 1. Incoming Call
```typescript
socket.on('call:incoming', (data) => {
  console.log('Incoming call:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   callType: 'voice',
  //   callerId: 'caller-user-id',
  //   callerName: 'John Doe',
  //   callerAvatar: 'avatar-url'
  // }
});
```

#### 2. Call Ringing
```typescript
socket.on('call:ringing', (data) => {
  console.log('Call ringing:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   targetUserIds: ['user-id-1']
  // }
});
```

#### 3. Call Accepted
```typescript
socket.on('call:accepted', (data) => {
  console.log('Call accepted:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   acceptedBy: 'user-id'
  // }
});
```

#### 4. Call Rejected
```typescript
socket.on('call:rejected', (data) => {
  console.log('Call rejected:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   rejectedBy: 'user-id',
  //   reason: 'declined'
  // }
});
```

#### 5. Call Missed
```typescript
socket.on('call:missed', (data) => {
  console.log('Call missed:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   callerId: 'caller-user-id'
  // }
});
```

#### 6. Call Ended
```typescript
socket.on('call:ended', (data) => {
  console.log('Call ended:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   endedBy: 'user-id',
  //   reason: 'completed'
  // }
});
```

#### 7. Participant Joined
```typescript
socket.on('call:participant-joined', (data) => {
  console.log('Participant joined:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   userId: 'user-id'
  // }
});
```

#### 8. Participant Left
```typescript
socket.on('call:participant-left', (data) => {
  console.log('Participant left:', data);
  // {
  //   sessionId: 'call-session-id',
  //   chatId: 'chat-id',
  //   userId: 'user-id',
  //   reason: 'disconnected'
  // }
});
```

#### 9. WebRTC Offer
```typescript
socket.on('webrtc:offer', (data) => {
  console.log('Received WebRTC offer:', data);
  // {
  //   sessionId: 'call-session-id',
  //   offer: RTCSessionDescriptionInit,
  //   chatId: 'chat-id',
  //   fromUserId: 'user-id'
  // }
});
```

#### 10. WebRTC Answer
```typescript
socket.on('webrtc:answer', (data) => {
  console.log('Received WebRTC answer:', data);
  // {
  //   sessionId: 'call-session-id',
  //   answer: RTCSessionDescriptionInit,
  //   chatId: 'chat-id',
  //   fromUserId: 'user-id'
  // }
});
```

#### 11. ICE Candidate
```typescript
socket.on('webrtc:ice-candidate', (data) => {
  console.log('Received ICE candidate:', data);
  // {
  //   sessionId: 'call-session-id',
  //   candidate: RTCIceCandidateInit,
  //   chatId: 'chat-id',
  //   fromUserId: 'user-id'
  // }
});
```

#### 12. Participant Audio Toggle
```typescript
socket.on('call:participant-audio-toggle', (data) => {
  console.log('Participant toggled audio:', data);
  // {
  //   sessionId: 'call-session-id',
  //   userId: 'user-id',
  //   muted: true
  // }
});
```

#### 13. Participant Video Toggle
```typescript
socket.on('call:participant-video-toggle', (data) => {
  console.log('Participant toggled video:', data);
  // {
  //   sessionId: 'call-session-id',
  //   userId: 'user-id',
  //   enabled: false
  // }
});
```

## API Endpoints

### 1. Get Call History

```typescript
GET /api/calls?chatId=xxx&type=voice&status=ended&limit=50&offset=0

Response:
{
  success: true,
  data: {
    calls: [
      {
        id: 'call-id',
        chatId: { ... },
        callType: 'voice',
        status: 'ended',
        isIncoming: false,
        isOutgoing: true,
        caller: { ... },
        participants: [ ... ],
        userStatus: 'joined',
        initiatedAt: '2025-01-01T00:00:00.000Z',
        startedAt: '2025-01-01T00:00:05.000Z',
        endedAt: '2025-01-01T00:05:30.000Z',
        duration: 325,
        endReason: 'completed',
        quality: { ... }
      }
    ],
    pagination: {
      total: 100,
      limit: 50,
      offset: 0,
      hasMore: true
    }
  }
}
```

### 2. Get Call Details

```typescript
GET /api/calls/[id]

Response:
{
  success: true,
  data: {
    id: 'call-id',
    chatId: { ... },
    callType: 'voice',
    status: 'ended',
    isIncoming: false,
    isOutgoing: true,
    caller: { ... },
    participants: [ ... ],
    userStatus: 'joined',
    initiatedAt: '2025-01-01T00:00:00.000Z',
    startedAt: '2025-01-01T00:00:05.000Z',
    endedAt: '2025-01-01T00:05:30.000Z',
    duration: 325,
    endReason: 'completed',
    quality: {
      avgBitrate: 128000,
      packetLoss: 0.5,
      jitter: 20
    }
  }
}
```

### 3. Get Call Statistics

```typescript
GET /api/calls/stats?chatId=xxx&timeframe=30d

Response:
{
  success: true,
  data: {
    timeframe: '30d',
    stats: {
      total: 150,
      byType: {
        voice: 120,
        video: 30
      },
      byStatus: {
        ended: 100,
        missed: 30,
        rejected: 20
      },
      byDirection: {
        incoming: 75,
        outgoing: 75
      },
      totalDuration: 45000,
      averageDuration: 300,
      longestCall: 1800,
      shortestCall: 30,
      recentCalls: [ ... ]
    },
    callFrequency: {
      '2025-01-01': 5,
      '2025-01-02': 3,
      ...
    },
    quality: {
      avgPacketLoss: 0.5,
      avgJitter: 20,
      avgBitrate: 128000
    }
  }
}
```

## Environment Variables

Add these to your `.env.local` file:

```env
# Optional TURN server (for better connectivity in restricted networks)
TURN_SERVER=turn:turn.example.com:3478
TURN_USERNAME=username
TURN_CREDENTIAL=credential
```

## Frontend Implementation Guide

### 1. Setup WebRTC Connection

```typescript
import { io, Socket } from 'socket.io-client';

class VoiceCallManager {
  private socket: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private sessionId: string | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  private async setupSocketListeners() {
    // Get WebRTC config from server
    this.socket.emit('webrtc:config:get', async ({ config }) => {
      this.peerConnection = new RTCPeerConnection(config);
      this.setupPeerConnectionListeners();
    });

    // Handle incoming call
    this.socket.on('call:incoming', this.handleIncomingCall.bind(this));

    // Handle call accepted
    this.socket.on('call:accepted', this.handleCallAccepted.bind(this));

    // Handle WebRTC offer
    this.socket.on('webrtc:offer', this.handleOffer.bind(this));

    // Handle WebRTC answer
    this.socket.on('webrtc:answer', this.handleAnswer.bind(this));

    // Handle ICE candidate
    this.socket.on('webrtc:ice-candidate', this.handleIceCandidate.bind(this));

    // Handle call ended
    this.socket.on('call:ended', this.handleCallEnded.bind(this));
  }

  private setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc:ice-candidate', {
          sessionId: this.sessionId,
          targetUserId: this.targetUserId,
          candidate: event.candidate,
          chatId: this.chatId,
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      // Attach to audio element
      const audioElement = document.getElementById('remote-audio') as HTMLAudioElement;
      if (audioElement) {
        audioElement.srcObject = this.remoteStream;
      }
    };
  }

  async initiateCall(chatId: string, targetUserIds: string[]) {
    // Get local audio stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    // Add tracks to peer connection
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // Initiate call
    this.socket.emit('call:initiate', {
      chatId,
      callType: 'voice',
      targetUserIds,
    }, (response) => {
      if (response.success) {
        this.sessionId = response.sessionId;
      }
    });
  }

  async handleIncomingCall(data: any) {
    this.sessionId = data.sessionId;
    this.chatId = data.chatId;
    this.targetUserId = data.callerId;

    // Show incoming call UI
    // User accepts or rejects
  }

  async acceptCall() {
    // Get local audio stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Add tracks
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // Accept call
    this.socket.emit('call:accept', {
      sessionId: this.sessionId,
      chatId: this.chatId,
    });
  }

  async handleCallAccepted(data: any) {
    // Create and send offer
    const offer = await this.peerConnection?.createOffer();
    await this.peerConnection?.setLocalDescription(offer);

    this.socket.emit('webrtc:offer', {
      sessionId: this.sessionId,
      targetUserId: data.acceptedBy,
      offer: offer,
      chatId: this.chatId,
    });
  }

  async handleOffer(data: any) {
    await this.peerConnection?.setRemoteDescription(data.offer);

    // Create answer
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);

    this.socket.emit('webrtc:answer', {
      sessionId: data.sessionId,
      targetUserId: data.fromUserId,
      answer: answer,
      chatId: data.chatId,
    });
  }

  async handleAnswer(data: any) {
    await this.peerConnection?.setRemoteDescription(data.answer);
  }

  async handleIceCandidate(data: any) {
    await this.peerConnection?.addIceCandidate(data.candidate);
  }

  endCall() {
    this.socket.emit('call:end', {
      sessionId: this.sessionId,
      chatId: this.chatId,
    });

    this.cleanup();
  }

  private cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    this.localStream = null;
    this.remoteStream = null;
    this.sessionId = null;
  }

  handleCallEnded(data: any) {
    this.cleanup();
    // Update UI
  }

  toggleMute() {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.socket.emit('call:toggle-audio', {
        sessionId: this.sessionId,
        chatId: this.chatId,
        muted: !audioTrack.enabled,
      });
    }
  }
}
```

## Call Flow

### Outgoing Call Flow

1. User initiates call → `call:initiate`
2. Server creates CallSession and notifies target users → `call:incoming`
3. Target accepts → `call:accept`
4. Server notifies caller → `call:accepted`
5. Caller creates WebRTC offer → `webrtc:offer`
6. Target receives offer, creates answer → `webrtc:answer`
7. Both exchange ICE candidates → `webrtc:ice-candidate`
8. WebRTC connection established
9. Either party ends call → `call:end`
10. Server notifies all participants → `call:ended`

### Incoming Call Flow

1. Receive `call:incoming` event
2. Show incoming call UI
3. User accepts → `call:accept`
4. Receive `webrtc:offer`
5. Create and send answer → `webrtc:answer`
6. Exchange ICE candidates
7. Connection established

## Features

- Call history tracking with full metadata
- Call quality monitoring (bitrate, packet loss, jitter)
- Missed call detection (45-second timeout)
- Multi-device support
- Automatic cleanup on disconnect
- Group call support
- Mute/unmute functionality
- Call statistics and analytics

## Testing

To test the implementation:

1. Start the backend server
2. Connect two clients with Socket.IO
3. Initiate a voice call from one client
4. Accept on the other client
5. Verify audio connection
6. Test mute/unmute
7. End call and verify cleanup

## Troubleshooting

### No audio
- Check microphone permissions
- Verify STUN/TURN servers are accessible
- Check browser console for WebRTC errors

### Connection fails
- Add TURN server credentials
- Check firewall settings
- Verify both clients can connect to Socket.IO server

### Call quality issues
- Monitor quality metrics in call stats API
- Check network conditions
- Adjust audio constraints
