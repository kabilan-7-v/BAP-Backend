import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/jwt';
import { formatUserResponse } from '@/utils/helpers';
import { ApiResponse, UserResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    // Debugging: log incoming origin and cookie header so we can see whether
    // the browser sent the auth cookie with the request.
    console.info('GET /api/auth/me - Origin:', request.headers.get('origin'));
    console.info('GET /api/auth/me - Cookie header:', request.headers.get('cookie'));

    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById(tokenPayload.userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatUserResponse(user),
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while fetching user data',
      },
      { status: 500 }
    );
  }
}
