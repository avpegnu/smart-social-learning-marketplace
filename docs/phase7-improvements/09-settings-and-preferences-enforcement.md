# 09 — Settings & Notification Preferences Enforcement

## Problems Identified

### Problem 1: Admin Platform Settings — Stored but NOT Enforced

Admin edits settings at `/admin/settings` → values save to `platform_settings` table → but **no business logic reads them**. All runtime values hardcoded in `apps/api/src/common/constants/app.constant.ts`.

| Setting Key | Enforced? | Issue |
|---|---|---|
| `default_commission_rate` | NO | Hardcoded 0.3 fallback in `webhooks.service.ts` |
| `minimum_withdrawal` | NO | No minimum check in withdrawal flow |
| `auto_approve_courses` | NO | All courses require manual admin review |
| `allow_free_courses` | NO | Free courses always allowed |
| `order_expiry_minutes` | Hardcoded | Technical constant, OK as-is |
| `lesson_complete_threshold` | Hardcoded | Technical constant, OK as-is |

### Problem 2: Notification Preferences — Stored but NOT Checked

Users toggle In-app/Email → saved to `user.notificationPreferences` JSON → but `NotificationProcessor` **never checks preferences** before creating notifications.

- UI preference keys (`courseUpdates`, `newEnrollment`) don't map to backend `NotificationType` enum (`COURSE_ENROLLED`, `FOLLOW`)
- Email column in UI has no backend support (only transactional emails exist)

### Problem 3: Recommendation Duplicate Courses

`getCollaborative()` and `getHybrid()` query with `courseId: { in: enrolledCourseIds }` → multiple enrolled courses can share the same `similarCourseId` → duplicate courses in API response → React duplicate key error on homepage.

### Problem 4: Withdrawal Page Hardcoded Minimum

Frontend `MIN_WITHDRAWAL = 5_000` hardcoded → doesn't reflect admin settings. Also no UX feedback when pending withdrawal exists.

---

## Implementation

### Phase A: PlatformSettingsService (Global, Cached)

**New files:**
- `apps/api/src/modules/platform-settings/platform-settings.service.ts`
- `apps/api/src/modules/platform-settings/platform-settings.module.ts`
- `apps/api/src/modules/platform-settings/platform-settings.controller.ts`

**Architecture:**
- `@Global()` module → injectable everywhere without explicit imports
- `OnModuleInit` → loads all settings from DB into in-memory `Map<string, unknown>` on startup
- `get<T>(key, fallback)` → returns cached value or fallback if not found
- `reload()` → re-fetches all settings from DB, called after admin updates

**Public API endpoint:**
- `GET /platform-settings` → returns `{ minimumWithdrawal, defaultCommissionRate, allowFreeCourses, autoApproveCourses }` for frontend consumption

**Cache invalidation:**
- `admin-content.service.ts` → after `updateSetting()` → calls `platformSettings.reload()`

**Modified files:**
| File | Change |
|---|---|
| `apps/api/src/app.module.ts` | Import `PlatformSettingsModule` |
| `apps/api/src/modules/admin/content/admin-content.service.ts` | Inject `PlatformSettingsService`, call `reload()` after update |

### Phase B: Enforce Admin Settings in Business Logic

#### B1. `minimum_withdrawal` — Withdrawals Service
**File:** `apps/api/src/modules/withdrawals/withdrawals.service.ts`

In `requestWithdrawal()`, added check before balance validation:
```typescript
const minWithdrawal = this.platformSettings.get<number>('minimum_withdrawal', 50000);
if (dto.amount < minWithdrawal) {
  throw new BadRequestException({ code: 'BELOW_MINIMUM_WITHDRAWAL', minimum: minWithdrawal });
}
```

#### B2. `default_commission_rate` — Webhooks Service
**File:** `apps/api/src/modules/orders/webhooks.service.ts`

In `getCommissionRate()`, replaced hardcoded `0.3` fallback with dynamic setting:
```typescript
// Before: return tier?.rate ?? 0.3;
const defaultRate = this.platformSettings.get<number>('default_commission_rate', 30) / 100;
return tier?.rate ?? defaultRate;
```
Note: Commission tiers from `commissionTier` table still take priority. The setting only affects the fallback when no tier matches.

#### B3. `auto_approve_courses` — Course Management Service
**File:** `apps/api/src/modules/courses/management/course-management.service.ts`

