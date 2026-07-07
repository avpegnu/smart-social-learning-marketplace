# 01 — Auth & Navigation: Login, Role Guards, Session Persistence, Hydration Fix

> Giải thích chi tiết Phase 5.14a — login với role-based redirect, auth guards cho instructor/admin layouts,
> sidebar/header với real data, session persistence fix, và hydration flash fix.

---

## 1. TỔNG QUAN

### 1.1 Bài toán

Mock UI đã có login page, sidebar, header, nhưng:
- Login form dùng `onSubmit={(e) => e.preventDefault()}` — không gọi API
- Sidebar hardcode "Nguyen Van An" / "Admin"
- Header hardcode notification badge "3"
- Instructor/Admin layouts không có auth guard — ai cũng truy cập được
- F5 page khi đã login → gọi refresh token không cần thiết
- F5 page khi đã login → flash màn hình guest trước khi hiện authenticated UI

### 1.2 Giải pháp — 4 layers

```
Layer 1: Login Page
  └── React Hook Form + Zod + useLogin() → role-based redirect

Layer 2: Auth Guards (3 layouts)
  ├── (auth)/layout.tsx    → redirect TO dashboard if authenticated
  ├── instructor/layout.tsx → redirect TO login if not INSTRUCTOR/ADMIN
  └── admin/layout.tsx     → redirect TO login if not ADMIN

Layer 3: Real Data (sidebar + header)
  ├── Sidebar: user name, role, avatar, logout button
  └── Header: notification count from API, user avatar

Layer 4: Session Fixes (shared — affects both portals)
  ├── auth-store: persist accessToken to sessionStorage
  └── useAuthHydrated: prevent flash of guest UI on F5
```

---

## 2. LOGIN PAGE — Role-Based Redirect

### 2.1 Tại sao Management Portal login khác Student Portal?

```
Student Portal:
  - Register, Forgot Password, Verify Email, Reset Password
  - Login → redirect home (mọi role đều OK)

Management Portal:
  - CHỈ có Login (instructor/admin đã có account từ student portal)
  - Login → check role:
    - ADMIN → /admin/dashboard
    - INSTRUCTOR → /instructor/dashboard
    - STUDENT → /unauthorized (không được truy cập)
```

Management portal **không cần** register, forgot password vì instructor/admin
dùng chung credentials với student portal. Họ đăng ký và quản lý mật khẩu
bên student portal.

### 2.2 Zod Schema đơn giản

```typescript
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),  // Chỉ check non-empty
});
```

**Tại sao không validate password phức tạp như student portal?**
Student portal validate `min(8) + regex(uppercase + digit)` để giúp user tạo
password mạnh khi register. Management portal chỉ login — backend sẽ validate
credentials, frontend chỉ cần biết "có nhập gì chưa".

### 2.3 Reuse useLogin() hook

```typescript
const loginMutation = useLogin();  // From @shared/hooks

const onSubmit = (data: LoginValues) => {
  loginMutation.mutate(data, {
    onSuccess: (res) => {
      const role = res.data.user.role;
      if (role === 'ADMIN') router.push('/admin/dashboard');
      else if (role === 'INSTRUCTOR') router.push('/instructor/dashboard');
      else router.push('/unauthorized');
    },
  });
};
```

`useLogin()` đã handle:
- Call POST /auth/login
- `onSuccess`: setAuth(user, token) vào Zustand store
- `onError`: toast.error(getErrorMessage(error))

Page chỉ cần handle redirect trong `mutate({ onSuccess })`.
TanStack Query cho phép `onSuccess` ở CẢ 2 nơi — hook level VÀ mutate level.
Cả 2 đều chạy, hook level trước.

---

## 3. AUTH GUARDS — 3-Layer Protection

### 3.1 Mô hình

```
                    ┌─────────────────────┐
                    │    Auth Layout       │
                    │  (auth pages only)   │
                    │                      │
                    │  IF authenticated    │
                    │  → redirect OUT      │
                    └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│  Instructor Layout   │     │    Admin Layout      │
│                      │     │                      │
│  REQUIRE:            │     │  REQUIRE:            │
│  INSTRUCTOR or ADMIN │     │  ADMIN only          │
│                      │     │                      │
│  Else → /login       │     │  Else → /login       │
│  or → /unauthorized  │     │  or → /unauthorized  │
└─────────────────────┘     └─────────────────────┘
```

### 3.2 Auth Layout — Redirect nếu đã login

