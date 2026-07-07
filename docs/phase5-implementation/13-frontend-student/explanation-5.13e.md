# Giai thich — Phase 5.13e: Reviews, Notifications, Profile & Settings

> Triển khai luồng viết đánh giá khóa học, hệ thống thông báo (popover + trang đầy đủ), trang hồ sơ cá nhân (xem + sửa + theo dõi), cài đặt (tài khoản + thông báo + giao diện), đơn đăng ký giảng viên, và các thay đổi backend hỗ trợ.

---

## 1. Tổng quan Phase 5.13e

Phase này kết nối 6 trang student portal với API thật, thay thế toàn bộ dữ liệu mock. Ngoài ra còn bổ sung backend endpoint mới và cải thiện management portal.

```
┌── COURSE REVIEWS ──┐    ┌── NOTIFICATIONS ──┐    ┌── PROFILE ──┐
│ Star rating input   │    │ Popover (navbar)   │    │ View + follow│
│ Create/Edit/Delete  │    │ Full page (scroll) │    │ Edit + save  │
│ Enrollment check    │    │ Infinite query     │    │ Followers tab│
└─────────────────────┘    └────────────────────┘    └──────────────┘

┌── SETTINGS ──────────┐   ┌── BECOME INSTRUCTOR ──┐  ┌── BACKEND ──────┐
│ Account: đổi mật khẩu│   │ Form đăng ký          │  │ Optional JWT    │
│ Notifications: toggle│   │ Status: pending/reject │  │ Change password │
│ Appearance: theme+i18n│  │ Re-apply after reject  │  │ Management detail│
└───────────────────────┘  └────────────────────────┘  └─────────────────┘
```

### Shared layer mới:
- **3 services**: `user.service.ts`, `notification.service.ts`, `certificate.service.ts`
- **3 query hook files**: `use-users.ts` (11 hooks), `use-notifications.ts` (5 hooks), `use-certificates.ts` (1 hook)
- **Mở rộng**: `use-courses.ts` thêm 3 review mutation hooks

---

## 2. Write Course Reviews

### Vấn đề ban đầu
File `course-reviews.tsx` trước đó chỉ **hiển thị** reviews từ API, không có form viết review. Cần thêm khả năng tạo/sửa/xóa review cho học viên đã ghi danh.

### StarRatingInput — Component chọn sao

```
Hover vào sao 3:  ★ ★ ★ ☆ ☆  (3 sao sáng vàng, 2 sao xám)
Click sao 4:      ★ ★ ★ ★ ☆  (giá trị = 4)
Di chuột ra:      ★ ★ ★ ★ ☆  (giữ nguyên giá trị đã chọn)
```

- State `hover` theo dõi sao đang được hover
- State `value` là giá trị đã chọn
- Logic hiển thị: `(hover || value) >= star` ? sáng : xám
- CSS: `fill-yellow-400 text-yellow-400` cho sao sáng, `text-muted-foreground` cho sao xám

### Luồng kiểm tra quyền viết review

```
User vào course detail → useEnrollmentCheck(courseId)
   ├── Chưa đăng nhập → isAuthenticated = false → KHÔNG hiện form
   ├── Chưa ghi danh → enrolled = false → KHÔNG hiện form
   ├── Đã ghi danh + đã review → myReview exists → KHÔNG hiện form (hiện nút Edit trên review)
   └── Đã ghi danh + chưa review → canWriteReview = true → HIỆN form
```

Biến quyết định: `canWriteReview = isAuthenticated && isEnrolled && !myReview`

### Luồng tạo review mới

1. User chọn rating (1-5 sao, bắt buộc)
2. User nhập comment (tùy chọn, tối đa 2000 ký tự)
3. Submit → `useCreateReview(courseId)` → `POST /courses/:courseId/reviews`
4. Thành công → toast "Review submitted" + reset form + invalidate queries
5. Lỗi → toast error message từ `useApiError()`

### Luồng sửa review

1. Click nút Edit (biểu tượng bút chì) trên review của mình
2. `editingReviewId` = review.id → render `WriteReviewForm` thay cho review card
3. Form pre-fill `rating` và `comment` từ review hiện tại
4. Submit → `useUpdateReview(courseId)` → `PATCH /courses/:courseId/reviews/:reviewId`
5. Thành công → toast + `setEditingReviewId(null)` → quay lại hiển thị bình thường

### Luồng xóa review + ConfirmDialog

