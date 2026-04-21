# 10 — Report & Moderation System

## Overview

Complete report and moderation system with two parts:
1. **Part 1 — Report Submission UI** (student portal)
2. **Part 2 — Admin Moderation Actions** (backend + management portal)

Part 1 lets users submit reports. Part 2 gives admins tools to act on them.

---

## Part 1 — Report Submission UI

### What was done

| Phase | Description |
|-------|-------------|
| A | Added `ANSWER` to `create-report.dto.ts` `@IsIn` validator |
| B | Created `report.service.ts` + `use-reports.ts` + exports in `index.ts` |
| C | Created `ReportDialog` component (portal, 6 predefined reasons, reusable) |
| D | PostCard — DropdownMenu (`...`) with Delete (owner) / Report (non-owner) |
| E | CommentItem — Flag icon report for non-owners |
| F | User Profile — DropdownMenu with "Report user" option |
| G | Course Detail — "Report this course" link below instructor card |
| H | Q&A — Report for questions + answers (Flag icon, non-owners) |
| I | i18n — `report` namespace EN/VI, keys in social/profile/courseDetail/questionDetail |

### Report Dialog

Reusable component at `apps/student-portal/src/components/feedback/report-dialog.tsx`.

**Props:** `open`, `onOpenChange`, `targetType`, `targetId`

**6 predefined reasons:** Spam, Inappropriate content, Harassment or bullying, Misinformation, Copyright violation, Other

**Behavior:**
- User selects reason (radio, required) + optional description textarea
- On submit → `POST /reports` → toast success → close dialog
- Duplicate report → toast error `REPORT_ALREADY_EXISTS`
- Portal-based (same pattern as `ConfirmDialog`)

### Where users can report

| Location | Target Type | UI Element |
|----------|-------------|------------|
| Post (feed) | POST | DropdownMenu `...` → "Report" |
| Comment | COMMENT | Flag icon next to Reply |
| User profile | USER | DropdownMenu `...` → "Report user" |
| Course detail | COURSE | "Report this course" text link |
| Question (Q&A) | QUESTION | Flag icon in metadata row |
| Answer (Q&A) | ANSWER | Flag icon in metadata row |

**Visibility rules:**
- Only authenticated users see report buttons
- Post/comment/question/answer owners see Delete, NOT Report
- Non-owners see Report, NOT Delete

---

## Part 2 — Admin Moderation Actions

### Problems solved

1. **"Action Taken" did nothing** — only changed label, no actual content deletion or user suspension
2. **Admin couldn't delete user content** — all delete methods enforced ownership, no admin override
3. **Reporter got no feedback** — no notification sent back after review
4. **No content preview** — admin saw `targetType + targetId` but not actual content
5. **No context** — admin couldn't see which post a comment belongs to, which question an answer belongs to
6. **No link to original** — admin had to manually find content by ID
7. **COURSE not handled** — `deleteByTargetType` didn't handle COURSE reports
8. **Q&A soft-delete not filtered** — questions/answers had `deletedAt` field but queries didn't filter it

### AdminModerationService

**File:** `apps/api/src/modules/admin/moderation/admin-moderation.service.ts`

Handles admin-initiated soft deletes, bypassing ownership checks. Reuses same soft-delete patterns as user delete methods.

| Method | Target | Logic |
|--------|--------|-------|
| `deletePost(id)` | Post | Set `deletedAt` |
| `deleteComment(id)` | Comment | Set `deletedAt` + decrement post `commentCount` (transaction) |
| `deleteQuestion(id)` | Question | Set `deletedAt` |
| `deleteAnswer(id)` | Answer | Set `deletedAt` + unset `bestAnswerId` + decrement `answerCount` (transaction) |
| `unpublishCourse(id)` | Course | Set status to `REJECTED` |
| `deleteByTargetType(type, id)` | Any | Switch dispatcher for above methods |

**Controller:** `apps/api/src/modules/admin/moderation/admin-moderation.controller.ts`
- `DELETE /admin/moderation/posts/:id`
- `DELETE /admin/moderation/comments/:id`
- `DELETE /admin/moderation/questions/:id`
- `DELETE /admin/moderation/answers/:id`

All endpoints require ADMIN role.

### Enhanced Report Review

**File:** `apps/api/src/modules/reports/reports.service.ts`

`reviewReport()` now accepts optional `action` field:

