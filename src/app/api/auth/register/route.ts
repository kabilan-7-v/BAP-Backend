import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, setAuthCookie } from '@/lib/jwt';
import { sendEmail, generateVerificationEmail } from '@/lib/email';
import { registerSchema } from '@/lib/validation';
import { generateToken, formatUserResponse, getBaseUrl } from '@/utils/helpers';
import { ApiResponse, UserResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
  try {
    await connectDB();

    const body = await request.json();

    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { fullName, companyName, email, password } = validationResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists',
        },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = await User.create({
      fullName,
      companyName,
      email,
      password,
      provider: 'local',
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Send verification email
    const verificationUrl = `${getBaseUrl()}/api/auth/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'Verify your BAP Workspace email',
      html: generateVerificationEmail(fullName, verificationUrl),
    });

    // Generate JWT and set cookie
    const token = await signToken({ userId: user._id.toString(), email: user.email });
    await setAuthCookie(token);

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        data: formatUserResponse(user),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during registration. Please try again.',
      },
      { status: 500 }
    );
  }
}
