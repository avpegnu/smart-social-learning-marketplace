# Explanation — Bugfix: Critical & High Priority Issues

## Context

Full codebase audit on 2026-04-05 identified 10 Critical/High bugs across backend, frontend, and shared packages. This document explains each fix and the reasoning behind it.

---

## Fix 1: Auth Refresh Endpoint Missing User Data

### Problem

When a user reloads the page, the frontend calls `POST /auth/refresh` to restore the session. The `auth-provider.tsx` expects `{ data: { user, accessToken } }` from this endpoint, but the controller only returned `{ accessToken }`.

**Consequence:** After page reload, `user` is `undefined`, so `setAuth(user, token)` is never called → user appears logged out despite having a valid refresh token cookie.

### Root Cause

The `auth.service.ts:refresh()` method correctly builds `{ accessToken, refreshToken, user }`, but the controller at line 98 stripped the user:

```typescript
// Before — user object discarded
return { accessToken: result.accessToken };
```

The `login` and `ott/validate` endpoints already returned `{ accessToken, user }` — refresh was the only inconsistent one.

### Fix

```typescript
return { accessToken: result.accessToken, user: result.user };
```

One-line change. The API client's `doRefresh()` in `client.ts` only uses `accessToken` (for automatic 401 retry), which still works. The `auth-provider.tsx` session restore path now receives the user object it expects.

---

## Fix 2: Missing DTO Validation on 6 Endpoints

### Problem

Six endpoints used `@Body('fieldName')` to extract a single field from the request body, bypassing NestJS's `ValidationPipe`. This means:

- No type checking (a number could be sent as `code`)
- No format validation (invalid email accepted)
- No length limits (megabyte-long strings accepted)
- Missing Swagger documentation for request body

### Affected Endpoints

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /auth/resend-verification` | `@Body('email') email: string` | `@Body() dto: ResendVerificationDto` with `@IsEmail()` |
| `POST /cart/apply-coupon` | `@Body('code') code: string` | `@Body() dto: ApplyCouponDto` with `@IsString() @MinLength(1) @MaxLength(50)` |
| `PUT /questions/:id/best-answer` | `@Body('answerId') answerId: string` | `@Body() dto: MarkBestAnswerDto` with `@IsString() @IsNotEmpty()` |
| `POST /posts/:id/share` | `@Body('content') content?: string` | `@Body() dto: SharePostDto` with `@IsOptional() @IsString() @MaxLength(500)` |
| `POST /placement-tests/start` | `@Body('categoryId') categoryId: string` | `@Body() dto: StartPlacementTestDto` with `@IsString() @IsNotEmpty()` |
| `PUT /groups/:id/members/:userId` | `@Body('role') role: GroupRole` | `@Body() dto: UpdateMemberRoleDto` with `@IsEnum(GroupRole)` |

### Design Decision

Each DTO follows the existing project pattern: one DTO per file in the module's `dto/` directory, with `class-validator` decorators and `@nestjs/swagger` annotations. The service layer is unchanged — DTOs only add input validation at the controller boundary.

---

## Fix 3: toggleLike Race Condition

### Problem

The `toggleLike` method in `interactions.service.ts` had a time-of-check-to-time-of-use (TOCTOU) bug:

```typescript
// Line 16: Read post OUTSIDE transaction
const post = await this.prisma.post.findUnique({ where: { id: postId } });

