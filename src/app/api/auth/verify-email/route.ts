import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, setAuthCookie } from '@/lib/jwt';
import { getFrontendUrl, formatUserResponse } from '@/utils/helpers';
import { ApiResponse, UserResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse> | Response> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Verification token is required',
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
      // Redirect to frontend with error
      return NextResponse.redirect(
        `${getFrontendUrl()}/verify-email?status=error&message=Invalid or expired verification token`
      );
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.lastLogin = new Date();

    // Auto-set isOnboarded for existing users (if not explicitly set)
    if (user.isOnboarded === undefined || user.isOnboarded === null) {
      user.isOnboarded = true;
    }

    await user.save();

    // Generate JWT and set cookie for auto-login
    const jwtToken = await signToken({ userId: user._id.toString(), email: user.email });

    // Create redirect response with cookie - include isOnboarded for frontend routing
    const redirectUrl = `${getFrontendUrl()}/verify-email?status=success&isOnboarded=${user.isOnboarded}`;
    const response = NextResponse.redirect(redirectUrl);

    // Set auth cookie
    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(
      `${getFrontendUrl()}/verify-email?status=error&message=An error occurred during verification`
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Verification token is required',
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
          error: 'Invalid or expired verification token',
        },
        { status: 400 }
      );
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.lastLogin = new Date();

    // Auto-set isOnboarded for existing users (if not explicitly set)
    if (user.isOnboarded === undefined || user.isOnboarded === null) {
      user.isOnboarded = true;
    }

    await user.save();

    // Generate JWT and set cookie for auto-login
    const jwtToken = await signToken({ userId: user._id.toString(), email: user.email });
    await setAuthCookie(jwtToken);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: formatUserResponse(user),
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during verification',
      },
      { status: 500 }
    );
  }
}
