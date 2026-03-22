'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { courseService } from '../services/course.service';
import type { CourseListParams } from '../services/course.service';

// ── Public Course Browse ──

export function useCourses(params: Record<string, string>) {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseService.browse(params),
  });
}

// ── Course Detail by Slug ──

export function useCourseDetail(slug: string) {
  return useQuery({
    queryKey: ['courses', 'detail', slug],
    queryFn: () => courseService.getBySlug(slug),
    enabled: !!slug,
  });
}

// ── Course Reviews (paginated) ──

export function useCourseReviews(courseId: string, params: Record<string, string>) {
  return useQuery({
    queryKey: ['courses', courseId, 'reviews', params],
    queryFn: () => courseService.getReviews(courseId, params),
    enabled: !!courseId,
  });
}

// ── Review Mutations ──

export function useCreateReview(courseId: string) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      courseService.createReview(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['courses', 'detail'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateReview(courseId: string) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      reviewId,
      data,
    }: {
      reviewId: string;
      data: { rating: number; comment?: string };
    }) => courseService.updateReview(courseId, reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['courses', 'detail'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteReview(courseId: string) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (reviewId: string) => courseService.deleteReview(courseId, reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['courses', 'detail'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

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
