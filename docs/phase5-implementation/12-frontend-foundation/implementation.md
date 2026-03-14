# Phase 5.12 — FRONTEND FOUNDATION & DESIGN SYSTEM

> shadcn/ui init, design tokens, layouts, API client, Zustand stores, shared components.
> Tham chiếu: `docs/phase4-frontend/01-design-system.md`, `docs/phase4-frontend/05-state-and-integration.md`

---

## Mục lục

- [Step 1: shadcn/ui Initialization](#step-1-shadcnui-initialization)
- [Step 2: Design Tokens & CSS Custom Properties](#step-2-design-tokens--css-custom-properties)
- [Step 3: Install shadcn/ui Components](#step-3-install-shadcnui-components)
- [Step 4: API Client (@shared/api-client)](#step-4-api-client-sharedapi-client)
- [Step 5: TanStack Query Setup](#step-5-tanstack-query-setup)
- [Step 6: Zustand Stores](#step-6-zustand-stores)
- [Step 7: Shared UI Components (@shared/ui)](#step-7-shared-ui-components-sharedui)
- [Step 8: Student Portal Layouts](#step-8-student-portal-layouts)
- [Step 9: Management Portal Layouts](#step-9-management-portal-layouts)
- [Step 10: Shared Hooks (@shared/hooks)](#step-10-shared-hooks-sharedhooks)
- [Step 11: i18n Translation Files](#step-11-i18n-translation-files)
- [Step 12: Socket.io Client](#step-12-socketio-client)
- [Step 13: Verify](#step-13-verify)

---

## Step 1: shadcn/ui Initialization

### Both portals

```bash
# Student Portal
cd apps/student-portal
npx shadcn@latest init

# Management Portal
cd apps/management-portal
npx shadcn@latest init
```

Interactive prompts:

- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind CSS: v4
- React Server Components: Yes
- Path aliases: @/components, @/lib

---

## Step 2: Design Tokens & CSS Custom Properties

### `src/styles/globals.css` (cả 2 portals)

```css
@import 'tailwindcss';

:root {
  /* Brand */
  --color-primary: 222.2 47.4% 11.2%;
  --color-primary-foreground: 210 40% 98%;
  --color-secondary: 210 40% 96.1%;
  --color-secondary-foreground: 222.2 47.4% 11.2%;
  --color-accent: 142.1 76.2% 36.3%;

  /* Semantic */
  --color-background: 0 0% 100%;
  --color-foreground: 222.2 84% 4.9%;
  --color-card: 0 0% 100%;
  --color-card-foreground: 222.2 84% 4.9%;
  --color-muted: 210 40% 96.1%;
  --color-muted-foreground: 215.4 16.3% 46.9%;
  --color-border: 214.3 31.8% 91.4%;
  --color-input: 214.3 31.8% 91.4%;

  /* Status */
  --color-destructive: 0 84.2% 60.2%;
  --color-success: 142.1 76.2% 36.3%;
  --color-warning: 38 92% 50%;
  --color-info: 217.2 91.2% 59.8%;

  /* Learning specific */
  --color-progress: 142.1 76.2% 36.3%;
  --color-streak: 38 92% 50%;
}

[data-theme='dark'] {
  --color-background: 222.2 84% 4.9%;
  --color-foreground: 210 40% 98%;
  --color-card: 222.2 84% 4.9%;
  --color-card-foreground: 210 40% 98%;
  --color-muted: 217.2 32.6% 17.5%;
  --color-muted-foreground: 215 20.2% 65.1%;
  --color-border: 217.2 32.6% 17.5%;
  --color-input: 217.2 32.6% 17.5%;
  --color-primary: 210 40% 98%;
  --color-primary-foreground: 222.2 47.4% 11.2%;
}
```

---

## Step 3: Install shadcn/ui Components

```bash
# Core components (both portals)
npx shadcn@latest add button input textarea select checkbox radio-group
npx shadcn@latest add switch slider label separator
npx shadcn@latest add badge avatar card table progress skeleton
npx shadcn@latest add alert alert-dialog tooltip
npx shadcn@latest add tabs breadcrumb pagination navigation-menu
npx shadcn@latest add dialog sheet popover dropdown-menu command
npx shadcn@latest add form          # React Hook Form integration
npx shadcn@latest add sonner        # Toast
```

---

## Step 4: API Client (@shared/api-client)

### `packages/shared-api-client/src/client.ts`

```typescript
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // For httpOnly cookies (refresh token)
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Get token from Zustand store (imported at runtime)
  const token = typeof window !== 'undefined' ? window.__SSLM_ACCESS_TOKEN__ : undefined;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await apiClient.post('/auth/refresh');
        const newToken = data.data?.accessToken || data.accessToken;

        if (typeof window !== 'undefined') {
          window.__SSLM_ACCESS_TOKEN__ = newToken;
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed → logout
        if (typeof window !== 'undefined') {
          window.__SSLM_ACCESS_TOKEN__ = undefined;
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);
```

### Query hooks pattern — `packages/shared-api-client/src/hooks/use-courses.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useCourses(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => apiClient.get('/courses', { params }).then((r) => r.data),
  });
}

export function useCourseDetail(slug: string) {
  return useQuery({
    queryKey: ['courses', slug],
    queryFn: () => apiClient.get(`/courses/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });
}

export function useCreateReview(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      apiClient.post(`/courses/${courseId}/reviews`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'reviews'] });
    },
  });
}
```

---

## Step 5: TanStack Query Setup

### Install

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools --workspace=apps/student-portal
npm install @tanstack/react-query @tanstack/react-query-devtools --workspace=apps/management-portal
```

### Provider — `src/providers/query-provider.tsx`

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
            staleTime: 60 * 1000, // 1 min
            gcTime: 5 * 60 * 1000, // 5 min
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Step 6: Zustand Stores

### Install

```bash
npm install zustand --workspace=apps/student-portal
npm install zustand --workspace=apps/management-portal
```

### `src/stores/auth.store.ts`

```typescript
import { create } from 'zustand';

interface AuthState {
  user: { id: string; email: string; fullName: string; role: string; avatarUrl?: string } | null;
  accessToken: string | null;
  login: (user: AuthState['user'], token: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,

  login: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __SSLM_ACCESS_TOKEN__: string }).__SSLM_ACCESS_TOKEN__ = accessToken;
    }
    set({ user, accessToken });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __SSLM_ACCESS_TOKEN__: undefined }).__SSLM_ACCESS_TOKEN__ = undefined;
    }
    set({ user: null, accessToken: null });
  },

  setAccessToken: (token) => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __SSLM_ACCESS_TOKEN__: string }).__SSLM_ACCESS_TOKEN__ = token;
    }
    set({ accessToken: token });
  },
}));
```

### `src/stores/cart.store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  courseId?: string;
  chapterId?: string;
  title: string;
  price: number;
  thumbnailUrl?: string;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setCoupon: (code: string | null) => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clearCart: () => set({ items: [], couponCode: null }),
      setCoupon: (code) => set({ couponCode: code }),
      total: () => get().items.reduce((sum, i) => sum + i.price, 0),
    }),
    { name: 'sslm-cart' },
  ),
);
```

### `src/stores/ui.store.ts`

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileNav: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
```

