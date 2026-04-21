# 01 — API Client & Query Keys: Native Fetch Wrapper, Auto-Refresh, Hierarchical Cache Keys

> Giải thích chi tiết ApiClient class — tại sao native fetch thay vì axios, token storage trong class field,
> auto-refresh với deduplication, server vs client fetch, và query keys factory pattern.

---

## 1. TỔNG QUAN

### 1.1 Tại sao native `fetch` thay vì axios?

```
❌ Axios:
  - Next.js 16 KHÔNG extend axios → mất caching, revalidation, deduplication
  - Server Components không import được axios (client-only library)
  - ~50KB bundle size thêm
  - Cần 2 clients: axios cho client, fetch cho server → inconsistent

✅ Native fetch:
  - Next.js 16 extend native fetch → auto caching, deduplication, ISR revalidation
  - Server Components dùng trực tiếp (đã có sẵn trong Node.js 22)
  - 0KB bundle (built-in)
  - 1 wrapper cho cả server + client → consistent API
```

**Ví dụ Next.js fetch extensions:**
```typescript
// ISR revalidation — chỉ native fetch hỗ trợ
fetch('/api/courses', { next: { revalidate: 300 } });  // Revalidate every 5 min

// Axios KHÔNG có `next` option → phải dùng `getStaticProps` pattern cũ
```

### 1.2 2 Functions — Server vs Client

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│                                                          │
│  Server Components           Client Components           │
│  ┌──────────────────┐       ┌──────────────────────┐    │
│  │ serverFetch<T>() │       │ apiClient.get<T>()   │    │
│  │                  │       │ apiClient.post<T>()  │    │
│  │ Reads cookies    │       │ apiClient.patch<T>() │    │
│  │ from next/headers│       │                      │    │
│  │                  │       │ Auto-refresh on 401  │    │
│  │ No client JS     │       │ Token in class field │    │
│  └──────────────────┘       └──────────────────────┘    │
│         │                           │                    │
│         └───────────┬───────────────┘                    │
│                     ▼                                    │
│              fetch(`${API_BASE}${path}`)                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. SERVER FETCH — Server Components

### 2.1 Implementation

```typescript
export async function serverFetch<T>(
  path: string,
  options?: RequestInit,
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
```

### 2.2 Tại sao `await import('next/headers')`?

```typescript
// ❌ Static import — breaks client components
import { cookies } from 'next/headers';
// → Error: `cookies` can only be used in Server Components

// ✅ Dynamic import — only executes server-side
const { cookies } = await import('next/headers');
// → Module only loaded when serverFetch() is called (always on server)
```

`shared-api-client` package được import bởi CẢ server và client components. Static import `next/headers` sẽ break khi bundled cho client. Dynamic import → chỉ resolve ở server runtime.

### 2.3 Cookie Forwarding

```
Browser → Next.js Server → Backend API
         ↑                ↑
         refreshToken     Cookie: refreshToken=xxx
         (httpOnly)       (forwarded by serverFetch)
```

Server Components chạy trên Next.js server, KHÔNG có access trực tiếp đến browser cookies. `next/headers` cung cấp API đọc cookies từ incoming request → forward sang backend.

---

## 3. CLIENT API — Class-Based Pattern

### 3.1 Tại sao class thay vì module-level variable?

```typescript
// ❌ Module-level (implementation.md cũ)
let accessToken: string | null = null;  // Shared mutable state
window.__SSLM_ACCESS_TOKEN__ = token;   // Global pollution

// ✅ Class-based
class ApiClient {
  private accessToken: string | null = null;  // Encapsulated
  setAccessToken(token: string | null) { this.accessToken = token; }
}
export const apiClient = new ApiClient();  // Singleton
```

**Advantages:**
- **Encapsulation** — `accessToken` is private, only accessible via `setAccessToken()`
- **No global pollution** — không cần `window.__SSLM_ACCESS_TOKEN__`
- **Type-safe** — class methods có proper TypeScript signatures
- **Testable** — mock `apiClient` instance trong tests

### 3.2 `credentials: 'include'`

```typescript
const res = await fetch(`${API_BASE}${path}`, {
  ...options,
  credentials: 'include',  // ← Key
  headers: { ... },
});
```

