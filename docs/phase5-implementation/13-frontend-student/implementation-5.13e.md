# Sub-phase 5.13e — REVIEWS, NOTIFICATIONS, PROFILE & SETTINGS (Completed)

> Course Reviews (write/edit/delete), Notifications (popover + full page), Profile (view + edit + follow), Settings (account + notifications + appearance), Become Instructor application, Backend changes (JWT guard optional auth, change password endpoint), Management Portal instructor approval detail dialog.

---

## Commits

| # | Message | Scope |
|---|---------|-------|
| 1 | `feat(shared): add user, notification, certificate services and query hooks` | Shared layer: 4 new service files, 3 new query hook files, extended course hooks, updated index exports |
| 2 | `feat(student): add course reviews write/edit/delete, notification system` | Course reviews component rewrite, notification popover + item + full page, confirm dialog, navbar integration |
| 3 | `feat(student): add profile view/edit, settings, become-instructor pages` | Profile view with follow/followers/certificates, profile edit with React Hook Form, settings 3-tab page, become instructor application form |
| 4 | `feat(api,management): add change password endpoint, optional JWT guard, instructor approval detail` | Backend JWT guard try-parse on public routes, PATCH /users/me/password, management portal Eye detail dialog |

---

## Files Changed

### Backend (`apps/api/`)

| File | Action | Description |
|------|--------|-------------|
| `src/common/guards/jwt-auth.guard.ts` | Modified | On `@Public()` routes, try to parse JWT silently (catch error, continue as anonymous). Enables optional `@CurrentUser()` on public endpoints like `GET /users/:id` |
| `src/modules/users/dto/change-password.dto.ts` | New | `ChangePasswordDto` with `currentPassword: string` and `newPassword: @MinLength(8)` |
| `src/modules/users/users.controller.ts` | Modified | Added `@Patch('me/password')` endpoint calling `usersService.changePassword()` |
| `src/modules/users/users.service.ts` | Modified | Added `changePassword(userId, dto)` — verifies current password with bcrypt, hashes new password, updates DB |

### Shared Layer (`packages/shared-hooks/`)

#### New Services

| File | Exports |
|------|---------|
| `src/services/user.service.ts` | `userService` — `getMe()`, `getById()`, `updateProfile()`, `changePassword()`, `updateNotificationPreferences()`, `follow()`, `unfollow()`, `getFollowers()`, `getFollowing()`, `applyInstructor()`, `getMyApplications()` |
| `src/services/notification.service.ts` | `notificationService` — `getUnreadCount()`, `getAll()`, `markRead()`, `markAllRead()` |
| `src/services/certificate.service.ts` | `certificateService` — `getMy()`, `verify()` |

#### New Query Hooks

| File | Exports |
|------|---------|
| `src/queries/use-users.ts` | `useMe()`, `useUserProfile()`, `useUpdateProfile()`, `useChangePassword()`, `useUpdateNotificationPreferences()`, `useFollowUser()` (optimistic), `useUnfollowUser()` (optimistic), `useUserFollowers()`, `useUserFollowing()`, `useApplyInstructor()`, `useMyApplications()` |
| `src/queries/use-notifications.ts` | `useUnreadNotificationCount()` (30s refetch), `useNotifications()`, `useInfiniteNotifications()` (useInfiniteQuery), `useMarkNotificationRead()`, `useMarkAllNotificationsRead()` |
| `src/queries/use-certificates.ts` | `useMyCertificates()` |

#### Extended Files

| File | Changes |
|------|---------|
| `src/queries/use-courses.ts` | Added `useCreateReview()`, `useUpdateReview()`, `useDeleteReview()` — all invalidate `['courses', courseId, 'reviews']` and `['courses', 'detail']` |
| `src/services/course.service.ts` | Added `updateReview()`, `deleteReview()` methods (createReview already existed) |
| `src/index.ts` | Exported all new services, hooks, and types: `userService`, `notificationService`, `certificateService`, `useMe`, `useUserProfile`, `useUpdateProfile`, `useChangePassword`, `useFollowUser`, `useUnfollowUser`, `useMyCertificates`, `useInfiniteNotifications`, etc. |

### Student Portal (`apps/student-portal/`)

#### New Components

