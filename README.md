# BAP Backend

A powerful, real-time backend API service built with **Next.js 14**, **Socket.IO**, and **MongoDB**. This backend powers the BAP (Business Automation Platform) with features including real-time messaging, voice-to-text transcription, video calls, and AI-powered input processing.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-8.7-green?logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black?logo=socket.io)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)

---

## ✨ Features

- **🔐 Authentication** - JWT-based authentication with Google OAuth support
- **💬 Real-time Messaging** - Socket.IO powered chat with typing indicators
- **🎤 Voice-to-Text** - Whisper-powered speech transcription via Groq API
- **📹 Video Calls** - WebRTC-based video calling with signaling server
- **📁 File Upload** - Multi-file upload with type validation
- **🤖 Input Agent** - Multimodal input processing (text, voice, files)
- **📊 Audit Logging** - Comprehensive activity tracking
- **🏷️ Labels & Organization** - Chat labeling and management

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB Atlas or local MongoDB instance
- Groq API Key (for voice transcription)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kabilan-7-v/BAP-Backend.git
   cd BAP-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   ```env
   # MongoDB Connection
   MONGODB_URI=your_mongodb_connection_string

   # Groq API Key (for voice transcription)
   GROQ_API_KEY=your_groq_api_key

   # JWT Secret
   JWT_SECRET=your_jwt_secret

   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   This starts:
   - Next.js API server on `http://localhost:3001`
   - Socket.IO server on `http://localhost:3002`

---

## 📁 Project Structure

```
BAP-Backend/
├── src/
│   ├── app/
│   │   └── api/              # Next.js API routes
│   │       ├── auth/         # Authentication endpoints
│   │       ├── calls/        # Voice/Video call management
│   │       ├── chats/        # Chat CRUD operations
│   │       ├── health/       # Health check endpoint
│   │       ├── input-agent/  # Multimodal input processing
│   │       ├── labels/       # Label management
│   │       ├── messages/     # Message operations
│   │       ├── upload/       # File upload handling
│   │       └── users/        # User management
│   ├── lib/                  # Database & utility libraries
│   ├── middleware/           # Authentication middleware
│   ├── models/               # MongoDB/Mongoose models
│   ├── services/             # Business logic services
│   ├── socket/               # Socket.IO event handlers
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── socket-server/            # Standalone Socket.IO server
├── server.ts                 # Production server entry
└── socket-server.ts          # Socket server entry
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/google` | Google OAuth login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/forgot-password` | Password reset request |

### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats` | List all chats |
| POST | `/api/chats` | Create new chat |
| GET | `/api/chats/[chatId]` | Get chat by ID |
| PUT | `/api/chats/[chatId]` | Update chat |
| DELETE | `/api/chats/[chatId]` | Delete chat |
| GET | `/api/chats/[chatId]/messages` | Get chat messages |
| POST | `/api/chats/[chatId]/messages` | Send message |

### Input Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/input-agent/text` | Process text input |
| POST | `/api/input-agent/voice/start` | Start voice session |
| POST | `/api/input-agent/voice/end` | End voice session |
| POST | `/api/input-agent/voice/whisper` | Whisper transcription |
| POST | `/api/input-agent/file` | Upload files |
| POST | `/api/input-agent/multimodal` | Process multimodal input |
| GET | `/api/input-agent/envelope` | Get input envelopes |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calls` | Initiate a call |
| GET | `/api/calls/[callId]` | Get call details |
| GET | `/api/calls/stats` | Get call statistics |

---

## 🔊 Socket.IO Events

### Connection
```javascript
// Connect with authentication
const socket = io('http://localhost:3002', {
  auth: { token: 'your_jwt_token' }
});
```

### Voice Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `input:voice:start` | Client → Server | Start voice session |
| `input:voice:chunk` | Client → Server | Send audio chunk |
| `input:voice:end` | Client → Server | End voice session |
| `input:voice:transcript` | Server → Client | Receive transcription |

### Text Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `input:text:send` | Client → Server | Send text message |
| `input:text:processed` | Server → Client | Message processed |

### Video Call Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `call:offer` | Client → Server | Send WebRTC offer |
| `call:answer` | Server → Client | Receive WebRTC answer |
| `call:ice-candidate` | Bidirectional | Exchange ICE candidates |

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (API + Socket) |
| `npm run dev:api` | Start only Next.js API server |
| `npm run dev:socket` | Start only Socket.IO server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 📦 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 |
| **Language** | TypeScript 5.6 |
| **Database** | MongoDB + Mongoose 8.7 |
| **Real-time** | Socket.IO 4.8 |
| **Authentication** | JWT + Google OAuth |
| **AI/ML** | Groq Whisper API |
| **Validation** | Zod |
| **Email** | Nodemailer |

---

## 🔒 Security

- **JWT Authentication** - Token-based authentication with secure cookies
- **Password Hashing** - bcryptjs for secure password storage
- **Input Validation** - Zod schema validation on all endpoints
- **CORS** - Configurable cross-origin resource sharing
- **Environment Variables** - Sensitive data stored in environment files

---

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Secret for JWT signing | ✅ |
| `GROQ_API_KEY` | Groq API key for Whisper | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ |
| `PLANNER_AGENT_URL` | Planner Agent service URL | ❌ |
| `FILE_STORAGE_URL` | File storage service URL | ❌ |

---

## 📄 License

This project is private and proprietary.

---

## 👤 Author

**Kabilan V**
- GitHub: [@kabilan-7-v](https://github.com/kabilan-7-v)
- Email: kabilanvelmani@gmail.com
