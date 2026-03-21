'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { sectionService } from '../services/section.service';

export function useCreateSection() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      data,
    }: {
      courseId: string;
      data: { title: string; order?: number };
    }) => sectionService.create(courseId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateSection() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      sectionId,
      data,
    }: {
      courseId: string;
      sectionId: string;
      data: { title?: string; order?: number };
    }) => sectionService.update(courseId, sectionId, data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteSection() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, sectionId }: { courseId: string; sectionId: string }) =>
      sectionService.delete(courseId, sectionId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReorderSections() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, orderedIds }: { courseId: string; orderedIds: string[] }) =>
      sectionService.reorder(courseId, orderedIds),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
