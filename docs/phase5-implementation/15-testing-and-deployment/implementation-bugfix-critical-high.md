# Implementation — Bugfix: Critical & High Priority Issues

> Audit ngày 2026-04-05 phát hiện 10 bugs ưu tiên Critical/High.
> File này mô tả chính xác từng thay đổi cần thực hiện.

---

## Commit 1: fix(api): return user in refresh endpoint and add missing DTOs

### 1A. Auth refresh endpoint — trả thêm user

**Vấn đề:** `POST /auth/refresh` chỉ trả `{ accessToken }`, frontend expect `{ user, accessToken }`.
Khi page reload, `auth-provider.tsx:56` destructure `data.data.user` → `undefined` → `setAuth` không được gọi → user mất session.

**File:** `apps/api/src/modules/auth/auth.controller.ts`
**Line 98:** Thay đổi return statement:

```typescript
// BEFORE (line 98):
return { accessToken: result.accessToken };

// AFTER:
return { accessToken: result.accessToken, user: result.user };
```

**Giải thích:** `auth.service.ts:151-161` đã trả đầy đủ `{ accessToken, refreshToken, user }` — controller chỉ cần thêm `user` vào response. Frontend (`auth-provider.tsx:56-58`) đã handle đúng rồi.

---

### 1B. Tạo 6 DTOs cho endpoints thiếu validation

**Vấn đề:** 6 endpoints dùng `@Body('field')` thay vì DTO — không validate input.

#### DTO 1: `ResendVerificationDto`

**Tạo file:** `apps/api/src/modules/auth/dto/resend-verification.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
```

**Sửa file:** `apps/api/src/modules/auth/auth.controller.ts`
- Import `ResendVerificationDto`
- Line 126: `@Body('email') email: string` → `@Body() dto: ResendVerificationDto`
- Line 127: `this.authService.resendVerification(email)` → `this.authService.resendVerification(dto.email)`

#### DTO 2: `ApplyCouponDto`

**Tạo file:** `apps/api/src/modules/cart/dto/apply-coupon.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty({ example: 'SUMMER2024' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;
}
```

**Sửa file:** `apps/api/src/modules/cart/cart.controller.ts`
- Import `ApplyCouponDto`
- Line 57: `@Body('code') code: string` → `@Body() dto: ApplyCouponDto`
- Line 58+: `code` → `dto.code`

#### DTO 3: `MarkBestAnswerDto`

**Tạo file:** `apps/api/src/modules/qna/questions/dto/mark-best-answer.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class MarkBestAnswerDto {
  @ApiProperty({ description: 'Answer ID to mark as best' })
  @IsString()
  @IsNotEmpty()
  answerId!: string;
}
```

**Sửa file:** `apps/api/src/modules/qna/questions/questions.controller.ts`
- Import `MarkBestAnswerDto`
- Line 90: `@Body('answerId') answerId: string` → `@Body() dto: MarkBestAnswerDto`
- Line 92: `answerId` → `dto.answerId`

#### DTO 4: `SharePostDto`

**Tạo file:** `apps/api/src/modules/social/posts/dto/share-post.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SharePostDto {
  @ApiPropertyOptional({ example: 'Check this out!', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;
}
```

**Sửa file:** `apps/api/src/modules/social/posts/posts.controller.ts`
- Import `SharePostDto`
- Line 67: `@Body('content') content?: string` → `@Body() dto: SharePostDto`
- Line 69: `content` → `dto.content`

#### DTO 5: `StartPlacementTestDto`

**Tạo file:** `apps/api/src/modules/learning/placement-tests/dto/start-placement-test.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class StartPlacementTestDto {
  @ApiProperty({ description: 'Category ID for placement test' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
```

**Sửa file:** `apps/api/src/modules/learning/placement-tests/placement-tests.controller.ts`
- Import `StartPlacementTestDto`
- Line 19: `@Body('categoryId') categoryId: string` → `@Body() dto: StartPlacementTestDto`
- Line 20: `categoryId` → `dto.categoryId`

#### DTO 6: `UpdateMemberRoleDto`

**Tạo file:** `apps/api/src/modules/social/groups/dto/update-member-role.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

// Import GroupRole from Prisma client
enum GroupRole {
  MEMBER = 'MEMBER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: GroupRole })
  @IsEnum(GroupRole)
  role!: GroupRole;
}
```

