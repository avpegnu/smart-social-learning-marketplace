# Phase 5.14a — Auth, Navigation & Shared Hooks

> Login with API, role-based redirect, auth guards, sidebar/header with real data,
> shared API hooks for management endpoints, theme toggle fix.

---

## 1. OVERVIEW

### Current State
- Login page: mock form with `onSubmit={(e) => e.preventDefault()}`
- Sidebar: hardcoded "Nguyen Van An" / "Admin"
- Header: hardcoded notification badge "3"
- Instructor layout: no auth guard (any user can access)
- Admin layout: no auth guard
- Auth provider: already has session restore logic (same as student portal)
- Theme toggle: same component as student portal (already fixed)

### Goal
Wire login with real API, add role-based guards, show real user data in sidebar/header.

---

## 2. LOGIN PAGE — Role-Based Redirect

### File: `apps/management-portal/src/app/[locale]/(auth)/login/page.tsx`

**Rewrite to:**
- React Hook Form + Zod validation (reuse loginSchema from shared or create management-specific)
- `useLogin()` hook from `@shared/hooks`
- On success: check `user.role`:
  - `INSTRUCTOR` → `router.push('/instructor/dashboard')`
  - `ADMIN` → `router.push('/admin/dashboard')`
  - `STUDENT` → `router.push('/unauthorized')` (students can't use management portal)
- Loading state on button
- Error toast via hook's onError

```tsx
// Key logic
const loginMutation = useLogin();

const onSubmit = (data: LoginValues) => {
  loginMutation.mutate(data, {
    onSuccess: (res) => {
      const role = res.data.user.role;
      if (role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'INSTRUCTOR') {
        router.push('/instructor/dashboard');
      } else {
        // Student tried to login to management portal
        router.push('/unauthorized');
      }
    },
  });
};
```

### Zod Schema

```typescript
// apps/management-portal/src/lib/validations/auth.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginValues = z.infer<typeof loginSchema>;
```

Note: Management portal login is simpler — no register, no forgot password.
Only email + password. Password validation is minimal (just non-empty) since
the backend handles actual validation.

---

## 3. AUTH LAYOUT — Redirect if Authenticated

### File: `apps/management-portal/src/app/[locale]/(auth)/layout.tsx`

Add redirect logic: if user is already authenticated, redirect to appropriate dashboard.

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@shared/hooks';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'INSTRUCTOR') {
        router.replace('/instructor/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

---

## 4. INSTRUCTOR LAYOUT — Auth Guard

### File: `apps/management-portal/src/app/[locale]/instructor/layout.tsx`

Add auth guard: only INSTRUCTOR or ADMIN can access.

```tsx
// Add to existing layout:
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const user = useAuthStore((s) => s.user);
const router = useRouter();

useEffect(() => {
  if (!isAuthenticated) {
    router.replace('/login');
    return;
  }
  if (user && user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
    router.replace('/unauthorized');
  }
}, [isAuthenticated, user, router]);

if (!isAuthenticated || !user) return null;
if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') return null;
```

---

## 5. ADMIN LAYOUT — Auth Guard

### File: `apps/management-portal/src/app/[locale]/admin/layout.tsx`

Add auth guard: only ADMIN can access.

```tsx
// Add to existing layout:
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const user = useAuthStore((s) => s.user);
const router = useRouter();

useEffect(() => {
  if (!isAuthenticated) {
    router.replace('/login');
    return;
  }
  if (user && user.role !== 'ADMIN') {
    router.replace('/unauthorized');
  }
}, [isAuthenticated, user, router]);

if (!isAuthenticated || !user) return null;
if (user.role !== 'ADMIN') return null;
```

---

## 6. SIDEBAR — Real User Data

### File: `apps/management-portal/src/components/navigation/sidebar.tsx`

Replace hardcoded user info with auth store data.

```tsx
// Replace hardcoded "Nguyen Van An" / "Admin"
import { useAuthStore } from '@shared/hooks';
import { useLogout } from '@shared/hooks';

// Inside component:
const user = useAuthStore((s) => s.user);
const logoutMutation = useLogout();

// User profile section at bottom:
<AvatarSimple
  src={user?.avatarUrl}
  alt={user?.fullName || ''}
  size="sm"
/>
{!collapsed && (
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">{user?.fullName}</p>
    <p className="truncate text-xs">{user?.role === 'ADMIN' ? 'Administrator' : 'Instructor'}</p>
  </div>
)}

// Add logout button:
<button
  onClick={() => logoutMutation.mutate(undefined, {
    onSettled: () => { window.location.href = '/login'; }
  })}
  className="..."
>
  <LogOut className="h-4 w-4" />
  {!collapsed && <span>{t('logout')}</span>}
</button>
```

---

## 7. HEADER — Real Notifications

### File: `apps/management-portal/src/components/navigation/header.tsx`

Wire notification count with API.

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { useAuthStore } from '@shared/hooks';

// Inside component:
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const user = useAuthStore((s) => s.user);

const { data: unreadCount } = useQuery({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => apiClient.get<number>('/notifications/unread-count'),
  enabled: isAuthenticated,
  refetchInterval: 30000, // Poll every 30s
});

// Replace hardcoded "3":
{(unreadCount?.data ?? 0) > 0 && (
  <span className="...">{unreadCount.data}</span>
)}

// Replace hardcoded avatar:
<AvatarSimple
  src={user?.avatarUrl}
  alt={user?.fullName || ''}
  size="sm"
/>
```

---

## 8. SHARED API HOOKS — Notifications

### File: `packages/shared-hooks/src/api/use-notifications.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';

export function useNotifications(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => apiClient.get('/notifications', { params }),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get<number>('/notifications/unread-count'),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.put('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

---

## 9. THEME TOGGLE FIX

### File: `apps/management-portal/src/components/theme-toggle.tsx`

Ensure same instant-switch fix as student portal (disable transitions during theme change).
The management portal theme-toggle.tsx should already have this if it was copied from
student portal in Phase 5.12. Verify and fix if needed.

### File: `apps/management-portal/src/app/globals.css`

Ensure `disable-transitions` class exists (already added in Phase 5.13a for student portal,
verify it exists in management portal's globals.css too).

---

## 10. INDEX PAGE REDIRECT

### File: `apps/management-portal/src/app/[locale]/page.tsx`

Currently redirects to `/instructor/dashboard`. Update to check role:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@shared/hooks';

export default function IndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user?.role === 'ADMIN') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/instructor/dashboard');
    }
  }, [isAuthenticated, user, router]);

  return null;
}
```

---

## 11. i18n UPDATES

### Add/update keys in `messages/vi.json` and `messages/en.json`:

```json
{
  "auth": {
    "loginTitle": "Đăng nhập quản lý",
    "loginSubtitle": "Sử dụng tài khoản giảng viên hoặc quản trị viên"
  },
  "apiErrors": {
    "INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng",
    "ACCOUNT_UNVERIFIED": "Tài khoản chưa được xác thực",
    "ACCOUNT_SUSPENDED": "Tài khoản đã bị khóa",
    "MISSING_REFRESH_TOKEN": "Phiên đăng nhập hết hạn"
  },
  "nav": {
    "logout": "Đăng xuất"
  }
}
```

---

## 12. AUTH STORE — Persist accessToken to sessionStorage

### File: `packages/shared-hooks/src/stores/auth-store.ts`

**Problem:** accessToken was only in memory (excluded from `partialize`).
Every F5 lost the token → AuthProvider always called POST /auth/refresh.

**Fix:** Persist `accessToken` + `isAuthenticated` alongside `user` in sessionStorage.

```typescript
partialize: (state) => ({
  user: state.user,
  accessToken: state.accessToken,
  isAuthenticated: state.isAuthenticated,
}),
```

- sessionStorage is **tab-scoped** (cleared on tab close) — still secure
- If token expires while stored, apiClient's 401 handler auto-refreshes
- Eliminates unnecessary refresh calls on every page reload

---

## 13. HYDRATION FLASH FIX — useAuthHydrated

### File: `packages/shared-hooks/src/use-auth-hydrated.ts`

**Problem:** Zustand `persist` hydrates **async**. Before hydration completes,
`isAuthenticated = false` → Navbar renders Guest UI briefly → flash.

**Fix:** `useAuthHydrated()` hook using `useSyncExternalStore`:

```typescript
export function useAuthHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false, // Server snapshot
  );
}
```

**Usage in Navbar (student portal):**
```tsx
const hydrated = useAuthHydrated();

