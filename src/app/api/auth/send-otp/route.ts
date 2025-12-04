import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, generateOtpEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, getFrontendUrl } from '@/utils/helpers';
import { ApiResponse } from '@/types';

// Generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    await connectDB();

    const body = await request.json();

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    // Generate OTP and magic link token
    const otp = generateOtp();
    const magicLinkToken = generateToken();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Log for development (remove in production)
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    console.log(`[DEV] Magic link token for ${email}: ${magicLinkToken}`);

    // Check if user exists to get their name for email
    let user = await User.findOne({ email });
    const userName = user?.fullName || email.split('@')[0];
    const isNewUser = !user;

    // Create magic link URL
    const magicLinkUrl = `${getFrontendUrl()}/verify-email?token=${magicLinkToken}&email=${encodeURIComponent(email)}${isNewUser ? '&new=true' : ''}`;

    // Send email with OTP and magic link FIRST before saving to database
    const emailSent = await sendEmail({
      to: email,
      subject: 'Your BAP Workspace verification code',
      html: generateOtpEmail(userName, otp, magicLinkUrl),
    });

    if (!emailSent) {
      console.error('Failed to send verification email to', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send verification email. Please try again.',
        },
        { status: 500 }
      );
    }

    // Email sent successfully, now save tokens to database
    // Store as "OTP:MAGIC_TOKEN" format so both verification methods work
    const combinedToken = `${otp}:${magicLinkToken}`;

    if (user) {
      // Update existing user
      user.emailVerificationToken = combinedToken;
      user.emailVerificationExpires = tokenExpires;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        fullName: userName,
        email,
        provider: 'local',
        isEmailVerified: false,
        isOnboarded: false,
        emailVerificationToken: combinedToken,
        emailVerificationExpires: tokenExpires,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