| File | Description |
|------|-------------|
| `src/components/notifications/notification-popover.tsx` | Navbar bell dropdown — custom popover with outside-click close, shows 8 latest notifications, mark-read on click, mark-all-read button, "View all" footer link to `/notifications` |
| `src/components/notifications/notification-item.tsx` | Shared notification row component — notification type to icon/color mapping (12 types), `getNotificationMessage()` switch, compact mode for popover, unread blue dot indicator |
| `src/components/feedback/confirm-dialog.tsx` | Portal-based confirm dialog — `ConfirmDialog` with title/description/confirm/cancel, destructive variant, loading state, close button, body scroll lock |

#### Modified/Rewritten Components

| File | Description |
|------|-------------|
| `src/components/course/detail/course-reviews.tsx` | Full rewrite: added `StarRatingInput` (hover preview, click-to-set), `WriteReviewForm` (create + edit mode), enrollment check via `useEnrollmentCheck()`, own-review detection, edit/delete buttons on own reviews, `ConfirmDialog` for delete, pagination |
| `src/components/navigation/navbar.tsx` | Replaced bell icon link with `<NotificationPopover />` component for authenticated users |

#### New/Rewritten Pages

| File | Description |
|------|-------------|
| `src/app/[locale]/(main)/notifications/page.tsx` | Full page with infinite scroll — `useInfiniteNotifications()` + `IntersectionObserver` sentinel, All/Unread filter tabs, mark-all-read, empty state |
| `src/app/[locale]/(main)/profile/[userId]/page.tsx` | Real API data via `useUserProfile()`, follow/unfollow with optimistic update, 3 tabs (certificates for own profile, followers, following), pagination on follower/following lists, instructor badge, `useMyCertificates()` |
| `src/app/[locale]/(main)/profile/edit/page.tsx` | `useMe()` data loading, React Hook Form with `reset()` on data load, avatar display (upload button placeholder), `useUpdateProfile()` + auth store update via `setUser()` on success, redirect to profile |
| `src/app/[locale]/(main)/settings/page.tsx` | 3-tab layout: Account (change password with `useChangePassword()`), Notifications (preference toggles with auto-save via `useUpdateNotificationPreferences()`), Appearance (theme picker with `next-themes`, locale picker with `router.replace()`) |
| `src/app/[locale]/(main)/become-instructor/page.tsx` | Application form with `useApplyInstructor()`, status display (PENDING/REJECTED/APPROVED), rejected feedback + re-apply form, benefits section, expertise as comma-separated input, already-instructor check |

#### Types

| File | Description |
|------|-------------|
| `src/components/course/detail/types.ts` | Added `ApiReview` interface: `{ id, rating, comment, createdAt, user: { id, fullName, avatarUrl } }` |

### Management Portal (`apps/management-portal/`)

| File | Description |
|------|-------------|
| `src/app/[locale]/admin/approvals/instructors/page.tsx` | Added Eye icon button + detail `Dialog` showing applicant's full info (avatar, name, email, expertise, experience, motivation, CV URL, certificate URLs, applied date) |

### i18n Files

| File | Namespaces Updated |
|------|-------------------|
| `apps/student-portal/messages/vi.json` | `courseDetail` (review keys), `notifications` (filter/empty keys), `profile` (follow/followers/certificates), `editProfile`, `settings` (3 tabs), `becomeInstructor` (form/status), `common` |
| `apps/student-portal/messages/en.json` | Same namespaces as vi.json |
| `apps/management-portal/messages/vi.json` | `approvals` (viewDetails, expertise, experience, motivation, certificates) |
| `apps/management-portal/messages/en.json` | Same as vi.json |

---

## Key Technical Decisions

1. **Optional JWT on public routes**: Modified `JwtAuthGuard` to try-parse JWT in a try/catch on `@Public()` routes, enabling `GET /users/:id` to return `isFollowing` flag when authenticated
2. **Optimistic updates for follow/unfollow**: `useFollowUser()` and `useUnfollowUser()` use `onMutate` to immediately update cache, rollback on error
3. **Infinite scroll**: Notifications page uses `useInfiniteQuery` with `IntersectionObserver` on a sentinel div, 15 items per page
4. **Notification popover**: Custom implementation (not radix Popover) with `useRef` + `mousedown` outside-click handler
5. **ConfirmDialog via portal**: Uses `ReactDOM.createPortal` to render at document.body level, avoids z-index stacking issues
6. **Auth store sync**: Profile edit updates auth store `user.fullName` immediately via `setUser()` after successful API update
7. **API response unwrapping**: All hooks handle `data.data` pattern from API responses (API wraps in `{ data: T, meta?: ... }`)
8. **formatRelativeTime capitalization**: Utility capitalizes first letter of `Intl.RelativeTimeFormat` output for consistent display
