# Sub-phase 5.13c — ECOMMERCE

> Cart, Checkout, Payment (QR + polling), Orders, Wishlist.
> Dependency: 5.13b (Course Browse & Detail) ✅ done.

---

## Hiện trạng

### Đã có sẵn:
- **6 pages** mock UI: Cart, Checkout, Payment, Orders, Order Detail, Wishlist — tất cả dùng `mockCartItems` / `mockOrders` từ mock-data.ts
- **Cart store** (Zustand): `useCartStore` — items, coupon, addItem, removeItem, clearCart, subtotal, total, itemCount — persist localStorage key `sslm-cart`
- **Course detail** đã có "Add to Cart" button gọi `useCartStore().addItem()` (Phase 5.13b)
- **i18n**: `cart`, `checkout`, `payment`, `orders`, `orderDetail`, `wishlist` namespace đã có đầy đủ keys
- **Shared types**: `CartItem`, `Order`, `OrderStatus` (PENDING/COMPLETED/EXPIRED)

### Backend API endpoints:

**Cart** (`/api/cart` — all require auth):
| Method | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| GET | `/cart` | — | `{ items: CartItem[], subtotal }` |
| POST | `/cart/items` | `{ courseId, chapterId? }` | CartItem |
| DELETE | `/cart/items/:itemId` | — | — |
| DELETE | `/cart` | — | — |
| POST | `/cart/merge` | `{ items: [{ courseId, chapterId? }] }` | merged cart |
| POST | `/cart/apply-coupon` | `{ code }` | `{ coupon, discount, subtotal, total }` |

**Cart item shape:**
```
{ id, userId, courseId, chapterId, price, createdAt,
  course: { id, title, slug, thumbnailUrl, price, instructor: { fullName } },
  chapter: { id, title, price } | null }
```

**Orders** (`/api/orders` — all require auth):
| Method | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| POST | `/orders` | `{ couponCode? }` | `{ order, payment }` |
| GET | `/orders` | `?page&limit` | `{ data: Order[], meta }` |
| GET | `/orders/:id` | — | Order with items |
| GET | `/orders/:id/status` | — | `{ status, paidAt }` |

**Order shape:**
```
{ id, userId, orderCode, totalAmount, discountAmount, finalAmount,
  status: PENDING | COMPLETED | EXPIRED, expiresAt, paidAt, createdAt,
  items: [{ id, type, courseId, chapterId, price, title }] }
```

**Payment info (from POST /orders):**
```
{ bankId, accountNumber, accountName, amount, content (orderCode),
  qrUrl: "https://img.vietqr.io/image/{bankId}-{accountNumber}-compact2.png?amount={amount}&addInfo={orderCode}" }
```

**Wishlist** (`/api/wishlists` — all require auth):
| Method | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| GET | `/wishlists` | `?page&limit` | Paginated courses |
| POST | `/wishlists/:courseId` | — | — |
| DELETE | `/wishlists/:courseId` | — | — |

**Wishlist item shape:**
```
{ id, userId, courseId, createdAt,
  course: { id, title, slug, thumbnailUrl, price, avgRating, totalStudents,
            instructor: { fullName } } }
```

---

## Scope & File Mapping

### Shared Hooks Layer
| # | File | Action |
|---|------|--------|
| 1 | `services/cart.service.ts` | **Create**: getCart, addItem, removeItem, clearCart, mergeCart, applyCoupon |
| 2 | `services/order.service.ts` | **Create**: create, getHistory, getById, getStatus |
| 3 | `services/wishlist.service.ts` | **Create**: getAll, add, remove |
| 4 | `services/index.ts` | Update: export 3 new services |
| 5 | `queries/use-cart.ts` | **Create**: useServerCart, useAddCartItem, useRemoveCartItem, useClearCart, useMergeCart, useApplyCoupon |
| 6 | `queries/use-orders.ts` | **Create**: useCreateOrder, useOrders, useOrderDetail, useOrderStatus |
| 7 | `queries/use-wishlist.ts` | **Create**: useWishlist, useAddToWishlist, useRemoveFromWishlist |
| 8 | `index.ts` | Update: export all new hooks + services |

