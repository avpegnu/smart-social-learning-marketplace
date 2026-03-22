'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { adminService } from '../services/admin.service';

// ── Queries ──

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminService.getDashboard(),
  });
}

export function useAdminUsers(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.getUsers(params),
  });
}

export function useAdminPendingApps(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'applications', params],
    queryFn: () => adminService.getPendingApplications(params),
  });
}

export function useAdminCourses(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'courses', 'all', params],
    queryFn: () => adminService.getAllCourses(params),
  });
}

export function useAdminCourseDetail(courseId: string) {
  return useQuery({
    queryKey: ['admin', 'courses', courseId],
    queryFn: () => adminService.getCourseDetail(courseId),
    enabled: !!courseId,
  });
}

export function useAdminPendingCourses(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'courses', 'pending', params],
    queryFn: () => adminService.getPendingCourses(params),
  });
}

export function useAdminWithdrawals(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'withdrawals', params],
    queryFn: () => adminService.getPendingWithdrawals(params),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminService.getSettings(),
  });
}

// ── Mutations ──

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { status: string; reason?: string } }) =>
      adminService.updateUserStatus(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReviewApplication() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      appId,
      data,
    }: {
      appId: string;
      data: { approved: boolean; reviewNote?: string };
    }) => adminService.reviewApplication(appId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReviewCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      courseId,
      data,
    }: {
      courseId: string;
      data: { approved: boolean; feedback?: string };
    }) => adminService.reviewCourse(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useProcessWithdrawal() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; reviewNote?: string } }) =>
      adminService.processWithdrawal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; parentId?: string; order?: number }) =>
      adminService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string; order?: number };
    }) => adminService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: { name: string }) => adminService.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      adminService.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: { key: string; value: unknown }) => adminService.updateSetting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Reports ──

export function useAdminReports(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => adminService.getReports(params),
  });
}

export function useReviewReport() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; adminNote?: string } }) =>
      adminService.reviewReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Analytics ──

export function useAdminAnalytics(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'analytics', params],
    queryFn: () => adminService.getAnalytics(params),
    enabled: !!params.type && !!params.from && !!params.to,
  });
}