```typescript
useEffect(() => {
  if (isAuthenticated && user) {
    if (user.role === 'ADMIN') router.replace('/admin/dashboard');
    else router.replace('/instructor/dashboard');
  }
}, [isAuthenticated, user, router]);

if (isAuthenticated) return null;  // Tránh flash of login form
```

**`return null` trước redirect:** `router.replace()` là async — mất vài ms để
navigate. Trong thời gian đó nếu render login form → flash. `return null`
đảm bảo không render gì cho đến khi redirect hoàn tất.

### 3.3 Instructor Layout — INSTRUCTOR hoặc ADMIN

```typescript
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

**Tại sao ADMIN cũng được vào instructor pages?** Admin cần xem instructor
dashboard, courses, revenue để support và debug. Admin là superset của
instructor về permissions.

### 3.4 Admin Layout — Chỉ ADMIN

```typescript
if (user.role !== 'ADMIN') router.replace('/unauthorized');
```

Strict hơn — instructor KHÔNG được vào admin pages (user management,
approvals, platform settings).

### 3.5 Double Guard Pattern

Mỗi layout có **2 lớp** guard:
1. **`useEffect` redirect** — navigate away (async)
2. **`if (...) return null`** — block render ngay lập tức (sync)

Lớp 2 cần thiết vì `useEffect` chạy SAU render đầu tiên. Nếu chỉ có
`useEffect`, sẽ có 1 frame render nội dung protected trước khi redirect.

---

## 4. SIDEBAR — Real User Data + Logout

### 4.1 Thay thế hardcoded data

```
TRƯỚC:
  <AvatarSimple alt="Nguyen Van An" />
  <p>Nguyen Van An</p>
  <p>Instructor</p>

SAU:
  <AvatarSimple src={user?.avatarUrl} alt={user?.fullName ?? ''} />
  <p>{user?.fullName}</p>
  <p>{user?.role === 'ADMIN' ? 'Administrator' : 'Instructor'}</p>
```

### 4.2 Logout Flow

```typescript
logoutMutation.mutate(undefined, {
  onSettled: () => {
    window.location.href = '/login';
  },
});
```

**`onSettled` thay vì `onSuccess`:** Logout phải clear session DÙ API fail
(network error, server down). `onSettled` chạy cả khi success và error.

**`window.location.href` thay vì `router.push`:** Full page reload đảm bảo
mọi client state (Zustand stores, TanStack Query cache, WebSocket connections)
đều bị clear sạch. `router.push` chỉ navigate trong SPA — có thể giữ lại
stale state.

---

## 5. HEADER — Real Notification Count

### 5.1 Polling pattern

```typescript
const { data: unreadData } = useQuery({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => apiClient.get<number>('/notifications/unread-count'),
  enabled: isAuthenticated,      // Chỉ fetch khi đã login
  refetchInterval: 30_000,       // Poll mỗi 30s
});
```

**`enabled: isAuthenticated`:** Guest không có notifications → không gọi API.
Tránh 401 error khi chưa có token.

**`refetchInterval: 30_000`:** Lightweight polling — chỉ 1 count query mỗi 30s.
Tương lai có thể bổ sung WebSocket push cho real-time, nhưng polling đủ tốt
cho management portal (ít users, không cần instant).

### 5.2 Removed `variant` prop

```
TRƯỚC: <Header variant="instructor" />  — dùng variant để hardcode user info
SAU:   <Header />                        — lấy user từ auth store
```

`variant` prop không còn cần thiết vì header lấy user data từ Zustand store,
không phải từ prop. Cả instructor và admin layout đều render cùng một Header
component.

---

## 6. INDEX PAGE — Role-Based Redirect

### 6.1 Thay đổi

```
TRƯỚC (Server Component):
  redirect(`/${locale}/instructor/dashboard`);  // Luôn redirect instructor

SAU (Client Component):
  if (!isAuthenticated) router.replace('/login');
  else if (user?.role === 'ADMIN') router.replace('/admin/dashboard');
  else router.replace('/instructor/dashboard');
