# 08 — Notification System Completion

> Phase 7 Improvement — April 12, 2026
> Hoàn thiện hệ thống notification cho toàn bộ platform: fix bugs, implement missing notification types, thêm WebSocket + notification UI cho management-portal, và thêm admin notifications.

---

## 1. Overview

Trước khi implement, hệ thống notification có nhiều vấn đề:

- **6/14 notification types** trong enum chưa bao giờ được tạo (COURSE_ENROLLED, COURSE_APPROVED, ORDER_COMPLETED, v.v.)
- **Management-portal** (instructor/admin) có icon chuông nhưng **không hoạt động** — không có popover, không có WebSocket
- **Admin** không nhận được notification nào
- **Comment replies** hiển thị cả những comment đã soft-delete
- **GROUP_JOIN_REQUEST** notification thiếu tên người request
- **Instructor notification preferences** là stub hardcoded, không gọi API
- **Admin Settings** page trống vì seed data thiếu các setting keys mà frontend cần

Sau khi implement:

- **17/18 notification types** hoạt động (trừ NEW_MESSAGE — để implement sau cùng với chat)
- Management-portal có đầy đủ notification popover + real-time WebSocket
- Admin nhận 4 loại notification nghiệp vụ
- Tất cả bugs đã fix

---

## 2. Bug Fixes

### 2.1 Comment Replies Missing `deletedAt` Filter

**File:** `apps/api/src/modules/social/comments/comments.service.ts`

**Vấn đề:** Khi user xóa reply (soft delete, set `deletedAt`), các query vẫn trả về reply đã xóa vì thiếu filter `deletedAt: null`.

**Thay đổi:**

- `getByPost()` — replies include: thêm `where: { deletedAt: null }`
- `getByPost()` — reply count: đổi `{ replies: true }` → `{ replies: { where: { deletedAt: null } } }`
- `getReplies()` — findMany: thêm `deletedAt: null` vào where
- `getReplies()` — count: thêm `deletedAt: null` vào where

> Lưu ý: top-level comments đã có filter `deletedAt: null` từ trước. Chỉ replies bị thiếu.

### 2.2 GROUP_JOIN_REQUEST Missing `fullName`

**File:** `apps/api/src/modules/social/groups/groups.service.ts`

**Vấn đề:** Notification data cho GROUP_JOIN_REQUEST không chứa `fullName` → frontend hiển thị "Someone" thay vì tên người request.

**Thay đổi:** Thêm query `user.findUnique({ select: { fullName } })` trước khi gọi `queue.addNotification()`, truyền `fullName` vào data.

### 2.3 Instructor Notification Preferences Stub

**File:** `apps/management-portal/src/app/[locale]/instructor/settings/page.tsx`

**Vấn đề:** Tab Notifications trong instructor settings là hardcoded static (`enabled: true/false`), không gọi API, user không thể thay đổi.

**Thay đổi:**
- Xóa `NOTIFICATION_PREFERENCES` constant hardcoded
- Tạo `NotificationsTab` component sử dụng `useMe()` + `useUpdateNotificationPreferences()` hooks
- Toggle in-app/email checkbox gọi `PUT /users/me/notification-preferences` lưu vào DB
- Pattern giống hệt student-portal settings

### 2.4 Admin Settings Page Empty

**File:** `apps/api/src/prisma/seed.ts`

**Vấn đề:** Frontend admin settings cần 9 setting keys (`platform_name`, `support_email`, `default_commission_rate`, ...) nhưng seed data chỉ tạo 7 keys khác (`min_withdrawal_amount`, `order_expiry_minutes`, ...).

**Thay đổi:** Thêm 9 settings vào seed data:
- `platform_name`: "Smart Social Learning Marketplace"
- `platform_description`: "Nền tảng học trực tuyến kết hợp mạng xã hội"
- `support_email`: "support@sslm.com"
- `default_commission_rate`: 30
- `minimum_withdrawal`: 50000
- `minimum_payout`: 100000
- `max_upload_size_mb`: 100
- `auto_approve_courses`: false
- `allow_free_courses`: true

---

## 3. Management-Portal Notification System

### 3.1 SocketProvider

**File mới:** `apps/management-portal/src/components/providers/socket-provider.tsx`

Component gọi `useNotificationSocket()` hook để kết nối WebSocket namespace `/notifications` cho real-time notification delivery.

