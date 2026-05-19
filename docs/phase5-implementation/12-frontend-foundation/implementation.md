# Phase 5.12 — FRONTEND FOUNDATION & INFRASTRUCTURE

> Clean foundation: API client, providers, stores, shared hooks, socket client.
> Mock UI đã có sẵn — phase này chỉ xây infrastructure layer, KHÔNG touch pages/components.
> Tham chiếu: `docs/phase4-frontend/05-state-and-integration.md`

---

## Hiện trạng (đã có sẵn từ mock UI phase)

| Component | Status | Location |
|-----------|--------|----------|
| Next.js 16.1.6 + React 19 + Turbopack | ✅ | Both portals |
| Tailwind CSS v4 + PostCSS | ✅ | `@tailwindcss/postcss` |
| CSS Design Tokens (light/dark) | ✅ | `src/app/globals.css` |
| next-intl (vi + en, 537 lines each) | ✅ | `messages/`, middleware, routing |
| next-themes (data-theme, system default) | ✅ | `[locale]/layout.tsx` |
| shadcn/ui primitives (13 components) | ✅ | `packages/shared-ui/` |
| ThemeToggle + LocaleSwitcher | ✅ | `src/components/` |
| Layouts (auth, main, learning, admin) | ✅ | `src/app/[locale]/` |
| Navigation (navbar, footer, sidebar, mobile-nav) | ✅ | `src/components/navigation/` |
| Mock pages (~35 student + ~28 management) | ✅ | Using `mock-data.ts` |
| shared-types (User, ApiResponse, etc.) | ✅ | `packages/shared-types/` |
| shared-utils (formatPrice, formatRelativeTime) | ✅ | `packages/shared-utils/` |
| Fonts (Inter + JetBrains Mono) | ✅ | Root layout |
| TanStack Query, Zustand, socket.io-client | ✅ Installed | But NOT configured |

## CẦN IMPLEMENT (phase này)

| Component | Priority | Location |
|-----------|----------|----------|
| API Client (fetch wrapper + auth) | 🔴 Critical | `packages/shared-api-client/` |
| TanStack Query Provider | 🔴 Critical | Each portal `src/providers/` |
| Zustand Stores (auth, cart, UI) | 🔴 Critical | `packages/shared-hooks/src/stores/` |
| Auth Provider (restore session) | 🔴 Critical | Each portal `src/providers/` |
| Shared Hooks | 🟡 Medium | `packages/shared-hooks/` |
| Socket.io Client hooks | 🟡 Medium | `packages/shared-hooks/` |
| Query Keys + Query Hooks | 🟡 Medium | `packages/shared-api-client/` |
| Install missing shadcn components | 🟢 Low | Interactive CLI |
| Error Boundary | 🟢 Low | `packages/shared-ui/` |

---

## Mục lục