**Sửa file:** `apps/api/src/modules/social/groups/groups.controller.ts`
- Import `UpdateMemberRoleDto`
- Line 95: `@Body('role') role: GroupRole` → `@Body() dto: UpdateMemberRoleDto`
- Line 97: `role` → `dto.role`

**Lưu ý chung cho tất cả DTO imports:**
- Dùng value import (không `type import`) vì ValidationPipe cần runtime class reference
- Thêm comment `// eslint-disable-next-line @typescript-eslint/consistent-type-imports` nếu ESLint complain

---

### 1C. Fix toggleLike race condition

**Vấn đề:** `post.likeCount` được đọc ở line 16 (ngoài transaction), return ở lines 33 & 55 dùng giá trị cũ.
Nếu 2 users like đồng thời, client nhận sai likeCount.

**File:** `apps/api/src/modules/social/interactions/interactions.service.ts`
**Method:** `toggleLike` (lines 15-56)

**BEFORE:**
```typescript
async toggleLike(userId: string, postId: string) {
  const post = await this.prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
  });
  if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

  const existing = await this.prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await this.prisma.$transaction([
      this.prisma.like.delete({ where: { id: existing.id } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return { liked: false, likeCount: post.likeCount - 1 };
  }

  await this.prisma.$transaction([
    this.prisma.like.create({ data: { userId, postId } }),
    this.prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    }),
  ]);

  // Notify post author (skip self-like)
  if (post.authorId !== userId) {
    const liker = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    this.notifications
      .create(post.authorId, 'POST_LIKE', { postId, userId, fullName: liker?.fullName })
      .catch(() => {});
  }

  return { liked: true, likeCount: post.likeCount + 1 };
}
```

**AFTER:**
```typescript
async toggleLike(userId: string, postId: string) {
  const post = await this.prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
  });
  if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

  const existing = await this.prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    const [, updatedPost] = await this.prisma.$transaction([
      this.prisma.like.delete({ where: { id: existing.id } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      }),
    ]);
    return { liked: false, likeCount: updatedPost.likeCount };
  }

  const [, updatedPost] = await this.prisma.$transaction([
    this.prisma.like.create({ data: { userId, postId } }),
    this.prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    }),
  ]);

  // Notify post author (skip self-like)
  if (post.authorId !== userId) {
    const liker = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    this.notifications
      .create(post.authorId, 'POST_LIKE', { postId, userId, fullName: liker?.fullName })
      .catch(() => {});
  }

  return { liked: true, likeCount: updatedPost.likeCount };
}
```

**Thay đổi cốt lõi:** Lấy `likeCount` từ kết quả `post.update` trong transaction (giá trị đã được DB cập nhật) thay vì dùng `post.likeCount` cũ.

---

### 1D. CartItem unique constraint

**Vấn đề:** `CartItem` thiếu unique constraint `(userId, courseId, chapterId)`. Service check tại `cart.service.ts:107-111` nhưng race condition vẫn có thể xảy ra.

**File:** `apps/api/src/prisma/schema.prisma`
**Model:** `CartItem` (lines 660-675)

**Thêm vào trước `@@map("cart_items")`:**

```prisma
@@unique([userId, courseId, chapterId])
```

**Tạo migration:**
```bash
cd apps/api
npx prisma migrate dev --name add_cart_item_unique_constraint
```

**Lưu ý:** Nếu DB có duplicate rows, migration sẽ fail. Cần xóa duplicates trước:
```sql
DELETE FROM cart_items a USING cart_items b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.course_id IS NOT DISTINCT FROM b.course_id
  AND a.chapter_id IS NOT DISTINCT FROM b.chapter_id;
```

---

## Commit 2: fix(shared): sync enums with database schema

### 2A. CourseStatus enum

**Vấn đề:** Prisma schema có 6 values, shared-types chỉ có 4 (thiếu `APPROVED`, `ARCHIVED`).

**File:** `packages/shared-types/src/index.ts`
**Lines 98-103:**

```typescript
// BEFORE:
export enum CourseStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

// AFTER:
export enum CourseStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}
```

### 2B. UserStatus enum

