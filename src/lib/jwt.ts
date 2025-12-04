import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'auth_token';

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
}

export async function signToken(payload: { userId: string; email: string }): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    console.log('verifyToken - token length:', token?.length, 'starts with:', token?.substring(0, 20));
    const { payload } = await jwtVerify(token, JWT_SECRET);
    console.log('verifyToken - success, userId:', payload.userId);
    return payload as TokenPayload;
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    console.error('Token was:', token?.substring(0, 50) + '...');
    return null;
  }
}

export function createAuthCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const secure = process.env.NODE_ENV === 'production';
  // Use SameSite=None for cross-origin requests (requires Secure in production)
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=${secure ? 'None' : 'Lax'}${secure ? '; Secure' : ''}`;
}

export function setAuthCookieOnResponse<T>(response: NextResponse<T>, token: string): NextResponse<T> {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    // Use SameSite=None for cross-origin requests (requires Secure in production)
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}

export function getAuthCookieFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  return cookie?.value || null;
}

export function removeAuthCookieOnResponse<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
  // Try cookie first
  let token = getAuthCookieFromRequest(request);

  // If no cookie, try Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;
  return verifyToken(token);
}
