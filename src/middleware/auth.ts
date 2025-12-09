import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/jwt';
import connectDB from '@/lib/mongodb';
import User, { IUser } from '@/models/User';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
  userData?: IUser;
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    // Create authenticated request
    const authRequest = request as AuthenticatedRequest;
    authRequest.user = payload;

    return handler(authRequest);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 401 }
    );
  }
}

export async function withAuthAndUser(
  request: NextRequest,
  handler: (req: AuthenticatedRequest, user: IUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    await connectDB();

    // Get user from database
    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Create authenticated request with user data
    const authRequest = request as AuthenticatedRequest;
    authRequest.user = payload;
    authRequest.userData = user;

    return handler(authRequest, user);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 401 }
    );
  }
}

// Role-based access control middleware
export async function withRole(
  request: NextRequest,
  allowedRoles: ('admin' | 'user' | 'viewer')[],
  handler: (req: AuthenticatedRequest, user: IUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuthAndUser(request, async (authRequest, user) => {
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User data not found',
        },
        { status: 401 }
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
        },
        { status: 403 }
      );
    }

    return handler(authRequest, user);
  });
}
