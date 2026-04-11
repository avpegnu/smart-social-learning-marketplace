'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiTutorService } from '../services/ai-tutor.service';
import { useApiError } from '../use-api-error';

export function useAiQuota() {
  return useQuery({
    queryKey: ['ai-tutor', 'quota'],
    queryFn: () => aiTutorService.getQuota(),
  });
}

export function useAiSessions(courseId?: string) {
  return useQuery({
    queryKey: ['ai-tutor', 'sessions', courseId],
    queryFn: () => aiTutorService.getSessions(courseId),
  });
}

export function useSessionMessages(sessionId: string) {
  return useQuery({
    queryKey: ['ai-tutor', 'messages', sessionId],
    queryFn: () => aiTutorService.getSessionMessages(sessionId),
    enabled: !!sessionId,
  });
}

// ── Admin: AI Indexing ──

export function useIndexStatus() {
  return useQuery({
    queryKey: ['ai-tutor', 'index-status'],
    queryFn: () => aiTutorService.getIndexStatus(),
    // Auto-refresh every 30s so table stays current after indexing completes
    refetchInterval: 30_000,
  });
}

export function useIndexCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => aiTutorService.indexCourse(courseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-tutor', 'index-status'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useBulkIndexCourses() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseIds: string[]) => aiTutorService.bulkIndex(courseIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-tutor', 'index-status'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
