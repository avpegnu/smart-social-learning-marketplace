'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { chapterService } from '../services/chapter.service';

export function useCreateChapter() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      data,
    }: {
      courseId: string;
      sectionId: string;
      data: {
        title: string;
        description?: string;
        price?: number;
        isFreePreview?: boolean;
        order?: number;
      };
    }) => chapterService.create(courseId, sectionId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateChapter() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      chapterId,
      data,
    }: {
      courseId: string;
      sectionId: string;
      chapterId: string;
      data: { title?: string; description?: string; price?: number; isFreePreview?: boolean };
    }) => chapterService.update(courseId, sectionId, chapterId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteChapter() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      chapterId,
    }: {
      courseId: string;
      sectionId: string;
      chapterId: string;
    }) => chapterService.delete(courseId, sectionId, chapterId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReorderChapters() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      orderedIds,
    }: {
      courseId: string;
      sectionId: string;
      orderedIds: string[];
    }) => chapterService.reorder(courseId, sectionId, orderedIds),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
