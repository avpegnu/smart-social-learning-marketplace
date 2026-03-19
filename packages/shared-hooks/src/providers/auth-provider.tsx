'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { apiClient } from '@shared/api-client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    // Wire apiClient callbacks (always, even on remount)
    apiClient.onRefresh = (token: string) => {
      useAuthStore.getState().setAccessToken(token);
    };
    apiClient.onLogout = () => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    };

    // Only restore session once
    if (initialized.current) return;
    initialized.current = true;

    const { isAuthenticated, accessToken } = useAuthStore.getState();

    // Already authenticated with token → just sync to apiClient
    if (isAuthenticated && accessToken) {
      apiClient.setAccessToken(accessToken);
      return;
    }

    // Check if user was previously logged in (sessionStorage has user data)
    // If never logged in on this tab → pure guest → skip refresh call
    const stored = sessionStorage.getItem('sslm-auth');
    const hasStoredUser = stored && JSON.parse(stored)?.state?.user;

    if (!hasStoredUser) return; // Pure guest — no refresh needed

    // Had user data but no token → try refresh via cookie
    const restoreSession = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          { method: 'POST', credentials: 'include' },
        );
        if (res.ok) {
          const data = await res.json();
          const { user, accessToken: token } = data.data;
          if (user && token) {
            useAuthStore.getState().setAuth(user, token);
          }
        } else {
          // Refresh failed → clear stale user data
          useAuthStore.getState().logout();
        }
      } catch {
        // Network error — keep stale user for offline display
      }
    };

    restoreSession();
  }, []);

  return <>{children}</>;
}