1. Click nút Delete (biểu tượng thùng rác) → `setDeleteDialogReviewId(review.id)`
2. `ConfirmDialog` hiện lên (portal vào document.body):
   - Tiêu đề: "Delete review"
   - Mô tả: "Are you sure you want to delete your review?"
   - Nút "Delete review" (variant destructive, màu đỏ)
   - Nút "Cancel"
   - Nút X góc trên phải
3. Confirm → `useDeleteReview(courseId)` → `DELETE /courses/:courseId/reviews/:reviewId`
4. Thành công → toast + đóng dialog

### ConfirmDialog — Component tái sử dụng

Được triển khai bằng `ReactDOM.createPortal` thay vì dùng Radix Dialog, vì:
- Tránh conflict z-index với các component khác
- Đơn giản hơn, không cần thêm dependency
- Tự quản lý body scroll lock (`document.body.style.overflow = 'hidden'`)

Props chính: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `variant` (destructive/default), `isLoading`, `onConfirm`, `children` (slot cho nội dung tùy chỉnh như input note).

---

## 3. Notification System

### 3.1 NotificationPopover — Dropdown trên navbar

Khi user đã đăng nhập, icon chuông trên navbar được thay bằng `<NotificationPopover />`:

```
┌─────────────────────────────┐
│  Thông báo    Đánh dấu đã đọc│  ← Header
├─────────────────────────────┤
│ 🔵 BookOpen  Bạn đã ghi danh │  ← Notification items (tối đa 8)
│    "React & Next.js"         │     Chấm xanh = chưa đọc
│    2 giờ trước               │
│                              │
│    Star  Ai đó đánh giá...   │
│    1 ngày trước              │
├─────────────────────────────┤
│        Xem tất cả →         │  ← Footer link → /notifications
└─────────────────────────────┘
```

**Hoạt động:**
- `useUnreadNotificationCount(isAuthenticated)` — poll mỗi 30 giây (refetchInterval: 30000)
- Unread count > 0 → hiện badge số trên chuông (tối đa "9+")
- Click chuông → toggle `open` state → fetch 8 notifications mới nhất
- Click item → `markRead.mutate(id)` + đóng popover
- "Đánh dấu đã đọc" → `markAllRead.mutate()`

**Đóng popover:**
- Click bên ngoài: `useEffect` + `document.addEventListener('mousedown')` + `ref.current.contains()` check
- Click item hoặc "Xem tất cả": `setOpen(false)`

### 3.2 NotificationItem — Component chia sẻ

Dùng chung cho cả popover (compact mode) và trang đầy đủ. Ánh xạ notification type → icon + màu:

| Type | Icon | Màu |
|------|------|-----|
| `ENROLLMENT_CONFIRMED` | BookOpen | blue |
| `COURSE_COMPLETED` | BookOpen | blue |
| `NEW_REVIEW` | Star | yellow |
| `REVIEW_REPLY` | Star | yellow |
| `NEW_COMMENT` | MessageCircle | green |
| `POST_LIKED` | MessageCircle | green |
| `ORDER_COMPLETED` | ShoppingCart | blue |
| `PAYMENT_RECEIVED` | ShoppingCart | blue |
| `NEW_FOLLOWER` | UserPlus | violet |
| `ACHIEVEMENT` | Trophy | orange |
| `CERTIFICATE_EARNED` | Trophy | orange |
| `SYSTEM` | Settings | gray |

Hàm `getNotificationMessage()` switch theo type, trích xuất thông tin từ `notification.data` (ví dụ `data.courseTitle`, `data.userName`).

### 3.3 Notifications Page — Infinite Scroll

```
URL: /notifications

┌──────────────────────────────┐
│ Thông báo (3)  Đánh dấu đã đọc│  ← Header + badge
├──────────────────────────────┤
│  [Tất cả]  [Chưa đọc]       │  ← Filter tabs
├──────────────────────────────┤
│ Notification 1               │
│ Notification 2               │
│ ...                          │
│ Notification 15              │
│ ── sentinel div (1px) ──     │  ← IntersectionObserver target
│ Loading spinner...           │  ← isFetchingNextPage
└──────────────────────────────┘
```

**useInfiniteNotifications:**

```typescript
useInfiniteQuery({
  queryKey: ['notifications', 'infinite', filter],
  queryFn: ({ pageParam = 1 }) =>
    notificationService.getAll({ page: pageParam, limit: 15, ...filter }),
  initialPageParam: 1,
  getNextPageParam: (lastPage) =>
    lastPage.meta.page < lastPage.meta.totalPages
      ? lastPage.meta.page + 1
      : undefined,  // undefined = hết trang
});
```

