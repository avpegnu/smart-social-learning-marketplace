# 01 — Auth & Navigation: Shared API Hooks, Form Validation, Session Management

> Giải thích chi tiết Phase 5.13a — shared API hooks pattern, Zod + React Hook Form integration,
> AuthGuard, Navbar auth state, i18n error mapping, và backend fixes.

---

## 1. TỔNG QUAN

### 1.1 Bài toán

Mock UI đã có 5 auth pages + navbar, nhưng:
- Forms dùng `onSubmit={(e) => e.preventDefault()}` — không gọi API
- Navbar hardcode user "Minh Tuấn", cart "2", notifications "3"
- Không có validation, loading states, error handling
- Không có auth guard (protected pages accessible without login)

### 1.2 Giải pháp — 3 layers

```
Layer 1: Shared API Hooks (@shared/hooks/api/use-auth.ts)
  └── Encapsulate: endpoint URL + mutationFn + error toast
  └── 7 hooks: useLogin, useRegister, useVerifyEmail, ...

Layer 2: Zod Schemas (src/lib/validations/auth.ts)
  └── Client-side validation matching backend DTOs
  └── 4 schemas: login, register, forgotPassword, resetPassword

Layer 3: Pages (src/app/[locale]/(auth)/...)
  └── UI only: form, loading state, page-specific redirect
  └── Import hooks + schemas, wire together
```

---

## 2. SHARED API HOOKS — Pattern Chi Tiết

### 2.1 Tại sao tách?

```tsx
// ❌ TRƯỚC: Mỗi page tự define mutation (5 pages × similar code)
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { useApiError } from '@shared/hooks';
import { toast } from 'sonner';

const mutation = useMutation({
  mutationFn: (data) => apiClient.post('/auth/login', data),
  onError: (error) => toast.error(getErrorMessage(error)),
});

// ✅ SAU: 1 import
import { useLogin } from '@shared/hooks';
const mutation = useLogin();
```

**Lợi ích:**
- **Single source of truth**: URL `/auth/login` defined 1 lần → đổi URL chỉ sửa 1 file
- **Consistent error handling**: mọi hook đều `toast.error(getErrorMessage(error))` → không page nào quên
- **Clean pages**: bỏ 4 imports (useMutation, apiClient, useApiError, toast) → 1 import
- **Reusable**: `useLogout()` dùng ở navbar, settings, anywhere

### 2.2 Hook Design — Error in hook, Success in caller

```typescript
// Hook: handles error (global behavior)
export function useLogin() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: LoginPayload) => apiClient.post('/auth/login', data),
    onError: (error) => toast.error(getErrorMessage(error)),  // ← Always toast
  });
}

// Page: handles success (page-specific behavior)
const mutation = useLogin();
mutation.mutate(data, {
  onSuccess: () => router.push(redirect),  // ← Page decides redirect
});
```

**Tại sao split?**
- **Error** luôn giống nhau: toast error message → define trong hook
- **Success** khác nhau mỗi page: login → redirect home, register → redirect verify-email → define trong caller

TanStack Query cho phép `onSuccess` ở CẢ 2 nơi — hook level + mutate call level. Cả 2 đều chạy. Hook-level `onError` chạy trước, mutate-level `onSuccess` chạy sau.

### 2.3 `useLogout` — onSettled Pattern

```typescript
export function useLogout() {
  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      useAuthStore.getState().logout();  // Always clear store
    },
  });
}
```

**`onSettled` thay vì `onSuccess`** — logout phải clear store DÙ API fail (network error, server down). `onSettled` chạy cả khi success và error.

### 2.4 File Organization

```
packages/shared-hooks/src/
├── api/                    ← API hooks (NEW)
│   └── use-auth.ts         # 7 auth hooks
├── stores/                 ← Zustand stores
│   ├── auth-store.ts
│   ├── cart-store.ts
│   └── ui-store.ts
├── use-debounce.ts         ← Generic hooks
├── use-api-error.ts        ← Error handling
└── index.ts                ← Re-exports all
```

Tương lai sẽ thêm: `api/use-courses.ts`, `api/use-cart.ts`, `api/use-social.ts`, ...

---

## 3. ZOD SCHEMAS — Client-Server Validation Sync

### 3.1 Password Schema

```typescript
const passwordSchema = z.string().min(8).max(100)
  .regex(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  });
```

**Tại sao regex giống backend?** Backend DTO:
```typescript
@Matches(/(?=.*[A-Z])(?=.*\d)/, { message: '...' })
newPassword!: string;
```

Nếu frontend KHÔNG validate → user nhập `password123` (no uppercase) → gửi API → backend reject → user thấy validation error ARRAY (xấu). Frontend validate trước → user thấy field-level error ngay lập tức (đẹp).

### 3.2 Refine — Cross-field Validation

```typescript
.refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],  // Error hiện trên field confirmPassword
  message: 'PASSWORDS_NOT_MATCH',
});
```

