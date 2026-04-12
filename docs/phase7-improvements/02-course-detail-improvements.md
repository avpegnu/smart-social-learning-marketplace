# Phase 7.2 — Course Detail & Auth UX Improvements

> Tài liệu mô tả các cải thiện UX nhỏ nhưng quan trọng cho course detail page và auth layout, kèm theo việc wire up các nút placeholder sẵn có.

---

## Bối cảnh

Sau đợt refresh UI (Phase 7.1), user phát hiện 2 vấn đề UX:

1. **Vào trang login/register không có cách quay về trang chủ** — user bị "kẹt" ở auth layout, không có nút back, không có link
2. **Nút "Yêu thích" và "Chia sẻ" trên trang course detail không hoạt động** — chỉ là placeholder UI không có handler

---

## Tổng quan thay đổi

| # | Vấn đề | Solution | Files |
|---|--------|----------|-------|
| 1 | Auth layout không có way back to home | Click logo + text → navigate `/` | 1 file |
| 2 | Nút "Chia sẻ" không làm gì | Copy URL hiện tại vào clipboard + toast | 1 file + i18n |
| 3 | Nút "Yêu thích" không làm gì | Toggle wishlist (add/remove) + auth check + visual feedback | 2 files + i18n |
| 4 | `useWishlist` gọi API kể cả khi chưa login | Thêm `enabled: isAuthenticated` | 1 hook |

---

## Fix #1: Auth layout — clickable logo về trang chủ

### Vấn đề

User vào `/login` hoặc `/register`, thấy có logo SSLM ở góc trên trái nhưng không click được. Không có nút "← Home" hay breadcrumb. Phải sửa URL thủ công hoặc click nút back của browser.

### File đã sửa

[apps/student-portal/src/app/[locale]/(auth)/layout.tsx](apps/student-portal/src/app/[locale]/(auth)/layout.tsx)

**Trước:**
```tsx
<div className="mb-8 flex items-center gap-2">
  <GraduationCap className="text-primary h-8 w-8" />
  <span className="text-xl font-bold">SSLM</span>
</div>
```

**Sau:**
```tsx
<Link
  href="/"
  className="hover:text-primary mb-8 inline-flex items-center gap-2 transition-colors"
>
  <GraduationCap className="text-primary h-8 w-8" />
  <span className="text-xl font-bold">SSLM</span>
</Link>
```

### Quyết định không thêm i18n cho aria-label

Ban đầu mình thêm `aria-label={t('backToHome')}` cho accessibility, nhưng user phản hồi:

> "Thêm localize để làm gì nhỉ?"

Đúng — vì link đã chứa visible text `SSLM`, screen reader sẽ đọc "SSLM, link" — đủ context. Aria-label dư thừa. Đã rollback i18n keys, chỉ giữ Link wrapper. Tránh overhead translation maintenance cho 1 string không cần thiết.

### Tại sao không break gì

- Layout structure giữ nguyên (vẫn `mb-8 flex items-center gap-2`)
- Chỉ wrap div thành Link
- Hover thêm color transition mềm mại

---

## Fix #2: Share button — copy URL to clipboard

### Vấn đề

[purchase-card.tsx](apps/student-portal/src/components/course/detail/purchase-card.tsx) có nút "Chia sẻ" với icon Share2 nhưng không có `onClick` handler — pure decoration.

### Solution

User request rõ ràng: copy URL hiện tại vào clipboard.

```tsx
const handleShare = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success(t('linkCopied'));
  } catch {
    toast.error(t('linkCopyFailed'));
  }
};
```

### Tại sao try-catch

`navigator.clipboard.writeText` có thể throw nếu:
- Browser không support (rất hiếm với modern browsers)
- Permission bị deny (vd: insecure context)
- iframe sandbox blocking

Try-catch cho fallback UX tốt hơn là crash silent.

### i18n keys mới

```json
// vi.json
"linkCopied": "Đã sao chép link khóa học",
"linkCopyFailed": "Không thể sao chép link",

// en.json
"linkCopied": "Course link copied to clipboard",
"linkCopyFailed": "Failed to copy link",
```

### Tại sao không dùng Web Share API

Web Share API (`navigator.share()`) thường được khuyên cho mobile, mở native share sheet. Nhưng:
1. Desktop support kém (Chrome desktop có nhưng popup gián đoạn)
2. User explicit request là copy URL, không phải share sheet
3. Copy → clipboard là pattern phổ biến cho desktop course platforms (Udemy, Coursera dùng chính style này)

---

## Fix #3: Wishlist toggle với auth check

### Vấn đề

Nút "Yêu thích" chỉ là static button, không có handler. Không hiển thị state hiện tại (đã yêu thích hay chưa), không có way add/remove.

### Solution

Wire vào existing wishlist hooks (`useWishlist`, `useAddToWishlist`, `useRemoveFromWishlist` đã có sẵn trong shared-hooks).

#### Logic flow

```
Click button
├── Chưa login? → router.push('/login?redirect=<current pathname>')
├── Đã login + đang trong wishlist? → DELETE /wishlists/{courseId} → toast
└── Đã login + chưa trong wishlist? → POST /wishlists/{courseId} → toast
```

#### Visual feedback

- **Chưa yêu thích**: icon Heart outline, màu `text-muted-foreground`
- **Đã yêu thích**: icon Heart **fill**, màu `text-destructive` (đỏ)
- **Mutation pending**: button disabled, opacity 50%

### Files đã sửa

