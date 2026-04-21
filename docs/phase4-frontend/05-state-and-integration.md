# 5. STATE MANAGEMENT & API INTEGRATION

> TanStack Query + Zustand + Socket.io-client + next-themes + next-intl

---

## 5.1 Tổng quan Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW ARCHITECTURE                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    NEXT.JS 16 APP                         │   │
│  │                                                           │   │
│  │  Server Components          Client Components             │   │
│  │  ┌─────────────────┐       ┌───────────────────────────┐ │   │
│  │  │ Direct fetch     │       │ TanStack Query           │ │   │
│  │  │ (no client JS)   │       │ (cache, refetch, mutate) │ │   │
│  │  │                  │       │                          │ │   │
│  │  │ - Homepage       │       │ - Cart mutations         │ │   │
│  │  │ - Course detail  │       │ - Form submissions       │ │   │
│  │  │ - Browse courses │       │ - Like/Follow/Vote       │ │   │
│  │  │ - Profile        │       │ - Chat messages          │ │   │
│  │  │ - Order history  │       │ - Video progress         │ │   │
│  │  └────────┬────────┘       │ - Notifications          │ │   │
│  │           │                 └────────────┬──────────────┘ │   │
│  │           │                              │                │   │
│  │           ▼                              ▼                │   │
│  │  ┌──────────────────────────────────────────────────────┐│   │
│  │  │              API CLIENT (@shared/api-client)         ││   │
│  │  │              fetch wrapper + auth interceptor         ││   │
│  │  └──────────────────────────┬───────────────────────────┘│   │
│  │                             │                             │   │
│  │  ┌──────────────────────────┼───────────────────────────┐│   │
│  │  │         ZUSTAND STORES   │                           ││   │
│  │  │  ┌────────────┐ ┌───────┴─────┐ ┌────────────────┐ ││   │
│  │  │  │ Auth Store │ │ Cart Store  │ │ UI Store       │ ││   │
│  │  │  │ user       │ │ items       │ │ sidebarOpen    │ ││   │
│  │  │  │ accessToken│ │ coupon      │ │ mobileNavOpen  │ ││   │
│  │  │  │ isAuth     │ │ total       │ │ commandPalette │ ││   │
│  │  │  └────────────┘ └─────────────┘ └────────────────┘ ││   │
│  │  └──────────────────────────────────────────────────────┘│   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────────┐│   │
│  │  │         SOCKET.IO CLIENT                             ││   │
│  │  │  /chat namespace     /notifications namespace        ││   │
│  │  └──────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│                    ┌────────────────────┐                        │
│                    │  NestJS Backend    │                        │
│                    │  api.app.com       │                        │
│                    └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Rendering Strategy Decision Matrix

```
┌─────────────────────────────────┬──────────────┬─────────────────────┐
│ Page / Feature                  │ Rendering    │ Reason              │
├─────────────────────────────────┼──────────────┼─────────────────────┤
│ Homepage                        │ Server + ISR │ SEO, static content │
│ Browse courses                  │ Server       │ SEO, URL search     │
│ Course detail                   │ Server + ISR │ SEO critical        │
│ Public profile                  │ Server       │ SEO, shareable      │
│ Q&A listing                     │ Server       │ SEO                 │
│ Q&A detail                      │ Server       │ SEO, shareable      │
│ Login/Register                  │ Client       │ Form interactivity  │
│ Course player                   │ Hybrid       │ Server data + video │
│ Learning dashboard              │ Server       │ Initial load fast   │
│ News feed                       │ Client       │ Real-time, infinite │
│ Chat                            │ Client       │ Full real-time      │
│ AI Tutor                        │ Client       │ SSE streaming       │
│ Cart                            │ Client       │ Mutations           │
│ Payment waiting                 │ Client       │ Polling             │
│ Settings                        │ Client       │ Form mutations      │
│ All Management Portal pages     │ Client       │ Interactive admin   │
└─────────────────────────────────┴──────────────┴─────────────────────┘
```

---

## 5.2 API Client

```typescript
// packages/api-client/src/client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL; // https://api.app.com

interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

interface ApiError {
  statusCode: number;
  error: string;
  message: string; // Error code (e.g., "EMAIL_ALREADY_EXISTS")
  details?: Record<string, unknown>;
}

// --- Server-side fetch (Server Components) ---

export async function serverFetch<T>(
  path: string,
  options?: RequestInit & { next?: NextFetchRequestConfig },
): Promise<ApiResponse<T>> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(refreshToken && { Cookie: `refreshToken=${refreshToken}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json();
}

