# Implementation — Bugfix: Medium & Low Priority Issues

## Audit Summary

| # | Vấn đề | Priority | Trạng thái |
|---|--------|----------|-----------|
| 11 | Mutation thiếu `onError` handler | MEDIUM | **Cần fix** |
| 12 | Thiếu indexes trên DB | MEDIUM | **Cần fix** |
| 13 | Admin confirmation dialogs | MEDIUM | **Đã có** ✅ |
| 14 | Instructor settings incomplete | MEDIUM | **Cần fix** |
| 15 | Query key inconsistency | MEDIUM | **Không phải bug** ✅ |
| 16 | Cart Zustand không sync across tabs | MEDIUM | **Cần fix** |
| 17 | Thiếu rate limiting trên sensitive endpoints | LOW | **Cần fix** |
| 18 | Missing recommendations endpoint | LOW | **Đã có** ✅ |
| 19 | Unsafe `as` type casting | LOW | **Defer** — ~50 files, 90+ casts, cần plan refactor riêng |
| 20 | TODO/FIXME comments | LOW | **Không còn** ✅ |

**Cần fix: #11, #12, #14, #16, #17** (5 bugs)

**Đã OK / không phải bug:**
- **#13** Admin confirmation dialogs — tất cả admin pages đã dùng `ConfirmDialog`
- **#15** Query key inconsistency — sau khi đọc kỹ, Course Wizard dùng **batch save pattern**: thay đổi chỉ lưu local state với flags `isNew`/`isModified`/`isDeleted`, khi user nhấn "Save Draft" mới batch tất cả mutations và invalidate **1 lần duy nhất** ở cuối ([step-curriculum.tsx:563](apps/management-portal/src/components/courses/wizard/step-curriculum.tsx#L563)). Thêm `onSuccess` invalidation vào từng hook sẽ gây spam refetch (60 lessons → 60 refetches thay vì 1). `useSubmitCourseForReview` cũng OK vì sau submit redirect sang list page. `useUpdateCourseTags` là dead code, không dùng ở đâu.
- **#18** Recommendations endpoint — `GET /recommendations` đã có sẵn ([recommendations.controller.ts](apps/api/src/modules/recommendations/recommendations.controller.ts))
- **#20** TODO/FIXME — codebase clean

**Defer:**
- **#19** Unsafe `as` casts — 50 files, 90+ casts, cần plan refactor riêng (refactor types/API client generics)

---

## Fix #11: Mutation thiếu onError handler

### Vấn đề

4 files chứa mutations với pattern sai hoặc thiếu error handler:

**Pattern sai** — truyền `getErrorMessage` trực tiếp thay vì wrap trong callback:
```typescript
// ❌ SAI: getErrorMessage là function trả về string, không phải error handler
onError: getErrorMessage,

// ✅ ĐÚNG: wrap trong callback + hiển thị toast
onError: (error) => toast.error(getErrorMessage(error)),
```

**Thiếu hoàn toàn** — không có onError:
```typescript
// ❌ Mutation không có error handler → silent failure
return useMutation({
  mutationFn: ...,
  onSuccess: () => { ... },
  // onError không có!
});
```

### Files cần sửa

#### 1. `packages/shared-hooks/src/queries/use-social.ts`

**Thêm import `toast`:**
```typescript
import { toast } from 'sonner';
```

**8 mutations cần fix:**

| Hook | Dòng | Vấn đề | Fix |
|------|------|--------|-----|
| `useCreatePost` | 60 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useUpdatePost` | 74 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useDeletePost` | 86 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useToggleLike` | 90-98 | Không có onError | Thêm `useApiError` + `onError: (error) => toast.error(getErrorMessage(error))` |
| `useToggleBookmark` | 100-108 | Không có onError | Thêm `useApiError` + `onError: (error) => toast.error(getErrorMessage(error))` |
| `useSharePost` | 120 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useCreateComment` | 134 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useDeleteComment` | 148 | `onError: getErrorMessage` | `onError: (error) => toast.error(getErrorMessage(error))` |

#### 2. `packages/shared-hooks/src/queries/use-groups.ts`

**Thêm import `toast`:**
```typescript
import { toast } from 'sonner';
```

**10 mutations cần fix — tất cả cùng pattern:**

| Hook | Dòng | Fix |
|------|------|-----|
| `useCreateGroup` | 59 | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useUpdateGroup` | 73 | same |
| `useDeleteGroup` | 85 | same |
| `useJoinGroup` | 98 | same |
| `useLeaveGroup` | 111 | same |
| `useCreateGroupPost` | 134 | same |
| `useUpdateMemberRole` | 147 | same |
| `useKickMember` | 161 | same |
| `useApproveRequest` | 176 | same |
| `useRejectRequest` | 189 | same |