```

**Tại sao chuyển sang Client Component?** Cần đọc auth state từ Zustand
(client-side store). Server Component không access được client-side state.

---

## 7. NOTIFICATION HOOKS — Shared Package

### File: `packages/shared-hooks/src/api/use-notifications.ts`

4 hooks cho notification management:

| Hook | Type | Endpoint |
|------|------|----------|
| `useUnreadNotificationCount` | Query | GET /notifications/unread-count |
| `useNotifications` | Query | GET /notifications |
| `useMarkNotificationRead` | Mutation | PUT /notifications/:id/read |
| `useMarkAllNotificationsRead` | Mutation | PUT /notifications/read-all |

**Tại sao để trong shared package?** Cả student portal và management portal
đều cần notification features. Shared hooks tránh duplicate code.

**Invalidation pattern:** Khi mark read → invalidate cả `['notifications']`
query key → refetch notification list VÀ unread count.

---

## 8. AUTH STORE — Persist accessToken vào sessionStorage

### 8.1 Vấn đề

```
TRƯỚC:
  partialize: (state) => ({ user: state.user })  // CHỈ persist user

  F5 → accessToken = null → isAuthenticated = false
    → AuthProvider: "chưa authenticated" → gọi POST /auth/refresh
    → DÙ token cũ vẫn còn hạn (15 phút)
```

Mỗi F5 đều gọi refresh endpoint — lãng phí request, tăng latency.

### 8.2 Fix

```typescript
partialize: (state) => ({
  user: state.user,
  accessToken: state.accessToken,
  isAuthenticated: state.isAuthenticated,
}),
```

```
SAU:
  F5 → accessToken RESTORE từ sessionStorage → isAuthenticated = true
    → AuthProvider: "already authenticated" → sync token to apiClient → DONE
    → KHÔNG gọi refresh
    → Nếu token hết hạn (>15 phút) → API call → 401 → apiClient auto-refresh
```

### 8.3 Tại sao sessionStorage an toàn?

```
localStorage:  Persist vĩnh viễn, shared giữa các tab → KHÔNG AN TOÀN
sessionStorage: Chỉ tồn tại trong tab hiện tại, cleared khi đóng tab → AN TOÀN
memory (RAM):  Mất khi F5 → cần refresh mỗi lần → không tối ưu
```

sessionStorage là trade-off tốt nhất:
- **An toàn hơn localStorage:** Tab-scoped, auto-cleared
- **Tối ưu hơn memory:** Không cần refresh mỗi lần F5
- **Token có TTL:** Dù bị đọc, hết hạn sau 15 phút

### 8.4 Token hết hạn trong sessionStorage?

Nếu user để tab mở >15 phút rồi tương tác:
1. apiClient gửi request với expired token
2. Backend trả 401
3. apiClient tự gọi POST /auth/refresh (deduplication)
4. Nhận token mới → retry original request
5. User không thấy gì — seamless

**Đây là cùng flow** khi token hết hạn trong memory. Sự khác biệt duy nhất:
session persistence giúp **SKIP** refresh call khi token **CÒN HẠN** (F5 trong
15 phút đầu).

---

## 9. HYDRATION FLASH FIX — useSyncExternalStore

### 9.1 Vấn đề

```
Timeline khi F5 (trước fix):

  0ms:  JS load → React render lần 1
        Zustand default: { isAuthenticated: false }
        Navbar: hiện Guest UI (Login/Register buttons) ← FLASH!

  ~50ms: Zustand hydrate từ sessionStorage
         { isAuthenticated: true, user: {...} }
         Navbar: re-render → hiện Auth UI (Avatar/Cart/Bell)
```

Khoảng 50ms flash là đủ để user nhận ra — thấy Login/Register buttons nhảy
thành Avatar/Cart/Bell.

### 9.2 Root Cause

Zustand `persist` middleware hydrate **async**:

```typescript
// Simplified Zustand persist internals
const storage = sessionStorage;
const storedState = JSON.parse(storage.getItem('sslm-auth'));
// ↑ Này chạy ASYNC sau khi React đã render lần đầu
setState(merge(initialState, storedState));
```

Render đầu tiên luôn dùng `initialState` (isAuthenticated: false).

### 9.3 Fix: useAuthHydrated()

```typescript
import { useSyncExternalStore } from 'react';
import { useAuthStore } from './stores/auth-store';

export function useAuthHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,  // Server snapshot — chưa hydrate trên server
  );
}
```

### 9.4 useSyncExternalStore — Lý thuyết

`useSyncExternalStore` là React 18+ hook cho **subscribing to external stores**.
Nó đảm bảo:
1. **Tearing prevention:** Mọi component đọc cùng snapshot trong 1 render
2. **SSR support:** `getServerSnapshot` trả giá trị cho server rendering
3. **Automatic re-render:** Khi store thay đổi, component re-render

```typescript
useSyncExternalStore(
  subscribe,          // (callback) => unsubscribe — gọi callback khi store change
  getSnapshot,        // () => value — đọc giá trị hiện tại
  getServerSnapshot,  // () => value — giá trị cho SSR
);
```

Áp dụng vào hydration:
- `subscribe`: `onFinishHydration` — Zustand persist fire khi hydrate xong
- `getSnapshot`: `hasHydrated()` — true/false
- `getServerSnapshot`: `false` — server chưa hydrate

### 9.5 Usage in Navbar

```tsx
const hydrated = useAuthHydrated();