// Line 33: Return stale count
return { liked: false, likeCount: post.likeCount - 1 };
```

**Race condition scenario:**
1. Post has `likeCount = 10`
2. User A reads post (sees 10)
3. User B likes → DB becomes 11
4. User A unlikes → DB becomes 10, but returns `10 - 1 = 9` to client

### Fix

Capture the return value from `post.update` inside the transaction:

```typescript
const [, updatedPost] = await this.prisma.$transaction([
  this.prisma.like.delete({ where: { id: existing.id } }),
  this.prisma.post.update({
    where: { id: postId },
    data: { likeCount: { decrement: 1 } },
    select: { likeCount: true },  // Return updated count
  }),
]);
return { liked: false, likeCount: updatedPost.likeCount };
```

Prisma's `$transaction` with batch operations returns an array matching the input order. The second element is the `post.update` result, which contains the count AFTER the decrement was applied.

---

## Fix 4: CartItem Unique Constraint

### Problem

The `CartItem` model had no database-level unique constraint on `(userId, courseId, chapterId)`. While `cart.service.ts` checks for duplicates with `findFirst` before inserting, concurrent requests could slip through:

1. Request A checks → no duplicate
2. Request B checks → no duplicate
3. Request A inserts → success
4. Request B inserts → duplicate created!

### Fix

Added `@@unique([userId, courseId, chapterId])` to the Prisma schema. This creates a unique index in PostgreSQL that prevents duplicates at the database level, regardless of application-level race conditions.

The service-level check (`ALREADY_IN_CART` error) remains for user-friendly error messages. The DB constraint is the safety net.

**Migration:** `20260405162857_add_cart_item_unique_constraint`

---

## Fix 5: Frontend Enum Mismatch with Database

### Problem

The `CourseStatus` and `UserStatus` enums in `packages/shared-types/src/index.ts` were out of sync with the Prisma schema:

| Enum | Database Values | Frontend Values (before) | Missing |
|------|----------------|-------------------------|---------|
| `CourseStatus` | DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED, ARCHIVED | DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED | APPROVED, ARCHIVED |
| `UserStatus` | UNVERIFIED, ACTIVE, SUSPENDED | ACTIVE, SUSPENDED | UNVERIFIED |

### Impact

When the API returns a course with `status: 'APPROVED'`, TypeScript types don't include this value, creating a type safety gap. Admin pages that check course status can't distinguish APPROVED from PUBLISHED.

### Fix

Added the missing enum values to `shared-types/index.ts`. This is additive-only — no existing values were changed or removed, so all existing code continues to work.

---

## Fix 6: WebSocket Listener Memory Leak

### Problem

Both `use-chat-socket.ts` and `use-notification-socket.ts` registered event listeners with `socket.on()` but only called `socket.disconnect()` in cleanup — never `socket.off()`.

```typescript
// 6 listeners registered...
socket.on('new_message', handler);
socket.on('user_typing', handler);
// ...

// Cleanup only disconnects transport, doesn't remove listeners
return () => { socket.disconnect(); };
```

**Issue:** `socket.disconnect()` closes the transport but doesn't remove event listener registrations from the socket instance. If the component remounts (React StrictMode, navigation, token refresh), new listeners are added on top of old ones. Over time:
- Memory usage grows
- Duplicate handlers fire for the same event
- Stale closures reference outdated state

### Fix

Explicitly remove all listeners before disconnecting:

```typescript
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

Note: `accessToken` is already in the dependency array `[isAuthenticated, accessToken, queryClient]`, so when the token refreshes, the effect re-runs — old socket disconnects (with cleanup), new socket connects with the fresh token.

---

## Fix 7: Auth Protection for Student Portal Pages

### Problem

9+ pages in the student portal required authentication but had no route-level protection:

`/my-learning`, `/orders`, `/settings`, `/wishlist`, `/notifications`, `/checkout`, `/payment`, `/profile/edit`, `/qna/ask`, `/become-instructor`

Without AuthGuard, unauthenticated users could navigate directly to these pages. The API calls would return 401, showing raw error states instead of a clean login redirect.

### Design Decision: Route Group `(protected)`

**Option A:** Add `AuthGuard` to each individual page — repetitive, easy to forget for new pages.

**Option B:** Add `AuthGuard` to `(main)/layout.tsx` — would protect public pages like `/courses`, homepage.

**Option C (chosen):** Create a `(main)/(protected)/` route group with its own layout that wraps `AuthGuard`. Move only private pages into it.

Next.js route groups `()` don't affect the URL path. `(main)/(protected)/my-learning/page.tsx` still serves at `/my-learning`. No links or redirects need updating.

### Pages Moved to `(protected)/`

| Private (moved) | Public (stayed in `(main)/`) |
|-----------------|------------------------------|
| my-learning/, my-learning/certificates/ | page.tsx (homepage) |
| orders/, orders/[orderId]/ | courses/ (browse, detail) |
| settings/ | qna/ (list), qna/[questionId]/ (detail) |
| wishlist/ | social/ (feed, groups) |
| notifications/ | cart/ (guest cart supported) |
| checkout/ | profile/[userId]/ (public profile) |
| payment/[orderId]/ | placement-test/ (public) |
| profile/edit/ | |
| qna/ask/ | |
| become-instructor/ | |

