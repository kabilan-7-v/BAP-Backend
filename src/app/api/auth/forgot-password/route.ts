import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';
import { generateToken, getFrontendUrl } from '@/utils/helpers';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
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

    await connectDB();

    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user || user.provider !== 'local') {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Log token for development (remove in production)
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    // Send reset email FIRST
    const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
    const emailSent = await sendEmail({
      to: email,
      subject: 'Reset your BAP Workspace password',
      html: generatePasswordResetEmail(user.fullName, resetUrl),
    });

    if (!emailSent) {
      console.error('Failed to send password reset email to', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send password reset email. Please try again.',
        },
        { status: 500 }
      );
    }

    // Email sent successfully, now save token to database
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
