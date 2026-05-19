# Phase 5.13 — STUDENT PORTAL: Replace Mock UI with Real API Integration

> 31 pages, ~11 components. Mock UI đã có sẵn — phase này replace mock-data với real API calls,
> thêm form validation, real-time features, và fix UI issues.
> Tham chiếu: `docs/phase4-frontend/03-student-portal.md`

---

## Hiện trạng

### Đã có (từ mock UI + Phase 5.12):
- 31 pages đã render với mock data (95% i18n, 95% dark mode, 100% responsive)
- Foundation: apiClient (native fetch + auto-refresh), queryKeys, Zustand stores, providers
- Shared packages: types (18 interfaces, 22 enums), hooks (6), socket.io clients, i18n (102 error codes)
- shadcn/ui: 13 primitives in shared-ui + per-portal components

### Cần implement:
1. Replace ALL `mock-data.ts` imports → real API via `apiClient` + TanStack Query
2. Connect ALL forms → React Hook Form + Zod + API submission
3. Wire dynamic route params (`[slug]`, `[orderId]`, `[questionId]`, etc.)
4. Fix hardcoded data: Navbar (user/cart/notifications), course detail gradient
5. Add auth guards, loading/error states, optimistic updates
6. Wire real-time: WebSocket chat, notifications, payment polling

---

## Sub-phase Breakdown (7 sub-phases)

| Sub | Scope | Pages | Files | Priority |
|-----|-------|-------|-------|----------|
| **5.13a** | Auth & Navigation | Login, Register, Verify Email, Forgot/Reset Password, Navbar, AuthGuard | 8 | 🔴 Critical |
| **5.13b** | Course Browse & Detail | Homepage, Courses Browse, Course Detail | 4 | 🔴 Critical |
| **5.13c** | Ecommerce | Cart, Checkout, Payment, Orders, Wishlist | 5 | 🔴 Critical |
| **5.13d** | Learning | My Learning, Course Player, Certificates | 4 | 🟡 High |
| **5.13e** | Social & Chat | Social Feed, Groups, Group Detail, Chat | 5 | 🟡 High |
| **5.13f** | Q&A & AI | Q&A List, Question Detail, Ask Question, AI Tutor | 4 | 🟡 Medium |
| **5.13g** | Profile & Settings | Profile, Edit Profile, Settings, Become Instructor, Notifications | 5 | 🟢 Medium |

Mỗi sub-phase sẽ có file implementation riêng: `implementation-5.13a.md` → `implementation-5.13g.md`

---

## Common Patterns (áp dụng xuyên suốt tất cả sub-phases)

### Pattern 1: Replace mock data → useQuery

```tsx
// ❌ TRƯỚC (mock)
import { mockCourses } from '@/lib/mock-data';
const courses = mockCourses;

// ✅ SAU (real API)
import { useQuery } from '@tanstack/react-query';
import { apiClient, queryKeys } from '@shared/api-client';

const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.courses.list(params),
  queryFn: () => apiClient.get<Course[]>('/courses', params),
});
const courses = data?.data ?? [];
```

### Pattern 2: Form → React Hook Form + Zod + useMutation

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { toast } from 'sonner';
import { useApiError } from '@shared/hooks';

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const getErrorMessage = useApiError();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => apiClient.post('/auth/login', data),
    onSuccess: (res) => {
      useAuthStore.getState().setAuth(res.data.user, res.data.accessToken);
      router.push('/');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Input {...register('email')} placeholder={t('email')} />
      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('loading') : t('login')}
      </Button>
    </form>
  );
}
```

### Pattern 3: Loading + Error + Empty states

```tsx
if (isLoading) return <CourseSkeleton count={8} />;
if (error) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;
if (!courses.length) return <EmptyState icon={BookOpen} title={t('noResults')} />;
```

### Pattern 4: Auth Guard component

```tsx
// src/components/auth/auth-guard.tsx
'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@shared/hooks';
import { useRouter, usePathname } from '@/i18n/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, router, pathname]);

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

### Pattern 5: Dynamic route params (Next.js 16)

```tsx
// Next.js 16: params is Promise
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function CoursePage({ params }: PageProps) {
  // Client component: use React.use() or useState + useEffect
  const { slug } = React.use(params);
  const { data } = useQuery({
    queryKey: queryKeys.courses.detail(slug),
    queryFn: () => apiClient.get(`/courses/${slug}`),
  });
}
```