In `submitForReview()`, added auto-approve branch:
```typescript
const autoApprove = this.platformSettings.get<boolean>('auto_approve_courses', false);
if (autoApprove) {
  // Set status directly to PUBLISHED with publishedAt timestamp
  // Notify instructor with COURSE_APPROVED
} else {
  // Existing behavior: PENDING_REVIEW + notify admins
}
```

#### B4. `allow_free_courses` — Course Creation
**File:** `apps/api/src/modules/courses/management/course-management.service.ts`

In `create()`, added price validation:
```typescript
const allowFree = this.platformSettings.get<boolean>('allow_free_courses', true);
if (!allowFree && (!dto.price || dto.price <= 0)) {
  throw new BadRequestException({ code: 'FREE_COURSES_NOT_ALLOWED' });
}
```

### Phase C: Notification Preferences Enforcement

#### C1. Preference-to-Type Mapping
**New file:** `apps/api/src/modules/notifications/notification-preferences.map.ts`

Three exports:
- `PREFERENCE_TYPE_MAP` — UI key → NotificationType[] (forward map)
- `TYPE_TO_PREFERENCE` — NotificationType → UI key (reverse map, auto-generated)
- `ALWAYS_DELIVER_TYPES` — Set of types that skip preference check

**Mapping:**

| UI Key (Student) | NotificationTypes |
|---|---|
| `socialUpdates` | POST_LIKE, POST_COMMENT |
| `newFollowers` | FOLLOW |
| `orderUpdates` | ORDER_COMPLETED, ORDER_EXPIRED |
| `reviewResponses` | QUESTION_ANSWERED, ANSWER_VOTED |
| `systemAnnouncements` | SYSTEM |

| UI Key (Instructor) | NotificationTypes |
|---|---|
| `newEnrollment` | COURSE_ENROLLED |
| `courseApproval` | COURSE_APPROVED, COURSE_REJECTED |
| `payoutCompleted` | WITHDRAWAL_COMPLETED, WITHDRAWAL_REJECTED |

| Always Deliver (Admin) | No opt-out |
|---|---|
| COURSE_PENDING_REVIEW, WITHDRAWAL_PENDING, NEW_REPORT, NEW_APPLICATION | Admin must always see these |

**Unmapped types** (e.g., future `NEW_MESSAGE`): `prefKey = undefined` → skip check → always delivered. Safe default.

#### C2. Preference Check with Redis Cache
**File:** `apps/api/src/modules/jobs/processors/notification.processor.ts`

**Flow:**
```
Job arrives → ALWAYS_DELIVER_TYPES? → create immediately
           → TYPE_TO_PREFERENCE[type] exists?
              → No (unmapped) → create immediately
              → Yes → redis.getOrSet("notif_prefs:{userId}", 300s, () => DB query)
                 → prefs null (never set) → create (opt-out model, ON by default)
                 → prefs[prefKey].inApp === false → skip, log, return
                 → prefs[prefKey].inApp === true → create
```

**Redis caching:**
- Key: `notif_prefs:{userId}`, TTL: 300 seconds (5 minutes)
- Uses existing `RedisService.getOrSet()` helper
- Cache hit: 0 DB queries. Cache miss: 1 query + cache result.
- Invalidation: `users.service.ts` → after `updateNotificationPreferences()` → `redis.del("notif_prefs:{userId}")`

**Modified files:**
| File | Change |
|---|---|
| `apps/api/src/modules/jobs/processors/notification.processor.ts` | Add preference check with Redis cache |
| `apps/api/src/modules/users/users.service.ts` | Inject RedisService, `redis.del()` on preference update |

#### C3. Frontend UI Updates

**Student Portal** (`apps/student-portal/src/app/[locale]/(main)/(protected)/settings/page.tsx`):
- Removed Email column (no backend support)
- Renamed `courseUpdates` → `socialUpdates` (maps to POST_LIKE, POST_COMMENT)
- `handleToggle(key)` → only toggles `inApp` field

**Instructor Portal** (`apps/management-portal/src/app/[locale]/instructor/settings/page.tsx`):
- Removed Email column
- Removed `newReview` and `weeklyReport` (no corresponding notification types exist)
- Kept: `newEnrollment`, `courseApproval`, `payoutCompleted`
- Title changed from "Email Notifications" → "Notifications"

**Shared type** (`packages/shared-hooks/src/services/user.service.ts`):
- `NotificationPreferences`: `email` field changed from required to optional (`email?: boolean`)

### Phase D: Frontend Platform Settings Integration

