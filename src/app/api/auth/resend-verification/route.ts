import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/jwt';
import { sendEmail, generateVerificationEmail } from '@/lib/email';
import { generateToken, getBaseUrl } from '@/utils/helpers';
import { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse<ApiResponse>> {
  try {
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

    if (user.isEmailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is already verified',
        },
        { status: 400 }
      );
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log token for development (remove in production)
    console.log(`[DEV] Verification token for ${user.email}: ${verificationToken}`);

    // Send verification email FIRST
    const verificationUrl = `${getBaseUrl()}/api/auth/verify-email?token=${verificationToken}`;
    const emailSent = await sendEmail({
      to: user.email,
      subject: 'Verify your BAP Workspace email',
      html: generateVerificationEmail(user.fullName, verificationUrl),
    });

    if (!emailSent) {
      console.error('Failed to send verification email to', user.email);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send verification email',
        },
        { status: 500 }
      );
    }

    // Email sent successfully, now save token to database
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while sending verification email',
      },
      { status: 500 }
    );
  }
}
