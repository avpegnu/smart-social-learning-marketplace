import { apiClient } from '@shared/api-client';

// --- Types ---

export interface LoginPayload {
  email: string;
  password: string;
  portal?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  avatarUrl: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// --- Service ---

export const authService = {
  login: (data: LoginPayload) => apiClient.post<AuthResponse>('/auth/login', data),

  register: (data: RegisterPayload) => apiClient.post('/auth/register', data),

  verifyEmail: (token: string) => apiClient.post('/auth/verify-email', { token }),

  resendVerification: (email: string) => apiClient.post('/auth/resend-verification', { email }),

  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (data: ResetPasswordPayload) => apiClient.post('/auth/reset-password', data),

  logout: (portal?: string) => apiClient.post(`/auth/logout?portal=${portal || 'student'}`),
};
