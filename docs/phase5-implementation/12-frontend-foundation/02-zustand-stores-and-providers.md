# 02 — Zustand Stores & Providers: Auth, Cart, UI State + Session Restore

> Giải thích chi tiết 3 Zustand stores — auth (sessionStorage + partialize), cart (localStorage + persist),
> UI (transient). AuthProvider session restore flow, QueryProvider setup, và provider wiring order.

---

## 1. TỔNG QUAN

### 1.1 State Management Rules (từ CLAUDE.md)

```
Server State → TanStack Query (API data)
Client State → Zustand (UI state, auth token)

❌ NEVER put API data in Zustand
❌ NEVER fetch data in useEffect
✅ TanStack Query for ALL data fetching
✅ Zustand ONLY for: auth token, cart, UI toggles
```

### 1.2 3 Stores

| Store | Persistence | Storage | Content |
|-------|-------------|---------|---------|
| `useAuthStore` | ✅ Partial | sessionStorage | user profile (NOT token) |
| `useCartStore` | ✅ Full | localStorage | items, coupon, discount |
| `useUIStore` | ❌ None | memory only | sidebar, mobile nav |

---

## 2. AUTH STORE — sessionStorage + partialize

### 2.1 Implementation

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        apiClient.setAccessToken(accessToken);  // Sync with API client
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
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
```

### 2.2 Tại sao sessionStorage thay vì localStorage?

```
localStorage:
  ✅ Persist across tabs + browser restarts
  ❌ Token accessible from ANY tab → if one tab is compromised, all are
  ❌ Token stays indefinitely (even after browser restart)

sessionStorage:
  ✅ Per-tab isolation → compromise 1 tab doesn't affect others
  ✅ Auto-clears on tab close → no stale tokens
  ❌ New tab = no session → must refresh token

Quyết định: sessionStorage
  → Security > convenience
  → New tab: AuthProvider auto-calls /auth/refresh → restores session
```

### 2.3 `partialize` — Chỉ persist user, NOT accessToken

```typescript
partialize: (state) => ({ user: state.user }),
```

**Tại sao KHÔNG persist accessToken?**
- Access token has 15-min TTL → persisted token likely expired
- Persisted token = **XSS target** (attacker reads sessionStorage → steals token)
- Solution: only persist user profile (display name, avatar) → token refreshed on each tab open

**Flow khi mở tab mới:**
```
1. sessionStorage has { user: { id, fullName, avatarUrl } } → show UI immediately
2. AuthProvider calls POST /auth/refresh (httpOnly cookie) → get new accessToken
3. setAuth(user, newToken) → apiClient synced, ready to make authenticated requests
```

### 2.4 `apiClient.setAccessToken()` trong mỗi action

```typescript
setAuth: (user, accessToken) => {
  apiClient.setAccessToken(accessToken);  // ← Sync API client
  set({ user, accessToken, isAuthenticated: true });
},
```

**Tại sao?** Zustand store và ApiClient là 2 hệ thống riêng biệt. Khi token thay đổi trong store, ApiClient cũng cần biết để attach vào requests. Gọi `apiClient.setAccessToken()` trong mỗi action đảm bảo 2 hệ thống luôn đồng bộ.

### 2.5 SSR Safety — sessionStorage fallback

```typescript
storage: createJSONStorage(() =>
  typeof window !== 'undefined'
    ? sessionStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
),
```

Server-side rendering (SSR) không có `sessionStorage`. Nếu không check `typeof window` → `ReferenceError: sessionStorage is not defined`. Fallback object = no-op storage cho SSR.

---

## 3. CART STORE — localStorage + full persist

### 3.1 Tại sao localStorage cho cart?

```
Guest user (chưa login):
  → Browse courses → Add to cart → Close browser → Quay lại → Cart vẫn còn ✅
  → localStorage persist across sessions

Sau khi login:
  → POST /api/cart/merge { items: localCart }
  → Server merge local cart với server cart
  → syncWithServer(mergedItems)
```

### 3.2 Duplicate Prevention

```typescript
addItem: (item) => {
  const exists = get().items.some(
    (i) => i.courseId === item.courseId && i.chapterId === item.chapterId,
  );
  if (!exists) set((s) => ({ items: [...s.items, item] }));
},
```

Check cả `courseId` + `chapterId` vì SSLM hỗ trợ mua lẻ chapter. User có thể mua:
- Full course (courseId='c1', chapterId=undefined) → 1 item
- Chapter 1 (courseId='c1', chapterId='ch1') → another item

### 3.3 Computed Functions (not getters)

```typescript
subtotal: () => get().items.reduce((sum, i) => sum + i.price, 0),
total: () => Math.max(0, get().subtotal() - get().discount),
itemCount: () => get().items.length,
```

**Zustand v5:** Computed values là functions (gọi bằng `store.subtotal()`), không phải getters. `get()` trả về current state tại thời điểm gọi.

---

## 4. UI STORE — Transient (no persist)

```typescript
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,         // Default: sidebar visible
  sidebarCollapsed: false,   // Default: sidebar expanded
  mobileNavOpen: false,      // Default: mobile nav hidden
  commandPaletteOpen: false, // Default: command palette hidden
  ...
}));
```

**Không persist** vì UI state là transient:
- Sidebar collapsed → refresh → expanded lại (default)
- Mobile nav open → navigate → closed
- Command palette → escape → closed

Persist UI state → unexpected behavior (user expects default state on reload).

---

## 5. AUTH PROVIDER — Session Restore

### 5.1 Implementation

```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Wire callbacks
    apiClient.onRefresh = (token) => useAuthStore.getState().setAccessToken(token);
    apiClient.onLogout = () => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    };

    // Restore session
    const restoreSession = async () => {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const { user, accessToken } = (await res.json()).data;
        useAuthStore.getState().setAuth(user, accessToken);
      }
    };

    restoreSession();
  }, []);

  return <>{children}</>;
}
```

### 5.2 `useRef(false)` — React 19 StrictMode Guard

```
React 19 StrictMode: useEffect runs TWICE in development
  → Mount → cleanup → Mount (simulate unmount/remount)