```
Admin reviews report
  → Update report status + adminNote + reviewedBy + reviewedAt
  → If action === 'DELETE_CONTENT':
      → AdminModerationService.deleteByTargetType(targetType, targetId)
      → Auto-resolve other PENDING reports on same target
  → If action === 'SUSPEND_USER' (targetType=USER):
      → AdminUsersService.updateUserStatus(targetId, 'SUSPENDED')
      → Auto-resolve other PENDING reports on same user
  → Notify reporter: REPORT_RESOLVED notification
```

**DTO change:** `ReviewReportDto` now has optional `action?: 'DELETE_CONTENT' | 'SUSPEND_USER'`

**Auto-resolve:** When admin deletes content, all other PENDING reports on the same `targetType + targetId` are automatically set to `ACTION_TAKEN` with note "Auto-resolved". Prevents admin from reviewing the same deleted content multiple times.

**Reporter notification:** `REPORT_RESOLVED` notification sent to reporter with `{ targetType, status }`. Mapped to `systemAnnouncements` preference (user can opt-out).

### Content Preview Enrichment

`getReports()` now includes `targetPreview` for each report via `enrichWithPreviews()`:

| Target Type | Preview Fields |
|-------------|---------------|
| POST | content (200 chars), author name, viewPath: `/social` |
| COMMENT | content, author name, **context: "Post by X: content..."**, viewPath: `/social` |
| QUESTION | title, author name, viewPath: `/qna/{id}` |
| ANSWER | content, author name, **context: "Question: title"**, viewPath: `/qna/{questionId}` |
| USER | status (ACTIVE/SUSPENDED), full name, viewPath: `/profile/{id}` |
| COURSE | title, instructor name, **context: "Status: PUBLISHED"**, viewPath: `/courses/{slug}` |

Deleted content shows `[Deleted]` as text. `viewPath` is relative — frontend builds full URL with `NEXT_PUBLIC_STUDENT_PORTAL_URL`.

**Query filter fix:** `QueryReportsDto.targetType` changed from `@IsIn([...])` to `@IsString()` to support comma-separated values (e.g., `POST,COMMENT,COURSE,QUESTION`). Service splits and uses Prisma `{ in: [...] }`.

### Admin Reports Page UI

**File:** `apps/management-portal/src/app/[locale]/admin/reports/page.tsx`

**Table columns:** Reporter, Content Type, **Reported Content** (with context + author), Reason, Date, Status, Actions

**Action buttons per row:**
- `ExternalLink` — open original content on student portal (all reports)
- `Eye` — PENDING: open review dialog / Already reviewed: open **read-only detail** dialog
- `XCircle` — quick dismiss (PENDING only)
- `ShieldBan` — open review dialog with default "Action Taken" (PENDING only)

**Review dialog (PENDING):**
- Report info: reporter, type, reason, description
- Target content preview with "View original" link
- Context line (italic): "Post by X: ..." or "Question: ..." 
- Status selection: REVIEWED / ACTION_TAKEN / DISMISSED
- Action checkboxes (only when ACTION_TAKEN):
  - POST/COMMENT/QUESTION/ANSWER: "Delete this content"
  - COURSE: "Unpublish this course"
  - USER: "Suspend this user"
- Admin note textarea

**Detail dialog (already reviewed):**
- Report info + content preview (same as above)
- Read-only review info: status badge, reviewed by, reviewed date, admin note
- Only "Close" button (no submit)

### Q&A Soft-Delete Filter Fix

**File:** `apps/api/src/modules/qna/questions/questions.service.ts`

Added `deletedAt: null` filter to all queries that were missing it:

| Method | Fix |
|--------|-----|
| `findAll()` | Added `deletedAt: null` to where clause |
| `findById()` | Added `deletedAt: null` to where clause |
| `findSimilar()` | Added `deletedAt: null` to where clause |
| `findById()` → answers | Added `where: { deletedAt: null }` to nested answers include |

### Post Feed Refresh Fix

**File:** `packages/shared-hooks/src/queries/use-social.ts`

- `useCreatePost`: Changed `invalidateQueries` → `resetQueries` with 500ms delay (feed fanout is async via BullMQ, need time for `feedItem` insertion)
- `useDeletePost`, `useSharePost`: Changed `invalidateQueries` → `resetQueries`
- Added `toast.success` on post creation in `PostComposer`

### Notification Display

**Files:** `notification-item.tsx` in both student-portal and management-portal

Added `REPORT_RESOLVED` to:
- Icon mapping: `ShieldCheck` with green color
- Message: "Your report has been reviewed and action was taken" (ACTION_TAKEN) or "Your report has been reviewed" (other statuses)

### Migration

