'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { instructorService } from '../services/instructor.service';

// ── Dashboard ──

export function useInstructorDashboard() {
  return useQuery({
    queryKey: ['instructor', 'dashboard'],
    queryFn: () => instructorService.getDashboard(),
    staleTime: 60_000,
  });
}

// ── Profile ──

export function useInstructorProfile() {
  return useQuery({
    queryKey: ['instructor', 'profile'],
    queryFn: () => instructorService.getProfile(),
  });
}

export function useUpdateInstructorProfile() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => instructorService.updateProfile(data),
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
    queryFn: () => instructorService.getApplicationStatus(),
  });
}
