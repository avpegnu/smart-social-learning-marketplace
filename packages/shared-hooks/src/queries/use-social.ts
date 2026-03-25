'use client';

import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { socialService } from '../services/social.service';
import type { CreatePostData, UpdatePostData, CreateCommentData } from '../services/social.service';
import { useApiError } from '../use-api-error';

// ── Feed ──

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['social', 'feed'],
    queryFn: ({ pageParam = 1 }) => socialService.getFeed({ page: pageParam as number, limit: 10 }),
    getNextPageParam: (lastPage: unknown) => {
      const page = lastPage as { meta?: { page: number; totalPages: number } };
      if (!page.meta || page.meta.page >= page.meta.totalPages) return undefined;
      return page.meta.page + 1;
    },
    initialPageParam: 1,
  });
}

export function useBookmarks(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['social', 'bookmarks', params],
    queryFn: () => socialService.getBookmarks(params),
  });
}

// ── Post Detail ──

export function usePost(id: string) {
  return useQuery({
    queryKey: ['social', 'posts', id],
    queryFn: () => socialService.getPost(id),
    enabled: !!id,
  });
}

// ── Comments ──

export function useComments(postId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['social', 'posts', postId, 'comments', params],
    queryFn: () => socialService.getComments(postId, params),
    enabled: !!postId,
  });
}

// ── Mutations ──

export function useCreatePost() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreatePostData) => socialService.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePostData }) =>
      socialService.updatePost(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'posts', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => socialService.deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => socialService.toggleLike(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => socialService.toggleBookmark(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
      queryClient.invalidateQueries({ queryKey: ['social', 'bookmarks'] });
    },
  });
}

export function useSharePost() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content?: string }) =>
      socialService.sharePost(postId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: CreateCommentData }) =>
      socialService.createComment(postId, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'posts', vars.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      socialService.deleteComment(postId, commentId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'posts', vars.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
    onError: getErrorMessage,
  });
}
