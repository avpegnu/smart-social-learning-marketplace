'use client';

import { useChatSocket, useNotificationSocket } from '@shared/hooks';

export function SocketProvider() {
  useNotificationSocket();
  useChatSocket();
  return null;
}