### Pages (6 pages rewrite)
| # | File | Action |
|---|------|--------|
| 9 | `cart/page.tsx` | Rewrite: server cart + merge, coupon, remove, wishlist button, CartItemCard + OrderSummary sub-components |
| 10 | `checkout/page.tsx` | Rewrite: order creation, auth hydration guard (`useAuthHydrated`), race condition fix (`orderInProgress`) |
| 11 | `payment/[orderId]/page.tsx` | Rewrite: QR display, countdown hook, polling, back nav, payment info từ API fallback sessionStorage |
| 12 | `orders/page.tsx` | Rewrite: order history, pagination, status badges |
| 13 | `orders/[orderId]/page.tsx` | Rewrite: dynamic order detail, continue payment/learning CTA |
| 14 | `wishlist/page.tsx` | Rewrite: wishlist from API, add to cart (server + local + toast), remove |

### Course Detail (chapter purchase + cart fix)
| # | File | Action |
|---|------|--------|
| 15 | `components/course/detail/types.ts` | Update: thêm `price` vào ApiChapter |
| 16 | `components/course/detail/course-curriculum.tsx` | Update: chapter price button, `onAddChapterToCart` callback |
| 17 | `courses/[slug]/page.tsx` | Update: `handleAddChapterToCart`, bỏ redirect login khi add to cart (guest vẫn thêm được) |

### Navbar
| # | File | Action |
|---|------|--------|
| 18 | `navigation/navbar.tsx` | Update: cart icon luôn hiển thị (cả guest), cart count từ server, wishlist icon + count badge |

### Backend Fixes
| # | File | Action |
|---|------|--------|
| 19 | `orders/orders.service.ts` | Fix: order code format `SSLM{date}{seq}`, return payment info for PENDING orders trong `findById` |
| 20 | `orders/webhooks.service.ts` | Fix: regex match `SSLM\d{13}`, increment totalStudents on chapter purchase |
| 21 | `orders/dto/sepay-webhook.dto.ts` | Fix: add all SePay fields (`id`, `subAccount`, `accumulated`, `code`, `description`) to prevent 400 |

### i18n
| # | File | Action |
|---|------|--------|
| 22 | `messages/vi.json` | Update: ~18 new keys (payment status, cart coupon/wishlist, chapter, wishlist addedToCart) |
| 23 | `messages/en.json` | Update: ~18 new keys |

---

## Step 1 — Service Layer