// --- Client-side fetch (Client Components) ---

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  async fetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include', // Include cookies (refreshToken)
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && {
          Authorization: `Bearer ${this.accessToken}`,
        }),
        ...options?.headers,
      },
    });

    // 401 → Try refresh token
    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request with new token
        return this.fetch<T>(path, options);
      }
      // Refresh failed → logout
      this.handleLogout();
      throw { statusCode: 401, message: 'TOKEN_EXPIRED' } as ApiError;
    }

    if (!res.ok) {
      const error: ApiError = await res.json();
      throw error;
    }

    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send refreshToken cookie
      });
      if (!res.ok) return false;

      const data = await res.json();
      this.accessToken = data.data.accessToken;
      // Update Zustand store
      useAuthStore.getState().setAccessToken(data.data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  private handleLogout() {
    this.accessToken = null;
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }

  // Convenience methods
  async get<T>(path: string) {
    return this.fetch<T>(path);
  }

  async post<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

---

## 5.3 TanStack Query Setup

```typescript
// packages/api-client/src/query-client.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,        // 1 minute
            gcTime: 5 * 60 * 1000,       // 5 minutes (garbage collection)
            retry: 1,                     // 1 retry on failure
            refetchOnWindowFocus: false,  // Không refetch khi focus tab
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
```

### Query Key Convention

```typescript
// packages/api-client/src/query-keys.ts

export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
  },

  // Courses
  courses: {
    all: ['courses'] as const,
    list: (filters: CourseFilters) => ['courses', 'list', filters] as const,
    detail: (slug: string) => ['courses', 'detail', slug] as const,
    player: (courseId: string) => ['courses', 'player', courseId] as const,
  },

  // Learning
  learning: {
    dashboard: ['learning', 'dashboard'] as const,
    progress: (courseId: string) => ['learning', 'progress', courseId] as const,
    certificates: ['learning', 'certificates'] as const,
  },

  // Social
  social: {
    feed: ['social', 'feed'] as const,
    post: (postId: string) => ['social', 'post', postId] as const,
  },

  // Chat
  chat: {
    conversations: ['chat', 'conversations'] as const,
    messages: (conversationId: string) => ['chat', 'messages', conversationId] as const,
  },

  // Cart
  cart: {
    items: ['cart', 'items'] as const,
  },

  // Notifications
  notifications: {
    list: ['notifications', 'list'] as const,
    unreadCount: ['notifications', 'unread'] as const,
  },

  // Q&A
  qna: {
    questions: (filters: QnAFilters) => ['qna', 'questions', filters] as const,
    question: (id: string) => ['qna', 'question', id] as const,
  },

  // AI
  ai: {
    sessions: ['ai', 'sessions'] as const,
    messages: (sessionId: string) => ['ai', 'messages', sessionId] as const,
  },

  // Instructor
  instructor: {
    dashboard: ['instructor', 'dashboard'] as const,
    courses: ['instructor', 'courses'] as const,
    revenue: ['instructor', 'revenue'] as const,
    coupons: ['instructor', 'coupons'] as const,
  },

  // Admin
  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    users: (filters: UserFilters) => ['admin', 'users', filters] as const,
    pendingInstructors: ['admin', 'pending-instructors'] as const,
    pendingCourses: ['admin', 'pending-courses'] as const,
    reports: ['admin', 'reports'] as const,
    withdrawals: ['admin', 'withdrawals'] as const,
  },
};
```

### Example: Custom Query Hook

```typescript
// packages/api-client/src/courses.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';

// --- Queries ---

export function useCourses(filters: CourseFilters) {
  return useQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: () =>
      apiClient.get<PaginatedResponse<Course>>(
        `/api/courses?${new URLSearchParams(filters as any)}`,
      ),
  });
}

export function useCourseDetail(slug: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(slug),
    queryFn: () => apiClient.get<CourseDetail>(`/api/courses/${slug}`),
    enabled: !!slug,
  });
}

// --- Mutations ---

export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) => apiClient.post('/api/cart/items', { courseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.items });
    },
  });
}

export function useSubmitReview(courseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; comment: string }) =>
      apiClient.post(`/api/courses/${courseId}/reviews`, data),
    onSuccess: () => {
      // Invalidate course detail (to refresh review section)
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(courseId),
      });
    },
  });
}

// --- Infinite Query (Feed) ---

export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.social.feed,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<Post>>(`/api/social/feed?cursor=${pageParam || ''}`),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}
```

---

## 5.4 Zustand Stores

### Auth Store

```typescript
// packages/hooks/src/stores/auth-store.ts
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

  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
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

      logout: () => {
        apiClient.setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      // sessionStorage: clears when tab closes
      // accessToken NOT stored in localStorage (security)
      partialize: (state) => ({
        user: state.user,
        // accessToken NOT persisted — must re-login or refresh
      }),
    },
  ),
);
```

### Cart Store (Guest + Authenticated)

```typescript
// packages/hooks/src/stores/cart-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  courseId: string;
  title: string;
  instructorName: string;
  thumbnailUrl: string;
  price: number;
  type: 'FULL_COURSE' | 'CHAPTER';
  chapterId?: string;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (courseId: string, chapterId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  syncWithServer: (serverItems: CartItem[]) => void;

  // Computed
  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      discount: 0,

      addItem: (item) => {
        const exists = get().items.some(
          (i) => i.courseId === item.courseId && i.chapterId === item.chapterId,
        );
        if (!exists) {
          set((state) => ({ items: [...state.items, item] }));
        }
      },

      removeItem: (courseId, chapterId) => {
        set((state) => ({
          items: state.items.filter((i) => !(i.courseId === courseId && i.chapterId === chapterId)),
        }));
      },

      clearCart: () => set({ items: [], couponCode: null, discount: 0 }),

      applyCoupon: (code, discount) => set({ couponCode: code, discount }),
      removeCoupon: () => set({ couponCode: null, discount: 0 }),

      syncWithServer: (serverItems) => set({ items: serverItems }),

      subtotal: () => get().items.reduce((sum, item) => sum + item.price, 0),
      total: () => Math.max(0, get().subtotal() - get().discount),
      itemCount: () => get().items.length,
    }),
    {
      name: 'cart-storage',
      // localStorage: persists across tabs for guest cart
    },
  ),
);
```

### UI Store

```typescript
// packages/hooks/src/stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandPaletteOpen: boolean;

  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandPalette: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandPaletteOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
}));
```

---

## 5.5 Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     AUTH FLOW DIAGRAM                             │
│                                                                  │
│  ┌──────────┐                                                    │
│  │ App Load │                                                    │
│  └────┬─────┘                                                    │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────────────────────────┐                              │
│  │ Check sessionStorage for user  │                              │
│  │ (from AuthStore persist)       │                              │
│  └────┬───────────────┬──────────┘                               │
│       │ has user      │ no user                                  │
│       ▼               ▼                                          │
│  ┌─────────────┐  ┌────────────────┐                             │
│  │ Try refresh  │  │ Show as Guest  │                             │
│  │ POST /auth/  │  │ (can browse,   │                             │
│  │ refresh      │  │  search, view) │                             │
│  │ (cookie)     │  └────────────────┘                             │
│  └─────┬───────┘                                                 │
│   ok   │  fail                                                    │
│   ▼    ▼                                                          │
│  ┌──────────┐  ┌──────────────────┐                              │
│  │ Set new  │  │ Clear auth state │                              │
│  │ access   │  │ Show as Guest    │                              │
│  │ token    │  └──────────────────┘                              │
│  │ → Auth'd │                                                    │
│  └──────────┘                                                    │
│                                                                  │
│  LOGIN FLOW:                                                      │
│  1. POST /api/auth/login { email, password }                     │
│  2. Response: { accessToken, user }                              │
│     + Set-Cookie: refreshToken=xxx; httpOnly; secure; sameSite   │
│  3. Store accessToken in memory (Zustand → sessionStorage)       │
│  4. Store user in Zustand                                        │
│  5. apiClient.setAccessToken(accessToken)                        │
│  6. Merge guest cart: POST /api/cart/merge { items: localCart }  │
│  7. Redirect to returnUrl or /                                   │
│                                                                  │
│  TOKEN REFRESH:                                                   │
│  - accessToken expires in 15 minutes                             │
│  - On 401 response → auto-try POST /api/auth/refresh            │
│  - refreshToken (httpOnly cookie) sent automatically             │
│  - New accessToken returned → retry failed request               │
│  - If refresh fails → logout + redirect /login                   │
│                                                                  │
│  LOGOUT:                                                          │
│  1. POST /api/auth/logout (clears refreshToken cookie)           │
│  2. Clear Zustand auth state                                     │
│  3. Clear apiClient accessToken                                  │
│  4. Redirect to /login                                           │
│                                                                  │
│  CROSS-PORTAL:                                                    │
│  Student Portal → Management Portal:                             │
│  1. POST /api/auth/ott → { token: "xxx" } (1-time, 30s expiry) │
│  2. Redirect: manage.app.com/auth/exchange?token=xxx             │
│  3. Management Portal: POST /api/auth/ott/exchange { token }    │
│  4. Response: { accessToken, user } + refreshToken cookie        │
│  5. Normal auth flow from here                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Auth Provider

```typescript
// packages/hooks/src/providers/auth-provider.tsx
'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { apiClient } from '@shared/api-client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setAuth, logout } = useAuthStore()

  useEffect(() => {
    // On mount: try to refresh token if we have a stored user
    if (user) {
      refreshAuth()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAuth() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        { method: 'POST', credentials: 'include' }
      )
      if (res.ok) {
        const data = await res.json()
        setAuth(data.data.user, data.data.accessToken)
      } else {
        logout()
      }
    } catch {
      logout()
    }
  }

  return <>{children}</>
}
```

### Route Protection

```typescript
// packages/hooks/src/use-require-auth.ts
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './stores/auth-store';

export function useRequireAuth(requiredRole?: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN') {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, user?.role, requiredRole, router]);

  return { isAuthenticated, user };
}

// Server-side auth check (for Server Components)
// packages/api-client/src/server-auth.ts
import { cookies } from 'next/headers';

export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken');

  if (!refreshToken) return null;

  try {
    const res = await fetch(`${process.env.API_URL}/api/auth/me`, {
      headers: { Cookie: `refreshToken=${refreshToken.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch {
    return null;
  }
}
```

---

## 5.6 WebSocket Integration

```typescript
// packages/hooks/src/use-socket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@shared/api-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL!;

// ============================================================
// Chat Socket
// ============================================================
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
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Chat connected');
    });

    socket.on('new_message', (message) => {
      // Update TanStack Query cache for the conversation
      queryClient.setQueryData(queryKeys.chat.messages(message.conversationId), (old: any) => ({
        ...old,
        data: [...(old?.data || []), message],
      }));
      // Update conversation list (last message preview)
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.conversations,
      });
    });

    socket.on('typing', ({ conversationId, userId, userName }) => {
      // Update typing state (managed in component local state)
    });

    socket.on('read_receipt', ({ conversationId, userId, lastReadMessageId }) => {
      // Update read status in cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(conversationId),
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, queryClient]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conversation', { conversationId });
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, content: string, type: string = 'TEXT') => {
      socketRef.current?.emit('send_message', {
        conversationId,
        content,
        type,
      });
    },
    [],
  );

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('stop_typing', { conversationId });
  }, []);

  const markRead = useCallback((conversationId: string, messageId: string) => {
    socketRef.current?.emit('mark_read', { conversationId, messageId });
  }, []);

  return {
    joinConversation,
    sendMessage,
    sendTyping,
    stopTyping,
    markRead,
    socket: socketRef.current,
  };
}