**`credentials: 'include'`** — browser tự động gửi cookies (kể cả cross-origin) kèm mỗi request. Refresh token là httpOnly cookie → browser gửi tự động, JavaScript KHÔNG đọc được (XSS-safe).

```
fetch('/api/orders')
  → Browser tự thêm: Cookie: refreshToken=eyJhbG...
  → Backend đọc cookie từ request headers
```

### 3.3 Auto-Refresh với Deduplication

```typescript
// Vấn đề: 3 requests fail 401 cùng lúc → 3 refresh calls → race condition
// Giải pháp: Deduplication — chỉ 1 refresh, 3 requests đợi kết quả

private isRefreshing = false;
private refreshPromise: Promise<boolean> | null = null;

private async tryRefresh(): Promise<boolean> {
  if (this.isRefreshing && this.refreshPromise) {
    return this.refreshPromise;  // Đợi refresh đang chạy
  }

  this.isRefreshing = true;
  this.refreshPromise = this.doRefresh();

  try {
    return await this.refreshPromise;
  } finally {
    this.isRefreshing = false;
    this.refreshPromise = null;
  }
}
```

**Timeline ví dụ:**
```
T=0ms: Request A gets 401 → tryRefresh() → isRefreshing=true, start doRefresh()
T=5ms: Request B gets 401 → tryRefresh() → isRefreshing=true, return same promise
T=10ms: Request C gets 401 → tryRefresh() → isRefreshing=true, return same promise
T=200ms: doRefresh() resolves → new token
         Request A retries with new token ✅
         Request B retries with new token ✅
         Request C retries with new token ✅
```

Không có deduplication → 3 refresh calls → 2 calls fail (token rotated), 1 succeeds → 2 requests get logged out.

### 3.4 Callback Pattern — Avoid Circular Import

```
Vấn đề circular import:
  apiClient.ts imports useAuthStore → auth-store.ts imports apiClient → LOOP

Giải pháp: Callbacks set by AuthProvider
  apiClient.ts: onRefresh?: (token: string) => void;
  auth-provider.tsx: apiClient.onRefresh = (token) => useAuthStore.getState().setAccessToken(token);
```

`apiClient` không biết về Zustand. `AuthProvider` wire callbacks lúc mount → apiClient gọi callback khi cần update store. Dependency inversion — apiClient depends on interface (callback), not implementation (Zustand).

---

## 4. QUERY KEYS — Hierarchical Factory Pattern

### 4.1 Tại sao hierarchical?

```typescript
export const queryKeys = {
  courses: {
    all: ['courses'] as const,
    list: (params?) => ['courses', 'list', params] as const,
    detail: (slug) => ['courses', slug] as const,
    reviews: (courseId) => ['courses', courseId, 'reviews'] as const,
  },
};
```

**Invalidation cascade:**
```typescript
// Invalidate ALL course data
queryClient.invalidateQueries({ queryKey: ['courses'] });
// → Matches: ['courses'], ['courses', 'list', {...}], ['courses', 'react-101'], ['courses', 'c1', 'reviews']

// Invalidate only reviews for course c1
queryClient.invalidateQueries({ queryKey: ['courses', 'c1', 'reviews'] });
// → Only matches: ['courses', 'c1', 'reviews']
```

TanStack Query dùng **prefix matching** — `['courses']` matches mọi query key bắt đầu bằng `'courses'`. Hierarchical keys cho phép invalidate ở bất kỳ level nào.

### 4.2 `as const` Assertion

```typescript
detail: (slug: string) => ['courses', slug] as const,
// Type: readonly ['courses', string]
// NOT: string[]
```

`as const` → TypeScript infer exact tuple type thay vì `string[]`. TanStack Query dùng type để deduplicate queries — `['courses', 'react-101']` !== `['courses', 'vue-basics']`.

---

## 5. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `packages/shared-api-client/src/client.ts` | 140 | ApiClient class + serverFetch |
| `packages/shared-api-client/src/query-keys.ts` | 80 | Query keys factory |
| `packages/shared-api-client/src/index.ts` | 4 | Updated exports |
