'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';

// ── Dashboard ──

export function useInstructorDashboard() {
  return useQuery({
    queryKey: ['instructor', 'dashboard'],
    queryFn: () => apiClient.get('/instructor/dashboard'),
    staleTime: 60_000,
  });
}

// ── Profile ──

export function useInstructorProfile() {
  return useQuery({
    queryKey: ['instructor', 'profile'],
    queryFn: () => apiClient.get('/instructor/profile'),
  });
}

export function useUpdateInstructorProfile() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.patch('/instructor/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'profile'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Application ──

export function useInstructorApplicationStatus() {
  return useQuery({
    queryKey: ['instructor', 'application'],
    queryFn: () => apiClient.get('/instructor/applications/me'),
  });
}
