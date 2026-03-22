'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { userService } from '../services/user.service';
import type {
  UpdateProfilePayload,
  ChangePasswordPayload,
  NotificationPreferences,
  ApplyInstructorPayload,
} from '../services/user.service';

// ── Profile ──

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => userService.getMe(),
    enabled,
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => userService.getById(userId),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => userService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useChangePassword() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: ChangePasswordPayload) => userService.changePassword(data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      userService.updateNotificationPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Follow ──

export function useFollowUser() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (userId: string) => userService.follow(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['users', userId] });
      const prev = queryClient.getQueryData(['users', userId]);
      queryClient.setQueryData(['users', userId], (old: unknown) => {
        const d = old as { data?: { isFollowing: boolean; followerCount: number } } | undefined;
        if (d?.data)
          return {
            ...d,
            data: { ...d.data, isFollowing: true, followerCount: d.data.followerCount + 1 },
          };
        return old;
      });
      return { prev };
    },
    onError: (error, userId, context) => {
      if (context?.prev) queryClient.setQueryData(['users', userId], context.prev);
      toast.error(getErrorMessage(error));
    },
    onSettled: (_, __, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (userId: string) => userService.unfollow(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['users', userId] });
      const prev = queryClient.getQueryData(['users', userId]);
      queryClient.setQueryData(['users', userId], (old: unknown) => {
        const d = old as { data?: { isFollowing: boolean; followerCount: number } } | undefined;
        if (d?.data)
          return {
            ...d,
            data: {
              ...d.data,
              isFollowing: false,
              followerCount: Math.max(0, d.data.followerCount - 1),
            },
          };
        return old;
      });
      return { prev };
    },
    onError: (error, userId, context) => {
      if (context?.prev) queryClient.setQueryData(['users', userId], context.prev);
      toast.error(getErrorMessage(error));
    },
    onSettled: (_, __, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
}

export function useUserFollowers(userId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['users', userId, 'followers', params],
    queryFn: () => userService.getFollowers(userId, params),
    enabled: !!userId,
  });
}

export function useUserFollowing(userId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['users', userId, 'following', params],
    queryFn: () => userService.getFollowing(userId, params),
    enabled: !!userId,
  });
}

// ── Instructor Application ──

export function useApplyInstructor() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: ApplyInstructorPayload) => userService.applyInstructor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'applications', 'me'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMyApplications(enabled = true) {
  return useQuery({
    queryKey: ['instructor', 'applications', 'me'],
    queryFn: () => userService.getMyApplications(),
    enabled,
  });
}
