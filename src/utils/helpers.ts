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
