# Video Call Implementation

This document describes the Video Call feature implementation for the BAP application.

## Overview

The video call implementation provides:
- **HD Video calls** (up to 1080p)
- **Screen sharing** support
- **Multiple quality presets** (low, medium, high, HD)
- **Multi-participant video** (up to 16 participants)
- **Video layout management** (grid, spotlight, sidebar)
- **Real-time quality monitoring**
- **STUN/TURN server** configuration for NAT traversal

## Architecture

### Backend Components

1. **Video Call Config** (`src/lib/video-call-config.ts`)
   - Video quality presets (low, medium, high, HD)
   - Screen sharing constraints
   - Layout management utilities
   - Bandwidth estimation

2. **Video Call Handlers** (`src/socket/video-call-handlers.ts`)
   - Video-specific socket events
   - Screen sharing management
   - Quality control
   - Layout synchronization

3. **CallSession Model** (`src/models/CallSession.ts`)
   - Tracks call sessions with `callType: 'video'`
   - Stores participants, duration, quality metrics

4. **WebRTC Config** (`src/lib/webrtc-config.ts`)
   - STUN/TURN server configuration
   - Video offer options
   - Media constraints

## Socket Events

### Video Call Events (Client → Server)

#### 1. Initiate Video Call
```typescript
socket.emit('video:call:initiate', {
  chatId: 'chat-id',
  targetUserIds: ['user-id-1', 'user-id-2'],
  quality: 'high' // 'low' | 'medium' | 'high' | 'hd'
}, (response) => {
  if (response.success) {
    console.log('Call initiated:', response.sessionId);
    console.log('WebRTC config:', response.config);
    console.log('Video constraints:', response.constraints);
  }
});
```

#### 2. Accept Video Call
```typescript
socket.emit('video:call:accept', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  quality: 'high'
}, (response) => {
  if (response.success) {
    console.log('Call accepted');
    console.log('WebRTC config:', response.config);
  }
});
```

#### 3. Toggle Video
```typescript
socket.emit('video:toggle', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  enabled: false // true to enable, false to disable
});
```

#### 4. Toggle Audio
```typescript
socket.emit('video:audio:toggle', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  muted: true // true to mute, false to unmute
});
```

#### 5. Start Screen Sharing
```typescript
socket.emit('video:screenshare:start', {
  sessionId: 'call-session-id',
  chatId: 'chat-id'
}, (response) => {
  if (response.success) {
    console.log('Screen sharing started');
  } else {
    console.error(response.error); // e.g., "Another participant is already sharing"
  }
});
```

#### 6. Stop Screen Sharing
```typescript
socket.emit('video:screenshare:stop', {
  sessionId: 'call-session-id',
  chatId: 'chat-id'
});
```

#### 7. Change Video Quality
```typescript
socket.emit('video:quality:change', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  quality: 'medium' // 'low' | 'medium' | 'high' | 'hd'
}, (response) => {
  console.log('New constraints:', response.constraints);
});
```

#### 8. Change Layout
```typescript
socket.emit('video:layout:change', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  layout: {
    type: 'grid', // 'grid' | 'spotlight' | 'sidebar'
    participantsPerRow: 2
  }
});
```

#### 9. Spotlight Participant
```typescript
socket.emit('video:spotlight', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  targetUserId: 'user-to-spotlight'
});
```

#### 10. Get Video States
```typescript
socket.emit('video:states:get', {
  sessionId: 'call-session-id'
}, (response) => {
  console.log('Participant states:', response.states);
  // { 'user-id': { isVideoEnabled: true, isAudioEnabled: true, isScreenSharing: false, quality: 'high' } }
});
```

#### 11. End Video Call
```typescript
socket.emit('video:call:end', {
  sessionId: 'call-session-id',
  chatId: 'chat-id',
  reason: 'completed' // optional
}, (response) => {
  console.log('Call ended:', response.success);
});
```

#### 12. Leave Video Call
```typescript
socket.emit('video:call:leave', {
  sessionId: 'call-session-id',
  chatId: 'chat-id'
}, (response) => {
  console.log('Left call:', response.success);
});
```