#### [apps/student-portal/src/components/course/detail/purchase-card.tsx](apps/student-portal/src/components/course/detail/purchase-card.tsx)

Thêm props mới `courseId` vì component cần biết course nào để toggle wishlist:

```tsx
interface PurchaseCardProps {
  courseId: string;          // ← NEW
  thumbnailUrl: string | null;
  // ... existing props
}
```

Logic kiểm tra `isInWishlist`:

```tsx
const { data: wishlistData } = useWishlist();
const wishlistItems = (wishlistData?.data as WishlistItemShape[]) ?? [];
const isInWishlist = wishlistItems.some((item) => item.courseId === courseId);
```

Trước đó mình suy nghĩ giữa 2 approach:
- **Option A**: query toàn bộ wishlist, filter client-side
- **Option B**: gọi backend "check if course X is in wishlist"

Chọn **Option A** vì:
- Hook `useWishlist()` đã có sẵn cache (TanStack Query)
- Wishlist của 1 user thường nhỏ (~chục đến vài chục courses)
- Tránh thêm 1 endpoint mới chỉ để check 1 boolean

#### [apps/student-portal/src/app/[locale]/(main)/courses/[slug]/page.tsx](apps/student-portal/src/app/[locale]/(main)/courses/[slug]/page.tsx)

Pass `courseId` vào PurchaseCard:

```tsx
<PurchaseCard
  courseId={course.id}    // ← NEW
  thumbnailUrl={course.thumbnailUrl}
  // ... other props
/>
```

### i18n keys mới

```json
// vi.json
"addedToWishlist": "Đã thêm vào danh sách yêu thích",
"removedFromWishlist": "Đã xóa khỏi danh sách yêu thích",

// en.json
"addedToWishlist": "Added to wishlist",
"removedFromWishlist": "Removed from wishlist",
```

### Redirect after login

Khi user chưa login click "Yêu thích", redirect tới `/login?redirect=<current pathname>`:

```tsx
if (!isAuthenticated) {
  router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  return;
}
```

Login page đã xử lý query param `redirect` để quay lại đúng course detail sau khi login.

---

## Fix #4: useWishlist hook — disable when unauthenticated

### Vấn đề

Trước đó hook `useWishlist()` không có `enabled` flag:

```tsx
export function useWishlist(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['wishlists', params],
    queryFn: () => wishlistService.getAll(params),
  });
}
```

Khi unauthenticated user mở course detail → hook chạy → gọi `GET /wishlists` → backend trả 401 → console error mỗi lần load page. Không break logic nhưng noisy.

### Fix

[packages/shared-hooks/src/queries/use-wishlist.ts](packages/shared-hooks/src/queries/use-wishlist.ts)

```tsx
import { useAuthStore } from '../stores/auth-store';

export function useWishlist(params?: Record<string, string>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['wishlists', params],
    queryFn: () => wishlistService.getAll(params),
    enabled: isAuthenticated,
  });
}
```

Hook sẽ chỉ chạy khi user đã login → tránh gọi API thừa.

### Tại sao không break gì

- `enabled: false` → query không chạy nhưng state vẫn `{ data: undefined, isLoading: false }`
- PurchaseCard wishlist check `wishlistItems = (... ?? [])` → empty array → `isInWishlist = false` (đúng — guest không có wishlist)
- Trang `/wishlist` (protected) chỉ render khi đã login → `enabled: true` → query chạy bình thường

---

## Verification

| Check | Status |
|-------|--------|
| TypeScript shared-hooks | ✅ 0 errors |
| TypeScript student-portal | ✅ 0 errors (sau khi clear stale `.next/types`) |
| Build student-portal | ✅ pass |
| Manual test: click logo auth → home | ✅ |
| Manual test: click share → toast + clipboard | ✅ |
| Manual test: click wishlist (unauthenticated) → redirect login | ✅ |
| Manual test: click wishlist (authenticated) → toggle + heart fill | ✅ |

---

## Files Changed Summary

| File | Change |
|------|--------|
| `apps/student-portal/src/app/[locale]/(auth)/layout.tsx` | Logo wrap trong Link |
| `apps/student-portal/src/components/course/detail/purchase-card.tsx` | Share + Wishlist handlers |
| `apps/student-portal/src/app/[locale]/(main)/courses/[slug]/page.tsx` | Pass `courseId` to PurchaseCard |
| `apps/student-portal/messages/vi.json` | 4 new keys |
| `apps/student-portal/messages/en.json` | 4 new keys |
| `packages/shared-hooks/src/queries/use-wishlist.ts` | Add `enabled: isAuthenticated` |

**Total: 6 files modified.**

---

## Lessons Learned

### 1. Aria-label không phải lúc nào cũng cần

Nếu interactive element đã có visible text meaningful, screen reader sẽ đọc text đó → aria-label dư thừa. Chỉ thêm aria-label khi:
- Element chỉ có icon (icon-only button)
- Visible text không mô tả đủ action (vd: nút "Edit" cho nhiều rows → cần `aria-label="Edit user John"`)

### 2. `enabled` flag là pattern quan trọng cho protected queries

Mọi `useQuery` cho endpoint authenticated cần `enabled: isAuthenticated` (hoặc condition tương đương) để tránh:
- 401 errors trong console
- Network requests thừa
- Race condition khi user logout

### 3. Filter client-side OK cho data nhỏ

Không cần thêm endpoint `GET /wishlists/check/:courseId` vì wishlist của 1 user nhỏ. Tận dụng cache của TanStack Query và filter client-side đơn giản hơn.