Không có guard:
  T=0ms: First mount → restoreSession() → POST /auth/refresh
  T=1ms: Cleanup
  T=2ms: Second mount → restoreSession() → POST /auth/refresh (duplicate!)

Với useRef guard:
  T=0ms: First mount → initialized.current=true → restoreSession()
  T=1ms: Cleanup (ref persists)
  T=2ms: Second mount → initialized.current=true → SKIP
```

### 5.3 `useAuthStore.getState()` thay vì destructured actions

```typescript
// ❌ Destructured (needs deps array)
const { setAuth, logout } = useAuthStore();
useEffect(() => {
  apiClient.onLogout = () => logout();  // ESLint: `logout` missing from deps
}, [logout]);  // → Re-runs when reference changes (shouldn't)

// ✅ getState() (stable, no deps needed)
useEffect(() => {
  apiClient.onLogout = () => useAuthStore.getState().logout();
}, []);  // → No deps needed, getState is always stable
```

`useAuthStore.getState()` — truy cập store ngoài React render cycle. Stable reference, không trigger re-render, không cần trong deps array.

### 5.4 Session Restore Flow

```
Tab opened → AuthProvider mounts
    │
    ├── Wire apiClient.onRefresh / onLogout
    │
    ├── POST /auth/refresh (httpOnly cookie auto-sent)
    │      │
    │      ├── 200 OK → { user, accessToken }
    │      │     ├── useAuthStore.setAuth(user, token)
    │      │     └── apiClient.setAccessToken(token)
    │      │     → User logged in, can make authenticated requests
    │      │
    │      └── 401/Error → No valid refresh token
    │            → User stays logged out
    │            → Can browse public pages
    │
    └── Render children (UI shows immediately, no loading state)
```

**Không blocking:** `restoreSession()` chạy async, children render ngay lập tức. UI hiển thị trước, auth resolve sau → no flash of loading state.

---

## 6. QUERY PROVIDER — TanStack Query Setup

```typescript
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // Data fresh for 1 min
      gcTime: 5 * 60 * 1000,     // Cache GC after 5 min unused
      retry: 1,                   // Retry failed query 1 time
      refetchOnWindowFocus: false, // Don't refetch when tab gets focus
    },
  },
}));
```

### 6.1 `useState(() => new QueryClient(...))`

**Tại sao `useState` thay vì `useRef` hoặc module-level?**
- `useRef` → QueryClient created on every render (ref.current assigned once but `new QueryClient()` still called)
- Module-level → shared across all components, SSR issues (server cache leaks between requests)
- `useState(() => ...)` → lazy initializer, called ONCE, stable across re-renders

### 6.2 Default Options Rationale

```
staleTime: 60s    → Courses list fetched → 60s without refetch → smooth navigation
gcTime: 5min      → Navigate away → cache kept 5min → navigate back → instant (no loading)
retry: 1          → Failed query retried once (network glitch) → not 3 times (default)
refetchOnWindowFocus: false → Tab switch doesn't trigger refetch (annoying on slow connections)
```

---

## 7. PROVIDER WIRING ORDER

```tsx
<ThemeProvider>           ← 1. CSS variables (no React context needed below)
  <NextIntlClientProvider>  ← 2. i18n translations
    <QueryProvider>           ← 3. TanStack Query cache
      <AuthProvider>            ← 4. Session restore + callback wiring
        {children}
        <Toaster />             ← 5. Toast notifications (Sonner)
      </AuthProvider>
    </QueryProvider>
  </NextIntlClientProvider>
</ThemeProvider>
```

**Order matters:**
- AuthProvider INSIDE QueryProvider → can use `useQueryClient` if needed
- Toaster INSIDE AuthProvider → toast from auth callbacks visible
- ThemeProvider OUTERMOST → CSS variables available everywhere

---

## 8. FILES CREATED / MODIFIED

| File | Action | Lines | Mục đích |
|------|--------|-------|----------|
| `shared-hooks/src/stores/auth-store.ts` | Created | 55 | Auth state + sessionStorage |
| `shared-hooks/src/stores/cart-store.ts` | Created | 65 | Cart + localStorage |
| `shared-hooks/src/stores/ui-store.ts` | Created | 30 | UI toggles (transient) |
| `shared-hooks/src/index.ts` | Rewritten | 12 | Export all stores + hooks |
| `shared-hooks/package.json` | Modified | 20 | Added peer deps |
| `student-portal/src/providers/query-provider.tsx` | Created | 28 | TanStack Query setup |
| `student-portal/src/providers/auth-provider.tsx` | Created | 40 | Session restore |
| `management-portal/src/providers/query-provider.tsx` | Created | 28 | Same as student |
| `management-portal/src/providers/auth-provider.tsx` | Created | 40 | Same as student |
| `student-portal/src/app/[locale]/layout.tsx` | Modified | 32 | Wired all providers |
| `management-portal/src/app/[locale]/layout.tsx` | Modified | 32 | Wired all providers |
