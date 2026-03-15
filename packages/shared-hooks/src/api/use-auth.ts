'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { useAuthStore } from '../stores/auth-store';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';

// --- Types ---

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
    avatarUrl: string | null;
  };
}

// --- Hooks ---

export function useLogin() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (data: LoginPayload) => apiClient.post<AuthResponse>('/auth/login', data),
    onSuccess: (res) => {
      useAuthStore.getState().setAuth(res.data.user, res.data.accessToken);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRegister() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (data: RegisterPayload) => apiClient.post('/auth/register', data),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useVerifyEmail() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (token: string) => apiClient.post('/auth/verify-email', { token }),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useResendVerification() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (email: string) => apiClient.post('/auth/resend-verification', { email }),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useForgotPassword() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (email: string) => apiClient.post('/auth/forgot-password', { email }),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useResetPassword() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (data: ResetPasswordPayload) => apiClient.post('/auth/reset-password', data),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      // Always logout locally, even if API fails
      useAuthStore.getState().logout();
    },
  });
}
