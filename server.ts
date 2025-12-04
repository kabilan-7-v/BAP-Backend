// Load environment variables FIRST before any imports that use them
import { config } from 'dotenv';
// Use .env.local for local dev, production uses system env vars
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' });
}

// Log to verify env is loaded
console.log('JWT_SECRET loaded:', !!process.env.JWT_SECRET);

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces
const port = parseInt(process.env.PORT || '3001', 10);

// Get frontend URL from env
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

console.log('Starting server...');
console.log('Frontend URL:', FRONTEND_URL);

app.prepare().then(async () => {
  // Dynamic import AFTER dotenv is loaded
  const { initializeSocketHandlers } = await import('./src/socket');

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO with CORS
  const io = new SocketIOServer(server, {
    cors: {
      origin: [
        FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'https://bap-workspace-0g6i.onrender.com',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Initialize socket handlers
  initializeSocketHandlers(io);

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Socket.IO server running`);
    console.log(`> CORS origin: ${FRONTEND_URL}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
