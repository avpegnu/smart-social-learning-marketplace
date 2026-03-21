'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { quizService } from '../services/quiz.service';
import type { UpsertQuizPayload } from '../services/quiz.service';

export function useQuiz(courseId: string, lessonId: string) {
  return useQuery({
    queryKey: ['instructor', 'courses', courseId, 'lessons', lessonId, 'quiz'],
    queryFn: () => quizService.get(courseId, lessonId),
    enabled: !!courseId && !!lessonId,
  });
}

export function useUpsertQuiz() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      lessonId,
      data,
    }: {
      courseId: string;
      lessonId: string;
      data: UpsertQuizPayload;
    }) => quizService.upsert(courseId, lessonId, data),
    onSuccess: (_, { courseId, lessonId }) => {
      queryClient.invalidateQueries({
        queryKey: ['instructor', 'courses', courseId, 'lessons', lessonId, 'quiz'],
      });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: string; lessonId: string }) =>
      quizService.delete(courseId, lessonId),
    onSuccess: (_, { courseId, lessonId }) => {
      queryClient.invalidateQueries({
        queryKey: ['instructor', 'courses', courseId, 'lessons', lessonId, 'quiz'],
      });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