### Video Call Events (Server → Client)

#### 1. Incoming Video Call
```typescript
socket.on('video:call:incoming', (data) => {
  console.log('Incoming video call:', data);
  // { sessionId, chatId, callType: 'video', callerId, callerName, callerAvatar, quality }
});
```

#### 2. Call Ringing
```typescript
socket.on('video:call:ringing', (data) => {
  console.log('Call ringing:', data);
  // { sessionId, chatId, targetUserIds }
});
```

#### 3. Call Accepted
```typescript
socket.on('video:call:accepted', (data) => {
  console.log('Call accepted:', data);
  // { sessionId, chatId, acceptedBy }
});
```

#### 4. Participant Joined
```typescript
socket.on('video:call:participant-joined', (data) => {
  console.log('Participant joined:', data);
  // { sessionId, chatId, userId, videoState }
});
```

#### 5. Participant Left
```typescript
socket.on('video:call:participant-left', (data) => {
  console.log('Participant left:', data);
  // { sessionId, chatId, userId, reason }
});
```

#### 6. Video/Audio Toggle
```typescript
socket.on('video:participant-toggle', (data) => {
  console.log('Toggle:', data);
  // { sessionId, userId, type: 'video'|'audio', enabled/muted }
});
```

#### 7. Screen Share Started
```typescript
socket.on('video:screenshare:started', (data) => {
  console.log('Screen sharing started:', data);
  // { sessionId, userId }
});
```

#### 8. Screen Share Stopped
```typescript
socket.on('video:screenshare:stopped', (data) => {
  console.log('Screen sharing stopped:', data);
  // { sessionId, userId }
});
```

#### 9. Quality Updated
```typescript
socket.on('video:quality:updated', (data) => {
  console.log('Quality updated:', data);
  // { sessionId, quality, constraints }
});
```

#### 10. Layout Updated
```typescript
socket.on('video:layout:updated', (data) => {
  console.log('Layout updated:', data);
  // { sessionId, layout, changedBy }
});
```

#### 11. Spotlight Changed
```typescript
socket.on('video:spotlight:changed', (data) => {
  console.log('Spotlight changed:', data);
  // { sessionId, spotlightUserId, changedBy }
});
```

#### 12. Call Ended
```typescript
socket.on('video:call:ended', (data) => {
  console.log('Call ended:', data);
  // { sessionId, chatId, endedBy, reason }
});
```

#### 13. Quality Warning
```typescript
socket.on('video:quality:warning', (data) => {
  console.log('Quality warning:', data);
  // { sessionId, message, suggestion }
});
```

## API Endpoints

### 1. Get Active Calls
```typescript
GET /api/calls/active?chatId=xxx

Response:
{
  success: true,
  data: {
    activeCalls: [
      {
        id: 'call-id',
        chatId: { ... },
        callType: 'video',
        status: 'ongoing',
        isIncoming: false,
        isOutgoing: true,
        caller: { ... },
        participants: [ ... ],
        userStatus: 'joined',
        initiatedAt: '2025-01-01T00:00:00.000Z',
        startedAt: '2025-01-01T00:00:05.000Z'
      }
    ],
    hasActiveCall: true
  }
}
```

### 2. Get Call History (with video filter)
```typescript
GET /api/calls?type=video&limit=50&offset=0
```

### 3. Get Call Details
```typescript
GET /api/calls/[id]
```

## Video Quality Presets

| Preset | Resolution | Frame Rate | Bitrate |
|--------|-----------|------------|---------|
| low    | 640x360   | 15 fps     | 500 kbps |
| medium | 854x480   | 24 fps     | 1 Mbps |
| high   | 1280x720  | 30 fps     | 2.5 Mbps |
| hd     | 1920x1080 | 30 fps     | 4 Mbps |

## Layout Types

1. **Grid** - Equal-sized video tiles arranged in a grid
2. **Spotlight** - One large video (speaker/screenshare) with smaller tiles
3. **Sidebar** - Main video with participants in a sidebar

## Frontend Implementation Guide

### Basic Video Call Manager

