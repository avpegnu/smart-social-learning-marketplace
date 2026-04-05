'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth-store';
import { queryKeys } from '@shared/api-client';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useNotificationSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('notification', () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });
      toast.info('New notification');
    });

    socket.on('unread_count', (data: { count: number }) => {
      // Match API response shape: { data: { count: N } }
      queryClient.setQueryData(queryKeys.notifications.unreadCount, { data });
    });

    socketRef.current = socket;

    return () => {
      socket.off('notification');
      socket.off('unread_count');
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, queryClient]);
}
