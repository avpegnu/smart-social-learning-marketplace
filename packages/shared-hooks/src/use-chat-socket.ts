'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth-store';
import { queryKeys } from '@shared/api-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useChatSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('new_message', (message: { conversationId: string }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.conversations,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(message.conversationId),
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, queryClient]);

  const joinConversation = useCallback((id: string) => {
    socketRef.current?.emit('join_conversation', {
      conversationId: id,
    });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    socketRef.current?.emit('send_message', {
      conversationId,
      content,
      type: 'TEXT',
    });
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('stop_typing', { conversationId });
  }, []);

  return {
    joinConversation,
    sendMessage,
    sendTyping,
    stopTyping,
  };
}
