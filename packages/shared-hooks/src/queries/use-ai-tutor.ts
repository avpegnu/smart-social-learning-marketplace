'use client';

import { useQuery } from '@tanstack/react-query';
import { aiTutorService } from '../services/ai-tutor.service';

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
