'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { learningService } from '../services/learning.service';

// ── Lesson for Course Player ──

export function useLesson(courseId: string, lessonId: string) {
  return useQuery({
    queryKey: ['learning', 'lesson', courseId, lessonId],
    queryFn: () => learningService.getLesson(courseId, lessonId),
    enabled: !!courseId && !!lessonId,
    retry: (failureCount, error) => {
      // Don't retry on access denied or not found
      const code = (error as { code?: string })?.code;
      if (code === 'LESSON_ACCESS_DENIED' || code === 'LESSON_NOT_FOUND') return false;
      return failureCount < 3;
    },
  });
}

// ── Update Video Progress (fire-and-forget, no invalidation) ──

export function useUpdateProgress() {
  return useMutation({
    mutationFn: ({
      lessonId,
      data,
    }: {
      lessonId: string;
      data: { lastPosition?: number; watchedSegments?: [number, number][] };
    }) => learningService.updateProgress(lessonId, data),
  });
}

// ── Complete Text Lesson ──

export function useCompleteLesson() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (lessonId: string) => learningService.completeLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Course Progress ──

export function useCourseProgress(courseId: string) {
  return useQuery({
    queryKey: ['learning', 'progress', courseId],
    queryFn: () => learningService.getCourseProgress(courseId),
    enabled: !!courseId,
  });
}

// ── Submit Quiz ──

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      lessonId,
      answers,
    }: {
      lessonId: string;
      answers: Array<{ questionId: string; selectedOptionId: string }>;
    }) => learningService.submitQuiz(lessonId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Quiz Attempts History ──

export function useQuizAttempts(lessonId: string) {
  return useQuery({
    queryKey: ['learning', 'quiz-attempts', lessonId],
    queryFn: () => learningService.getQuizAttempts(lessonId),
    enabled: !!lessonId,
  });
}

// ── Learning Dashboard ──

export function useLearningDashboard() {
  return useQuery({
    queryKey: ['learning', 'dashboard'],
    queryFn: () => learningService.getDashboard(),
  });
}

// ── Learning Streak ──

export function useStreak() {
  return useQuery({
    queryKey: ['learning', 'streak'],
    queryFn: () => learningService.getStreak(),
  });
}