**Thêm vào layouts:**
- `apps/management-portal/src/app/[locale]/instructor/layout.tsx` — `<SocketProvider />`
- `apps/management-portal/src/app/[locale]/admin/layout.tsx` — `<SocketProvider />`

### 3.2 Notification Components

**Files mới:**
- `apps/management-portal/src/components/notifications/notification-popover.tsx`
- `apps/management-portal/src/components/notifications/notification-item.tsx`

Copy từ student-portal với adjustments:
- `notification-popover.tsx`: Dùng cùng style button với header (border, rounded-md) thay vì Button ghost
- Footer: "Mark all as read" thay vì "View all" (vì management-portal không có trang notifications riêng)
- `notification-item.tsx`: Cùng icon mapping và message generation

### 3.3 Header Integration

**File:** `apps/management-portal/src/components/navigation/header.tsx`

- Xóa inline `useQuery` cho unread count (NotificationPopover tự quản lý)
- Xóa `isAuthenticated` (không còn dùng)
- Thay static `<button>` bằng `<NotificationPopover />`
- Xóa import `Bell` (không còn dùng trực tiếp), `useQuery`

### 3.4 Translations

**Files:** `apps/management-portal/messages/en.json`, `vi.json`

Thêm namespace `notifications`:
```json
{
  "notifications": {
    "title": "Notifications" / "Thông báo",
    "markAllRead": "Mark all as read" / "Đánh dấu đã đọc tất cả",
    "empty": "No notifications yet" / "Chưa có thông báo nào"
  }
}
```

---

## 4. Notification Types Implementation

### 4.1 Enum Changes

**File:** `apps/api/src/prisma/schema.prisma`

Thêm 4 enum values vào `NotificationType`:
- `COURSE_PENDING_REVIEW`
- `WITHDRAWAL_PENDING`
- `NEW_REPORT`
- `NEW_APPLICATION`

**Migration:** `apps/api/src/prisma/migrations/20260412130000_add_admin_notification_types/migration.sql`

```sql
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COURSE_PENDING_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_PENDING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REPORT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_APPLICATION';
```

### 4.2 QueueService — `addAdminNotification()`

**File:** `apps/api/src/modules/jobs/queue.service.ts`

Thêm `PrismaService` injection và method mới:

```typescript
addAdminNotification(type: string, data: Record<string, unknown>) {
  this.prisma.user
    .findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } })
    .then((admins) => {
      for (const admin of admins) {
        this.enqueue(this.notificationQueue, 'create', { userId: admin.id, type, data });
      }
    })
    .catch((err) => this.logger.warn(...));
}
```

Pattern: fire-and-forget, query tất cả admin users → enqueue notification cho từng admin.

### 4.3 Instructor/Student Notification Types (8 types)

| Type | Trigger | Service File | Ai nhận |
|------|---------|-------------|---------|
| `COURSE_ENROLLED` | Free enroll | `enrollments.service.ts` | Instructor |
| `COURSE_ENROLLED` | Paid order complete | `webhooks.service.ts` | Instructor |
| `COURSE_APPROVED` | Admin duyệt khóa học | `admin-courses.service.ts` | Instructor |
| `COURSE_REJECTED` | Admin từ chối khóa học | `admin-courses.service.ts` | Instructor |
| `ORDER_COMPLETED` | Webhook thanh toán | `webhooks.service.ts` | Student |
| `ORDER_EXPIRED` | Cron job hết hạn đơn | `cron.service.ts` | Student |
| `ANSWER_VOTED` | Upvote câu trả lời | `answers.service.ts` | Answer author |
| `WITHDRAWAL_COMPLETED` | Admin duyệt rút tiền | `admin-withdrawals.service.ts` | Instructor |
| `WITHDRAWAL_REJECTED` | Admin từ chối rút tiền | `admin-withdrawals.service.ts` | Instructor |

### 4.4 Admin Notification Types (4 types)

| Type | Trigger | Service File |
|------|---------|-------------|
| `COURSE_PENDING_REVIEW` | Instructor submit khóa học | `course-management.service.ts` |
| `WITHDRAWAL_PENDING` | Instructor yêu cầu rút tiền | `withdrawals.service.ts` |
| `NEW_REPORT` | User report nội dung | `reports.service.ts` |
| `NEW_APPLICATION` | User đăng ký làm instructor | `instructor.service.ts` |

### 4.5 Notification Data Payloads

