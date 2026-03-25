'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chat.service';
import type { CreateConversationData, SendMessageData } from '../services/chat.service';
import { useApiError } from '../use-api-error';

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatService.getConversations(),
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['chat', conversationId, 'messages'],
    queryFn: ({ pageParam = 1 }) =>
      chatService.getMessages(conversationId, { page: pageParam as number, limit: 30 }),
    getNextPageParam: (lastPage: unknown) => {
      const page = lastPage as { meta?: { page: number; totalPages: number } };
      if (!page.meta || page.meta.page >= page.meta.totalPages) return undefined;
      return page.meta.page + 1;
    },
    initialPageParam: 1,
    enabled: !!conversationId,
  });
}

export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateConversationData) => chatService.getOrCreateConversation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: getErrorMessage,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ conversationId, data }: { conversationId: string; data: SendMessageData }) =>
      chatService.sendMessage(conversationId, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['chat', vars.conversationId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: getErrorMessage,
  });
}