Zod `refine` cho phép validate liên quan giữa 2+ fields. `path: ['confirmPassword']` → React Hook Form hiển thị error trên field `confirmPassword`, không phải form-level.

### 3.3 Frontend vs Backend Field Names

```
Frontend Zod:  { password, confirmPassword }
Backend DTO:   { token, newPassword }
```

Reset password page map: `{ token, newPassword: data.password }` — frontend dùng `password` (user-friendly label) nhưng gửi API với field name `newPassword` (backend convention).

---

## 4. `useApiError` — Dual Error Format

### 4.1 Vấn đề: 2 dạng error từ backend

```typescript
// Business error (custom code)
{ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 }

// Validation error (class-validator)
{ message: ['property password should not exist', 'newPassword must be...'], statusCode: 400 }
```

### 4.2 Updated handler

```typescript
export function useApiError() {
  const t = useTranslations();
  return (error: unknown): string => {
    // Business error: { code } → i18n lookup
    if (isApiErrorWithCode(error)) {
      const key = `apiErrors.${error.code}`;
      return t.has(key) ? t(key) : error.code;
    }
    // Validation error: { message: string[] } → show first message
    if (isValidationError(error)) {
      const msg = error.message;
      if (Array.isArray(msg)) return msg[0] ?? t('common.unknownError');
      if (typeof msg === 'string') return msg;
    }
    return t('common.unknownError');
  };
}
```

**Flow:**
```
Backend: throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS' })
  → useApiError → t('apiErrors.EMAIL_ALREADY_EXISTS')
  → vi: "Email đã được sử dụng"
  → en: "Email is already in use"

Backend: ValidationPipe reject { password: 'abc' }
  → useApiError → message[0]: "Password must be longer than or equal to 8 characters"
```

---

## 5. NAVBAR — Conditional Rendering

### 5.1 Guest vs Authenticated

```
Guest:          [Logo] [Search] [Browse] [Q&A]        [Login] [Register]
                                                        ↑ Button variant="ghost" + variant="default"

Authenticated:  [Logo] [Search] [Browse] [Learning] [Cart(3)] [Bell(5)] [Avatar▾]
                                                                        ↑ DropdownMenu
```

### 5.2 Notifications Polling

```typescript
const { data: unreadData } = useQuery({
  queryKey: queryKeys.notifications.unreadCount,
  queryFn: () => apiClient.get<number>('/notifications/unread-count'),
  enabled: isAuthenticated,      // Chỉ fetch khi đã login
  refetchInterval: 30000,        // Poll mỗi 30s
});
```

**`refetchInterval: 30000`** — poll badge count mỗi 30 giây. Lightweight (1 count query, not full list). Bổ sung bằng WebSocket `useNotificationSocket` cho real-time push.

### 5.3 Avatar Initials

```typescript
const initials = user?.fullName
  ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  : '';
// "Nguyễn Minh Tuấn" → "NM" (first 2 initials)
```

---

## 6. AUTH LAYOUT — Redirect Guard

```typescript
export default function AuthLayout({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null;
  // ... render auth layout
}
```

**Tại sao cần?** User đã login → navigate to `/login` → should redirect home. Không cần thấy login form khi đã authenticated.

`return null` trước redirect hoàn tất → tránh flash of login form.

---

## 7. BACKEND FIXES

### 7.1 `POST /auth/resend-verification` — New Endpoint

```typescript
async resendVerification(email: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'ACTIVE') {
    return { message: 'VERIFICATION_EMAIL_SENT' };  // Anti-enumeration
  }
  // Generate new token + send email
}
```

**Anti-enumeration**: luôn return success dù email không tồn tại hoặc user đã verify. Attacker không biết email nào valid.

### 7.2 Mail URL Fix — Route Groups

```
TRƯỚC: /auth/verify-email?token=xxx  → 404!
SAU:   /verify-email?token=xxx       → ✅

Lý do: (auth) là route group → KHÔNG xuất hiện trong URL
  src/app/[locale]/(auth)/verify-email/page.tsx
  URL thực tế: /verify-email (không có /auth/)
```

---

## 8. VERIFY EMAIL — 2 Modes

### Mode 1: Check Email (no token)

```
Register → redirect /verify-email?email=user@example.com
  → Show "Check your email" + resend button
  → Nếu không có ?email= param → show email input
```

### Mode 2: Auto-verify (with token)

```
Email link → /verify-email?token=1faad303-...
  → useEffect fires verifyMutation.mutate(token)
  → Success: toast + redirect /login
  → Error: show error message + back to login link
```

---

## 9. AUTH PROVIDER — Guest vs Authenticated Session Restore

### 9.1 Vấn đề

AuthProvider luôn gọi `POST /auth/refresh` khi mount — kể cả guest chưa từng login. Guest không có refresh token cookie → backend trả 401 `MISSING_REFRESH_TOKEN` → wasted request mỗi page load.

