
# 🎤 Real-Time Voice-to-Text Testing Guide

## Overview
Your system now has **real-time voice-to-text conversion** with live backend console logging. This guide will help you test the complete flow.

---

## ✅ What's Already Implemented

### Backend (D:\BAP\BAP-Backend)
- ✅ **Real-time socket handlers** for voice transcription
- ✅ **Console logging** for all voice & text messages
- ✅ **Input Agent infrastructure** fully operational

### Frontend (D:\BAP\bap-workspace\bap-frontend)
- ✅ **Web Speech API integration** (just added!)
- ✅ **MediaRecorder** for audio capture
- ✅ **Socket.IO client** connected to backend
- ✅ **SuperAssistant UI** with voice controls

---

## 🚀 How to Test

### Step 1: Start the Backend Server

```bash
cd D:\BAP\BAP-Backend
npm run dev
```

This starts:
- Next.js API on port **3001**
- Socket.IO server on port **3002**

**Expected output:**
```
Socket.IO handlers initialized
Input Agent socket handlers initialized
Socket server running on port 3002
```

### Step 2: Start the Frontend

Open a new terminal:

```bash
cd D:\BAP\bap-workspace\bap-frontend
npm run dev
```

This starts the frontend on port **3000**

### Step 3: Open SuperAssistant

1. Open your browser: `http://localhost:3000`
2. Log in to your account
3. Navigate to **Super Assistant** page
4. Click the **Voice Mode** button (microphone icon)

### Step 4: Test Real-Time Voice Input

1. **Click "Speak"** button in the voice chat interface
2. **Allow microphone access** when prompted
3. **Start speaking** - you should see:
   - Real-time transcription in the UI
   - Live console logs in your backend terminal

---

## 📺 Expected Backend Console Output

When you speak, you'll see real-time logs like this:

### Interim Transcripts (as you speak):
```
============================================================
🎤➡️📝 REAL-TIME VOICE INPUT (INTERIM)
============================================================
👤 User ID: 507f1f77bcf86cd799439011
🔗 Session: local_1734567890_abc123
💬 Text: "hello this is"
🎯 Confidence: 0.0%
📅 Time: 12/19/2025, 4:30:15 PM
============================================================
```

### Final Transcripts (when you pause):
```
============================================================
🎤➡️📝 REAL-TIME VOICE INPUT (FINAL)
============================================================
👤 User ID: 507f1f77bcf86cd799439011
🔗 Session: local_1734567890_abc123
💬 Text: "hello this is a test message"
🎯 Confidence: 92.5%
📅 Time: 12/19/2025, 4:30:18 PM
============================================================
```

### Recognition Status Updates:
```
============================================================
🎙️ SPEECH RECOGNITION STATUS: STARTED
============================================================
👤 User ID: 507f1f77bcf86cd799439011
📅 Time: 12/19/2025, 4:30:15 PM
============================================================
```

---

## 🎯 Key Features

### 1. **Real-Time Transcription**
- Uses **Web Speech API** (browser-based)
- Works in Chrome, Edge, Safari (with webkit prefix)
- Displays both **interim** (while speaking) and **final** transcripts

### 2. **Backend Console Logging**
Location: `src/socket/input-agent-handlers.ts:296-338`
- Logs every voice input in real-time
- Shows user ID, session ID, text, confidence
- Separate logs for interim vs final transcripts

### 3. **Dual Audio Processing**
- **Web Speech API** → Real-time text (for immediate display)
- **MediaRecorder** → Audio chunks (for future Whisper V3 integration)

---

## 🔧 Configuration

### Voice Configuration (Frontend)
Default settings in `lib/hooks/useInputAgent.ts:287-294`:
```typescript
{
  sample_rate: 16000,
  channels: 1,
  codec: 'opus',
  language: 'en-US',
  vad_enabled: true
}
```

### Backend Console Logging
Location: `src/socket/input-agent-handlers.ts:296-338`

You can customize the log format by editing:
```typescript
console.log('\n' + '='.repeat(60));
console.log(`🎤➡️📝 REAL-TIME VOICE INPUT ${is_final ? '(FINAL)' : '(INTERIM)'}`);
// ... customize your logging format here
```

---

## 🌐 Browser Compatibility