```typescript
// COURSE_ENROLLED
{ courseId, courseTitle }

// COURSE_APPROVED
{ courseId, courseTitle }

// COURSE_REJECTED
{ courseId, courseTitle, feedback }

// ORDER_COMPLETED
{ orderId }

// ORDER_EXPIRED
{ orderId }

// ANSWER_VOTED (chỉ upvote, không notify downvote)
{ answerId, questionId, userId, fullName }

// WITHDRAWAL_COMPLETED / WITHDRAWAL_REJECTED
{ withdrawalId, amount, reviewNote? }

// COURSE_PENDING_REVIEW (admin)
{ courseId, courseTitle, instructorId }

// WITHDRAWAL_PENDING (admin)
{ withdrawalId, amount, instructorId }

// NEW_REPORT (admin)
{ reportId, targetType, reason }

// NEW_APPLICATION (admin)
{ applicationId, userId, fullName }
```

---

## 5. Module Dependency Changes

Các module cần import `JobsModule` để sử dụng `QueueService`:

| Module | File | Trước | Sau |
|--------|------|-------|-----|
| `EnrollmentsModule` | `enrollments.module.ts` | no imports | `imports: [JobsModule]` |
| `CoursesModule` | `courses.module.ts` | no imports | `imports: [JobsModule]` |
| `OrdersModule` | `orders.module.ts` | `[CouponsModule]` | `[CouponsModule, JobsModule]` |
| `AdminModule` | `admin.module.ts` | `[AiTutorModule]` | `[AiTutorModule, JobsModule]` |
| `WithdrawalsModule` | `withdrawals.module.ts` | no imports | `imports: [JobsModule]` |
| `ReportsModule` | `reports.module.ts` | no imports | `imports: [JobsModule]` |
| `InstructorModule` | `instructor.module.ts` | no imports | `imports: [JobsModule]` |

---

## 6. Frontend Notification Display

### notification-item.tsx (cả 2 portals)

Thêm icon mapping:
- `WITHDRAWAL_PENDING`: Trophy (yellow)
- `COURSE_PENDING_REVIEW`: BookOpen (yellow)
- `NEW_REPORT`: Bell (red)
- `NEW_APPLICATION`: UserPlus (blue)

Thêm message generation:
- `COURSE_PENDING_REVIEW` → `Course "HTML CSS cơ bản" submitted for review`
- `WITHDRAWAL_PENDING` → `New withdrawal request: ₫500,000`
- `NEW_REPORT` → `New POST report: Spam content`
- `NEW_APPLICATION` → `Nguyễn Văn A applied to become an instructor`
- `GROUP_JOIN_REQUEST` → Fix: `${name} requested...` thay vì `Someone requested...`

---

## 7. Cron Service Change — ORDER_EXPIRED

**File:** `apps/api/src/modules/jobs/cron/cron.service.ts`

**Trước:**
```typescript
const result = await this.prisma.order.updateMany({
  where: { status: 'PENDING', expiresAt: { lt: new Date() } },
  data: { status: 'EXPIRED' },
});
```

**Sau:**
```typescript
// 1. Find orders first to get userId
const expiredOrders = await this.prisma.order.findMany({
  where: { status: 'PENDING', expiresAt: { lt: new Date() } },
  select: { id: true, userId: true },
});
// 2. Bulk update
await this.prisma.order.updateMany({
  where: { id: { in: expiredOrders.map((o) => o.id) } },
  data: { status: 'EXPIRED' },
});
// 3. Notify each user
for (const order of expiredOrders) {
  this.queue.addNotification(order.userId, 'ORDER_EXPIRED', { orderId: order.id });
}
```

Lý do: `updateMany` không trả về individual records, cần `findMany` trước để có `userId` cho notification.

---

## 8. Files Changed Summary

### New Files (3)
- `apps/management-portal/src/components/providers/socket-provider.tsx`
- `apps/management-portal/src/components/notifications/notification-popover.tsx`
- `apps/management-portal/src/components/notifications/notification-item.tsx`
- `apps/api/src/prisma/migrations/20260412130000_add_admin_notification_types/migration.sql`