### 1.1 `cart.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const cartService = {
  getCart: () => apiClient.get('/cart'),

  addItem: (courseId: string, chapterId?: string) =>
    apiClient.post('/cart/items', { courseId, chapterId }),

  removeItem: (itemId: string) => apiClient.del(`/cart/items/${itemId}`),

  clearCart: () => apiClient.del('/cart'),

  mergeCart: (items: Array<{ courseId: string; chapterId?: string }>) =>
    apiClient.post('/cart/merge', { items }),

  applyCoupon: (code: string) => apiClient.post('/cart/apply-coupon', { code }),
};
```

### 1.2 `order.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const orderService = {
  create: (couponCode?: string) =>
    apiClient.post('/orders', couponCode ? { couponCode } : {}),

  getHistory: (params?: Record<string, string>) =>
    apiClient.get('/orders', params),

  getById: (orderId: string) => apiClient.get(`/orders/${orderId}`),

  getStatus: (orderId: string) => apiClient.get(`/orders/${orderId}/status`),
};
```

### 1.3 `wishlist.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const wishlistService = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/wishlists', params),

  add: (courseId: string) => apiClient.post(`/wishlists/${courseId}`),

  remove: (courseId: string) => apiClient.del(`/wishlists/${courseId}`),
};
```

---

## Step 2 — Query Hooks

### 2.1 `use-cart.ts`

```typescript
// useServerCart — query GET /cart, enabled when authenticated
// useAddCartItem — mutation POST /cart/items → invalidate ['cart']
// useRemoveCartItem — mutation DELETE /cart/items/:id → invalidate ['cart']
// useClearCart — mutation DELETE /cart → invalidate ['cart'] + cartStore.clearCart()
// useMergeCart — mutation POST /cart/merge → invalidate ['cart'] + cartStore.clearCart()
// useApplyCoupon — mutation POST /cart/apply-coupon → return discount info
```

### 2.2 `use-orders.ts`

```typescript
// useCreateOrder — mutation POST /orders → invalidate ['cart'] + cartStore.clearCart()
// useOrders(params) — query GET /orders (paginated)
// useOrderDetail(orderId) — query GET /orders/:id
// useOrderStatus(orderId) — query GET /orders/:id/status with polling:
//   refetchInterval: (query) => {
//     const status = query.state.data?.data?.status;
//     return (status === 'COMPLETED' || status === 'EXPIRED') ? false : 5000;
//   }
```

### 2.3 `use-wishlist.ts`

```typescript
// useWishlist(params) — query GET /wishlists (paginated)
// useAddToWishlist — mutation POST /wishlists/:courseId → invalidate ['wishlists']
// useRemoveFromWishlist — mutation DELETE /wishlists/:courseId → invalidate ['wishlists']
```

---

## Step 3 — Cart Page

### Guest vs Authenticated:
```
Guest:
  → useCartStore (localStorage) for display
  → Checkout redirects to /login

Authenticated:
  → On mount: if localItems.length > 0 → useMergeCart → then clearCart store
  → Display from useServerCart
  → Remove: useRemoveCartItem (server) + cartStore.removeItem()
  → Coupon: useApplyCoupon → show discount
