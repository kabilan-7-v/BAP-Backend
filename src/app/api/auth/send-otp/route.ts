import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, generateMagicLinkEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, getFrontendUrl } from '@/utils/helpers';
import { checkRateLimit } from '@/utils/rateLimit';
import { ApiResponse } from '@/types';

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

    // Rate limiting: 3 requests per hour per email
    if (!checkRateLimit(`magic-link:${email}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again in an hour.',
        },
        { status: 429 }
      );
    }

    // Generate magic link token
    const magicLinkToken = generateToken();
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Check if user exists to get their name for email
    let user = await User.findOne({ email });
    const userName = user?.fullName || email.split('@')[0];

    // Create magic link URL
    const magicLinkUrl = `${getFrontendUrl()}/verify-email?token=${magicLinkToken}`;

    // Send email with ONLY magic link
    const emailSent = await sendEmail({
      to: email,
      subject: 'Sign in to BAP',
      html: generateMagicLinkEmail(userName, magicLinkUrl),
    });

    if (!emailSent) {
      console.error('Failed to send magic link email to', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send magic link. Please try again.',
        },
        { status: 500 }
      );
    }

    // Store token in database
    if (user) {
      user.emailVerificationToken = magicLinkToken;
      user.emailVerificationExpires = tokenExpires;
      await user.save();
    } else {
      user = await User.create({
        fullName: userName,
        email,
        provider: 'local',
        isEmailVerified: false,
        isOnboarded: false,
        emailVerificationToken: magicLinkToken,
        emailVerificationExpires: tokenExpires,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Magic link sent to your email',
    });
  } catch (error: any) {
    console.error('Send magic link error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