{!hydrated ? (
  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
) : isAuthenticated ? (
  /* Authenticated UI */
) : (
  /* Guest UI */
)}
```

---

## 14. FILES SUMMARY

### Created (3 files):
| File | Lines | Purpose |
|------|-------|---------|
| `management-portal/src/lib/validations/auth.ts` | 8 | Login Zod schema |
| `shared-hooks/src/api/use-notifications.ts` | 42 | 4 notification hooks |
| `shared-hooks/src/use-auth-hydrated.ts` | 15 | Hydration state hook |

### Modified — Management Portal (8 files):
| File | Changes |
|------|---------|
| `(auth)/login/page.tsx` | RHF + Zod + useLogin + role-based redirect |
| `(auth)/layout.tsx` | Client component + redirect if authenticated |
| `instructor/layout.tsx` | + auth guard (INSTRUCTOR or ADMIN) |
| `admin/layout.tsx` | + auth guard (ADMIN only) |
| `navigation/sidebar.tsx` | Real user data from auth store + logout button |
| `navigation/header.tsx` | Real notification count + user avatar, removed variant prop |
| `[locale]/page.tsx` | Client component + role-based redirect |
| `messages/vi.json` + `en.json` | + 17 apiErrors keys |

### Modified — Shared Packages (2 files):
| File | Changes |
|------|---------|
| `shared-hooks/src/stores/auth-store.ts` | Persist accessToken + isAuthenticated |
| `shared-hooks/src/index.ts` | + export notification hooks + useAuthHydrated |

### Modified — Student Portal (1 file):
| File | Changes |
|------|---------|
| `student-portal/navbar.tsx` | + useAuthHydrated to prevent flash of guest UI |

---

## 15. VERIFICATION

- [x] Login with INSTRUCTOR credentials → redirects to /instructor/dashboard
- [x] Login with ADMIN credentials → redirects to /admin/dashboard
- [x] Login with STUDENT credentials → redirects to /unauthorized
- [x] Already authenticated → visiting /login redirects to dashboard
- [x] Sidebar shows real user name and role
- [x] Logout clears session and redirects to /login
- [x] Header shows real notification count (no hardcoded "3")
- [x] Guest visiting /instructor/* → redirects to /login
- [x] INSTRUCTOR visiting /admin/* → redirects to /unauthorized
- [x] Theme toggle works instantly (no lag)
- [x] Both vi and en locales work
- [x] F5 while logged in → no flash of guest UI
- [x] F5 while logged in → no unnecessary refresh call
- [x] Both portals build cleanly
