import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateOTPFromToken } from '@/utils/helpers';
import { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token is required',
        },
        { status: 400 }
      );
    }

    await connectDB();

    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 400 }
      );
    }

    // Generate OTP deterministically from token
    const otp = generateOTPFromToken(token);

    return NextResponse.json({
      success: true,
      otp,
      email: user.email,
    });
  } catch (error: any) {
    console.error('Get OTP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
