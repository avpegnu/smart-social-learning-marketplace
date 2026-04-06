'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService } from '../services/notification.service';
import { useApiError } from '../use-api-error';

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.getUnreadCount(),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useNotifications(params?: { page?: number; limit?: number; read?: boolean }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationService.getAll(params),
  });
}

export function useInfiniteNotifications(filter?: { read?: boolean }) {
  return useInfiniteQuery({
    queryKey: ['notifications', 'infinite', filter],
    queryFn: ({ pageParam = 1 }) =>
      notificationService.getAll({ page: pageParam as number, limit: 15, ...filter }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: { meta?: { page: number; totalPages: number } }) =>
      lastPage.meta && lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