### Pattern 6: Optimistic updates (like, follow, bookmark)

```tsx
const likeMutation = useMutation({
  mutationFn: (postId: string) => apiClient.post(`/posts/${postId}/like`),
  onMutate: async (postId) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.social.post(postId) });
    const prev = queryClient.getQueryData(queryKeys.social.post(postId));
    queryClient.setQueryData(queryKeys.social.post(postId), (old: unknown) => {
      const data = old as { data: Post };
      return { data: { ...data.data, isLiked: !data.data.isLiked, likeCount: data.data.likeCount + (data.data.isLiked ? -1 : 1) } };
    });
    return { prev };
  },
  onError: (_, postId, ctx) => {
    queryClient.setQueryData(queryKeys.social.post(postId), ctx?.prev);
  },
});
```

### Pattern 7: Skeleton components

```tsx
// Reusable skeleton per domain
function CourseCardSkeleton() {
  return (
    <Card>
      <Skeleton className="h-48 w-full rounded-t-lg" />
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </CardContent>
    </Card>
  );
}

function CourseSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

---

## UI Fixes (áp dụng xuyên suốt)

### Fix 1: Navbar — Replace hardcoded data
```
TRƯỚC: "Minh Tuấn" hardcoded, cart count "2", notifications "3"
SAU:
  - User: useAuthStore().user (show login button if !isAuthenticated)
  - Cart: useCartStore().itemCount()
  - Notifications: useQuery(queryKeys.notifications.unreadCount)
```

### Fix 2: Course detail hero gradient
```
TRƯỚC: bg-gradient-to-r from-gray-900 to-gray-800
SAU: bg-gradient-to-r from-primary/90 to-primary/70
```

### Fix 3: Hardcoded feature card colors
```
TRƯỚC: text-blue-500 bg-blue-500/10
SAU: text-primary bg-primary/10 (hoặc semantic tokens)
```

### Fix 4: Custom select → shadcn Select
```
TRƯỚC: <select className="custom-styles">
SAU: import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui';
```

### Fix 5: Learning layout hardcoded
```
TRƯỚC: "React & Next.js Full-Stack", "65%"
SAU: Fetch from enrollment API, render real course title + progress
```

---

## New Components Needed

### Shared (packages/shared-ui hoặc per-portal)
- `EmptyState` — ✅ Đã có (`src/components/feedback/empty-state.tsx`)
- `LoadingOverlay` — ✅ Đã có (`src/components/feedback/loading-overlay.tsx`)
- `ErrorState` — Cần tạo: icon + message + retry button
- `AuthGuard` — Cần tạo: redirect to login if not authenticated
- `CourseCardSkeleton` — Cần tạo: skeleton cho course card grid
- `PageSkeleton` — Cần tạo: skeleton cho full page loading

### Per-page (tạo khi implement sub-phase)
- `CourseFilters` — Filter sidebar cho course browse
- `CurriculumAccordion` — Expandable curriculum cho course detail
- `QRPayment` — QR code display cho payment page
- `ChatMessage` — Message bubble cho chat
- `AiMessage` — AI response với code highlighting

---

## Dependency Order

```
5.13a (Auth) → 5.13b (Courses) → 5.13c (Ecommerce) → 5.13d (Learning)
                                                          ↓
                                    5.13e (Social) → 5.13f (Q&A + AI)
                                                          ↓
                                                     5.13g (Profile)
```

Auth PHẢI xong trước vì tất cả pages khác cần `useAuthStore` + auth guard.
Courses trước Ecommerce vì cart cần course data.
Learning sau Ecommerce vì enrollment flow.

---

## Final Checklist

- [ ] Sub-phase 5.13a: Auth + Navigation
- [ ] Sub-phase 5.13b: Course Browse + Detail
- [ ] Sub-phase 5.13c: Ecommerce (Cart, Checkout, Payment, Orders, Wishlist)
- [ ] Sub-phase 5.13d: Learning (My Learning, Player, Certificates)
- [ ] Sub-phase 5.13e: Social + Chat
- [ ] Sub-phase 5.13f: Q&A + AI Tutor
- [ ] Sub-phase 5.13g: Profile + Settings + Notifications
- [ ] Delete `src/lib/mock-data.ts`
- [ ] Student portal builds without errors
- [ ] All pages work with real API
- [ ] Dark mode verified
- [ ] Mobile responsive verified
- [ ] i18n vi + en verified
