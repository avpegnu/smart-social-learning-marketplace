# Explanation — Bugfix Medium & Low Priority

Tài liệu giải thích chi tiết từng bug và cách fix, để bạn (và Claude trong tương lai) hiểu **lý do tại sao** thay đổi, không chỉ **thay đổi cái gì**.

---

## Tổng quan

Đợt audit tìm thấy 10 issue (Medium #11–#16, Low #17–#20). Sau khi điều tra kỹ:

| # | Vấn đề | Kết luận |
|---|--------|----------|
| 11 | Mutation thiếu `onError` handler | **Fix** (22 mutations, 4 files) |
| 12 | Thiếu indexes trên DB | **Fix** (3 models, 1 migration) |
| 13 | Admin confirmation dialogs | **Đã có** — không phải bug |
| 14 | Instructor settings incomplete | **Fix** (settings page + i18n) |
| 15 | Query key inconsistency | **Không phải bug** — đã dùng batch save pattern |
| 16 | Cart Zustand không sync across tabs | **Fix** (cart-store.ts) |
| 17 | Thiếu rate limiting trên sensitive endpoints | **Fix** (4 controllers) |
| 18 | Missing recommendations endpoint | **Đã có** — không phải bug |
| 19 | Unsafe `as` type casting | **Defer** — quá lớn (50 files), cần plan riêng |
| 20 | TODO/FIXME comments | **Không có** — codebase clean |

**Tổng cộng:** Fix 5 bugs (#11, #12, #14, #16, #17). Tất cả 692 backend tests pass, 0 TypeScript errors.

---

## Fix #11 — Mutation thiếu onError handler

### Bug

Project có pattern `useApiError` hook để map backend error codes sang i18n messages:

```typescript
// Pattern chuẩn
const getErrorMessage = useApiError();
return useMutation({
  mutationFn: ...,
  onError: (error) => toast.error(getErrorMessage(error)),
});
```

Tuy nhiên có **22 mutations** trong 4 files dùng pattern **sai** hoặc **không có** error handler:

#### Pattern sai (20 mutations)
```typescript
// ❌ SAI: getErrorMessage là function trả về string, không phải callback
const getErrorMessage = useApiError();
return useMutation({
  ...,
  onError: getErrorMessage,
});
```

Khi mutation thất bại, TanStack Query gọi `onError(error)` → trả về string → string bị **vứt đi** (TanStack không làm gì với return value của onError). Toast không xuất hiện. User không biết có lỗi.

#### Không có error handler (4 mutations)
- `useToggleLike`, `useToggleBookmark` trong [use-social.ts](packages/shared-hooks/src/queries/use-social.ts)
- `useMarkNotificationRead`, `useMarkAllNotificationsRead` trong [use-notifications.ts](packages/shared-hooks/src/queries/use-notifications.ts)

→ Silent failure khi API lỗi.

### Files đã fix

1. **[use-social.ts](packages/shared-hooks/src/queries/use-social.ts)** — 8 mutations
   - 6 mutations sửa pattern sai (`useCreatePost`, `useUpdatePost`, `useDeletePost`, `useSharePost`, `useCreateComment`, `useDeleteComment`)
   - 2 mutations thêm error handler mới (`useToggleLike`, `useToggleBookmark`)
   - Thêm `import { toast } from 'sonner'`

2. **[use-groups.ts](packages/shared-hooks/src/queries/use-groups.ts)** — 10 mutations sửa pattern sai
   - `useCreateGroup`, `useUpdateGroup`, `useDeleteGroup`, `useJoinGroup`, `useLeaveGroup`, `useCreateGroupPost`, `useUpdateMemberRole`, `useKickMember`, `useApproveRequest`, `useRejectRequest`
   - Thêm `import { toast } from 'sonner'`

3. **[use-chat.ts](packages/shared-hooks/src/queries/use-chat.ts)** — 2 mutations sửa pattern sai
   - `useGetOrCreateConversation`, `useSendMessage`
   - Thêm `import { toast } from 'sonner'`

4. **[use-notifications.ts](packages/shared-hooks/src/queries/use-notifications.ts)** — 2 mutations thêm error handler mới
   - `useMarkNotificationRead`, `useMarkAllNotificationsRead`
   - Thêm `import { toast }` và `import { useApiError }`

### Fix pattern

```typescript
// ✅ ĐÚNG
return useMutation({
  ...,
  onError: (error) => toast.error(getErrorMessage(error)),
});
```

### Tại sao không break gì

- Các mutation trước đây bị silent failure → user không bao giờ thấy lỗi
- Sau fix, user thấy toast khi có lỗi → UX tốt hơn, không thay đổi happy path
- Không thay đổi mutation logic, không thay đổi state cũ

---

## Fix #12 — Thiếu indexes trên DB

### Bug

3 models có columns được dùng trong WHERE/JOIN nhưng không có index → full table scan, chậm khi data lớn.

#### 1. `OrderItem.courseId`

[instructor.service.ts](apps/api/src/modules/instructor/instructor.service.ts) query earnings groupBy `courseId`:

```typescript
this.prisma.orderItem.groupBy({
  by: ['courseId'],
  where: { courseId: { in: courseIds } },
  ...
});
```

Trước fix: chỉ có `@@index([orderId])`. Query theo `courseId` → full scan.

#### 2. `LessonProgress.lessonId`

Composite primary key `@@id([userId, lessonId])` chỉ tối ưu khi WHERE bắt đầu bằng `userId`. Query "có bao nhiêu user đã hoàn thành lesson X" cần lookup theo `lessonId` → scan toàn bộ table.

#### 3. `ChapterPurchase.chapterId`

`@@unique([userId, chapterId])` cũng chỉ tối ưu khi WHERE bắt đầu bằng `userId`. Query "ai đã mua chapter X" → scan.

### Files đã fix

1. **[schema.prisma](apps/api/src/prisma/schema.prisma)** — thêm 3 `@@index` directives:
   ```prisma
   model OrderItem {
     ...
     @@index([orderId])
     @@index([courseId])    // ADD
   }

   model LessonProgress {
     ...
     @@id([userId, lessonId])
     @@index([lessonId])    // ADD
   }

   model ChapterPurchase {
     ...
     @@unique([userId, chapterId])
     @@index([chapterId])   // ADD
   }
   ```

2. **[migrations/20260406120000_add_performance_indexes/migration.sql](apps/api/src/prisma/migrations/20260406120000_add_performance_indexes/migration.sql)** — created
   ```sql
   CREATE INDEX "order_items_course_id_idx" ON "order_items"("course_id");
   CREATE INDEX "chapter_purchases_chapter_id_idx" ON "chapter_purchases"("chapter_id");
   CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");
   ```

### Tại sao tạo migration thủ công

Database local (PostgreSQL) không đang chạy lúc fix → không thể chạy `npx prisma migrate dev`. Migration SQL được viết thủ công theo đúng convention naming Prisma generate ra (`{table}_{column}_idx`). Khi DB lên lại, chạy `npx prisma migrate dev` để apply.

### Tại sao không break gì

- Indexes là **additive** — chỉ thêm cấu trúc, không sửa data
- Pure performance improvement, không thay đổi semantics
- Risk duy nhất: migration table bị stale nếu schema.prisma và migration SQL không khớp → đã verify khớp với naming convention

---

## Fix #14 — Instructor settings tabs

### Bug

[settings/page.tsx](apps/management-portal/src/app/[locale]/instructor/settings/page.tsx) có 3 tabs: **Profile**, **Payout**, **Notifications**.

- **Profile tab**: hoàn chỉnh, có form với headline/bio/expertise
- **Payout tab**: chỉ có 1 dòng text + button link tới `/instructor/withdrawals`
- **Notifications tab**: chỉ có 1 dòng "coming soon"

→ 2 tabs trống, không cung cấp giá trị gì cho user.

### Files đã fix

1. **[settings/page.tsx](apps/management-portal/src/app/[locale]/instructor/settings/page.tsx)**

   **Payout tab — hiển thị balance overview:**

   Backend đã có sẵn `GET /instructor/dashboard` trả về `overview.totalRevenue`, `overview.availableBalance`, `overview.pendingBalance`. Chỉ cần dùng `useInstructorDashboard()` hook và hiển thị 3 cards:
   - **Total Revenue** — tổng doanh thu (tham chiếu)
   - **Available Balance** (xanh lá) — có thể rút
   - **Pending Balance** (vàng) — đang chờ confirm

   Sau đó text giải thích + button link tới withdrawals page.

   **Notifications tab — hiển thị preference list (read-only):**

   Backend chưa có notification preferences API. Nhưng user vẫn cần biết họ đang nhận thông báo gì. Nên implement static preference list (read-only) với 5 loại:
   - New enrollment, New review, Course approval, Payout completed, Weekly report (weekly tắt mặc định)

   Mỗi item hiển thị `Enabled` / `Disabled` badge. Bên dưới có note "Customizable preferences coming in a future update".

   Khi backend support, chỉ cần wire lên API mà không cần thay đổi layout.

2. **[messages/vi.json](apps/management-portal/messages/vi.json) và [messages/en.json](apps/management-portal/messages/en.json)** — thêm 13 keys mới vào section `settings`:
   - `totalRevenue`, `availableBalance`, `pendingBalance`, `balanceDesc`
   - `notificationsDesc`, `notif_newEnrollment`, `notif_newReview`, `notif_courseApproval`, `notif_payoutCompleted`, `notif_weeklyReport`
   - `enabled`, `disabled`
   - Sửa lại `notificationsComingSoon` cho rõ nghĩa hơn

   Đã verify vi/en parity: **37 keys** match.

### Tại sao không break gì

- Profile tab không thay đổi
- 2 tabs mới chỉ thêm UI, không thay đổi mutation logic
- `useInstructorDashboard()` hook đã có sẵn, được dùng ở dashboard page → reuse cache
- Notifications tab read-only → không gọi API mới

---

## Fix #16 — Cart cross-tab sync

### Bug

[cart-store.ts](packages/shared-hooks/src/stores/cart-store.ts) dùng Zustand `persist` middleware để lưu vào `localStorage`. Nhưng `persist` chỉ:
- ✅ Save state → localStorage mỗi khi state thay đổi
- ✅ Load state ← localStorage khi store khởi tạo
- ❌ **Không listen** sự kiện storage change từ tab khác

**Kịch bản bug:**
1. User mở Tab A và Tab B cùng trang
2. Tab A: thêm khóa học X vào giỏ → save vào `localStorage['sslm-cart']`
3. Tab B: vẫn giữ state cũ trong memory (chưa biết localStorage đã đổi)
4. User chuyển sang Tab B → giỏ hàng vẫn rỗng
5. Tab B add khóa học Y → ghi đè state → **mất khóa học X**

### Files đã fix

1. **[cart-store.ts](packages/shared-hooks/src/stores/cart-store.ts)**

   **Bước 1: thêm explicit storage config**
   ```typescript
   import { persist, createJSONStorage } from 'zustand/middleware';

   const STORAGE_KEY = 'sslm-cart';

   const noopStorage = {
     getItem: () => null,
     setItem: () => {},
     removeItem: () => {},
   };

   ...

   {
     name: STORAGE_KEY,
     storage: createJSONStorage(() =>
       typeof window === 'undefined' ? noopStorage : window.localStorage,
     ),
   }
   ```

   - Dùng `noopStorage` khi `window === undefined` (SSR safe — Next.js render server-side)
   - Tránh việc `localStorage` undefined gây crash

   **Bước 2: thêm cross-tab sync listener**
   ```typescript
   if (typeof window !== 'undefined') {
     window.addEventListener('storage', (event) => {
       if (event.key !== STORAGE_KEY || !event.newValue) return;
       try {
         const parsed = JSON.parse(event.newValue) as {
           state?: { items?: CartItem[]; couponCode?: string | null; discount?: number };
         };
         if (!parsed.state) return;
         useCartStore.setState({
           items: parsed.state.items ?? [],
           couponCode: parsed.state.couponCode ?? null,
           discount: parsed.state.discount ?? 0,
         });
       } catch {
         // ignore malformed storage payloads
       }
     });
   }
   ```

### Cách hoạt động

- Browser tự bắn `storage` event mỗi khi tab khác sửa `localStorage`
- Listener parse JSON, validate shape, gọi `setState` để sync
- Try-catch để tránh crash nếu localStorage bị tampered/corrupt
- **Quan trọng:** `storage` event chỉ bắn ở **các tab khác**, không bắn ở tab vừa write → không bị infinite loop
- SSR-safe: chỉ chạy khi `typeof window !== 'undefined'`

### Tại sao không break gì

- Persist behavior cũ không thay đổi (vẫn save/load từ localStorage)
- Listener chỉ thêm, không thay đổi setState logic hiện có
- SSR-safe: không chạy khi server render
- Try-catch bảo vệ khỏi malformed JSON

---

## Fix #17 — Rate limiting cho sensitive endpoints

### Bug

`ThrottlerModule` đã được setup global trong [app.module.ts](apps/api/src/app.module.ts), nhưng global limit thường khá lỏng (vd: 100 req/phút). Một số endpoint **rất nhạy cảm** cần limit chặt hơn:

- `POST /auth/register` — spam tạo account giả
- `POST /auth/login` — brute force password
- `POST /auth/forgot-password` — spam email reset
- `POST /auth/resend-verification` — spam email verification
- `POST /social/posts` — spam post
- `POST /qna/questions` — spam câu hỏi
- `POST /reports` — spam báo cáo

### Files đã fix

1. **[auth.controller.ts](apps/api/src/modules/auth/auth.controller.ts)** — 4 endpoints
   ```typescript
   @Post('register')
   @Throttle({ default: { limit: 3, ttl: 600_000 } })  // 3 req / 10 phút

   @Post('login')
   @Throttle({ default: { limit: 5, ttl: 60_000 } })   // 5 req / phút

   @Post('forgot-password')
   @Throttle({ default: { limit: 3, ttl: 600_000 } })  // 3 req / 10 phút

   @Post('resend-verification')
   @Throttle({ default: { limit: 3, ttl: 600_000 } })  // 3 req / 10 phút
   ```

2. **[posts.controller.ts](apps/api/src/modules/social/posts/posts.controller.ts)** — `POST /posts`
   ```typescript
   @Throttle({ default: { limit: 10, ttl: 60_000 } })  // 10 req / phút
   ```

3. **[questions.controller.ts](apps/api/src/modules/qna/questions/questions.controller.ts)** — `POST /questions`
   ```typescript
   @Throttle({ default: { limit: 5, ttl: 60_000 } })   // 5 req / phút
   ```

4. **[reports.controller.ts](apps/api/src/modules/reports/reports.controller.ts)** — `POST /reports`
   ```typescript
   @Throttle({ default: { limit: 10, ttl: 3_600_000 } }) // 10 req / giờ
   ```

### Hai lớp bảo vệ

`auth.service.ts` đã có check `TOO_MANY_LOGIN_ATTEMPTS` ở **application level** (đếm failed attempts trong DB). Đó là layer 2.

Rate limit ở **decorator level** là layer 1 — chặn ngay từ guard, không vào controller, không query DB, không bcrypt compare → tiết kiệm resource và chống DDoS hiệu quả hơn.

Hai layer kết hợp:
- Layer 1 (Throttle decorator): chặn IP-level brute force, không vào logic
- Layer 2 (auth.service check): chặn account-level (5 fail trong 15 phút → lock)

### TTL units

`@nestjs/throttler` dùng **milliseconds**:
- `60_000` = 1 phút
- `600_000` = 10 phút
- `3_600_000` = 1 giờ

### Tại sao không break gì

- Decorator chỉ thêm rate check, không thay đổi handler logic
- Throttle exception trả về `429 Too Many Requests` — frontend đã có generic error handler
- Limit số được chọn rộng tay cho legitimate user (vd: 5 login/phút là quá đủ cho người thật, nhưng chặn được bot)
- Tests không bị ảnh hưởng vì test goes qua service trực tiếp, không qua HTTP layer

---

## Verification

| Check | Status |
|-------|--------|
| Backend tests (`cd apps/api && npm test`) | ✅ 692 passed |
| TypeScript check shared-hooks | ✅ 0 errors |
| TypeScript check management-portal | ✅ 0 errors |
| TypeScript check student-portal | ✅ 0 errors (sau khi clear stale `.next/types` cache) |
| TypeScript check api | ✅ 0 errors |
| i18n vi/en parity (settings) | ✅ 37 keys match |

---

## Files changed

| Fix | Files |
|-----|-------|
| #11 | `packages/shared-hooks/src/queries/use-social.ts`, `use-groups.ts`, `use-chat.ts`, `use-notifications.ts` |
| #12 | `apps/api/src/prisma/schema.prisma` + migration `20260406120000_add_performance_indexes/migration.sql` |
| #14 | `apps/management-portal/src/app/[locale]/instructor/settings/page.tsx`, `messages/vi.json`, `messages/en.json` |
| #16 | `packages/shared-hooks/src/stores/cart-store.ts` |
| #17 | `apps/api/src/modules/auth/auth.controller.ts`, `social/posts/posts.controller.ts`, `qna/questions/questions.controller.ts`, `reports/reports.controller.ts` |

Total: **13 files** modified, **1 migration** created.

## Commit Plan

1. `fix(shared): add missing onError handlers to mutation hooks`
2. `fix(api): add performance indexes on OrderItem, LessonProgress, ChapterPurchase`
3. `fix(management): complete instructor settings payout and notifications tabs`
4. `fix(shared): add cross-tab sync to cart store`
5. `fix(api): add rate limiting to sensitive endpoints`

## Bugs not fixed (deferred / not actually bugs)

- **#13** Admin confirmation dialogs — đã có sẵn, không phải bug
- **#15** Query key invalidation — Course Wizard dùng batch save pattern (state local + invalidate 1 lần ở cuối handleSave). Thêm onSuccess vào từng hook sẽ gây spam refetch (60 lessons → 60 refetches). Không phải bug.
- **#18** Recommendations endpoint — `GET /recommendations` đã có sẵn
- **#19** Unsafe `as` casts — 50 files, 90+ casts. Cần plan refactor riêng cho proper types/API client generics. Defer.
- **#20** TODO/FIXME — codebase clean
