import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, generateMagicLinkEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, getFrontendUrl } from '@/utils/helpers';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    await connectDB();

    const body = await request.json();

    // Validate input (reuse forgotPasswordSchema since it's just email)
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

    // Check if user exists
    const existingUser = await User.findOne({ email });

    // Generate verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log token for development (remove in production)
    console.log(`[DEV] Magic link token for ${email}: ${verificationToken}`);

    if (existingUser) {
      // User exists - send magic link to login/verify
      const magicLinkUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      // Send email FIRST
      const emailSent = await sendEmail({
        to: email,
        subject: 'Sign in to BAP Workspace',
        html: generateMagicLinkEmail(existingUser.fullName || 'there', magicLinkUrl, false),
      });

      if (!emailSent) {
        console.error('Failed to send magic link email to', email);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send verification email. Please try again.',
          },
          { status: 500 }
        );
      }

      // Email sent successfully, now save token to database
      existingUser.emailVerificationToken = verificationToken;
      existingUser.emailVerificationExpires = verificationExpires;
      await existingUser.save();
    } else {
      // User doesn't exist - send signup link first
      const signupUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&new=true`;

      // Send email FIRST
      const emailSent = await sendEmail({
        to: email,
        subject: 'Complete your BAP Workspace signup',
        html: generateMagicLinkEmail('there', signupUrl, true),
      });

      if (!emailSent) {
        console.error('Failed to send signup link email to', email);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send verification email. Please try again.',
          },
          { status: 500 }
        );
      }

      // Email sent successfully, now create user
      await User.create({
        fullName: email.split('@')[0],
        email,
        provider: 'local',
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification link sent to your email',
    });
  } catch (error: any) {
    console.error('Send link error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, generateMagicLinkEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, getFrontendUrl } from '@/utils/helpers';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    await connectDB();

    const body = await request.json();

    // Validate input (reuse forgotPasswordSchema since it's just email)
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

    // Check if user exists
    const existingUser = await User.findOne({ email });

    // Generate verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log token for development (remove in production)
    console.log(`[DEV] Magic link token for ${email}: ${verificationToken}`);

    if (existingUser) {
      // User exists - send magic link to login/verify
      const magicLinkUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      // Send email FIRST
      const emailSent = await sendEmail({
        to: email,
        subject: 'Sign in to BAP Workspace',
        html: generateMagicLinkEmail(existingUser.fullName || 'there', magicLinkUrl, false),
      });

      if (!emailSent) {
        console.error('Failed to send magic link email to', email);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send verification email. Please try again.',
          },
          { status: 500 }
        );
      }

      // Email sent successfully, now save token to database
      existingUser.emailVerificationToken = verificationToken;
      existingUser.emailVerificationExpires = verificationExpires;
      await existingUser.save();
    } else {
      // User doesn't exist - send signup link first
      const signupUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&new=true`;

      // Send email FIRST
      const emailSent = await sendEmail({
        to: email,
        subject: 'Complete your BAP Workspace signup',
        html: generateMagicLinkEmail('there', signupUrl, true),
      });

      if (!emailSent) {
        console.error('Failed to send signup link email to', email);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send verification email. Please try again.',
          },
          { status: 500 }
        );
      }

      // Email sent successfully, now create user
      await User.create({
        fullName: email.split('@')[0],
        email,
        provider: 'local',
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification link sent to your email',
    });
  } catch (error: any) {
    console.error('Send link error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
