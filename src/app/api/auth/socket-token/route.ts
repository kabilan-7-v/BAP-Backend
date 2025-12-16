import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndUser } from '@/middleware/auth';
import { getAuthCookie } from '@/lib/jwt';

// GET /api/auth/socket-token - Get existing JWT for WebSocket authentication
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      // Get the existing JWT token (same one used for HTTP requests)
      const token = await getAuthCookie() || 
                   req.headers.get('authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'No token found' },
          { status: 401 }
        );
      }

      // Token expires in 7 days (same as HTTP JWT)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      return NextResponse.json({
        success: true,
        token,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('Error getting socket token:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get token' },
        { status: 500 }
      );
    }
  });
}