#### 3. `packages/shared-hooks/src/queries/use-chat.ts`

**Thêm import `toast`:**
```typescript
import { toast } from 'sonner';
```

**2 mutations cần fix:**

| Hook | Dòng | Fix |
|------|------|-----|
| `useGetOrCreateConversation` | 38 | `onError: (error) => toast.error(getErrorMessage(error))` |
| `useSendMessage` | 52 | `onError: (error) => toast.error(getErrorMessage(error))` |

#### 4. `packages/shared-hooks/src/queries/use-notifications.ts`

**Thêm imports:**
```typescript
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
```

**2 mutations cần fix — thêm useApiError + onError:**

| Hook | Dòng | Fix |
|------|------|-----|
| `useMarkNotificationRead` | 35-43 | Thêm `const getErrorMessage = useApiError();` + `onError: (error) => toast.error(getErrorMessage(error))` |
| `useMarkAllNotificationsRead` | 45-53 | same |

### Tổng: 22 mutations, 4 files

---

## Fix #12: Thiếu indexes trên DB

### Vấn đề

3 models thiếu index cho các trường thường xuyên dùng trong WHERE/JOIN:

### File: `apps/api/src/prisma/schema.prisma`

#### 1. OrderItem — thêm `@@index([courseId])`

```prisma
model OrderItem {
  // ... existing fields ...

  @@index([orderId])
  @@index([courseId])          // ADD: query earnings by course
  @@map("order_items")
}
```

**Lý do:** `instructor.service.ts` query earnings groupBy courseId. Không có index sẽ full table scan.

#### 2. LessonProgress — thêm `@@index([lessonId])`

```prisma
model LessonProgress {
  // ... existing fields ...

  @@id([userId, lessonId])
  @@index([lessonId])          // ADD: query completion rate per lesson
  @@map("lesson_progress")
}
```

**Lý do:** Composite PK `[userId, lessonId]` chỉ tối ưu khi query theo userId trước. Query "bao nhiêu user đã complete lesson X" cần index trên lessonId.

#### 3. ChapterPurchase — thêm `@@index([chapterId])`

```prisma
model ChapterPurchase {
  // ... existing fields ...

  @@unique([userId, chapterId])
  @@index([chapterId])         // ADD: check all purchasers of a chapter
  @@map("chapter_purchases")
}
```

**Lý do:** `@@unique([userId, chapterId])` tối ưu query (userId, chapterId) nhưng query "ai đã mua chapter X" cần index trên chapterId.

### Migration

```bash
cd apps/api
npx prisma migrate dev --name add_performance_indexes
```

---

## Fix #14: Instructor settings — hoàn thiện Payout & Notifications tab

### Vấn đề

- Payout tab: chỉ có text + link tới withdrawals page
- Notifications tab: chỉ hiển thị "coming soon"

### File: `apps/management-portal/src/app/[locale]/instructor/settings/page.tsx`

### 14a. Payout Tab — hiển thị balance + bank info

Backend đã trả `availableBalance` và `pendingBalance` từ `GET /instructor/dashboard`.

**Thêm hook:**
```typescript
import { useInstructorProfile, useUpdateInstructorProfile, useAuthStore, useInstructorDashboard } from '@shared/hooks';
```

**Thêm query:**
```typescript
const { data: dashboardData } = useInstructorDashboard();
const dashboard = dashboardData?.data as { overview?: { availableBalance?: number; pendingBalance?: number; totalRevenue?: number } } | undefined;
```