**IntersectionObserver:**

```typescript
// Sentinel div ở cuối danh sách
const sentinelRef = useRef<HTMLDivElement>(null);

const handleObserver = useCallback((entries) => {
  const [entry] = entries;
  if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();  // Tự động tải trang tiếp
  }
}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

useEffect(() => {
  const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [handleObserver]);
```

Khi sentinel div (cao 1px) xuất hiện trong viewport → observer trigger → gọi `fetchNextPage()` → append trang mới vào `data.pages[]`.

**Filter tabs:**
- "Tất cả" → `readParam = undefined`
- "Chưa đọc" → `readParam = { read: false }`
- Thay đổi filter → useInfiniteQuery key thay đổi → tự động reset và fetch lại

---

## 4. Profile View

### Trang xem hồ sơ (`/profile/[userId]`)

**Data flow:**

```
useUserProfile(userId) → GET /users/:userId
                          ↓
Backend kiểm tra JWT (optional auth)
  ├── Có token → trả isFollowing: true/false
  └── Không token → trả isFollowing: null
```

**Profile header hiển thị:**
- Avatar (fallback = 2 ký tự đầu tên)
- Tên + badge "Giảng viên" nếu role = INSTRUCTOR
- Bio + headline (nếu là instructor)
- Ngày tham gia (format locale)
- Stats: followers, following, (students + courses nếu instructor)

**Follow/Unfollow với optimistic update:**

```
User click "Follow" →
  1. onMutate: cancel queries → lưu snapshot → update cache ngay
     { isFollowing: true, followerCount: +1 }
  2. API: POST /users/:userId/follow
  3. onSuccess: → (không cần làm gì, cache đã đúng)
  3. onError: → rollback cache về snapshot cũ + toast error
  4. onSettled: → invalidateQueries để đồng bộ chính xác
```

Tương tự cho "Unfollow" nhưng `isFollowing: false, followerCount: -1` (đảm bảo `Math.max(0, count - 1)`).

**3 tabs (own profile: certificates + followers + following; other: followers + following):**

- **Certificates tab** (chỉ profile mình): `useMyCertificates()` → hiện danh sách chứng chỉ với icon Award vàng, tên khóa học, ngày cấp
- **Followers/Following tab**: `useUserFollowers(userId, { page, limit: 10 })` — pagination thủ công (nút Previous/Next), hiện avatar + tên, link tới profile

---

## 5. Profile Edit

### Trang sửa hồ sơ (`/profile/edit`)

**Data loading với useMe():**

```
useMe() → GET /users/me → trả { id, fullName, email, bio, avatarUrl }
              ↓
useEffect([me]) → reset({ fullName: me.fullName, bio: me.bio ?? '' })
```

Dùng `useForm<EditProfileValues>()` của React Hook Form, gọi `reset()` khi data load xong để populate form.

**Luồng save:**

```
Submit → useUpdateProfile({ fullName, bio })
  → PATCH /users/me
  → onSuccess:
    1. Cập nhật auth store: setUser({ ...currentUser, fullName: updated.fullName })
       (Để navbar hiện tên mới ngay lập tức)
    2. toast.success("Saved")
    3. router.push(`/profile/${me.id}`)
```

**Lưu ý:**
- Email hiển thị nhưng disabled (không cho sửa)
- Avatar có nút Camera nhưng chưa wire upload flow (placeholder)
- Validation: fullName required + minLength 2, bio maxLength 500

---

## 6. Settings

### 3 tabs: Account, Notifications, Appearance

#### Tab Account — Đổi mật khẩu

```
┌── Đổi mật khẩu ──────────┐
│ Mật khẩu hiện tại  [____] │
│ Mật khẩu mới       [____] │  ← minLength: 8
│ Xác nhận            [____] │
│ [Cập nhật mật khẩu]       │
└────────────────────────────┘
```

Luồng:
1. Validate client-side: newPassword.length >= 8, newPassword === confirmPassword
2. `useChangePassword()` → `PATCH /users/me/password`
3. Backend verify currentPassword bằng bcrypt → hash newPassword → update
4. Thành công → toast + reset form
5. Lỗi `INVALID_CURRENT_PASSWORD` → toast error

#### Tab Notifications — Preference toggles

```
┌── Notification Preferences ────────────────┐
│ Course updates              [✓] In-app [✓] Email│
│ New followers               [✓] In-app [ ] Email│
│ Order updates               [✓] In-app [✓] Email│
│ Review responses            [✓] In-app [ ] Email│
│ System announcements        [✓] In-app [ ] Email│
└─────────────────────────────────────────────┘
```