```

### Cart merge flow (on mount, authenticated):
```typescript
useEffect(() => {
  if (isAuthenticated && localItems.length > 0 && !hasMerged.current) {
    hasMerged.current = true;
    mergeCart.mutate(
      localItems.map((i) => ({ courseId: i.courseId, chapterId: i.chapterId })),
      { onSuccess: () => cartStore.getState().clearCart() }
    );
  }
}, [isAuthenticated]);
```

### UI: giữ layout hiện tại, thay data source

---

## Step 4 — Checkout Page

### Flow:
1. AuthGuard
2. Show order summary from server cart (or cartStore for guests → redirect)
3. Coupon input (optional)
4. Terms checkbox → enable "Confirm Payment"
5. `useCreateOrder(couponCode?)` → on success:
   - `cartStore.clearCart()`
   - `router.push(`/payment/${order.id}`)`
   - Lưu `payment` info vào sessionStorage (key: `sslm-payment-${orderId}`)

### Lưu payment info:
`POST /orders` trả `{ order, payment }` nhưng `GET /orders/:id` không trả payment info.
→ Lưu vào sessionStorage khi tạo order, đọc trên payment page.

---

## Step 5 — Payment Page (QR + Polling)

### Data sources:
1. `orderId` from route params
2. `useOrderDetail(orderId)` → order data (amounts, status, expiresAt)
3. Payment info: đọc từ `sessionStorage('sslm-payment-${orderId}')` hoặc reconstruct QR URL
4. `useOrderStatus(orderId)` → polling every 5s

### QR code:
```tsx
<img src={payment.qrUrl} alt="QR Payment" className="mx-auto h-64 w-64 rounded-lg" />
```

### Countdown timer:
```typescript
const [remaining, setRemaining] = useState(0);
useEffect(() => {
  if (!order?.expiresAt) return;
  const interval = setInterval(() => {
    const diff = new Date(order.expiresAt).getTime() - Date.now();
    setRemaining(Math.max(0, diff));
    if (diff <= 0) clearInterval(interval);
  }, 1000);
  return () => clearInterval(interval);
}, [order?.expiresAt]);
```

### Status polling:
```typescript
const { data: statusData } = useOrderStatus(orderId);
// Hook internally uses refetchInterval: status is terminal ? false : 5000
// When COMPLETED → show success UI, link to /orders/:id
// When EXPIRED → show expired UI, link to /courses
```

---

## Step 6 — Orders Page

- Replace `mockOrders` → `useOrders({ page, limit })`
- Status badge: PENDING → `outline`, COMPLETED → `default`, EXPIRED → `destructive`
- Click → `/orders/:orderId`
- Pagination from `meta`
- Empty state: "Chưa có đơn hàng nào"

---

## Step 7 — Order Detail Page

- Read `orderId` from params → `useOrderDetail(orderId)`
- Display: orderCode, status, createdAt, items list, amounts
- PENDING → "Continue Payment" button → `/payment/:orderId`
- COMPLETED → "Continue Learning" per course item
- Not found state
- Skeleton loading

---

## Step 8 — Wishlist Page

- Replace `mockCourses.slice(0,4)` → `useWishlist({ page, limit })`
- Map wishlist items to CourseCard-compatible shape
- Remove: `useRemoveFromWishlist(courseId)`
- Empty state: "Chưa có khóa học yêu thích"
- Pagination if needed

---

## Commits

| # | Scope | Message |
|---|-------|---------|
| 1 | shared | `feat(shared): add cart, order, and wishlist services and hooks` |
| 2 | student | `feat(student): wire cart and checkout pages to real api` |
| 3 | student | `feat(student): wire payment page with qr code and status polling` |
| 4 | student | `feat(student): wire orders and wishlist pages to real api` |

---

## Verification Checklist

### Cart
- [ ] Guest: cart shows items from localStorage
- [ ] Guest: checkout redirects to login
- [ ] Authenticated: localStorage cart merges to server on mount
- [ ] Authenticated: items show from server cart (useServerCart)
- [ ] Remove item: API call + local store sync
- [ ] Apply valid coupon: shows discount in summary
- [ ] Invalid coupon: shows error toast
- [ ] Clear cart works
- [ ] Checkout button → `/checkout`
- [ ] Empty state when no items

### Checkout
- [ ] AuthGuard: redirects if not logged in
- [ ] Order summary shows server cart items + totals
- [ ] Terms checkbox enables confirm button
- [ ] Place order → API call → redirect to `/payment/:orderId`
- [ ] Cart cleared after successful order (both store + server)
- [ ] Payment info saved to sessionStorage

### Payment
- [ ] QR code image loads from VietQR URL
- [ ] Bank details: bankName, accountNumber, accountName, content, amount
- [ ] Copy buttons work for each field
- [ ] Countdown timer from `expiresAt` (MM:SS format)
- [ ] Polling every 5s via `useOrderStatus`
- [ ] COMPLETED → success UI + link to order detail
- [ ] EXPIRED → expired UI + link back to courses
- [ ] Timer reaches 0 → show expired state

### Orders
- [ ] Order list from API with pagination
- [ ] Status badges styled correctly (PENDING/COMPLETED/EXPIRED)
- [ ] Click → order detail page
- [ ] Empty state
- [ ] Dark mode correct

### Order Detail
- [ ] Dynamic orderId from URL
- [ ] Shows order items, amounts, status badge
- [ ] PENDING → "Continue Payment" link
- [ ] COMPLETED → "Continue Learning" links per item
- [ ] Not found state for invalid orderId

### Wishlist
- [ ] List from API with course cards
- [ ] Remove from wishlist works
- [ ] Empty state
- [ ] Dark mode correct

### Cross-cutting
- [ ] All pages require auth (except guest cart view)
- [ ] No mock data imports in these 6 pages
- [ ] All user-facing strings via useTranslations
- [ ] Build passes: `npm run build --workspace=apps/student-portal`
