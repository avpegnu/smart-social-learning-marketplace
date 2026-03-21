'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { useAuthStore } from '../stores/auth-store';
import { enrollmentService } from '../services/enrollment.service';

// ── Check Enrollment Status ──

export function useEnrollmentCheck(courseId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['enrollments', 'check', courseId],
    queryFn: () => enrollmentService.check(courseId),
    enabled: !!courseId && isAuthenticated,
  });
}

// ── Enroll in Free Course ──

export function useEnrollFree() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => enrollmentService.enrollFree(courseId),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'check', courseId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'my-learning'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── My Learning (enrolled courses) ──

export function useMyLearning(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['enrollments', 'my-learning', params],
    queryFn: () => enrollmentService.getMyLearning(params),
  });
}
