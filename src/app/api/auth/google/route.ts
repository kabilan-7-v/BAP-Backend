import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, setAuthCookieOnResponse } from '@/lib/jwt';
import { formatUserResponse } from '@/utils/helpers';
import { googleAuthSchema } from '@/lib/validation';
import { ApiResponse, UserResponse } from '@/types';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = googleAuthSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { credential } = validationResult.data;

    // Verify Google token
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error('Google token verification failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Google credential',
        },
        { status: 401 }
      );
    }

    if (!payload || !payload.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not get user information from Google',
        },
        { status: 400 }
      );
    }

    const { email, name, picture, sub: googleId } = payload;

    await connectDB();

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { email },
        { provider: 'google', providerId: googleId },
      ],
    });

    if (user) {
      // If user exists with local provider, link Google account
      if (user.provider === 'local') {
        user.provider = 'google';
        user.providerId = googleId;
        user.isEmailVerified = true; // Google verifies email
        if (picture && !user.avatar) {
          user.avatar = picture;
        }
      }

      // Auto-set isOnboarded for existing users (if not explicitly set)
      if (user.isOnboarded === undefined || user.isOnboarded === null) {
        user.isOnboarded = true;
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user - needs onboarding
      user = await User.create({
        fullName: name || 'Google User',
        email,
        provider: 'google',
        providerId: googleId,
        avatar: picture,
        isEmailVerified: true, // Google verifies email
        isOnboarded: false, // New user needs onboarding
        lastLogin: new Date(),
      });
    }

    // Generate JWT and set cookie
    const token = await signToken({ userId: user._id.toString(), email: user.email });

    const response = NextResponse.json({
      success: true,
      message: 'Google authentication successful',
      data: formatUserResponse(user),
      token, // Include token in response for frontend localStorage
    });

    return setAuthCookieOnResponse(response, token);
  } catch (error: any) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during Google authentication',
      },
      { status: 500 }
    );
  }
}
