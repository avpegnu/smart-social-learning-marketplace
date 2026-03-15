'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';

// ── Instructor Course List ──

interface CourseListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export function useInstructorCourses(params?: CourseListParams) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;
  if (params?.search) queryParams.search = params.search;

  return useQuery({
    queryKey: ['instructor', 'courses', params],
    queryFn: () => apiClient.get('/instructor/courses', queryParams),
  });
}

// ── Course Detail (for editing) ──

export function useInstructorCourseDetail(courseId: string) {
  return useQuery({
    queryKey: ['instructor', 'courses', courseId],
    queryFn: () => apiClient.get(`/instructor/courses/${courseId}`),
    enabled: !!courseId,
  });
}

// ── Course CRUD ──

export function useCreateCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/instructor/courses', data),
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
      apiClient.patch(`/instructor/courses/${courseId}`, data),
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
    mutationFn: (courseId: string) => apiClient.del(`/instructor/courses/${courseId}`),
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
    mutationFn: (courseId: string) => apiClient.post(`/instructor/courses/${courseId}/submit`),
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
      apiClient.put(`/instructor/courses/${courseId}/tags`, { tagIds }),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
