# Phase 5.14e — Instructor: Revenue, Withdrawals, Coupons, Students, Q&A, Settings

> Wire 7 instructor pages from mock data to real backend API. Fix earning/discount calculation.

---

## 1. OVERVIEW

### Pages Wired (7)
| # | Page | Data Source |
|---|------|-------------|
| 1 | Revenue | `useInstructorDashboard()` — overview stats + recent earnings + course stats |
| 2 | Withdrawals | `useInstructorWithdrawals()` + `useRequestWithdrawal()` + withdrawal dialog |
| 3 | Coupons List | `useInstructorCoupons()` + `useDeactivateCoupon()` |
| 4 | Create Coupon | `useCreateCoupon()` + `useInstructorCourses()` for course selector |
| 5 | Course Students | `useInstructorCourseStudents()` — new backend endpoint |
| 6 | Q&A | `useQuestions({ instructorId })` + `useCreateAnswer()` |
| 7 | Settings | `useInstructorProfile()` + `useUpdateInstructorProfile()` |

### Backend Changes
| Change | Purpose |
|--------|---------|
| `GET /instructor/courses/:id/students` | New endpoint — paginated student list |
| `QueryQuestionsDto.instructorId` | Filter Q&A by instructor's courses |
| `OrderItem.discount` field | Store per-item discount for earning calculation |
| `InstructorProfile.availableBalance` field | Cached balance for withdrawals |
| Earning calculation in webhook | Use `item.price - item.discount` instead of raw price |
| `distributeDiscount()` in orders service | Proportionally distribute coupon discount per item |
| Cron `releaseAvailableEarnings()` | Increment `availableBalance` on instructor profile |
| Withdrawal service simplified | Deduct from `availableBalance` directly |

---

## 2. BACKEND — NEW ENDPOINTS

### GET /instructor/courses/:courseId/students

**Controller:** `course-management.controller.ts`
**Service:** `course-management.service.ts` → `getCourseStudents()`
**DTO:** `query-course-students.dto.ts` extends `PaginationDto` with optional `search`

**Response:**
```typescript
{
  data: Array<{
    id: string;          // enrollment.id
    userId: string;
    courseId: string;
    type: 'FULL' | 'PARTIAL';
    progress: number;    // 0-1
    createdAt: string;
    user: { id, fullName, email, avatarUrl };
  }>,
  meta: { page, limit, total, totalPages }
}
```

### QueryQuestionsDto — instructorId filter

**File:** `query-questions.dto.ts` — added optional `instructorId` field
**Service:** `questions.service.ts` — `where: { course: { instructorId } }`

Allows instructor to see questions across ALL their courses in one query.

---

## 3. BACKEND — EARNING & DISCOUNT FIXES

### Problem
Coupon discount was applied at order level but earning was calculated on item's original price.
Example: Course 10,000₫, coupon -1,000₫, instructor earns 70% of 10,000 = 7,000 (wrong, should be 6,300).

### Solution: Per-item discount

**Schema:** `OrderItem.discount Float @default(0)`

**Order creation** (`orders.service.ts`):
1. `validateAndCalculateDiscount()` now returns `applicableCourseIds`
2. `distributeDiscount()` distributes total discount proportionally among applicable items
3. Each `OrderItem` stores its `discount` amount

**Webhook** (`webhooks.service.ts`):
```typescript
const actualPrice = item.price - item.discount;
const commissionAmount = Math.round(actualPrice * commissionRate);
const netAmount = actualPrice - commissionAmount;
```

### Available Balance

**Schema:** `InstructorProfile.availableBalance Float @default(0)`

**Flow:**
1. Payment → earning created with `status: PENDING`, `availableAt: now + 7 days`
2. Cron daily 1 AM → earnings with `availableAt <= now` → `status: AVAILABLE`, `availableBalance += netAmount`
3. Withdrawal → `availableBalance -= amount`
4. Dashboard reads `availableBalance` from profile (no aggregate query)

**Webhook also updates:**
- `InstructorProfile.totalRevenue += netAmount`
- `InstructorProfile.totalStudents += 1` (once per instructor per order, tracked by Set)

---

## 4. SHARED SERVICES & HOOKS

### New Services (3)

| File | Functions |
|------|-----------|
| `coupon.service.ts` | `getInstructorCoupons(params)`, `create(data)`, `update(id, data)`, `deactivate(id)` |
| `withdrawal.service.ts` | `getHistory(params)`, `request(data)` |
| `qna.service.ts` | `getQuestions(params)`, `getQuestionDetail(id)`, `createAnswer(qId, data)`, `markBestAnswer(qId, aId)` |

All services use `toQuery()` helper to convert params to `Record<string, string>` for `apiClient.get()`.

### New Hooks (3)

| File | Hooks |
|------|-------|
| `use-coupons.ts` | `useInstructorCoupons`, `useCreateCoupon`, `useUpdateCoupon`, `useDeactivateCoupon` |
| `use-withdrawals.ts` | `useInstructorWithdrawals`, `useRequestWithdrawal` |
| `use-qna.ts` | `useQuestions`, `useQuestionDetail`, `useCreateAnswer`, `useMarkBestAnswer` |

### Extended

| File | Added |
|------|-------|
| `instructor.service.ts` | `getCourseStudents(courseId, params)` |
| `use-instructor.ts` | `useInstructorCourseStudents(courseId, params)` |

---

## 5. MANAGEMENT PAGES

### 5.1 Revenue Page
- 4 stat cards: Total Revenue, Total Students, Pending Withdrawal, Available Balance
- Recent Earnings table: course title, date, status (StatusBadge), amount
- Revenue by Course table: title, enrollments, rating
- "Withdraw" button → navigates to `/instructor/withdrawals`

