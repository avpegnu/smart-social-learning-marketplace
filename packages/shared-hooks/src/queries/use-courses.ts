'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { courseService } from '../services/course.service';
import type { CourseListParams } from '../services/course.service';

// ── Instructor Course List ──

export function useInstructorCourses(params?: CourseListParams) {
  return useQuery({
    queryKey: ['instructor', 'courses', params],
    queryFn: () => courseService.getInstructorCourses(params),
  });
}

// ── Course Detail (for editing) ──

export function useInstructorCourseDetail(courseId: string) {
  return useQuery({
    queryKey: ['instructor', 'courses', courseId],
    queryFn: () => courseService.getInstructorCourseDetail(courseId),
    enabled: !!courseId,
  });
}

// ── Course CRUD ──

export function useCreateCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => courseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: Record<string, unknown> }) =>
      courseService.update(courseId, data),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => courseService.delete(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useSubmitCourseForReview() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => courseService.submitForReview(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCourseTags() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, tagIds }: { courseId: string; tagIds: string[] }) =>
      courseService.updateTags(courseId, tagIds),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
