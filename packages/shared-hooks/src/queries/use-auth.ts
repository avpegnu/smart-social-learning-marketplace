'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth-store';
import { useApiError } from '../use-api-error';
import { authService } from '../services/auth.service';
import type { LoginPayload, RegisterPayload, ResetPasswordPayload } from '../services/auth.service';

export function useLogin() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (data: LoginPayload) => authService.login(data),
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
    mutationFn: (data: RegisterPayload) => authService.register(data),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useVerifyEmail() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useResendVerification() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (email: string) => authService.resendVerification(email),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useForgotPassword() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useResetPassword() {
  const getErrorMessage = useApiError();

  return useMutation({
    mutationFn: (data: ResetPasswordPayload) => authService.resetPassword(data),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Always logout locally, even if API fails
      useAuthStore.getState().logout();
      // Clear all cached data from previous user
      queryClient.clear();
    },
  });
}
