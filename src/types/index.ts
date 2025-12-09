export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin' | 'viewer';
  provider: 'local' | 'google';
  isEmailVerified: boolean;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface GoogleAuthInput {
  credential: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface VerifyEmailInput {
  token: string;
}
