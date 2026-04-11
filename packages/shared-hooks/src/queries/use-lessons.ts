'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { lessonService } from '../services/lesson.service';

export function useCreateLesson() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      chapterId,
      data,
    }: {
      courseId: string;
      chapterId: string;
      data: {
        title: string;
        type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE';
        textContent?: string;
        videoUrl?: string;
        fileUrl?: string;
        fileMimeType?: string;
        estimatedDuration?: number;
        order?: number;
      };
    }) => lessonService.create(courseId, chapterId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLesson() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      chapterId,
      lessonId,
      data,
    }: {
      courseId: string;
      chapterId: string;
      lessonId: string;
      data: {
        title?: string;
        textContent?: string;
        videoUrl?: string;
        fileUrl?: string;
        fileMimeType?: string;
        estimatedDuration?: number;
      };
    }) => lessonService.update(courseId, chapterId, lessonId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLesson() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      chapterId,
      lessonId,
    }: {
      courseId: string;
      chapterId: string;
      lessonId: string;
    }) => lessonService.delete(courseId, chapterId, lessonId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReorderLessons() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      chapterId,
      orderedIds,
    }: {
      courseId: string;
      chapterId: string;
      orderedIds: string[];
    }) => lessonService.reorder(courseId, chapterId, orderedIds),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
