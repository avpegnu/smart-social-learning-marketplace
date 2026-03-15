'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '@shared/hooks';
import { apiClient } from '@shared/api-client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Wire apiClient callbacks to Zustand store
    apiClient.onRefresh = (token: string) => {
      useAuthStore.getState().setAccessToken(token);
    };
    apiClient.onLogout = () => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    };

    // Try restore session via refresh token cookie
    const restoreSession = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          { method: 'POST', credentials: 'include' },
        );
        if (res.ok) {
          const data = await res.json();
          const { user, accessToken } = data.data;
          useAuthStore.getState().setAuth(user, accessToken);
        }
      } catch {
        // No valid refresh token — stay logged out
      }
    };

    restoreSession();
  }, []);

  return <>{children}</>;
}