---

## Fix 8: API Client Network Error Handling

### Problem

The `ApiClient.fetch()` method called `fetch()` without try-catch. Network errors (offline, DNS failure, timeout) throw a `TypeError` from the Fetch API — this was not caught and propagated as an unhandled error, potentially crashing components.

Additionally, if the server returns a non-JSON error (e.g., 502 from nginx proxy), `res.json()` would throw, also unhandled.

### Fix

1. **Wrap `fetch()` in try-catch** → throw `{ code: 'NETWORK_ERROR', statusCode: 0 }` in standard `ApiError` format
2. **Wrap error `res.json()` in try-catch** → fallback to `{ code: 'UNKNOWN_ERROR', statusCode: res.status }` for non-JSON responses
3. **Same treatment for `streamFetch()`** used by AI Tutor SSE streaming

TanStack Query catches these errors and displays the appropriate error state, instead of an unhandled rejection crashing the page.

---

## Files Changed Summary

### Created (7 files)
- `apps/api/src/modules/auth/dto/resend-verification.dto.ts`
- `apps/api/src/modules/cart/dto/apply-coupon.dto.ts`
- `apps/api/src/modules/qna/dto/mark-best-answer.dto.ts`
- `apps/api/src/modules/social/dto/share-post.dto.ts`
- `apps/api/src/modules/social/dto/update-member-role.dto.ts`
- `apps/api/src/modules/learning/dto/start-placement-test.dto.ts`
- `apps/student-portal/src/app/[locale]/(main)/(protected)/layout.tsx`

### Modified (10 files)
- `apps/api/src/modules/auth/auth.controller.ts` — return user in refresh + use ResendVerificationDto
- `apps/api/src/modules/cart/cart.controller.ts` — use ApplyCouponDto
- `apps/api/src/modules/qna/questions/questions.controller.ts` — use MarkBestAnswerDto
- `apps/api/src/modules/social/posts/posts.controller.ts` — use SharePostDto
- `apps/api/src/modules/social/groups/groups.controller.ts` — use UpdateMemberRoleDto
- `apps/api/src/modules/learning/placement-tests/placement-tests.controller.ts` — use StartPlacementTestDto
- `apps/api/src/modules/social/interactions/interactions.service.ts` — fix toggleLike race condition
- `apps/api/src/modules/social/interactions/interactions.service.spec.ts` — update mock for transaction result
- `apps/api/src/prisma/schema.prisma` — add CartItem unique constraint
- `packages/shared-types/src/index.ts` — sync CourseStatus + UserStatus enums

### Modified (3 shared packages)
- `packages/shared-api-client/src/client.ts` — network error handling
- `packages/shared-hooks/src/use-chat-socket.ts` — listener cleanup
- `packages/shared-hooks/src/use-notification-socket.ts` — listener cleanup

### Moved (12 page directories)
- `(main)/my-learning/` → `(main)/(protected)/my-learning/`
- `(main)/orders/` → `(main)/(protected)/orders/`
- `(main)/settings/` → `(main)/(protected)/settings/`
- `(main)/wishlist/` → `(main)/(protected)/wishlist/`
- `(main)/notifications/` → `(main)/(protected)/notifications/`
- `(main)/checkout/` → `(main)/(protected)/checkout/`
- `(main)/payment/` → `(main)/(protected)/payment/`
- `(main)/profile/edit/` → `(main)/(protected)/profile/edit/`
- `(main)/qna/ask/` → `(main)/(protected)/qna/ask/`
- `(main)/become-instructor/` → `(main)/(protected)/become-instructor/`
- `(main)/my-learning/certificates/` → `(main)/(protected)/my-learning/certificates/`
- `(main)/orders/[orderId]/` → `(main)/(protected)/orders/[orderId]/`

### Migration (1 file)
- `apps/api/src/prisma/migrations/20260405162857_add_cart_item_unique_constraint/migration.sql`

## Verification

- 67 test suites, 692 tests — all pass
- TypeScript check — 0 errors
- No business logic changed — only added validation, safety nets, and error handling
