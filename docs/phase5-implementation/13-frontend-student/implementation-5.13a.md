# Sub-phase 5.13a — AUTH & NAVIGATION

> Login, Register, Verify Email, Forgot/Reset Password, Navbar, AuthGuard.
> Dependency: Phase 5.12 (apiClient, stores, providers) phải xong.
> Pattern: Shared API hooks (`@shared/hooks/api/use-auth.ts`) — tách mutation logic ra khỏi pages.

---

## Scope

| # | File | Action | API Endpoints |
|---|------|--------|---------------|
| 1 | `shared-hooks/src/api/use-auth.ts` | **Create:** 7 API hooks | All auth endpoints |
| 2 | `lib/validations/auth.ts` | **Create:** 4 Zod schemas | — |
| 3 | `components/auth/auth-guard.tsx` | **Create:** redirect guard | — |
| 4 | `(auth)/login/page.tsx` | **Rewrite:** RHF + `useLogin()` | `POST /auth/login` |
| 5 | `(auth)/register/page.tsx` | **Rewrite:** RHF + `useRegister()` | `POST /auth/register` |
| 6 | `(auth)/verify-email/page.tsx` | **Rewrite:** `useVerifyEmail()` + `useResendVerification()` | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| 7 | `(auth)/forgot-password/page.tsx` | **Rewrite:** RHF + `useForgotPassword()` | `POST /auth/forgot-password` |
| 8 | `(auth)/reset-password/page.tsx` | **Rewrite:** RHF + `useResetPassword()` | `POST /auth/reset-password` |
| 9 | `(auth)/layout.tsx` | **Update:** redirect if authenticated | — |
| 10 | `navigation/navbar.tsx` | **Rewrite:** auth store, cart store, notifications query, `useLogout()` | `GET /notifications/unread-count`, `POST /auth/logout` |
| 11 | `messages/vi.json` + `en.json` | **Update:** +30 apiErrors, missing auth keys | — |

**Backend changes (cũng thuộc phase này):**

| # | File | Action |
|---|------|--------|
| 12 | `auth.service.ts` | **Add:** `resendVerification()` method + **Fix:** `refresh()` trả thêm `user` data |
| 13 | `auth.controller.ts` | **Add:** `POST /auth/resend-verification` endpoint |
| 14 | `auth.service.spec.ts` | **Add:** 3 tests resendVerification + **Fix:** refresh test expect user |
| 15 | `mail.service.ts` | **Fix:** email URLs remove `/auth/` prefix (route group) |

**Auth Provider fixes (cả 2 portals):**

| # | File | Action |
|---|------|--------|
| 16 | `auth-provider.tsx` | **Fix:** skip refresh for pure guest (check sessionStorage), sync token if already auth |

**Theme toggle fix:**

| # | File | Action |
|---|------|--------|
| 17 | `theme-toggle.tsx` | **Fix:** disable transitions during theme switch (instant color change) |
| 18 | `globals.css` | **Add:** `.disable-transitions` CSS class |

**UI fix:**

| # | File | Action |
|---|------|--------|
| 19 | `shared-ui/dropdown-menu.tsx` | **Fix:** `bg-popover` → `bg-card` + `shadow-xl` (visible dropdown bg) |

---

## Architecture: Shared API Hooks Pattern

```
packages/shared-hooks/src/api/use-auth.ts
  ├── useLogin()                → POST /auth/login
  ├── useRegister()             → POST /auth/register
  ├── useVerifyEmail()          → POST /auth/verify-email
  ├── useResendVerification()   → POST /auth/resend-verification
  ├── useForgotPassword()       → POST /auth/forgot-password
  ├── useResetPassword()        → POST /auth/reset-password
  └── useLogout()               → POST /auth/logout

Mỗi hook:
  - Encapsulate mutationFn (API URL + payload)
  - Handle onError → toast.error(getErrorMessage(error))
  - Caller truyền page-specific logic qua mutation.mutate(data, { onSuccess })
```

**Tại sao tách hooks?**
- API endpoints tập trung 1 file → đổi URL chỉ sửa 1 chỗ
- Error handling nhất quán (toast error) → không quên
- Pages clean: chỉ import `useLogin` thay vì `useMutation + apiClient + toast + useApiError`
- Reusable: `useLogout()` dùng ở navbar, settings, anywhere

**Page-specific logic truyền qua `onSuccess` callback:**
```tsx
const mutation = useLogin();
mutation.mutate(data, {
  onSuccess: () => router.push(redirect),  // Page decides where to redirect
});
```

---

## Zod Schemas

### `src/lib/validations/auth.ts`

```typescript
const passwordSchema = z.string().min(8).max(100)
  .regex(/(?=.*[A-Z])(?=.*\d)/, { message: '...' });

loginSchema:         { email, password (min 1) }
registerSchema:      { fullName, email, password (strong), confirmPassword } + refine match
forgotPasswordSchema: { email }
resetPasswordSchema:  { password (strong), confirmPassword } + refine match
```

Password regex matches backend DTO validation: `(?=.*[A-Z])(?=.*\d)` — at least 1 uppercase + 1 number. Catch client-side trước khi gửi API.

---

## Auth Pages — Key Changes

### Login
- `useLogin()` hook → `onSuccess` setAuth + redirect (support `?redirect=` param)
- Google OAuth button: `disabled` (not yet implemented)
- Forgot password link: fixed `href="#"` → `href="/forgot-password"`

### Register
- `useRegister()` hook → `onSuccess` redirect to `/verify-email?email=xxx`
- Password strength indicator (0-4 score, progress bar)
- Confirm password validation via Zod refine