| Browser | Web Speech API | Status |
|---------|----------------|--------|
| Chrome  | ✅ Native      | Fully supported |
| Edge    | ✅ Native      | Fully supported |
| Safari  | ✅ webkit      | Fully supported |
| Firefox | ❌ Not supported | Will use audio-only mode |

---

## 📝 Text Messages Console Logging

Text messages also appear in the backend console!

Location: `src/socket/input-agent-handlers.ts:364-435`

**When you send a text message:**
```
============================================================
🤖 AGENT RESPONSE (Text Input)
============================================================
📦 Envelope ID: env_1734567890_xyz456
💬 Response: {"status": "success", "message": "..."}
📅 Time: 12/19/2025, 4:35:20 PM
============================================================
```

---

## 🐛 Troubleshooting

### Issue: No voice recognition
**Solution:**
- Check microphone permissions in browser
- Ensure you're using Chrome/Edge/Safari
- Check browser console for errors

### Issue: Backend console shows no logs
**Solution:**
- Verify Socket.IO server is running on port 3002
- Check frontend is connecting to correct WebSocket URL
- Look for connection errors in browser console

### Issue: "Backend unavailable" message
**Solution:**
- Ensure backend server is running (`npm run dev`)
- Check .env file has correct WebSocket URL
- Frontend will work in local-only mode (no backend logging)

---

## 🔌 Socket Events Reference

### Frontend → Backend Events:

```typescript
// Real-time transcript
socket.emit('input:voice:realtime-transcript', {
  session_id: string,
  text: string,
  is_final: boolean,
  confidence: number
})

// Recognition status
socket.emit('input:voice:recognition-status', {
  status: 'started' | 'stopped' | 'error',
  error?: string
})
```

### Backend → Frontend Events:

```typescript
// Transcript acknowledgment
socket.on('input:voice:transcript-received', {
  session_id: string,
  text: string,
  is_final: boolean,
  timestamp: string
})
```

---

## 📊 Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SuperAssistant UI                                    │   │
│  │  - Voice button                                       │   │
│  │  - Real-time transcript display                       │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Web Speech API (Real-time Transcription)            │   │
│  │  - Continuous recognition                             │   │
│  │  - Interim & final results                            │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Socket.IO Client                                     │   │
│  │  - Emits: input:voice:realtime-transcript             │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼─────────────────────────────────────┘
                      │
                      │ WebSocket (port 3002)
                      │
┌────────────────────▼─────────────────────────────────────┐
│                         BACKEND                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Socket.IO Server                                     ││
│  │  - Listens: input:voice:realtime-transcript           ││
│  │  - Handler: input-agent-handlers.ts:296               ││
│  └──────────────────┬───────────────────────────────────┘│
│                     │                                      │
│  ┌──────────────────▼───────────────────────────────────┐│
│  │  CONSOLE LOGGING                                      ││
│  │  🎤➡️📝 REAL-TIME VOICE INPUT                         ││
│  │  - User ID                                            ││
│  │  - Session ID                                         ││
│  │  - Transcript text                                    ││
│  │  - Confidence score                                   ││
│  │  - Timestamp                                          ││
│  └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## 🎉 Success Criteria

Your system is working correctly when you see:

1. ✅ Voice button activates in SuperAssistant UI
2. ✅ Real-time transcript appears in frontend
3. ✅ Backend console shows interim transcripts (as you speak)
4. ✅ Backend console shows final transcripts (when you pause)
5. ✅ Confidence scores displayed in console
6. ✅ Recognition status updates in console

---

## 📚 Next Steps

### Future Enhancements:
1. **Whisper V3 Integration** - Replace Web Speech API with Whisper for better accuracy
2. **Multi-language Support** - Add language detection and switching
3. **Speaker Diarization** - Identify different speakers in conversation
4. **Voice Commands** - Trigger specific actions via voice
5. **Transcript History** - Store and retrieve past voice sessions

---

## 🔐 Environment Variables

Make sure these are set in your `.env` files:

**Backend (.env):**
```env
PORT=3001
SOCKET_PORT=3002
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

---

## 📞 Support

If you encounter any issues:
1. Check browser console (F12) for frontend errors
2. Check backend terminal for server errors
3. Verify WebSocket connection is established
4. Ensure microphone permissions are granted

---

**Happy Testing! 🚀**