**Replace Payout tab content (lines 168-183):**
```tsx
<TabsContent value="payout">
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{t('payout')}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-muted-foreground text-sm">{t('totalRevenue')}</p>
          <p className="text-xl font-bold">{formatPrice(dashboard?.overview?.totalRevenue ?? 0)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-muted-foreground text-sm">{t('availableBalance')}</p>
          <p className="text-xl font-bold text-green-600">{formatPrice(dashboard?.overview?.availableBalance ?? 0)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-muted-foreground text-sm">{t('pendingBalance')}</p>
          <p className="text-xl font-bold text-yellow-600">{formatPrice(dashboard?.overview?.pendingBalance ?? 0)}</p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">{t('payoutInfo')}</p>

      <Link href="/instructor/withdrawals">
        <Button variant="outline" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          {t('goToWithdrawals')}
        </Button>
      </Link>
    </CardContent>
  </Card>
</TabsContent>
```

**Thêm import:**
```typescript
import { formatPrice } from '@shared/utils';
```

### 14b. Notifications Tab — hiển thị notification preferences (UI only)

Backend chưa hỗ trợ notification preferences API, nên hiển thị static toggle list. Các toggle sẽ disabled với tooltip "coming soon". Khi backend support, chỉ cần wire up API.

**Replace Notifications tab content (lines 186-195):**
```tsx
<TabsContent value="notifications">
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{t('emailNotifications')}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('notificationsDesc')}</p>
      <div className="space-y-3">
        {[
          { key: 'newEnrollment', defaultOn: true },
          { key: 'newReview', defaultOn: true },
          { key: 'courseApproval', defaultOn: true },
          { key: 'payoutCompleted', defaultOn: true },
          { key: 'weeklyReport', defaultOn: false },
        ].map(({ key, defaultOn }) => (
          <div key={key} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">{t(`notif_${key}`)}</span>
            <span className={`text-xs ${defaultOn ? 'text-green-600' : 'text-muted-foreground'}`}>
              {defaultOn ? t('enabled') : t('disabled')}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t('notificationsComingSoon')}</p>
    </CardContent>
  </Card>
</TabsContent>
```

### 14c. Thêm i18n keys

**`apps/management-portal/messages/vi.json`** — thêm vào section `settings`:
```json
"totalRevenue": "Tổng doanh thu",
"availableBalance": "Số dư khả dụng",
"pendingBalance": "Đang chờ xử lý",
"notificationsDesc": "Quản lý các thông báo email bạn nhận được",
"notif_newEnrollment": "Học viên mới đăng ký",
"notif_newReview": "Đánh giá mới",
"notif_courseApproval": "Khóa học được duyệt/từ chối",
"notif_payoutCompleted": "Rút tiền hoàn tất",
"notif_weeklyReport": "Báo cáo tuần",
"enabled": "Bật",
"disabled": "Tắt"
```

**`apps/management-portal/messages/en.json`** — thêm vào section `settings`:
```json
"totalRevenue": "Total Revenue",
"availableBalance": "Available Balance",
"pendingBalance": "Pending Balance",
"notificationsDesc": "Manage the email notifications you receive",
"notif_newEnrollment": "New student enrollment",
"notif_newReview": "New course review",
"notif_courseApproval": "Course approved/rejected",
"notif_payoutCompleted": "Payout completed",
"notif_weeklyReport": "Weekly summary report",
"enabled": "Enabled",
"disabled": "Disabled"
```

---

## Fix #16: Cart Zustand cross-tab sync

### Vấn đề

`cart-store.ts` dùng `persist` middleware nhưng không listen `storage` event → mở 2 tab, cart không sync.

### File: `packages/shared-hooks/src/stores/cart-store.ts`

**Thay đổi persist config (line 66):**

Thay:
```typescript
{ name: 'sslm-cart' },
```

Bằng:
```typescript
{
  name: 'sslm-cart',
  storage: createJSONStorage(() => {
    if (typeof window === 'undefined') {
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };
    }
    return localStorage;
  }),
},
```