**Vấn đề:** Prisma schema có `UNVERIFIED`, shared-types thiếu.

**File:** `packages/shared-types/src/index.ts`
**Lines 25-28:**

```typescript
// BEFORE:
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// AFTER:
export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}
```

**Impact check:** Grep `CourseStatus` và `UserStatus` trong cả 2 portal. Thêm values mới KHÔNG break code hiện tại (chỉ thêm, không đổi existing values). Frontend code dùng string comparison nên vẫn hoạt động.

---

## Commit 3: fix(shared): fix WebSocket listener cleanup and token refresh

### 3A. Chat socket — cleanup listeners + reconnect on token change

**File:** `packages/shared-hooks/src/use-chat-socket.ts`

**Vấn đề 1:** `.on()` listeners không có `.off()` → memory leak, duplicate handlers.
**Vấn đề 2:** `accessToken` đã có trong dependency array `[isAuthenticated, accessToken, queryClient]`, nên khi token thay đổi, socket tự disconnect rồi reconnect (OK). Nhưng cleanup chỉ gọi `socket.disconnect()` mà không `.off()` listeners.

**Sửa cleanup function (lines 68-70):**

```typescript
// BEFORE:
return () => {
  socket.disconnect();
};

// AFTER:
return () => {
  socket.off('new_message');
  socket.off('user_typing');
  socket.off('user_stop_typing');
  socket.off('message_read');
  socket.off('mark_read_confirmed');
  socket.off('new_message_notification');
  socket.disconnect();
};
```

### 3B. Notification socket — cleanup listeners

**File:** `packages/shared-hooks/src/use-notification-socket.ts`

**Sửa cleanup function (lines 42-44):**

```typescript
// BEFORE:
return () => {
  socket.disconnect();
};

// AFTER:
return () => {
  socket.off('notification');
  socket.off('unread_count');
  socket.disconnect();
};
```

**Giải thích:** `socket.disconnect()` đóng transport nhưng không xóa registered listeners trên instance. Nếu socket reconnect hoặc component remount, old listeners vẫn fire. `.off()` explicitly removes chúng.

---

## Commit 4: fix(student): add auth protection to private pages

### 4A. Tạo route group `(protected)` cho pages cần auth

**Vấn đề:** 7 pages trong `(main)` group cần authentication nhưng không có AuthGuard. User chưa login vào trực tiếp → API trả 401 → hiện lỗi thay vì redirect login.

**Giải pháp:** Tạo layout wrapper cho protected pages. KHÔNG sửa `(main)/layout.tsx` vì nhiều pages trong `(main)` là public (courses, browse, homepage).

**Cách tiếp cận: Tạo nested layout cho protected routes**

**Tạo file:** `apps/student-portal/src/app/[locale]/(main)/(protected)/layout.tsx`

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

**Di chuyển các pages cần auth vào `(protected)/`:**

| From | To |
|------|-----|
| `(main)/my-learning/` | `(main)/(protected)/my-learning/` |
| `(main)/my-learning/certificates/` | `(main)/(protected)/my-learning/certificates/` |
| `(main)/orders/` | `(main)/(protected)/orders/` |
| `(main)/orders/[orderId]/` | `(main)/(protected)/orders/[orderId]/` |
| `(main)/settings/` | `(main)/(protected)/settings/` |
| `(main)/wishlist/` | `(main)/(protected)/wishlist/` |
| `(main)/profile/edit/` | `(main)/(protected)/profile/edit/` |
| `(main)/qna/ask/` | `(main)/(protected)/qna/ask/` |
| `(main)/notifications/` | `(main)/(protected)/notifications/` |
| `(main)/become-instructor/` | `(main)/(protected)/become-instructor/` |
| `(main)/checkout/` | `(main)/(protected)/checkout/` |
| `(main)/payment/` | `(main)/(protected)/payment/` |

**Pages giữ lại trong `(main)/` (public):**
- `page.tsx` (homepage)
- `courses/` (browse, detail)
- `qna/page.tsx` (list — public read)
- `qna/[questionId]/` (detail — public read)
- `social/` (feed — public read)
- `cart/` (có thể dùng guest cart)
- `profile/[userId]/` (public profile view)
- `placement-test/` (public)