### Modified Files — Backend (20)
- `apps/api/src/prisma/schema.prisma` — 4 new enum values
- `apps/api/src/prisma/seed.ts` — 9 new platform settings
- `apps/api/src/modules/jobs/queue.service.ts` — `addAdminNotification()` + PrismaService
- `apps/api/src/modules/jobs/cron/cron.service.ts` — QueueService + ORDER_EXPIRED notification
- `apps/api/src/modules/social/comments/comments.service.ts` — deletedAt filters for replies
- `apps/api/src/modules/social/groups/groups.service.ts` — fullName in GROUP_JOIN_REQUEST
- `apps/api/src/modules/enrollments/enrollments.service.ts` — COURSE_ENROLLED notification
- `apps/api/src/modules/enrollments/enrollments.module.ts` — import JobsModule
- `apps/api/src/modules/courses/courses.module.ts` — import JobsModule
- `apps/api/src/modules/courses/management/course-management.service.ts` — COURSE_PENDING_REVIEW
- `apps/api/src/modules/admin/admin.module.ts` — import JobsModule
- `apps/api/src/modules/admin/courses/admin-courses.service.ts` — COURSE_APPROVED/REJECTED
- `apps/api/src/modules/admin/withdrawals/admin-withdrawals.service.ts` — WITHDRAWAL_COMPLETED/REJECTED
- `apps/api/src/modules/orders/orders.module.ts` — import JobsModule
- `apps/api/src/modules/orders/webhooks.service.ts` — ORDER_COMPLETED + COURSE_ENROLLED
- `apps/api/src/modules/qna/answers/answers.service.ts` — ANSWER_VOTED
- `apps/api/src/modules/withdrawals/withdrawals.module.ts` — import JobsModule
- `apps/api/src/modules/withdrawals/withdrawals.service.ts` — WITHDRAWAL_PENDING
- `apps/api/src/modules/reports/reports.module.ts` — import JobsModule
- `apps/api/src/modules/reports/reports.service.ts` — NEW_REPORT
- `apps/api/src/modules/instructor/instructor.module.ts` — import JobsModule
- `apps/api/src/modules/instructor/instructor.service.ts` — NEW_APPLICATION

### Modified Files — Frontend (6)
- `apps/management-portal/src/components/navigation/header.tsx` — NotificationPopover
- `apps/management-portal/src/app/[locale]/instructor/layout.tsx` — SocketProvider
- `apps/management-portal/src/app/[locale]/admin/layout.tsx` — SocketProvider
- `apps/management-portal/src/app/[locale]/instructor/settings/page.tsx` — real notification prefs
- `apps/management-portal/messages/en.json` — notifications namespace
- `apps/management-portal/messages/vi.json` — notifications namespace
- `apps/student-portal/src/components/notifications/notification-item.tsx` — new types + fullName fix

---

## 9. Notification Type Coverage

| Type | Status | Recipient |
|------|--------|-----------|
| FOLLOW | ✅ Already existed | Any user |
| POST_LIKE | ✅ Already existed | Post author |
| POST_COMMENT | ✅ Already existed | Post/comment author |
| COURSE_ENROLLED | ✅ New | Instructor |
| COURSE_APPROVED | ✅ New | Instructor |
| COURSE_REJECTED | ✅ New | Instructor |
| COURSE_PENDING_REVIEW | ✅ New | All admins |
| ORDER_COMPLETED | ✅ New | Student |
| ORDER_EXPIRED | ✅ New | Student |
| NEW_MESSAGE | ⏳ Deferred | Chat recipient |
| QUESTION_ANSWERED | ✅ Already existed | Question author |
| ANSWER_VOTED | ✅ New | Answer author |
| WITHDRAWAL_COMPLETED | ✅ New | Instructor |
| WITHDRAWAL_REJECTED | ✅ New | Instructor |
| WITHDRAWAL_PENDING | ✅ New | All admins |
| NEW_REPORT | ✅ New | All admins |
| NEW_APPLICATION | ✅ New | All admins |
| SYSTEM | ✅ Already existed | Group owner/requester |

**Total: 17/18 implemented (94%)**

---

## 10. Deployment Steps

```bash
# 1. Chạy migration cho enum values mới
npx prisma db execute --schema=src/prisma/schema.prisma \
  --file=src/prisma/migrations/20260412130000_add_admin_notification_types/migration.sql

# 2. Regenerate Prisma Client
npx prisma generate --schema=src/prisma/schema.prisma

# 3. (Optional) Seed default platform settings
# Hoặc admin tự nhập qua Admin Settings page
npx prisma db seed

# 4. Restart API
pm2 restart api
```