Added `REPORT_RESOLVED` to `NotificationType` enum via:
- `schema.prisma` — enum value added
- SQL: `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_RESOLVED'`
- Migration file: `migrations/20260413120000_add_report_resolved_notification_type/`

---

## All Files Changed

### Backend

| # | File | Action |
|---|------|--------|
| 1 | `apps/api/src/modules/reports/dto/create-report.dto.ts` | MODIFY — add ANSWER to validator |
| 2 | `apps/api/src/modules/reports/dto/query-reports.dto.ts` | MODIFY — @IsString for comma-separated targetType |
| 3 | `apps/api/src/modules/reports/reports.service.ts` | MODIFY — enhanced reviewReport, enrichWithPreviews, comma-split filter |
| 4 | `apps/api/src/modules/reports/reports.module.ts` | MODIFY — import AdminModule via forwardRef |
| 5 | `apps/api/src/modules/admin/moderation/admin-moderation.service.ts` | NEW — admin soft-delete + unpublish |
| 6 | `apps/api/src/modules/admin/moderation/admin-moderation.controller.ts` | NEW — DELETE endpoints |
| 7 | `apps/api/src/modules/admin/admin.module.ts` | MODIFY — register moderation, export services |
| 8 | `apps/api/src/modules/admin/dto/review-report.dto.ts` | MODIFY — add action field |
| 9 | `apps/api/src/modules/notifications/notification-preferences.map.ts` | MODIFY — REPORT_RESOLVED mapping |
| 10 | `apps/api/src/prisma/schema.prisma` | MODIFY — REPORT_RESOLVED enum |
| 11 | `apps/api/src/prisma/migrations/20260413120000_.../migration.sql` | NEW — migration file |
| 12 | `apps/api/src/modules/qna/questions/questions.service.ts` | MODIFY — deletedAt filter on all queries |

### Shared Hooks

| # | File | Action |
|---|------|--------|
| 13 | `packages/shared-hooks/src/services/report.service.ts` | NEW — report API client |
| 14 | `packages/shared-hooks/src/queries/use-reports.ts` | NEW — useCreateReport hook |
| 15 | `packages/shared-hooks/src/queries/use-social.ts` | MODIFY — resetQueries + setTimeout for feed |
| 16 | `packages/shared-hooks/src/queries/use-admin.ts` | MODIFY — action param in useReviewReport |
| 17 | `packages/shared-hooks/src/services/admin.service.ts` | MODIFY — deleteContent + action param |
| 18 | `packages/shared-hooks/src/index.ts` | MODIFY — export report hook/service/types |

### Student Portal

| # | File | Action |
|---|------|--------|
| 19 | `apps/student-portal/src/components/feedback/report-dialog.tsx` | NEW — reusable report dialog |
| 20 | `apps/student-portal/src/components/social/post-card.tsx` | MODIFY — DropdownMenu + report |
| 21 | `apps/student-portal/src/components/social/comment-item.tsx` | MODIFY — Flag report button |
| 22 | `apps/student-portal/src/components/social/post-composer.tsx` | MODIFY — toast on success |
| 23 | `apps/student-portal/src/app/[locale]/(main)/profile/[userId]/page.tsx` | MODIFY — report user |
| 24 | `apps/student-portal/src/app/[locale]/(main)/courses/[slug]/page.tsx` | MODIFY — report course |
| 25 | `apps/student-portal/src/app/[locale]/(main)/qna/[questionId]/page.tsx` | MODIFY — report question |
| 26 | `apps/student-portal/src/components/qna/answer-card.tsx` | MODIFY — report answer |
| 27 | `apps/student-portal/src/components/notifications/notification-item.tsx` | MODIFY — REPORT_RESOLVED |
| 28 | `apps/student-portal/messages/en.json` | MODIFY — report i18n |
| 29 | `apps/student-portal/messages/vi.json` | MODIFY — report i18n |

### Management Portal

| # | File | Action |
|---|------|--------|
| 30 | `apps/management-portal/src/app/[locale]/admin/reports/page.tsx` | MODIFY — full rewrite with preview, actions, detail view |
| 31 | `apps/management-portal/src/components/notifications/notification-item.tsx` | MODIFY — REPORT_RESOLVED |
| 32 | `apps/management-portal/messages/en.json` | MODIFY — moderation i18n |
| 33 | `apps/management-portal/messages/vi.json` | MODIFY — moderation i18n |
| 34 | `apps/management-portal/.env` | MODIFY — NEXT_PUBLIC_STUDENT_PORTAL_URL |
| 35 | `apps/management-portal/.env.example` | MODIFY — same |