### 9.2 Fix: Check sessionStorage trước

```typescript
// sessionStorage 'sslm-auth' chỉ tồn tại nếu user từng login trên tab này
const stored = sessionStorage.getItem('sslm-auth');
const hasStoredUser = stored && JSON.parse(stored)?.state?.user;

if (!hasStoredUser) return; // Pure guest — skip refresh
```

### 9.3 Session Restore States

```
Guest (chưa login):       sessionStorage empty → SKIP refresh → 0 API calls ✅
Đã login (same tab):      store có token → sync apiClient → SKIP refresh ✅
Từng login (new tab):     sessionStorage có user → TRY refresh → restore session
Refresh fail:             → logout() → clear stale user data
```

### 9.4 Backend Refresh Response Fix

```typescript
// TRƯỚC: chỉ trả tokens
return { accessToken, refreshToken };

// SAU: trả cả user data
return { accessToken, refreshToken, user: { id, email, fullName, role, avatarUrl } };
```

AuthProvider cần `user` để `setAuth(user, token)`. Thiếu `user` → `setAuth(undefined, token)` → user bị clear khỏi store → avatar mất.

---

## 10. THEME TOGGLE — Instant Color Switch

### 10.1 Vấn đề

Nhiều elements có `transition-colors` class (cho hover effects). Khi đổi theme → text/border colors animate chậm (~200ms) trong khi background đổi ngay → nhìn "khựng".

### 10.2 Fix: Tạm disable transitions

```css
/* globals.css */
html.disable-transitions,
html.disable-transitions * {
  transition-duration: 0s !important;
}
```

```typescript
// theme-toggle.tsx
const handleThemeChange = (value: string) => {
  document.documentElement.classList.add('disable-transitions');
  setTheme(value);
  // Re-enable after browser repaint (~32ms = 2 frames)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('disable-transitions');
    });
  });
};
```

**Double `requestAnimationFrame`**: Frame 1 — browser tính layout mới. Frame 2 — paint xong → safe to re-enable transitions. User không nhận ra vì 32ms < human perception (~100ms).

---

## 11. DROPDOWN MENU — Background Visibility

### 11.1 Vấn đề

`DropdownMenuContent` dùng `bg-popover` — dark mode popover color (`#1e293b`) gần giống page bg (`#0f172a`) → nhìn transparent.

### 11.2 Fix

```
TRƯỚC: bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 shadow-lg
SAU:   bg-card text-card-foreground shadow-xl
```

- `bg-card` có contrast rõ hơn `bg-popover` trong dark mode
- `shadow-xl` tạo depth separation rõ ràng
- Bỏ `animate-in fade-in-0 zoom-in-95` (tailwindcss-animate not installed → broken classes)

---

## 12. FILES CREATED / MODIFIED

### Created (3 files):

| File | Lines | Mục đích |
|------|-------|----------|
| `shared-hooks/src/api/use-auth.ts` | 120 | 7 shared API hooks |
| `student-portal/src/lib/validations/auth.ts` | 40 | 4 Zod schemas |
| `student-portal/src/components/auth/auth-guard.tsx` | 20 | Redirect guard |

### Rewritten (6 files):

| File | Lines | Changes |
|------|-------|---------|
| `login/page.tsx` | 120 | RHF + useLogin + ?redirect= |
| `register/page.tsx` | 195 | RHF + useRegister + password strength |
| `verify-email/page.tsx` | 115 | useVerifyEmail + useResendVerification + email input fallback |
| `forgot-password/page.tsx` | 80 | RHF + useForgotPassword + success state |
| `reset-password/page.tsx` | 130 | RHF + useResetPassword + newPassword mapping |
| `navbar.tsx` | 250 | Auth/guest conditional, stores, notifications query, useLogout |

### Updated (8 files):

| File | Changes |
|------|---------|
| `(auth)/layout.tsx` | +redirect if authenticated |
| `messages/vi.json` | +30 apiErrors + missing keys |
| `messages/en.json` | +30 apiErrors + missing keys |
| `shared-hooks/src/index.ts` | +7 API hook exports |
| `shared-hooks/src/use-api-error.ts` | +validation error array handling |
| `auth-provider.tsx` (cả 2 portals) | Fix: skip refresh for guest, sync token, refresh returns user |
| `theme-toggle.tsx` | Fix: disable transitions during theme switch |
| `globals.css` | +disable-transitions CSS class |

### Backend (5 files):

| File | Changes |
|------|---------|
| `auth.service.ts` | +resendVerification + refresh returns user |
| `auth.controller.ts` | +POST /auth/resend-verification |
| `auth.service.spec.ts` | +3 resend tests + fix refresh test |
| `mail.service.ts` | Fix URLs: remove /auth/ prefix |
| `shared-ui/dropdown-menu.tsx` | bg-card + shadow-xl + remove broken animate classes |