### Verify Email
- 2 modes: check email (no token) vs auto-verify (with `?token=xxx`)
- `useVerifyEmail()` → auto-fire on mount if token present
- `useResendVerification()` → resend button with 60s countdown
- Email input fallback khi không có `?email=` param

### Forgot Password
- `useForgotPassword()` → always show success (anti-enumeration)
- Success state: shows "email sent" card, hides form

### Reset Password
- `useResetPassword()` with `{ token, newPassword }` (NOT `password`)
- Token from `?token=` URL param → redirect `/forgot-password` if missing
- Password strength indicator same as register

---

## Navbar — Key Changes

```
TRƯỚC:
  - Hardcoded "Minh Tuấn", cart "2", notifications "3"
  - Always shows avatar dropdown (even guest)

SAU:
  - Guest:         [Logo] [Search] [Browse] [Q&A]     [Login] [Register]
  - Authenticated: [Logo] [Search] [Browse] [Learning] [Cart(n)] [Bell(n)] [Avatar▾]
  - User data from useAuthStore()
  - Cart count from useCartStore().itemCount()
  - Notifications from useQuery(GET /notifications/unread-count) — refetch 30s
  - Logout via useLogout() → onSettled redirect /login
  - Avatar: real image or initials fallback
  - Dropdown: onClick + router.push (no asChild — custom shadcn/ui)
```

---

## Backend Changes

### `POST /auth/resend-verification` (NEW)
- `@Public()` — no auth required
- Anti-enumeration: always return success
- Skip if user already ACTIVE (verified)
- Generate new token + send verification email

### Mail URL Fix
- `/auth/verify-email` → `/verify-email` (route group `(auth)` doesn't appear in URL)
- `/auth/reset-password` → `/reset-password`

### Refresh Response Fix
- `refresh()` giờ trả `{ accessToken, refreshToken, user }` (trước chỉ trả tokens)
- AuthProvider cần `user` để `setAuth(user, token)` — thiếu `user` sẽ clear store

---

## Auth Provider — Session Restore Logic

```
Guest (chưa từng login):  sessionStorage empty → skip refresh → 0 API calls
Từng login (tab mới):     sessionStorage có user → try refresh → restore session
Đã login (same tab):      store có token → sync apiClient → 0 API calls
Refresh fail:             → logout() → clear stale user data
```

Key fix: check `sessionStorage.getItem('sslm-auth')` trước khi gọi refresh — pure guest không có cookie nên refresh luôn fail → wasted 401 request.

---

## Theme Toggle — Instant Color Switch

Vấn đề: text có `transition-colors` (cho hover) → khi đổi theme, text color animate chậm → nhìn khựng.

Fix: tạm disable transitions khi switch theme:
1. Add class `disable-transitions` → `<html>` → `* { transition-duration: 0s !important }`
2. `setTheme(value)` → colors đổi instant
3. Double `requestAnimationFrame` (~32ms) → browser repaint xong → remove class
4. Hover transitions hoạt động bình thường trở lại

---

## Dropdown Menu — Background Fix

Vấn đề: `DropdownMenuContent` dùng `bg-popover` nhưng dark mode popover color quá giống page bg → nhìn transparent.

Fix: `bg-popover` → `bg-card` + `shadow-xl` + bỏ broken `animate-in` classes (tailwindcss-animate not installed).

---

## i18n Updates

### Added to both `vi.json` + `en.json`:
- `apiErrors` namespace: 30 error codes mapped to localized messages
- `verifyEmail.verified`, `verifyEmail.verifying`, `verifyEmail.resendSuccess`, `verifyEmail.enterEmail`
- `forgotPassword.sentTitle`, `forgotPassword.sentDescription`, `forgotPassword.emailSent`
- `resetPassword.success`, `resetPassword.invalidToken`, `resetPassword.requestNewLink`, `resetPassword.backToLogin`
- `common.unknownError`
- `nav.login`, `nav.register`, `nav.orders`, `nav.notifications`, `nav.cart`

### `useApiError` updated:
- Handle both `{ code, statusCode }` (business errors) and `{ message: string[], statusCode }` (validation errors)

---

## Verify

- [x] Shared API hooks created (7 hooks in use-auth.ts)
- [x] Zod schemas match backend DTO validation (password regex)
- [x] Login: RHF + useLogin + redirect with ?redirect= support
- [x] Register: RHF + useRegister + password strength + redirect verify-email
- [x] Verify email: auto-verify with ?token= + resend with countdown
- [x] Verify email: email input fallback when no ?email= param
- [x] Forgot password: useForgotPassword + success state
- [x] Reset password: useResetPassword + token from URL + newPassword field name
- [x] Auth layout: redirect home if already authenticated
- [x] AuthGuard component: redirect /login?redirect=...
- [x] Navbar: guest = Login/Register, auth = avatar/cart/notifications
- [x] Navbar: useLogout + redirect
- [x] Navbar: notifications unread count from API (30s refetch)
- [x] Backend: POST /auth/resend-verification endpoint + 3 tests
- [x] Backend: mail URLs fixed (no /auth/ prefix)
- [x] i18n: 30 apiErrors + missing keys (vi + en)
- [x] useApiError: handles validation error arrays
- [x] Google OAuth: disabled button
- [x] Backend: refresh() returns user data
- [x] AuthProvider: skip refresh for pure guest (no sessionStorage)
- [x] AuthProvider: sync token to apiClient if already authenticated
- [x] Theme toggle: instant color switch (disable-transitions class)
- [x] Dropdown menu: bg-card + shadow-xl (visible in dark mode)
- [x] Build: both portals clean
- [x] Backend: 646 tests passing