**Thêm cross-tab sync listener sau store creation (sau line 68):**

```typescript
// Cross-tab sync: listen for storage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'sslm-cart' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.state) {
          useCartStore.setState({
            items: parsed.state.items ?? [],
            couponCode: parsed.state.couponCode ?? null,
            discount: parsed.state.discount ?? 0,
          });
        }
      } catch {
        // ignore malformed data
      }
    }
  });
}
```

**Thêm import:**
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
```

---

## Fix #17: Rate limiting cho sensitive endpoints

### Vấn đề

`ThrottlerModule` đã được setup global trong `app.module.ts`, nhưng global limit thường lỏng. Một số endpoint nhạy cảm cần limit chặt hơn để chống abuse và brute force.

### Endpoints cần rate limit chặt

| Controller | Endpoint | Lý do | Limit |
|------------|----------|-------|-------|
| `auth.controller.ts` | `POST /auth/register` | Spam tạo account giả | 3 / 10 phút |
| `auth.controller.ts` | `POST /auth/login` | Brute force password | 5 / phút |
| `auth.controller.ts` | `POST /auth/forgot-password` | Spam email reset | 3 / 10 phút |
| `auth.controller.ts` | `POST /auth/resend-verification` | Spam email verification | 3 / 10 phút |
| `posts.controller.ts` | `POST /social/posts` | Spam post | 10 / phút |
| `questions.controller.ts` | `POST /qna/questions` | Spam câu hỏi | 5 / phút |
| `reports.controller.ts` | `POST /reports` | Spam báo cáo | 10 / giờ |

### Cách fix

Dùng decorator `@Throttle()` từ `@nestjs/throttler` (đã có sẵn trong project).

```typescript
import { Throttle } from '@nestjs/throttler';

@Post('register')
@Throttle({ default: { limit: 3, ttl: 600_000 } }) // 3 req / 10 phút
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}
```

### Lưu ý

- TTL ở @nestjs/throttler tính bằng **milliseconds**
- Rate limit theo IP (default tracker)
- Throttle exception trả về `429 Too Many Requests` — frontend nên handle code này (đã có generic error handler)
- Auth service đã có check `TOO_MANY_LOGIN_ATTEMPTS` ở application level (DB-based) — rate limit ở decorator level là **lớp bảo vệ thứ 2**, chặn từ guard trước khi vào service

### Ghi chú: AI tutor đã có daily limit

`POST /ai-tutor/sessions/:id/messages` đã có check `AI_DAILY_LIMIT_REACHED` ở service level (daily quota). Per-minute throttle có thể thêm sau nếu cần.

---

## Files tổng quan

| Fix | Files | Modified |
|-----|-------|----------|
| #11 Mutation onError | shared-hooks queries | 4 |
| #12 DB indexes | schema.prisma + migration | 1 + migration |
| #14 Instructor settings | settings page + i18n | 3 |
| #16 Cart cross-tab sync | cart-store | 1 |
| #17 Rate limiting | 4 controllers | 4 |
| **Total** | | **~13** |

## Commit Plan

1. `fix(shared): add missing onError handlers to mutation hooks`
   - use-social.ts, use-groups.ts, use-chat.ts, use-notifications.ts

2. `fix(api): add performance indexes on OrderItem, LessonProgress, ChapterPurchase`
   - schema.prisma + migration

3. `fix(management): complete instructor settings payout and notifications tabs`
   - instructor settings page + i18n keys

4. `fix(shared): add cross-tab sync to cart store`
   - cart-store.ts

5. `fix(api): add rate limiting to sensitive endpoints`
   - auth, social posts, qna questions, reports controllers

## Verification

1. `cd apps/api && npm test` — all backend tests pass
2. TypeScript check — 0 errors in shared-hooks, student-portal, management-portal
3. Manual test: create post → should show toast on API error
4. Manual test: open 2 tabs, add item to cart in one → other tab should update
5. Manual test: instructor settings → payout tab shows balance, notifications tab shows preference list
6. Manual test: spam POST /auth/login 6 times → 6th request returns 429
