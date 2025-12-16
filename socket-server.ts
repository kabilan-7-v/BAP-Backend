import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { jwtVerify } from 'jose';

const server = createServer();
const port = 3002;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');

interface AuthenticatedSocket extends SocketIOServer {
  userId?: string;
  userEmail?: string;
}

const io = new SocketIOServer(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Authentication middleware
io.use(async (socket: any, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('No token provided'));
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    socket.userId = payload.userId;
    socket.userEmail = payload.email;
    
    console.log('Socket authenticated for user:', socket.userId);
    next();
  } catch (err) {
    console.error('Socket auth error:', err);
    next(new Error('Invalid token'));
  }
});

// Import socket handlers after auth is set up
import('./src/socket').then(({ initializeSocketHandlers }) => {
  initializeSocketHandlers(io);
});

server.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
  console.log(`Using JWT_SECRET: ${process.env.JWT_SECRET ? 'Set' : 'Missing'}`);
});
