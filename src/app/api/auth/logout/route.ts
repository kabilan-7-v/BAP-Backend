import { NextResponse } from 'next/server';
import { removeAuthCookieOnResponse } from '@/lib/jwt';
import { ApiResponse } from '@/types';

export async function POST(): Promise<NextResponse<ApiResponse>> {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    return removeAuthCookieOnResponse(response);
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during logout',
      },
      { status: 500 }
    );
  }
}