// ============================================================
// Notification Socket
// ============================================================
export function useNotificationSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('notification', (notification) => {
      // Update notification list cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list,
      });
      // Update unread count
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });

      // Show toast for important notifications
      if (['ORDER_COMPLETED', 'COURSE_APPROVED', 'NEW_MESSAGE'].includes(notification.type)) {
        // toast.info(notification.message) — handled in NotificationProvider
      }
    });

    socket.on('unread_count', (count: number) => {
      queryClient.setQueryData(queryKeys.notifications.unreadCount, count);
    });

    socket.on('order_status', ({ orderId, status }) => {
      // For payment polling — when ORDER_COMPLETED received
      queryClient.invalidateQueries({
        queryKey: ['orders', orderId],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, queryClient]);
}
```

---

## 5.7 Video Progress Tracking

```typescript
// packages/hooks/src/use-video-progress.ts
'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';

interface WatchedSegment {
  start: number; // seconds
  end: number; // seconds
}

export function useVideoProgress(courseId: string, lessonId: string) {
  const segmentsRef = useRef<WatchedSegment[]>([]);
  const lastReportRef = useRef<number>(0);

  const reportMutation = useMutation({
    mutationFn: (data: {
      lessonId: string;
      watchedSegments: WatchedSegment[];
      lastPosition: number;
    }) => apiClient.post(`/api/learning/progress/${courseId}`, data),
  });

  // Merge overlapping segments
  const mergeSegments = useCallback((segments: WatchedSegment[]): WatchedSegment[] => {
    if (segments.length === 0) return [];
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const merged: WatchedSegment[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i].start <= last.end + 1) {
        last.end = Math.max(last.end, sorted[i].end);
      } else {
        merged.push(sorted[i]);
      }
    }
    return merged;
  }, []);

  // Called every second while video is playing
  const recordProgress = useCallback(
    (currentTime: number) => {
      const rounded = Math.floor(currentTime);

      // Add to current segment or create new one
      const segments = segmentsRef.current;
      const last = segments[segments.length - 1];

      if (last && rounded <= last.end + 2) {
        last.end = rounded;
      } else {
        segments.push({ start: rounded, end: rounded });
      }

      // Report every 10 seconds
      if (rounded - lastReportRef.current >= 10) {
        lastReportRef.current = rounded;
        const merged = mergeSegments(segments);

        reportMutation.mutate({
          lessonId,
          watchedSegments: merged,
          lastPosition: rounded,
        });
      }
    },
    [lessonId, mergeSegments, reportMutation],
  );

  // Report on unmount (leaving page)
  useEffect(() => {
    return () => {
      if (segmentsRef.current.length > 0) {
        const merged = mergeSegments(segmentsRef.current);
        // Use sendBeacon for reliability on page unload
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL}/api/learning/progress/${courseId}`,
          JSON.stringify({
            lessonId,
            watchedSegments: merged,
            lastPosition: lastReportRef.current,
          }),
        );
      }
    };
  }, [courseId, lessonId, mergeSegments]);

  return { recordProgress };
}
```

---

## 5.8 SSE Streaming (AI Tutor)

```typescript
// packages/hooks/src/use-ai-chat.ts
'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from './stores/auth-store';

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function useAIChat(courseId: string) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { accessToken } = useAuthStore();

  const sendMessage = useCallback(
    async (question: string) => {
      // Add user message
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setIsLoading(true);

      // Add empty assistant message (will be filled by stream)
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ courseId, question }),
        });

        if (!response.ok) throw await response.json();

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No reader');

        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                fullContent += parsed.content || '';

                // Update last message with accumulated content
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: fullContent,
                    isStreaming: true,
                  };
                  return updated;
                });
              } catch {
                // Not JSON, might be raw text
                fullContent += data;
              }
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: fullContent,
            isStreaming: false,
          };
          return updated;
        });
      } catch (error) {
        // Remove empty assistant message, show error
        setMessages((prev) => prev.slice(0, -1));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [courseId, accessToken],
  );

  return { messages, isLoading, sendMessage };
}
```

---

## 5.9 Optimistic Updates Pattern

```typescript
// Example: Like a post (optimistic update)

export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => apiClient.post(`/api/social/posts/${postId}/like`),

    // Optimistic update: immediately reflect in UI
    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.social.feed });

      // Snapshot current value
      const previousFeed = queryClient.getQueryData(queryKeys.social.feed);

      // Optimistically update
      queryClient.setQueryData(queryKeys.social.feed, (old: any) => ({
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((post: any) =>
            post.id === postId ? { ...post, isLiked: true, likeCount: post.likeCount + 1 } : post,
          ),
        })),
      }));

      return { previousFeed };
    },

    // Rollback on error
    onError: (_err, _postId, context) => {
      queryClient.setQueryData(queryKeys.social.feed, context?.previousFeed);
    },

    // Refetch after settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.social.feed });
    },
  });
}
```

---

## 5.10 Provider Stack

```typescript
// apps/student-portal/app/[locale]/layout.tsx
import { ThemeProvider } from '@shared/ui/theme/provider'
import { QueryProvider } from '@shared/api-client/query-client'
import { AuthProvider } from '@shared/hooks/providers/auth-provider'
import { NotificationSocketProvider } from '@shared/hooks/providers/notification-provider'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { Toaster } from '@shared/ui/components/ui/sonner'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <AuthProvider>
                <NotificationSocketProvider>
                  {children}
                  <Toaster />
                </NotificationSocketProvider>
              </AuthProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

// Provider nesting order (outermost → innermost):
// 1. ThemeProvider — CSS variables, data-theme attribute
// 2. NextIntlClientProvider — i18n translations
// 3. QueryProvider — TanStack Query client
// 4. AuthProvider — Check/refresh auth on mount
// 5. NotificationSocketProvider — WebSocket connection
// 6. Toaster — Toast notifications (Sonner)
```

---

## 5.11 Caching Strategy

```
┌──────────────────────────────┬──────────────┬────────────────────┐
│ Data                         │ Cache Method │ TTL / Strategy     │
├──────────────────────────────┼──────────────┼────────────────────┤
│ Homepage courses             │ ISR          │ revalidate: 300s   │
│ Course detail                │ ISR          │ revalidate: 1800s  │
│ Course list (browse)         │ Server fetch │ No cache (dynamic) │
│ User profile (public)        │ ISR          │ revalidate: 600s   │
│ Categories                   │ ISR          │ revalidate: 3600s  │
│ Cart items                   │ TanStack Q   │ staleTime: 0       │
│ Notifications                │ TanStack Q   │ staleTime: 30s     │
│ Feed posts                   │ TanStack Q   │ staleTime: 60s     │
│ Chat messages                │ TanStack Q   │ staleTime: 0       │
│ Learning progress            │ TanStack Q   │ staleTime: 60s     │
│ Instructor dashboard         │ TanStack Q   │ staleTime: 300s    │
│ Admin analytics              │ TanStack Q   │ staleTime: 300s    │
│ AI chat sessions             │ TanStack Q   │ staleTime: 60s     │
│ Auth user                    │ Zustand      │ sessionStorage      │
│ Guest cart                   │ Zustand      │ localStorage        │
│ Theme preference             │ next-themes  │ localStorage        │
│ Locale preference            │ Cookie       │ 365 days            │
│ Sidebar collapsed            │ localStorage │ Persistent          │
└──────────────────────────────┴──────────────┴────────────────────┘
```

---

## 5.12 Error Handling Strategy

```typescript
// Global error boundary
// apps/student-portal/app/[locale]/error.tsx
'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@shared/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('error.500')

  useEffect(() => {
    // Log to Sentry
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-h2">{t('title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('message')}</p>
        <Button onClick={reset} className="mt-4">
          {t('retry')}
        </Button>
      </div>
    </div>
  )
}

// API error handling pattern:
// 1. TanStack Query onError → toast.error(getErrorMessage(error))
// 2. Form submission → form.setError() for field-specific errors
// 3. 401 → auto-refresh token → retry → if fail → redirect /login
// 4. 403 → toast.error("Forbidden") + stay on page
// 5. 404 → notFound() (Next.js built-in)
// 6. 429 → toast.error("Rate limited") + show cooldown
// 7. 500 → toast.error("Server error") + error boundary
```

---

## 5.13 Performance Optimizations

```
1. Next.js 16 Features:
   - Turbopack (default): 2-5x faster builds
   - React Compiler (stable): auto-memoize components
   - "use cache" directive: explicit caching per component/function
   - View Transitions API: smooth page transitions

2. Bundle Optimization:
   - Tree-shaking: Lucide icons, date-fns functions
   - Dynamic imports: heavy components (Tiptap, Video.js, Recharts)
     const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })
     const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })
     const Chart = dynamic(() => import('./ChartWidget'), { ssr: false })
   - Route-based code splitting (automatic with App Router)

3. Image Optimization:
   - next/image for all images (auto WebP, lazy loading, srcSet)
   - Cloudinary URL transforms for thumbnails
   - Blur placeholder (blurDataURL) for course thumbnails

4. Data Fetching:
   - Server Components: zero client JS for static pages
   - Streaming: Suspense boundaries for progressive loading
   - Parallel fetches: Promise.all() for independent data
   - Prefetching: <Link prefetch={true}> for likely navigation

5. Real-time:
   - WebSocket only when authenticated (không connect cho guest)
   - Debounce typing events (300ms)
   - Batch notification updates

6. CSS:
   - Tailwind CSS 4: Oxide engine, faster builds
   - CSS layers for proper cascade
   - Minimal custom CSS (rely on Tailwind utilities)
```
