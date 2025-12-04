import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/jwt';
import { formatUserResponse } from '@/utils/helpers';
import { ApiResponse, UserResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    const tokenPayload = await getAuthenticatedUser(request);

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

    // Mark user as onboarded
    user.isOnboarded = true;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: formatUserResponse(user),
    });
  } catch (error: any) {
    console.error('Complete onboarding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while completing onboarding',
      },
      { status: 500 }
    );
  }
}
