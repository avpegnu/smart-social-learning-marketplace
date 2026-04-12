'use client';

import { useNotificationSocket } from '@shared/hooks';

export function SocketProvider() {
  useNotificationSocket();
  return null;
}
