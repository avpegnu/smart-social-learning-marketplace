# Phase 5.13 — FRONTEND STUDENT PORTAL

> 25+ pages cho Student Portal — Auth, Browse, Learning, Social, Ecommerce, Account.
> Tham chiếu: `docs/phase4-frontend/03-student-portal.md`

---

## Mục lục

- [Step 1: Auth Pages (5)](#step-1-auth-pages-5)
- [Step 2: Homepage](#step-2-homepage)
- [Step 3: Browse & Course Pages](#step-3-browse--course-pages)
- [Step 4: Learning Pages (5)](#step-4-learning-pages-5)
- [Step 5: Ecommerce Pages (3)](#step-5-ecommerce-pages-3)
- [Step 6: Social Pages (5)](#step-6-social-pages-5)
- [Step 7: Account Pages (2)](#step-7-account-pages-2)
- [Step 8: Verify](#step-8-verify)

---

## Step 1: Auth Pages (5)

| Route                     | Component          | Type   | Data                                                  |
| ------------------------- | ------------------ | ------ | ----------------------------------------------------- |
| `/(auth)/login`           | LoginPage          | Client | Form → POST /api/auth/login                           |
| `/(auth)/register`        | RegisterPage       | Client | Form → POST /api/auth/register                        |
| `/(auth)/verify-email`    | VerifyEmailPage    | Client | Token from URL → POST /api/auth/verify-email          |
| `/(auth)/forgot-password` | ForgotPasswordPage | Client | Form → POST /api/auth/forgot-password                 |
| `/(auth)/reset-password`  | ResetPasswordPage  | Client | Token from URL + Form → POST /api/auth/reset-password |

### Pattern for auth forms

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const t = useTranslations('auth');
  const form = useForm({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: (data: z.infer<typeof loginSchema>) => apiClient.post('/auth/login', data),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data;
      useAuthStore.getState().login(user, accessToken);
      router.push('/');
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}>
      {/* Form fields using shadcn/ui Form components */}
    </form>
  );
}
```

---

## Step 2: Homepage

| Route | `/(main)/page.tsx`                   |
| ----- | ------------------------------------ |
| Type  | Server Component with client islands |

### Sections:

1. **Hero** — Banner with search bar, CTA
2. **Featured Courses** — `GET /api/courses?sort=popular&limit=8`
3. **Categories** — `GET /api/categories`
4. **Recent Activity** (authenticated) — `GET /api/feed?limit=5`
5. **Testimonials / Social Proof** — Static or from reviews

```tsx
// Server component
export default async function HomePage() {
  const [courses, categories] = await Promise.all([
    fetch(`${API_URL}/courses?sort=popular&limit=8`).then((r) => r.json()),
    fetch(`${API_URL}/categories`).then((r) => r.json()),
  ]);

  return (
    <>
      <HeroSection />
      <FeaturedCourses courses={courses.data} />
      <CategoriesGrid categories={categories.data} />
    </>
  );
}
```

---

## Step 3: Browse & Course Pages

### Browse Courses — `/(main)/courses/page.tsx`

| Type | Client Component (filters, search, pagination)                              |
| ---- | --------------------------------------------------------------------------- |
| Data | `useCourses({ search, categoryId, level, minPrice, maxPrice, sort, page })` |

Key features:

- Search bar with debounce
- Category filter (dropdown or sidebar)
- Level filter (ALL, BEGINNER, INTERMEDIATE, ADVANCED)
- Price range filter (slider)
- Rating filter
- Sort dropdown (newest, popular, rating, price)
- Infinite scroll or pagination
- CourseCard grid (responsive: 1 col mobile → 2 sm → 3 md → 4 xl)

### Course Detail — `/(main)/courses/[slug]/page.tsx`

| Type | Server Component (SSR for SEO) |
| ---- | ------------------------------ |
| Data | `GET /api/courses/:slug`       |

Tabs:

1. **Overview** — Description, what you'll learn, requirements
2. **Curriculum** — Sections > Chapters > Lessons (accordion)
3. **Reviews** — Rating summary + review list (paginated)
4. **Q&A** — Questions from students (linked to Q&A module)

Sidebar (sticky):

- Promo video
- Price + Buy button / Enroll button
- Course stats (students, rating, lessons, duration)
- Instructor card
- Wishlist button
- Share button

---

## Step 4: Learning Pages (5)

### Course Player — `/(learning)/courses/[courseId]/lessons/[lessonId]/page.tsx`

| Type | Client Component                                       |
| ---- | ------------------------------------------------------ |
| Data | `useLessonProgress(userId, lessonId)` + lesson content |

Layout: Video/Text area (70%) + Curriculum sidebar (30%)

- **Video lesson:** Video.js player + progress tracking (send segments every 10s)
- **Text lesson:** Rich text content (Tiptap renderer) + "Mark as complete" button
- **Quiz lesson:** Redirect to quiz player

### Quiz Player — `/(learning)/quiz/[quizId]/page.tsx`

- Question-by-question UI
- Timer (if time limit set)
- Submit → show results + score

### Learning Dashboard — `/(main)/my-learning/page.tsx`

- Enrolled courses grid with progress bars
- Continue learning button (last accessed lesson)
- Current streak display
- Skills map (radar chart)

---

## Step 5: Ecommerce Pages (3)

### Cart — `/(main)/cart/page.tsx`

| Type  | Client Component                |
| ----- | ------------------------------- |
| State | Zustand CartStore + server sync |

- Item list with remove button
- Coupon input + validate
- Price summary (subtotal, discount, total)
- Checkout button

### Checkout — `/(main)/checkout/page.tsx`

- Order summary
- QR code (SePay) for payment
- 15-minute countdown timer
- Polling for payment status (every 5s)
- On success → redirect to order confirmation

### Order Detail — `/(main)/orders/[orderId]/page.tsx`

- Order info (date, status, payment ref)
- Items list
- Status badge (PENDING/COMPLETED/EXPIRED)

---

## Step 6: Social Pages (5)

### Social Feed — `/(main)/feed/page.tsx`

- Post composer (text, code, link, images)
- Feed list (infinite scroll)
- PostCard: author, content, images, like/comment/share/bookmark buttons
- Comment thread (expand/collapse)

### Groups — `/(main)/groups/page.tsx` + `/(main)/groups/[groupId]/page.tsx`

- Group list (joined + discover)
- Group detail: members, posts, join/leave button

### Chat — `/(main)/chat/page.tsx`

- Conversation list (left sidebar)
- Message thread (right panel)
- Message input with file attachment
- Real-time via WebSocket
- Typing indicators
- Online status dots

### Q&A Forum — `/(main)/questions/page.tsx` + `/(main)/questions/[questionId]/page.tsx`

- Question list (filter by course, tag)
- Question detail with answers
- Vote buttons on answers
- Mark best answer (question owner)

### Notifications — `/(main)/notifications/page.tsx`

- Notification list
- Mark as read (individual + all)
- Click to navigate to source

---

## Step 7: Account Pages (2)

### Profile — `/(main)/profile/page.tsx`

- Edit full name, bio, avatar
- Upload avatar (Cloudinary)
- View follower/following counts

### Settings — `/(main)/settings/page.tsx`

- Notification preferences (toggle per type)
- Theme selection (light/dark/system)
- Language selection (vi/en)

---

## Step 8: Verify

### Checklist

- [ ] All auth pages work (register → verify → login → forgot → reset)
- [ ] Homepage loads with featured courses
- [ ] Course browse: search, filter, sort, pagination all work
- [ ] Course detail: tabs, curriculum, reviews display correctly
- [ ] Video player tracks progress (segments sent to API)
- [ ] Quiz player grades and shows results
- [ ] Cart: add/remove items, apply coupon, checkout
- [ ] QR payment + countdown timer + status polling
- [ ] Social feed with infinite scroll
- [ ] Post create with images
- [ ] Like/bookmark/comment work
- [ ] Chat: real-time messaging via WebSocket
- [ ] Notifications: list + mark read + WebSocket push
- [ ] All pages responsive (mobile-first)
- [ ] All text uses useTranslations()
- [ ] Dark mode works on all pages
- [ ] Both vi and en locales work
