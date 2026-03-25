'use client';

import { useNotificationSocket, useChatSocket } from '@shared/hooks';

export function SocketProvider() {
  useNotificationSocket();
  useChatSocket();
  return null;
}