### 5.2 Withdrawals Page
- Available balance display in header
- Withdrawal history table: date, amount, bank, account, status, admin note
- "Request Withdrawal" button → opens dialog
- Dialog: amount input (min 5,000, max availableBalance), bank name, account number, account name
- Pre-fills bank info from last withdrawal
- Pagination

### 5.3 Coupons List Page
- Table: code, discount (% or ₫), usage/limit with progress bar, valid period, computed status, deactivate action
- Status computed: `isActive=false` → DISABLED, `endDate < now` → EXPIRED, `startDate > now` → SCHEDULED, else → ACTIVE
- Deactivate via ConfirmDialog
- "Create Coupon" button → navigates to `/instructor/coupons/new`
- Pagination

### 5.4 Create Coupon Page
- Form: code (with auto-generate), discount type (PERCENTAGE/FIXED_AMOUNT), value, max discount cap, applicable courses (all/specific), usage limit, max uses per user, min order amount, start/end date
- Live preview card
- Course selector from `useInstructorCourses` (PUBLISHED only)
- Validation: code min 4 chars uppercase, value > 0, PERCENTAGE 1-100, startDate < endDate

### 5.5 Course Students Page
- Header with course title from `useInstructorCourseDetail`
- 2 stat cards: Total Students, Completion Rate
- Table: student (avatar + name + email), enrolled date, type (FULL/PARTIAL badge), progress bar
- Debounced search input
- Pagination

### 5.6 Q&A Page
- Course filter badges from instructor's courses
- Status tabs: All / Unanswered / Answered (server-side filtering via API)
- Question cards: author avatar + name, title, content (truncated), course badge, answer count, relative time
- "Reply" button → opens answer dialog (textarea + submit)
- Answer submitted via `useCreateAnswer` mutation
- Pagination

### 5.7 Settings Page
- Profile tab: fullName (disabled), email (disabled), headline, biography, expertise (tag input with Enter)
- Payout tab: info message + link to Withdrawals page (bank info is per-withdrawal)
- Notifications tab: "Coming soon" message
- Save via `useUpdateInstructorProfile`

---

## 6. OTHER CHANGES

### Shared UI
- `Textarea` component added to `@shared/ui`

### Hydration Fix
- `navbar.tsx`: Cart badge wrapped with `hydrated &&` check to prevent SSR mismatch

### i18n
- ~50 new keys in `en.json` + `vi.json`
- New namespaces: `couponForm`, `courseStudents`
- Extended: `revenue`, `withdrawals`, `coupons`, `qna`, `settings`
- New status labels: AVAILABLE, WITHDRAWN, FAILED, SCHEDULED
- Removed old `createCoupon` namespace (replaced by `couponForm`)

### Migration
- `20260322000000_add_order_discount_and_available_balance`
  - `order_items.discount DOUBLE PRECISION DEFAULT 0`
  - `instructor_profiles.available_balance DOUBLE PRECISION DEFAULT 0`

---

## 7. FILE SUMMARY

### Created (10)
| File | Purpose |
|------|---------|
| `apps/api/.../dto/query-course-students.dto.ts` | DTO for students endpoint |
| `packages/shared-hooks/src/services/coupon.service.ts` | Coupon API service |
| `packages/shared-hooks/src/services/withdrawal.service.ts` | Withdrawal API service |
| `packages/shared-hooks/src/services/qna.service.ts` | Q&A API service |
| `packages/shared-hooks/src/queries/use-coupons.ts` | 4 coupon hooks |
| `packages/shared-hooks/src/queries/use-withdrawals.ts` | 2 withdrawal hooks |
| `packages/shared-hooks/src/queries/use-qna.ts` | 4 Q&A hooks |
| `packages/shared-ui/src/components/textarea.tsx` | Textarea component |
| `apps/api/.../migrations/20260322.../migration.sql` | Schema migration |
| `docs/.../explanation-5.14e.md` | Explanation file |

### Modified (21)
| File | Changes |
|------|---------|
| `course-management.controller.ts` | Add GET /:id/students endpoint |
| `course-management.service.ts` | Add getCourseStudents() method |
| `query-questions.dto.ts` | Add instructorId field |
| `questions.service.ts` | Add instructorId filter in findAll |
| `webhooks.service.ts` | Use item.discount for earning calc, update InstructorProfile counters |
| `orders.service.ts` | Add distributeDiscount(), save per-item discount |
| `coupons.service.ts` | Return applicableCourseIds from validateAndCalculateDiscount |
| `withdrawals.service.ts` | Simplified: deduct from availableBalance |
| `create-withdrawal.dto.ts` | Min amount changed to 5000 |
| `instructor.service.ts` | Read availableBalance from profile |
| `cron.service.ts` | Release earnings → increment availableBalance |
| `schema.prisma` | Add OrderItem.discount, InstructorProfile.availableBalance |
| `instructor.service.ts` (shared) | Add getCourseStudents |
| `use-instructor.ts` (shared) | Add useInstructorCourseStudents |
| `services/index.ts` | Export new services |
| `shared-hooks/index.ts` | Export new hooks + services |
| `shared-ui/index.ts` | Export Textarea |
| `revenue/page.tsx` | Rewrite with API |
| `withdrawals/page.tsx` | Rewrite with API + dialog |
| `coupons/page.tsx` | Rewrite with API |
| `coupons/new/page.tsx` | Rewrite with API |
| `students/page.tsx` | Rewrite with API |
| `qna/page.tsx` | Rewrite with API + answer dialog |
| `settings/page.tsx` | Rewrite with API |
| `en.json` + `vi.json` | ~50 new i18n keys |
| `navbar.tsx` (student) | Hydration fix for cart badge |
