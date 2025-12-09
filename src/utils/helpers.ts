import crypto from 'crypto';
import { IUser } from '@/models/User';
import { UserResponse } from '@/types';

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function formatUserResponse(user: IUser): UserResponse {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    provider: user.provider,
    isEmailVerified: user.isEmailVerified,
    isOnboarded: user.isOnboarded,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function getBaseUrl(): string {
  return process.env.APP_URL || 'http://localhost:3001';
}

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

// Generate deterministic OTP from token
export function generateOTPFromToken(token: string): string {
  const secretKey = process.env.JWT_SECRET || 'fallback-secret';
  const hash = crypto.createHmac('sha256', secretKey).update(token).digest('hex');
  const otp = hash.substring(0, 6).replace(/[^0-9]/g, '');
  return otp.padStart(6, '0');
}