**Lưu ý:** Next.js route groups `()` không ảnh hưởng URL. `(main)/(protected)/my-learning/page.tsx` vẫn serve tại `/my-learning`. Không cần sửa bất kỳ Link/href nào.

---

## Commit 5: fix(shared): add network error handling to API client

### 5A. Wrap fetch trong try-catch

**File:** `packages/shared-api-client/src/client.ts`
**Method:** `fetch<T>` (lines 66-99)

**BEFORE:**
```typescript
async fetch<T>(path: string, options?: RequestInit, _isRetry = false): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(this.accessToken && {
        Authorization: `Bearer ${this.accessToken}`,
      }),
      ...options?.headers,
    },
  });

  // 401 → token expired, try refresh once
  if (res.status === 401 && this.accessToken && !_isRetry) {
    const refreshed = await this.tryRefresh();
    if (refreshed) {
      return this.fetch<T>(path, options, true);
    }
    this.handleLogout();
    throw {
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
      message: 'Session expired',
    } as ApiError;
  }

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json();
}
```

**AFTER:**
```typescript
async fetch<T>(path: string, options?: RequestInit, _isRetry = false): Promise<ApiResponse<T>> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && {
          Authorization: `Bearer ${this.accessToken}`,
        }),
        ...options?.headers,
      },
    });
  } catch {
    throw {
      code: 'NETWORK_ERROR',
      statusCode: 0,
      message: 'Network error',
    } as ApiError;
  }

  // 401 → token expired, try refresh once
  if (res.status === 401 && this.accessToken && !_isRetry) {
    const refreshed = await this.tryRefresh();
    if (refreshed) {
      return this.fetch<T>(path, options, true);
    }
    this.handleLogout();
    throw {
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
      message: 'Session expired',
    } as ApiError;
  }

  if (!res.ok) {
    let error: ApiError;
    try {
      error = await res.json();
    } catch {
      error = {
        code: 'UNKNOWN_ERROR',
        statusCode: res.status,
        message: res.statusText,
      };
    }
    throw error;
  }

  return res.json();
}
```

**Thay đổi:**
1. Wrap `fetch()` trong try-catch → throw `NETWORK_ERROR` (ApiError format) thay vì raw TypeError
2. Wrap `res.json()` trong error branch → handle trường hợp server trả non-JSON error (502/503 từ proxy)
3. TanStack Query sẽ nhận ApiError và hiện thông báo phù hợp

### 5B. Wrap streamFetch

**File:** `packages/shared-api-client/src/client.ts`
**Method:** `streamFetch` (lines 176-186)

**BEFORE:**
```typescript
async streamFetch(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

**AFTER:**
```typescript
async streamFetch(path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw {
      code: 'NETWORK_ERROR',
      statusCode: 0,
      message: 'Network error',
    } as ApiError;
  }
}
```

---

## Tóm tắt thay đổi

| Commit | Files tạo mới | Files sửa | Loại thay đổi |
|--------|--------------|-----------|---------------|
| 1. API fixes | 6 DTOs | 7 controllers + 1 service + 1 schema | Backend logic + validation |
| 2. Enum sync | 0 | 1 (shared-types) | Type safety |
| 3. WebSocket fix | 0 | 2 (socket hooks) | Memory leak + stability |
| 4. Auth protection | 1 layout | ~12 page moves | Route protection |
| 5. Network errors | 0 | 1 (api-client) | Error handling |

## Thứ tự thực hiện

1. **Commit 1** trước — backend fixes, không ảnh hưởng frontend
2. **Commit 2** — enum sync, zero risk (chỉ thêm values)
3. **Commit 3** — socket cleanup, isolated change
4. **Commit 4** — route protection, cần test navigation
5. **Commit 5** — API client, cần test error scenarios

## Verification

```bash
# After each commit:
cd apps/api && npm test              # Backend tests (646+)
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/shared-hooks
npm run build --workspace=packages/shared-api-client
npm run build --workspace=apps/student-portal
npm run build --workspace=apps/management-portal
```

## Không thay đổi

- Không sửa business logic nào khác
- Không refactor code xung quanh
- Không thêm tính năng mới
- Không sửa tests hiện tại (chỉ thêm tests cho DTO mới nếu cần)
- Giữ nguyên API response format — frontend code không cần sửa
