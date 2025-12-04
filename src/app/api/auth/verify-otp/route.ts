import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, setAuthCookieOnResponse } from '@/lib/jwt';
import { formatUserResponse } from '@/utils/helpers';
import { ApiResponse, UserResponse } from '@/types';
import { z } from 'zod';

const verifyOtpSchema = z.object({
  email: z.string().email('Please enter a valid email').toLowerCase().trim(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    await connectDB();

    const body = await request.json();

    // Validate input
    const validationResult = verifyOtpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email, otp } = validationResult.data;

    // Find user with matching email
    const user = await User.findOne({
      email,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user || !user.emailVerificationToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired verification code',
        },
        { status: 400 }
      );
    }

    // Token is stored as "OTP:MAGIC_TOKEN" - extract OTP part
    const storedOtp = user.emailVerificationToken.split(':')[0];

    if (storedOtp !== otp) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid verification code',
        },
        { status: 400 }
      );
    }

    // Mark email as verified and clear OTP
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.lastLogin = new Date();

    // Auto-set isOnboarded for existing users (if not explicitly set)
    if (user.isOnboarded === undefined || user.isOnboarded === null) {
      user.isOnboarded = true;
    }

    await user.save();

    // Generate JWT and set cookie
    const token = await signToken({ userId: user._id.toString(), email: user.email });

    const response = NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: formatUserResponse(user),
      token, // Include token in response for frontend localStorage
    });

    return setAuthCookieOnResponse(response, token);
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during verification',
      },
      { status: 500 }
    );
  }
}