**New files:**
- `packages/shared-hooks/src/services/platform-settings.service.ts` — API client for `GET /platform-settings`
- `packages/shared-hooks/src/queries/use-platform-settings.ts` — `usePlatformSettings()` hook with 5-min staleTime

**Withdrawal page** (`apps/management-portal/src/app/[locale]/instructor/withdrawals/page.tsx`):
- Removed hardcoded `MIN_WITHDRAWAL = 5_000`
- Now reads from `usePlatformSettings()` → `settingsData.data.minimumWithdrawal`
- Added `hasPending` check → disables "Request Withdrawal" button when pending exists
- Added `pendingExists` i18n message below button

### Phase E: i18n Updates

**New error code translations (both EN/VI):**
- `BELOW_MINIMUM_WITHDRAWAL` — "Amount is below the minimum withdrawal limit"
- `FREE_COURSES_NOT_ALLOWED` — "Free courses are not allowed on this platform"

**New notification preference translations (student-portal):**
- `notif_socialUpdates` / `notif_socialUpdates_desc`

**Updated labels (management-portal):**
- `notificationsDesc` → "Manage the notifications you receive"
- Removed `notif_newReview`, `notif_weeklyReport`
- Added `pendingExists` in withdrawals namespace

### Phase F: Recommendation Deduplication Fix

**File:** `apps/api/src/modules/recommendations/recommendations.service.ts`

Added `deduplicateByScore()` private method:
```typescript
private deduplicateByScore<T extends { similarCourseId: string; score: number }>(
  items: T[], limit: number,
): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const existing = best.get(item.similarCourseId);
    if (!existing || item.score > existing.score) {
      best.set(item.similarCourseId, item);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
```

Applied to `getCollaborative()` and `getHybrid()` — fetches all matching similarities (no `take: limit`), deduplicates by `similarCourseId` keeping highest score, then slices to limit.

---

## All Files Changed

| # | File | Action |
|---|---|---|
| 1 | `apps/api/src/modules/platform-settings/platform-settings.service.ts` | NEW — cached settings service |
| 2 | `apps/api/src/modules/platform-settings/platform-settings.module.ts` | NEW — @Global module |
| 3 | `apps/api/src/modules/platform-settings/platform-settings.controller.ts` | NEW — GET /platform-settings endpoint |
| 4 | `apps/api/src/modules/notifications/notification-preferences.map.ts` | NEW — preference ↔ type mapping |
| 5 | `apps/api/src/app.module.ts` | Import PlatformSettingsModule |
| 6 | `apps/api/src/modules/admin/content/admin-content.service.ts` | Inject PlatformSettingsService, reload() after update |
| 7 | `apps/api/src/modules/withdrawals/withdrawals.service.ts` | Inject PlatformSettingsService, add minimum check |
| 8 | `apps/api/src/modules/orders/webhooks.service.ts` | Inject PlatformSettingsService, dynamic commission fallback |
| 9 | `apps/api/src/modules/courses/management/course-management.service.ts` | Inject PlatformSettingsService, auto_approve + allow_free |
| 10 | `apps/api/src/modules/jobs/processors/notification.processor.ts` | Preference check with Redis cache |
| 11 | `apps/api/src/modules/users/users.service.ts` | Inject RedisService, cache invalidation |
| 12 | `apps/api/src/modules/recommendations/recommendations.service.ts` | deduplicateByScore() for collaborative/hybrid |
| 13 | `apps/student-portal/.../settings/page.tsx` | Remove Email column, socialUpdates key |
| 14 | `apps/management-portal/.../instructor/settings/page.tsx` | Remove Email column, remove unused types |
| 15 | `apps/management-portal/.../instructor/withdrawals/page.tsx` | Dynamic min amount, pending exists UX |
| 16 | `packages/shared-hooks/src/services/user.service.ts` | email field optional |
| 17 | `packages/shared-hooks/src/services/platform-settings.service.ts` | NEW — API client |
| 18 | `packages/shared-hooks/src/queries/use-platform-settings.ts` | NEW — usePlatformSettings() hook |
| 19 | `packages/shared-hooks/src/index.ts` | Export new hook + type |
| 20 | `apps/student-portal/messages/en.json` + `vi.json` | socialUpdates translations |
| 21 | `apps/management-portal/messages/en.json` + `vi.json` | Error codes, updated labels, pendingExists |

## No Migration Needed

All changes use existing tables and columns. No schema changes required.