```typescript
import { io, Socket } from 'socket.io-client';

class VideoCallManager {
  private socket: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private chatId: string | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    // Handle incoming call
    this.socket.on('video:call:incoming', this.handleIncomingCall.bind(this));
    
    // Handle call accepted
    this.socket.on('video:call:accepted', this.handleCallAccepted.bind(this));
    
    // Handle participant joined
    this.socket.on('video:call:participant-joined', this.handleParticipantJoined.bind(this));
    
    // Handle participant left
    this.socket.on('video:call:participant-left', this.handleParticipantLeft.bind(this));
    
    // Handle video/audio toggles
    this.socket.on('video:participant-toggle', this.handleParticipantToggle.bind(this));
    
    // Handle screen share events
    this.socket.on('video:screenshare:started', this.handleScreenShareStarted.bind(this));
    this.socket.on('video:screenshare:stopped', this.handleScreenShareStopped.bind(this));
    
    // Handle call ended
    this.socket.on('video:call:ended', this.handleCallEnded.bind(this));
    
    // Handle WebRTC signaling
    this.socket.on('webrtc:offer', this.handleOffer.bind(this));
    this.socket.on('webrtc:answer', this.handleAnswer.bind(this));
    this.socket.on('webrtc:ice-candidate', this.handleIceCandidate.bind(this));
  }

  async initiateCall(chatId: string, targetUserIds: string[], quality: string = 'high') {
    this.chatId = chatId;
    
    // Get local video/audio stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
    });

    // Initiate call
    this.socket.emit('video:call:initiate', {
      chatId,
      targetUserIds,
      quality,
    }, (response: any) => {
      if (response.success) {
        this.sessionId = response.sessionId;
        // Create peer connections for each target
        this.createPeerConnections(targetUserIds, response.config);
      }
    });
  }

  async toggleVideo(enabled: boolean) {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
      this.socket.emit('video:toggle', {
        sessionId: this.sessionId,
        chatId: this.chatId,
        enabled,
      });
    }
  }

  async toggleAudio(muted: boolean) {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !muted;
      this.socket.emit('video:audio:toggle', {
        sessionId: this.sessionId,
        chatId: this.chatId,
        muted,
      });
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });

      // Replace video track in peer connections
      const screenTrack = this.screenStream.getVideoTracks()[0];
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
      });

      this.socket.emit('video:screenshare:start', {
        sessionId: this.sessionId,
        chatId: this.chatId,
      });

      // Handle screen share end
      screenTrack.onended = () => this.stopScreenShare();
    } catch (error) {
      console.error('Screen share failed:', error);
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;

      // Restore camera video
      const cameraTrack = this.localStream?.getVideoTracks()[0];
      if (cameraTrack) {
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(cameraTrack);
        });
      }

      this.socket.emit('video:screenshare:stop', {
        sessionId: this.sessionId,
        chatId: this.chatId,
      });
    }
  }

  endCall(reason?: string) {
    this.socket.emit('video:call:end', {
      sessionId: this.sessionId,
      chatId: this.chatId,
      reason,
    });
    this.cleanup();
  }

  private cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.localStream = null;
    this.screenStream = null;
    this.sessionId = null;
  }

  // ... implement other handlers
}
```

## Testing

1. Start the backend server
2. Connect two clients with Socket.IO
3. Initiate a video call from one client
4. Accept on the other client
5. Verify video/audio connection
6. Test screen sharing
7. Test video/audio toggling
8. Test quality changes
9. End call and verify cleanup

## Troubleshooting

### No video
- Check camera permissions
- Verify STUN/TURN servers are accessible
- Check browser console for WebRTC errors
- Ensure video constraints are supported

### Screen share not working
- Check screen sharing permissions
- Some browsers require HTTPS for screen sharing
- Verify getDisplayMedia is supported

### Poor video quality
- Lower the quality preset
- Check network bandwidth
- Monitor quality warnings from server
- Consider using TURN server for better connectivity

### Connection fails
- Add TURN server credentials
- Check firewall settings
- Verify both clients can connect to Socket.IO server
- Check ICE candidate gathering