- Load từ `useMe()` → `me.notificationPreferences`
- Mỗi toggle → `useUpdateNotificationPreferences()` → `PUT /users/me/notification-preferences`
- Auto-save khi toggle (không cần nút Save)
- Default: `{ inApp: true, email: false }` nếu key chưa tồn tại

#### Tab Appearance — Theme + Locale

```
Theme:    [☀️ Light]  [🌙 Dark]  [🖥️ System]   ← next-themes setTheme()
Language: [Tiếng Việt]  [English]             ← router.replace(pathname, { locale })
```

- Theme: `useTheme()` từ next-themes, chọn bằng border highlight
- Locale: `useLocale()` + `router.replace()` từ `@/i18n/navigation`
- Cả hai lưu trữ tự động (cookie/localStorage), không cần API call

---

## 7. Become Instructor

### Luồng đăng ký giảng viên

```
User vào /become-instructor →
  ├── user.role === INSTRUCTOR/ADMIN → "Bạn đã là giảng viên" (icon CheckCircle2 xanh)
  ├── latestApp.status === PENDING → hiện trạng thái "Đang chờ duyệt" (icon Clock vàng)
  ├── latestApp.status === REJECTED → hiện feedback + form đăng ký lại
  └── Không có đơn → hiện form + benefits
```

### Form đăng ký (ApplicationForm component)

| Field | Type | Validation | Mô tả |
|-------|------|-----------|-------|
| expertise | Input text | Required | Nhập phân cách bằng dấu phẩy, split thành array |
| experience | textarea | minLength: 50 | Kinh nghiệm giảng dạy |
| motivation | textarea | Optional | Lý do muốn dạy |
| cvUrl | Input text | Optional | Link CV / portfolio |
| certificateUrls | textarea | Optional | Mỗi URL một dòng, split bằng `\n` |

**Submit:**
```
Input expertise: "React, Node.js, TypeScript"
  → split(',') → trim → filter(Boolean)
  → ["React", "Node.js", "TypeScript"]

certificateUrls textarea:
  "https://cert1.com\nhttps://cert2.com"
  → split('\n') → trim → filter(Boolean)
  → ["https://cert1.com", "https://cert2.com"]
```

`useApplyInstructor()` → `POST /instructor/applications` → thành công → toast + invalidate queries → trang tự chuyển sang hiện trạng thái PENDING.

### Hiển thị trạng thái

**PENDING:** Card vàng với chi tiết đơn (expertise, experience, motivation, thời gian nộp).

**REJECTED:** Card đỏ với:
- Icon XCircle + "Đơn bị từ chối"
- `reviewNote` (feedback từ admin, hoặc "Không có phản hồi")
- Chi tiết đơn cũ
- Phía dưới: hint "Bạn có thể nộp lại" + form đăng ký mới

---

## 8. Backend Changes

### 8.1 Optional Auth trên Public Routes

**Vấn đề:** Endpoint `GET /users/:id` cần trả `isFollowing` flag khi user đã đăng nhập, nhưng vẫn cho phép truy cập ẩn danh (anonymous).

**Giải pháp:** Sửa `JwtAuthGuard.canActivate()`:

```typescript
// Trước: @Public() → return true (bỏ qua JWT hoàn toàn)
// Sau:
if (isPublic) {
  try {
    await super.canActivate(context);  // Thử parse JWT
  } catch {
    // Không có token hoặc token invalid → tiếp tục (anonymous)
  }
  return true;  // Luôn cho phép truy cập
}
```

Kết quả:
- Có JWT hợp lệ → `request.user` được set → `@CurrentUser()` trả JwtPayload
- Không có JWT → `request.user` undefined → `@CurrentUser()` trả undefined
- Controller dùng optional parameter: `@CurrentUser() user?: JwtPayload`

### 8.2 PATCH /users/me/password

**DTO mới:** `ChangePasswordDto`
```typescript
class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}
```

**Service logic:**
```
1. Tìm user → lấy passwordHash
2. Không có passwordHash (OAuth user) → throw INVALID_CREDENTIALS
3. bcrypt.compare(currentPassword, passwordHash)
   → sai → throw INVALID_CURRENT_PASSWORD
4. bcrypt.hash(newPassword, 10) → update DB
5. Trả { message: 'Password changed' }
```

---

## 9. Management Portal — Instructor Approval Detail

### Detail Dialog

Trước đó trang admin instructor approvals chỉ có nút Approve/Reject. Thêm nút Eye (mắt) để xem chi tiết đơn:

```
┌── DataTable Row ───────────────────────────────────┐
│ [Avatar] Nguyễn Văn A  │ React, AI  │ 15/03/2026 │ [👁] [✓ Approve] [✗ Reject] │
└────────────────────────────────────────────────────┘
                              ↓ Click Eye
┌── Dialog ──────────────────────────────┐
│  Xem chi tiết                     [X]  │
│  ┌──────────────────────────────────┐  │
│  │ [Avatar] Nguyễn Văn A           │  │
│  │          nguyenvana@email.com    │  │
│  ├──────────────────────────────────┤  │
│  │ Chuyên môn: React, AI           │  │
│  │ Kinh nghiệm: 5 năm giảng dạy...│  │
│  │ Động lực: Muốn chia sẻ...      │  │
│  │ CV: https://cv.example.com      │  │
│  │ Chứng chỉ:                     │  │
│  │   • https://cert1.com          │  │
│  │   • https://cert2.com          │  │
│  │ Ngày nộp: 15/03/2026           │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

Sử dụng `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` từ `@shared/ui`. State `detailApp` quản lý đơn nào đang được xem.

---

## 10. Các vấn đề đã giải quyết

### 10.1 API Response Unwrapping (data.data pattern)

**Vấn đề:** API trả response bọc trong `{ data: T, meta?: ... }`, nhưng `apiClient` cũng trả kết quả bọc thêm một lần nữa. Kết quả hooks nhận được dạng `{ data: { data: T, meta } }` từ TanStack Query.

**Giải pháp:** Tất cả components cast response thủ công:
```typescript
const { data: profileRaw } = useUserProfile(userId);
const profile = (profileRaw as { data?: { id: string; fullName: string; ... } })?.data;
```

Pattern này lặp lại ở mọi nơi: notifications, followers, certificates, applications.

### 10.2 formatRelativeTime capitalize

**Vấn đề:** `Intl.RelativeTimeFormat` trả string lowercase tiếng Việt (ví dụ: "2 giờ trước"), nhưng muốn capitalize chữ đầu khi hiển thị standalone.

**Giải pháp:** Hàm `formatRelativeTime` trong `@shared/utils` thêm:
```typescript
return result.charAt(0).toUpperCase() + result.slice(1);
// "2 giờ trước" → "2 giờ trước" (không đổi vì '2' đã uppercase)
// "hôm qua" → "Hôm qua"
```

### 10.3 Dialog close button position

**Vấn đề:** ConfirmDialog cần nút đóng X ở góc trên phải, nhưng phải hoạt động đúng khi dialog đang loading (không cho đóng khi đang xử lý).

**Giải pháp:**
```typescript
<button
  className="absolute top-4 right-4 ..."
  onClick={() => !isLoading && onOpenChange(false)}
>
  <X className="h-4 w-4" />
</button>
```

Backdrop click cũng kiểm tra `!isLoading` trước khi đóng.

### 10.4 Locale detection cho router navigation

**Vấn đề:** Settings page cần chuyển locale (vi ↔ en) mà không reload trang, giữ nguyên pathname hiện tại.

**Giải pháp:** Dùng `useRouter()` và `usePathname()` từ `@/i18n/navigation` (next-intl wrapper):
```typescript
const router = useRouter();
const pathname = usePathname();
// Click "English" →
router.replace(pathname, { locale: 'en' });
// URL: /settings → /en/settings (vì vi là default, dùng as-needed strategy)
```

### 10.5 Notification count trên navbar

**Vấn đề:** Cần hiển thị số thông báo chưa đọc trên icon chuông, cập nhật realtime.

**Giải pháp:** `useUnreadNotificationCount()` với `refetchInterval: 30_000` (30 giây) — polling đơn giản thay vì WebSocket cho MVP. Badge hiển thị "9+" nếu count > 9.

### 10.6 Follow optimistic update rollback

**Vấn đề:** Nếu API follow/unfollow thất bại (ví dụ ALREADY_FOLLOWING), UI đã cập nhật rồi cần rollback.

**Giải pháp:** Pattern chuẩn TanStack Query optimistic update:
```
onMutate:   lưu snapshot prev → update cache
onError:    restore prev → toast error
onSettled:  invalidateQueries (đồng bộ lại dù thành công hay thất bại)
```

Cache update trực tiếp trên query data:
```typescript
queryClient.setQueryData(['users', userId], (old) => ({
  ...old,
  data: { ...old.data, isFollowing: true, followerCount: old.data.followerCount + 1 }
}));
```
