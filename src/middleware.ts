import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
  'https://bap-workspace-p2wu.vercel.app',
  'https://bap-workspace.vercel.app',
].filter(Boolean) as string[];

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');

  // If the request origin is in our allowed list, return it
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  // Default fallback for development
  return 'http://localhost:3000';
}

export function middleware(request: NextRequest) {
  const corsOrigin = getCorsOrigin(request);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = NextResponse.next();

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', corsOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
