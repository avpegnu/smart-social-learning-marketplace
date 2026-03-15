'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@shared/api-client';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        apiClient.setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      setAccessToken: (accessToken) => {
        apiClient.setAccessToken(accessToken);
        set({ accessToken });
      },

      setUser: (user) => {
        set({ user });
      },

      logout: () => {
        apiClient.setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'sslm-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      // Persist user + token to sessionStorage (tab-scoped, cleared on tab close)
      // This prevents unnecessary refresh calls on page reload (F5)
      // If token expires while stored, apiClient's 401 handler will auto-refresh
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