- [Step 1: API Client — Native fetch wrapper](#step-1-api-client)
- [Step 2: Query Keys factory](#step-2-query-keys)
- [Step 3: Zustand Stores](#step-3-zustand-stores)
- [Step 4: Providers (Query + Auth)](#step-4-providers)
- [Step 5: Wire providers into layouts](#step-5-wire-providers)
- [Step 6: Shared Hooks](#step-6-shared-hooks)
- [Step 7: Socket.io Client hooks](#step-7-socketio-client)
- [Step 8: Shared Types (expand)](#step-8-shared-types)
- [Step 9: Install missing shadcn components](#step-9-shadcn-components)
- [Step 10: Error handling utilities](#step-10-error-handling)
- [Step 11: Verify](#step-11-verify)

---

## Step 1: API Client — Native fetch wrapper

**Quyết định: Native `fetch` thay vì axios.**

Lý do:
- Next.js 16 extend native `fetch` với caching, revalidation, deduplication
- Server Components chỉ dùng được native `fetch` (không import axios)
- Giảm 1 dependency (axios ~50KB)
- `credentials: 'include'` cho httpOnly cookie refresh token

### `packages/shared-api-client/src/client.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// --- Types ---
interface ApiResponse<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
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

// --- Client-side API (Client Components) ---
class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async fetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',  // httpOnly cookie for refreshToken
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        ...options?.headers,
      },
    });

    // 401 → try refresh
    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.refreshToken();
      if (refreshed) return this.fetch<T>(path, options);
      this.handleLogout();
      throw { code: 'TOKEN_EXPIRED', statusCode: 401, message: 'Session expired' } as ApiError;
    }

    if (!res.ok) {
      const error: ApiError = await res.json();
      throw error;
    }

    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.accessToken = data.data.accessToken;
      // Zustand store updated via onRefresh callback
      this.onRefresh?.(data.data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  private handleLogout() {
    this.accessToken = null;
    this.onLogout?.();
  }

  // Callbacks set by AuthProvider
  onRefresh?: (token: string) => void;
  onLogout?: () => void;

  // Convenience methods
  async get<T>(path: string, params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.fetch<T>(`${path}${query}`);
  }

  async post<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  async patch<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  }

  async put<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  async del<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

**Key design decisions:**
- **Class-based** — accessToken stored as private class field (NOT `window.__SSLM_ACCESS_TOKEN__`)
- **`onRefresh` / `onLogout` callbacks** — set by AuthProvider, avoids circular import with Zustand
- **Auto-refresh** — transparent to callers, retry original request with new token
- **`credentials: 'include'`** — sends httpOnly refreshToken cookie automatically
- **Server vs Client** — `serverFetch()` for RSC (reads cookies from `next/headers`), `apiClient` for client components

---

## Step 2: Query Keys factory

### `packages/shared-api-client/src/query-keys.ts`

```typescript
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    profile: (id: string) => ['users', id] as const,
    followers: (id: string) => ['users', id, 'followers'] as const,
    following: (id: string) => ['users', id, 'following'] as const,
  },
  courses: {
    all: ['courses'] as const,
    list: (params?: Record<string, unknown>) => ['courses', 'list', params] as const,
    detail: (slug: string) => ['courses', slug] as const,
    reviews: (courseId: string) => ['courses', courseId, 'reviews'] as const,
  },
  instructor: {
    courses: ['instructor', 'courses'] as const,
    course: (id: string) => ['instructor', 'courses', id] as const,
    dashboard: ['instructor', 'dashboard'] as const,
    coupons: ['instructor', 'coupons'] as const,
  },
  cart: {
    all: ['cart'] as const,
  },
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', id] as const,
  },
  enrollments: {
    myLearning: ['enrollments', 'my-learning'] as const,
    check: (courseId: string) => ['enrollments', 'check', courseId] as const,
  },
  learning: {
    lesson: (courseId: string, lessonId: string) => ['learning', courseId, lessonId] as const,
    progress: (courseId: string) => ['learning', 'progress', courseId] as const,
    streak: ['learning', 'streak'] as const,
    dashboard: ['learning', 'dashboard'] as const,
  },
  social: {
    feed: ['social', 'feed'] as const,
    post: (id: string) => ['social', 'posts', id] as const,
    bookmarks: ['social', 'bookmarks'] as const,
  },
  groups: {
    all: ['groups'] as const,
    detail: (id: string) => ['groups', id] as const,
    posts: (id: string) => ['groups', id, 'posts'] as const,
  },
  chat: {
    conversations: ['chat', 'conversations'] as const,
    messages: (id: string) => ['chat', id, 'messages'] as const,
  },
  qna: {
    questions: ['qna', 'questions'] as const,
    question: (id: string) => ['qna', 'questions', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    users: ['admin', 'users'] as const,
    applications: ['admin', 'applications'] as const,
    courses: ['admin', 'courses'] as const,
    reports: ['admin', 'reports'] as const,
    withdrawals: ['admin', 'withdrawals'] as const,
  },
} as const;
```

**Pattern:** `['resource', id?, 'sub-resource']` — hierarchical arrays for precise invalidation.

---

## Step 3: Zustand Stores

### Location: `packages/shared-hooks/src/stores/`

Stores đặt trong `shared-hooks` (không per-portal) vì auth store dùng chung.
Cart store chỉ student portal dùng nhưng đặt chung cho consistency.

### `auth-store.ts`

```typescript
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
      name: 'sslm-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist user profile, NOT accessToken (security)
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
```

**Key decisions:**
- `sessionStorage` — clears when tab closes (NOT localStorage)
- `partialize` — only persist `user`, NOT `accessToken` (must refresh on new tab)
- `apiClient.setAccessToken()` called in actions — keeps client in sync
- No `window.__SSLM_ACCESS_TOKEN__` hack

### `cart-store.ts`

```typescript
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
  addItem: (item: CartItem) => void;
  removeItem: (courseId: string, chapterId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  syncWithServer: (serverItems: CartItem[]) => void;
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
        if (!exists) set((s) => ({ items: [...s.items, item] }));
      },

      removeItem: (courseId, chapterId) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.courseId === courseId && i.chapterId === chapterId),
          ),
        })),

      clearCart: () => set({ items: [], couponCode: null, discount: 0 }),
      applyCoupon: (code, discount) => set({ couponCode: code, discount }),
      removeCoupon: () => set({ couponCode: null, discount: 0 }),
      syncWithServer: (serverItems) => set({ items: serverItems }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price, 0),
      total: () => Math.max(0, get().subtotal() - get().discount),
      itemCount: () => get().items.length,
    }),
    { name: 'sslm-cart' },  // localStorage — persist across tabs for guest cart
  ),
);
```

### `ui-store.ts`

```typescript
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

### Export from `shared-hooks`

```typescript
// packages/shared-hooks/src/index.ts
export { useAuthStore } from './stores/auth-store';
export { useCartStore } from './stores/cart-store';
export { useUIStore } from './stores/ui-store';
```

---

## Step 4: Providers (Query + Auth)

### `src/providers/query-provider.tsx` (cả 2 portals)

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,     // 1 min
            gcTime: 5 * 60 * 1000,    // 5 min
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

### `src/providers/auth-provider.tsx` (cả 2 portals)

```tsx
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
```

**Key patterns:**
- **`useRef(false)` guard** — React 19 StrictMode runs useEffect twice in dev. Ref prevents double restoreSession()
- **`useAuthStore.getState()`** — static store access, no deps needed in useEffect (stable reference)
- **`onRefresh`/`onLogout` callbacks** — wired once on mount, apiClient calls them on 401 refresh/failure
- **Non-blocking** — `restoreSession()` runs async, children render immediately (no loading flash)

---

## Step 5: Wire providers into layouts

### `src/app/[locale]/layout.tsx` (cả 2 portals — UPDATE existing)

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'vi' | 'en')) notFound();
  const messages = await getMessages();

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="sslm-theme">
      <NextIntlClientProvider messages={messages}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </QueryProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
```

**Provider order:**
1. `ThemeProvider` — CSS theme (no React context needed by children)
2. `NextIntlClientProvider` — i18n translations
3. `QueryProvider` — TanStack Query cache
4. `AuthProvider` — restore session + wire callbacks
5. `Toaster` — toast notifications (Sonner)

---

## Step 6: Shared Hooks

### `packages/shared-hooks/src/use-debounce.ts`

```typescript
'use client';
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### `packages/shared-hooks/src/use-media-query.ts`

```typescript
'use client';
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
```

### `packages/shared-hooks/src/use-infinite-scroll.ts`

```typescript
'use client';
import { useEffect, useRef, useCallback } from 'react';

export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) onLoadMore();
        },
        { threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [onLoadMore, hasMore],
  );
  return sentinelRef;
}
```

### Export all from index

```typescript
// packages/shared-hooks/src/index.ts
export { useAuthStore } from './stores/auth-store';
export { useCartStore } from './stores/cart-store';
export { useUIStore } from './stores/ui-store';
export { useDebounce } from './use-debounce';
export { useMediaQuery } from './use-media-query';
export { useInfiniteScroll } from './use-infinite-scroll';
export { useApiError } from './use-api-error';
export { useChatSocket } from './use-chat-socket';
export { useNotificationSocket } from './use-notification-socket';
```

---

## Step 7: Socket.io Client hooks

### `packages/shared-hooks/src/use-chat-socket.ts`

```typescript
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
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

    socket.on('new_message', (message) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(message.conversationId),
      });
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [isAuthenticated, accessToken, queryClient]);

  const joinConversation = useCallback((id: string) => {
    socketRef.current?.emit('join_conversation', { conversationId: id });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    socketRef.current?.emit('send_message', { conversationId, content, type: 'TEXT' });
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  return { joinConversation, sendMessage, sendTyping };
}
```

### `packages/shared-hooks/src/use-notification-socket.ts`

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
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

    socket.on('notification', (notification) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
      toast.info(notification.data?.title || 'New notification');
    });

    socket.on('unread_count', (count: number) => {
      queryClient.setQueryData(queryKeys.notifications.unreadCount, { data: count });
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [isAuthenticated, accessToken, queryClient]);
}
```

---

## Step 8: Shared Types (full expansion — 18 interfaces, 22 enums)

### `packages/shared-types/src/index.ts`

Full type definitions matching ALL backend models and Prisma enums:

**Interfaces (18):**
- `User`, `Course`, `Section`, `Chapter`, `Lesson`, `Review`
- `CartItem`, `Order`
- `Post`, `Comment`, `Conversation`, `Message`
- `Question`, `Answer`
- `Notification`, `Category`, `Tag`, `Group`
- `LessonProgress`, `Certificate`, `InstructorProfile`

**Enums (22 — matching ALL Prisma enums):**
- `Role`, `UserStatus`, `CourseLevel`, `CourseStatus`, `LessonType`
- `OrderStatus`, `EnrollmentType`
- `PostType`, `MessageType`, `NotificationType`
- `GroupPrivacy`, `GroupRole`
- `ApplicationStatus`, `CouponType`, `WithdrawalStatus`, `EarningStatus`
- `MediaType`, `MediaStatus`
- `ReportTargetType`, `ReportStatus`

**Total: ~300 lines** — complete type coverage for all frontend needs.

---

## Step 8b: Shared i18n (102 error codes)

### `packages/shared-i18n/src/index.ts`

All 102 backend error codes organized by module:

```typescript
export const API_ERROR_CODES = {
  // Auth (10 codes)
  INVALID_CREDENTIALS, EMAIL_ALREADY_EXISTS, EMAIL_NOT_VERIFIED,
  INVALID_REFRESH_TOKEN, MISSING_REFRESH_TOKEN, INVALID_VERIFICATION_TOKEN,
  INVALID_RESET_TOKEN, INVALID_OTT, ACCOUNT_SUSPENDED, TOO_MANY_LOGIN_ATTEMPTS,

  // Users (4)
  USER_NOT_FOUND, CANNOT_FOLLOW_SELF, ALREADY_FOLLOWING, NOT_FOLLOWING,

  // Instructor (5)
  ALREADY_INSTRUCTOR, APPLICATION_ALREADY_PENDING, APPLICATION_NOT_FOUND,
  APPLICATION_ALREADY_REVIEWED, INSTRUCTOR_PROFILE_NOT_FOUND,

  // Courses (11)
  COURSE_NOT_FOUND, COURSE_NOT_EDITABLE, COURSE_INCOMPLETE_INFO, ...

  // Curriculum (7), Reviews (3), Cart (6), Orders (2), Coupons (7),
  // Enrollments (4), Chapters (2), Withdrawals (4), Webhooks (1),
  // Learning (3), Social (4), Groups (8), Chat (1), Q&A (7),
  // Notifications (1), AI (2), Media (2), Admin (5), Reports (3)

  // Total: 102 error codes
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
```

Frontend maps these to i18n: `t(\`apiErrors.${error.code}\`)`

---

## Step 9: Install missing shadcn components

Interactive CLI — user must run manually:

```bash
# Student Portal
cd apps/student-portal
npx shadcn@latest add form sonner tooltip alert alert-dialog
npx shadcn@latest add breadcrumb pagination navigation-menu command
npx shadcn@latest add checkbox radio-group switch slider label popover

# Management Portal
cd apps/management-portal
npx shadcn@latest add form sonner tooltip alert alert-dialog
npx shadcn@latest add breadcrumb pagination command
npx shadcn@latest add checkbox radio-group switch slider label popover
```

**Note:** shadcn components install into each portal's `src/components/ui/` (NOT shared-ui package). This is by design — each portal may customize components independently.

---

## Step 10: Error handling utilities

### `packages/shared-utils/src/api-errors.ts`

```typescript
// Map backend error codes to i18n keys
export function getErrorMessageKey(code: string): string {
  return `apiErrors.${code}`;
}

// Check if error is ApiError
export function isApiError(error: unknown): error is { code: string; statusCode: number } {
  return typeof error === 'object' && error !== null && 'code' in error && 'statusCode' in error;
}
```

### `packages/shared-hooks/src/use-api-error.ts`

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { isApiError } from '@shared/utils';

export function useApiError() {
  const t = useTranslations();

  return (error: unknown): string => {
    if (isApiError(error)) {
      const key = `apiErrors.${error.code}`;
      const translated = t.has(key) ? t(key) : error.code;
      return translated;
    }
    return t('common.unknownError');
  };
}
```

---

## Step 11: Verify

### Checklist

- [ ] `apiClient.get('/auth/me')` returns user data with JWT
- [ ] Auto-refresh on 401: expired token → refresh → retry → success
- [ ] Refresh fail → redirect to /login
- [ ] `QueryProvider` wraps app, devtools visible in development
- [ ] `AuthProvider` restores session on page load (refresh token cookie)
- [ ] `useAuthStore` — login/logout/setAccessToken work
- [ ] `useCartStore` — addItem/removeItem persist in localStorage
- [ ] `useUIStore` — toggleSidebar works
- [ ] `useDebounce` — delays value update
- [ ] `useMediaQuery` — responds to breakpoints
- [ ] `useInfiniteScroll` — triggers callback at sentinel
- [ ] Socket.io chat connects with JWT auth
- [ ] Socket.io notification shows toast on new notification
- [ ] `queryKeys` hierarchy invalidates correctly
- [ ] `isApiError` + `useApiError` maps error codes to i18n
- [ ] Sonner Toaster renders toasts
- [ ] Both portals build without errors
- [ ] Providers wired in correct order in locale layout
