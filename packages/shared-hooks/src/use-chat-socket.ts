'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth-store';
import { queryKeys } from '@shared/api-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export interface ChatSocketCallbacks {
  onTyping?: (data: { userId: string; conversationId: string }) => void;
  onStopTyping?: (data: { userId: string; conversationId: string }) => void;
  onMessageRead?: (data: { userId: string; conversationId: string }) => void;
}

export function useChatSocket(callbacks?: ChatSocketCallbacks) {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

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

    socket.on('user_typing', (data: { userId: string; conversationId: string }) => {
      callbacksRef.current?.onTyping?.(data);
    });

    socket.on('user_stop_typing', (data: { userId: string; conversationId: string }) => {
      callbacksRef.current?.onStopTyping?.(data);
    });

    socket.on('message_read', (data: { userId: string; conversationId: string }) => {
      callbacksRef.current?.onMessageRead?.(data);
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    // When server confirms our mark_read
    socket.on('mark_read_confirmed', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    // Notification for messages when user is NOT in the conversation room
    socket.on('new_message_notification', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, queryClient]);

  const joinConversation = useCallback((id: string) => {
    socketRef.current?.emit('join_conversation', { conversationId: id });
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

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit('mark_read', { conversationId });
  }, []);

  return {
    socket: socketRef.current,
    joinConversation,
    sendMessage,
    sendTyping,
    stopTyping,
    markRead,
  };
}