{!hydrated ? (
  // Placeholder — hiện khi chưa biết auth state
  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
) : isAuthenticated ? (
  // Authenticated UI — Cart, Bell, Avatar
) : (
  // Guest UI — Login, Register buttons
)}
```

```
Timeline sau fix:

  0ms:  JS load → React render lần 1
        hydrated = false
        Navbar: hiện placeholder (●) ← Smooth, no flash

  ~50ms: Zustand hydrate → hydrated = true
         Navbar: hiện đúng UI (Auth hoặc Guest)
```

Placeholder nhỏ (chỉ 1 circle) nên transition rất smooth. User không nhận ra
sự thay đổi vì placeholder gần giống avatar size.

---

## 10. i18n — API Error Codes

### 10.1 Pattern

Backend trả error code machine-readable:
```json
{ "code": "INVALID_CREDENTIALS", "statusCode": 401 }
```

Frontend map qua i18n:
```typescript
// useApiError hook
const key = `apiErrors.${error.code}`;
return t.has(key) ? t(key) : error.code;
```

### 10.2 Keys thêm (17 error codes)

```json
{
  "apiErrors": {
    "INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng",
    "ACCOUNT_UNVERIFIED": "Tài khoản chưa được xác thực email",
    "ACCOUNT_SUSPENDED": "Tài khoản đã bị khóa",
    "ACCOUNT_NOT_FOUND": "Tài khoản không tồn tại",
    "EMAIL_ALREADY_EXISTS": "Email đã được sử dụng",
    "MISSING_REFRESH_TOKEN": "Phiên đăng nhập hết hạn",
    "INVALID_REFRESH_TOKEN": "Phiên đăng nhập không hợp lệ",
    "TOKEN_EXPIRED": "Phiên đăng nhập đã hết hạn",
    "INVALID_TOKEN": "Mã xác thực không hợp lệ",
    "FORBIDDEN": "Bạn không có quyền thực hiện hành động này",
    "NOT_FOUND": "Không tìm thấy dữ liệu",
    "COURSE_NOT_FOUND": "Không tìm thấy khóa học",
    "INSUFFICIENT_BALANCE": "Số dư không đủ",
    "MIN_WITHDRAWAL_NOT_MET": "Chưa đạt số tiền rút tối thiểu",
    "COUPON_NOT_FOUND": "Mã giảm giá không tồn tại",
    "COUPON_EXPIRED": "Mã giảm giá đã hết hạn",
    "CATEGORY_HAS_COURSES": "Không thể xóa danh mục đang có khóa học"
  }
}
```

Nhiều error codes hơn student portal vì management portal tương tác với
nhiều resources hơn (courses, coupons, withdrawals, categories).

---

## 11. FILES CREATED / MODIFIED

### Created (3 files):

| File | Lines | Mục đích |
|------|-------|----------|
| `management-portal/src/lib/validations/auth.ts` | 8 | Login Zod schema |
| `shared-hooks/src/api/use-notifications.ts` | 42 | 4 notification hooks |
| `shared-hooks/src/use-auth-hydrated.ts` | 15 | Hydration state hook |

### Modified — Management Portal (8 files):

| File | Changes |
|------|---------|
| `(auth)/login/page.tsx` | RHF + Zod + useLogin + role-based redirect + loading state |
| `(auth)/layout.tsx` | Server → Client component, redirect if authenticated |
| `instructor/layout.tsx` | + auth guard (INSTRUCTOR or ADMIN), return null |
| `admin/layout.tsx` | + auth guard (ADMIN only), return null |
| `navigation/sidebar.tsx` | Auth store user data + logout button with LogOut icon |
| `navigation/header.tsx` | API notification count + auth store avatar, removed variant prop |
| `[locale]/page.tsx` | Server → Client component, role-based redirect |
| `messages/vi.json` + `en.json` | + 17 apiErrors keys, common_errors.unknownError |

### Modified — Shared Packages (2 files):

| File | Changes |
|------|---------|
| `shared-hooks/src/stores/auth-store.ts` | partialize: + accessToken, isAuthenticated |
| `shared-hooks/src/index.ts` | + export useAuthHydrated, notification hooks |

### Modified — Student Portal (1 file):

| File | Changes |
|------|---------|
| `student-portal/navbar.tsx` | + useAuthHydrated, placeholder khi chưa hydrate |