---

## Step 7: Shared UI Components (@shared/ui)

Key components to create in `packages/shared-ui/src/`:

- `ThemeToggle.tsx` — Dark/Light/System toggle using next-themes
- `LocaleSwitcher.tsx` — Language switcher (vi/en) using next-intl
- `SearchBar.tsx` — Search input with debounce
- `InfiniteScroll.tsx` — Intersection observer wrapper
- `EmptyState.tsx` — Empty state placeholder with icon + message
- `ErrorBoundary.tsx` — React error boundary
- `LoadingOverlay.tsx` — Full-screen loading spinner
- `ConfirmDialog.tsx` — Confirmation dialog wrapper
- `ImageWithFallback.tsx` — Image with fallback on error

---

## Step 8: Student Portal Layouts

### `src/app/[locale]/(main)/layout.tsx`

```tsx
// Server component
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
```

### `src/app/[locale]/(learning)/layout.tsx`

```tsx
// Learning layout with sidebar curriculum
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="bg-card w-80 overflow-y-auto border-r">
        {/* Curriculum sidebar — rendered by page */}
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

### `src/app/[locale]/(auth)/layout.tsx`

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

---

## Step 9: Management Portal Layouts

### Dashboard layout with sidebar

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 border-r" />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Desktop-only guard

```tsx
'use client';
export function DesktopGuard({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  if (!isDesktop) return <DesktopOnlyMessage />;
  return <>{children}</>;
}
```

---

## Step 10: Shared Hooks (@shared/hooks)

- `use-auth.ts` — Auth helper (login, logout, check auth)
- `use-debounce.ts` — Debounce value
- `use-media-query.ts` — Responsive breakpoints
- `use-infinite-scroll.ts` — Intersection observer for infinite loading

---

## Step 11: i18n Translation Files

### Structure per portal: `messages/vi.json`, `messages/en.json`

Key namespaces:

- `common` — Shared strings (buttons, labels)
- `auth` — Login, register, password
- `courses` — Course browse, detail
- `learning` — Progress, quiz, certificate
- `social` — Posts, comments, chat
- `ecommerce` — Cart, orders, payment
- `dashboard` — Instructor/admin dashboard
- `apiErrors` — Backend error code mappings

### Example: `messages/vi.json`

```json
{
  "common": {
    "save": "Lưu",
    "cancel": "Hủy",
    "delete": "Xóa",
    "search": "Tìm kiếm",
    "loading": "Đang tải...",
    "noResults": "Không tìm thấy kết quả"
  },
  "auth": {
    "login": "Đăng nhập",
    "register": "Đăng ký",
    "email": "Email",
    "password": "Mật khẩu",
    "forgotPassword": "Quên mật khẩu?"
  },
  "apiErrors": {
    "EMAIL_ALREADY_EXISTS": "Email đã được sử dụng",
    "INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng",
    "EMAIL_NOT_VERIFIED": "Vui lòng xác nhận email trước khi đăng nhập"
  }
}
```

---

## Step 12: Socket.io Client

### Install

```bash
npm install socket.io-client --workspace=apps/student-portal
```

### `packages/shared-api-client/src/socket.ts`

```typescript
import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function createChatSocket(token: string): Socket {
  return io(`${WS_URL}/chat`, {
    auth: { token },
    autoConnect: false,
  });
}

export function createNotificationSocket(token: string): Socket {
  return io(`${WS_URL}/notifications`, {
    auth: { token },
    autoConnect: false,
  });
}
```

---

## Step 13: Verify

### Checklist

- [ ] shadcn/ui initialized in both portals
- [ ] Design tokens work in both light and dark modes
- [ ] All shadcn/ui components installed and importable
- [ ] API client sends requests with JWT token
- [ ] Auto-refresh on 401 works
- [ ] TanStack Query provider wraps app
- [ ] Zustand stores (auth, cart, UI) work correctly
- [ ] Cart persists in localStorage
- [ ] Student portal layouts render correctly (main, learning, auth)
- [ ] Management portal layout with sidebar works
- [ ] Desktop-only guard shows message on mobile
- [ ] i18n translations load for both vi and en
- [ ] Theme toggle switches between light/dark/system
- [ ] Locale switcher changes language
- [ ] Socket.io connects with JWT auth
