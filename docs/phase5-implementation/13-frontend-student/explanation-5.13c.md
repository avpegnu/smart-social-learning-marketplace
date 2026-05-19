# Giải thích — Phase 5.13c: Ecommerce (Giỏ hàng, Thanh toán, Đơn hàng, Yêu thích)

> Kết nối 6 trang mock với API thật. Triển khai luồng mua hàng hoàn chỉnh từ "Thêm vào giỏ" đến "Thanh toán thành công".

---

## 1. Luồng mua hàng hoàn chỉnh (End-to-End)

### Sơ đồ tổng quan:

```
┌─ CHI TIẾT KHÓA HỌC ─┐    ┌── GIỎ HÀNG ──┐    ┌── THANH TOÁN ──┐    ┌── QR + POLLING ──┐    ┌── HOÀN THÀNH ──┐
│                       │    │              │    │               │    │                  │    │                │
│ "Thêm vào giỏ"       │───▷│ Xem lại      │───▷│ Xác nhận      │───▷│ Quét QR          │───▷│ Chi tiết đơn   │
│ "Mua chương lẻ"      │    │ Mã giảm giá  │    │ Đặt hàng      │    │ Đếm ngược        │    │ Bắt đầu học    │
└───────────────────────┘    └──────────────┘    └───────────────┘    └──────────────────┘    └────────────────┘
```

### Chi tiết từng bước:

#### Bước 1: Thêm vào giỏ hàng (Trang chi tiết khóa học)

**Frontend làm gì:**
- User ấn "Thêm vào giỏ" → gọi `useCartStore().addItem()` → lưu vào **localStorage** qua Zustand persist
- Dữ liệu cart item: `{ courseId, title, instructorName, thumbnailUrl, price, type: 'FULL_COURSE' }`
- Nếu mua chương lẻ: `type: 'CHAPTER'`, thêm `chapterId`, giá lấy từ chapter (không phải course)
- Icon giỏ hàng trên navbar tự động cập nhật số lượng qua `useCartStore((s) => s.itemCount())`

**Tại sao lưu localStorage trước?** Để khách (chưa đăng nhập) vẫn có thể duyệt và thêm vào giỏ. Giỏ hàng tồn tại khi refresh trang.

#### Bước 2: Trang giỏ hàng

**Frontend làm gì:**
- **Khách (chưa login):** hiển thị items từ `useCartStore` (localStorage)
- **Đã đăng nhập:** khi mount trang, merge localStorage → server qua `POST /cart/merge`, sau đó hiển thị từ `GET /cart`
- Mã giảm giá: nhập mã → `POST /cart/apply-coupon` → hiển thị số tiền giảm
- Nút "Thanh toán": nếu khách → chuyển tới `/login`, nếu đã login → chuyển tới `/checkout`

**Backend xử lý (POST /cart/merge):**
- Nhận `{ items: [{ courseId, chapterId? }] }` từ localStorage
- Với mỗi item: kiểm tra khóa học tồn tại + đã publish, chưa ghi danh, xác định giá từ DB
- Bỏ qua item trùng, thêm item mới vào DB
- Trả về giỏ hàng sau merge

**Backend xử lý (POST /cart/apply-coupon):**
- Kiểm tra mã coupon: tồn tại, còn hoạt động, chưa hết hạn, chưa vượt giới hạn sử dụng
- Tính discount theo loại coupon (PERCENTAGE hoặc FIXED_AMOUNT)
- Trả `{ coupon, discount, subtotal, total }` — chỉ xem trước, chưa áp dụng thật

#### Bước 3: Trang xác nhận thanh toán (Checkout)

**Frontend làm gì:**
- Đợi auth store hydrate xong (`useAuthHydrated`), nếu chưa login → redirect tới `/login`
- Load giỏ hàng từ server qua `useServerCart()` → hiển thị tóm tắt đơn hàng
- Đọc coupon từ `sessionStorage('sslm-coupon')` (cart page đã lưu)
- Checkbox đồng ý điều khoản → bật nút "Xác nhận thanh toán"
- Ấn "Xác nhận" → gọi `useCreateOrder(couponCode?)` mutation

**Backend xử lý (POST /orders):**
1. Lấy cart items từ DB
2. Kiểm tra lại tất cả items (khóa học vẫn publish?)
3. Tính `totalAmount` từ giá trong DB (**không bao giờ tin giá từ frontend**)
4. Áp dụng coupon nếu có → tính `discountAmount`
5. Tạo order trong **transaction**: bản ghi order + order items + ghi nhận coupon usage + xóa giỏ hàng
6. Sinh `orderCode` = `SSLM{YYYYMMDD}{5-chữ-số}` (ví dụ: `SSLM2026032100123`)
7. Sinh thông tin thanh toán: thông tin ngân hàng + URL mã QR VietQR
8. Trả về `{ order, payment }`

**Frontend sau khi tạo order thành công:**
- Lưu `payment` info vào `sessionStorage('sslm-payment-${orderId}')`
- Xóa giỏ hàng localStorage (`useCartStore.getState().clearCart()`)
- Chuyển tới `/payment/${orderId}`

#### Bước 4: Trang thanh toán (Payment)

**Frontend làm gì:**
- Đọc `orderId` từ URL params
- `useOrderDetail(orderId)` → lấy dữ liệu đơn hàng (số tiền, trạng thái, thời hạn)
- Thông tin thanh toán: ưu tiên từ API response (`order.payment` cho đơn PENDING), fallback `sessionStorage`
- Mã QR: `<img src={payment.qrUrl} />` — VietQR tạo ảnh QR qua URL
- Thông tin ngân hàng: tên NH, số TK, chủ TK, nội dung CK (orderCode), số tiền
- Nút "Sao chép" cho từng trường
- **Đếm ngược:** hook `useCountdown(expiresAt)` custom, cập nhật mỗi 1 giây
- **Polling trạng thái:** `useOrderStatus(orderId)` với `refetchInterval: 5000` (5 giây/lần), tự dừng khi COMPLETED/EXPIRED
- Nút quay lại → về trang chi tiết đơn hàng
- 3 trạng thái hiển thị: Đang chờ (spinner), Thành công (nút "Bắt đầu học"), Hết hạn (nút "Quay lại khám phá")

**Backend xử lý (GET /orders/:id):**
- Trả order kèm items
- **Với đơn PENDING:** trả thêm `payment` info (thông tin NH + QR URL) để trang thanh toán hoạt động mà không cần sessionStorage

**Backend xử lý (GET /orders/:id/status):**
- Trả `{ status, paidAt }` — endpoint nhẹ dành cho polling

#### Bước 5: Xác nhận thanh toán qua Webhook

**Luồng: User chuyển tiền → Ngân hàng thông báo SePay → SePay gọi webhook backend:**

**Backend xử lý (POST /webhooks/sepay):**
1. Xác thực API key từ header `Authorization: Apikey <key>`
2. Chỉ xử lý giao dịch chuyển vào (`transferType === 'in'`)
3. Trích xuất mã đơn hàng từ nội dung chuyển khoản bằng regex `/SSLM\d{13}/i`
4. Tìm đơn hàng PENDING theo `orderCode`
5. Kiểm tra `transferAmount >= order.finalAmount`
6. Hoàn thành đơn hàng trong **transaction:**
   - Cập nhật trạng thái sang `COMPLETED` + ghi `paidAt`
   - Tạo enrollment (FULL cho mua cả khóa, PARTIAL cho mua chương lẻ)
   - Tăng `course.totalStudents` (cả mua full và mua chương lần đầu)
   - Tạo bản ghi earning cho giảng viên (tính hoa hồng theo tier)
7. Trả `{ success: true }` — SePay yêu cầu response 2xx

**Frontend phát hiện thanh toán thành công:**
- `useOrderStatus` polling mỗi 5 giây phát hiện `status === 'COMPLETED'`
- Polling tự dừng (trả `false` cho `refetchInterval`)
- UI chuyển sang trạng thái thành công với nút "Bắt đầu học"

#### Bước 6: Chi tiết đơn hàng

**Frontend làm gì:**
- Hiển thị: mã đơn, badge trạng thái, ngày tạo, danh sách items, số tiền
- Đơn PENDING → nút "Tiếp tục thanh toán" → `/payment/${orderId}`
- Đơn COMPLETED → nút "Bắt đầu học" → `/my-learning`

---

## 2. Kiến trúc giỏ hàng kép (Guest vs Authenticated)

### Mô hình hoạt động:

```
Khách (chưa login):
  Trang khóa học → addToCart() → Zustand store → localStorage ('sslm-cart')
  Trang giỏ hàng → đọc từ useCartStore → hiển thị items local
  Ấn "Thanh toán" → chuyển tới /login

Đã đăng nhập:
  Trang khóa học → addToCart() → Zustand store → localStorage
  Trang giỏ hàng mount → useMergeCart (localStorage → POST /cart/merge) → xóa local store
  Trang giỏ hàng → useServerCart (GET /cart) → hiển thị items từ server
  Checkout → useServerCart → đặt hàng → POST /orders
```

### Luồng merge (chạy 1 lần duy nhất khi mount trang giỏ hàng):

```typescript
const hasMerged = useRef(false);
useEffect(() => {
  if (isAuthenticated && localItems.length > 0 && !hasMerged.current) {
    hasMerged.current = true;
    mergeCart.mutate(localItems.map(i => ({ courseId: i.courseId, chapterId: i.chapterId })));
  }
}, [isAuthenticated]);
```

**Tại sao dùng `useRef`?** Ngăn merge lặp khi component re-render. Sau merge thành công, `clearCart()` xóa localStorage nên điều kiện `localItems.length > 0` cũng tự ngăn merge lại.

---

## 3. Định dạng mã đơn hàng & tương thích ngân hàng

### Vấn đề
Định dạng cũ: `SSLM-mn07j2qef38m` (base36 timestamp + random)
- Ngân hàng **tự động xóa ký tự đặc biệt** trong nội dung chuyển khoản
- `SSLM-mn07j2qef38m` → `SSLMmn07j2qef38m` trong hệ thống NH
- Regex webhook `/SSLM-[a-z0-9]+/` không match được

### Giải pháp
Định dạng mới: `SSLM2026032100123` (ngày + 5 số)
- Toàn bộ chữ và số, không có ký tự đặc biệt
- Dễ đọc: chứa ngày tháng
- Regex: `/SSLM\d{13}/` — chính xác 4 chữ cái + 13 chữ số
- Ngân hàng không thể xóa bất kỳ ký tự nào

---

## 4. Sửa lỗi DTO Webhook SePay (400 Bad Request)

### Vấn đề
Backend sử dụng `forbidNonWhitelisted: true` trong global ValidationPipe.
SePay gửi thêm các trường không có trong DTO (`id`, `subAccount`, `accumulated`, `code`, `description`) → backend trả **400 Bad Request**.

### Giải pháp
Thêm tất cả trường mà SePay có thể gửi vào `SepayWebhookDto` với `@IsOptional()`:
```typescript
export class SepayWebhookDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() gateway!: string;
  @IsString() transactionDate!: string;
  @IsString() accountNumber!: string;
  @IsOptional() @IsString() subAccount?: string | null;
  @IsString() transferType!: string;
  @Transform(({ value }) => typeof value === 'string' ? parseFloat(value) : value)
  @IsNumber() transferAmount!: number;
  @IsOptional() @IsNumber() accumulated?: number;
  @IsOptional() @IsString() code?: string | null;
  @IsString() content!: string;
  @IsOptional() @IsString() referenceCode?: string;
  @IsOptional() @IsString() description?: string;
}
```

Thêm `@Transform` cho `transferAmount` phòng trường hợp SePay gửi dạng string.

---

## 5. Race Condition: Auth Hydration

### Vấn đề
Nhiều trang (checkout, wishlist) kiểm tra `isAuthenticated` ngay khi mount để redirect.
Nhưng Zustand store hydrate từ `sessionStorage` **bất đồng bộ** — render đầu tiên luôn có `isAuthenticated = false`.

```
Trang mount → isAuthenticated = false (chưa hydrate)
            → useServerCart enabled: false → isLoading: false, data: undefined
            → items = [] → "giỏ hàng trống" → redirect về /cart
            → 50ms sau: store hydrate → isAuthenticated = true (đã quá muộn!)
```

### Giải pháp
Dùng hook `useAuthHydrated()` để đợi store hydrate xong:
```typescript
const hydrated = useAuthHydrated();
const { isAuthenticated } = useAuthStore();

// Không redirect cho tới khi hydrate xong
useEffect(() => {
  if (hydrated && !isAuthenticated) router.push('/login');
}, [hydrated, isAuthenticated]);

// Hiển thị skeleton trong lúc hydrating
if (!hydrated || !isAuthenticated || isLoading) return <Skeleton />;
```

---

## 6. Race Condition: Redirect sau khi tạo order

### Vấn đề
Sau khi `POST /orders` thành công:
1. Hook `useCreateOrder` chạy `onSuccess` → xóa giỏ hàng + invalidate cart query
2. Cart query refetch → giỏ trống → `cartEmpty = true` → redirect về `/cart`
3. Component `onSuccess` (router.push tới `/payment`) chạy sau → **nhưng đã redirect rồi!**

### Giải pháp
Thêm flag `orderInProgress` vào điều kiện redirect:
```typescript
const orderInProgress = createOrder.isPending || createOrder.isSuccess;
const cartEmpty = isFetched && items.length === 0 && !orderInProgress;
```
Khi order đang tạo hoặc đã tạo xong → **không redirect** dù giỏ trống, để callback `onSuccess` kịp push sang trang payment.

---

## 7. Luồng mua chương lẻ

### Bổ sung trong phase này
Trang chi tiết khóa học hiển thị giá chương với nút "Mua chương":
```
Chapter 1                    🛒 5.000 đ    3 bài học
Chapter 2    [Xem trước]                   1 bài học
```

**Frontend:** `onAddChapterToCart(chapter)` thêm vào giỏ với `type: 'CHAPTER'` và `chapterId`

**Backend (POST /cart/items):** Kiểm tra chapter tồn tại, có giá, chưa mua

**Backend (webhook completeOrder):** Mua chương tạo enrollment PARTIAL + tăng `totalStudents` (chỉ lần đầu)

---

## 8. Lưu trữ thông tin thanh toán

### Vấn đề
`POST /orders` trả `{ order, payment }` với thông tin ngân hàng + URL QR.
Nhưng `GET /orders/:id` ban đầu chỉ trả order data — không có payment info.
Khi user ấn "Tiếp tục thanh toán" từ trang chi tiết đơn hàng → trang payment không có thông tin NH.

### Giải pháp (2 tầng)
1. **Backend:** `GET /orders/:id` giờ trả thêm `payment` info cho đơn PENDING
2. **Frontend fallback:** trang payment thử API response trước, sau đó sessionStorage
```typescript
const apiPayment = orderData?.data?.payment;   // Từ GET /orders/:id
const storedPayment = sessionStorage.get(...);  // Từ POST /orders (lúc tạo)
const payment = apiPayment ?? storedPayment;
```

---

## 9. Navbar: Cart + Wishlist luôn hiển thị

### Vấn đề cũ
- Icon giỏ hàng chỉ hiển thị khi `isAuthenticated` → khách thêm vào giỏ nhưng không thấy icon
- Sau login + merge, localStorage bị xóa → `useCartStore.itemCount() = 0` nhưng server cart có items → count = 0
- Không có icon Wishlist trên navbar

### Giải pháp

**Cart icon luôn hiển thị** (di chuyển ra ngoài block `isAuthenticated`):
```typescript
// Cart count: guest dùng localStorage, auth dùng server
const localCartCount = useCartStore((s) => s.itemCount());
const { data: serverCartData } = useServerCart();
const serverCartCount = serverCartData?.data?.items?.length ?? 0;
const cartCount = isAuthenticated ? serverCartCount : localCartCount;
```

**Wishlist icon với count badge** (chỉ cho user đã login):
```typescript
const { data: wishlistData } = useWishlist();
const wishlistCount = wishlistData?.data?.length ?? 0;
```

**Thêm vào giỏ không cần login** — bỏ `if (!isAuthenticated) router.push('/login')` trong `handleAddToCart` trên trang chi tiết khóa học. Guest thêm thoải mái, chỉ redirect login khi ấn "Thanh toán".

---

## 10. Wishlist "Thêm vào giỏ" hoạt động đúng

### Vấn đề cũ
Nút "Thêm vào giỏ" trên trang wishlist chỉ gọi `useCartStore().addItem()` (localStorage) mà không gọi server API → giỏ hàng server không có item, không có toast feedback.

### Giải pháp
Gọi cả server + local + toast:
```typescript
addCartItem.mutate(
  { courseId: item.course.id },
  {
    onSuccess: () => {
      addToCart({ ... }); // Zustand localStorage
      toast.success(t('addedToCart'));
    },
  },
);
```

---

## Tóm tắt files

### Tạo mới (6 files)
| File | Mục đích |
|------|----------|
| `shared-hooks/services/cart.service.ts` | API giỏ hàng: get, add, remove, clear, merge, coupon |
| `shared-hooks/services/order.service.ts` | API đơn hàng: create, history, detail, status |
| `shared-hooks/services/wishlist.service.ts` | API yêu thích: list, add, remove |
| `shared-hooks/queries/use-cart.ts` | 6 hooks: useServerCart, useAddCartItem, useRemoveCartItem, useClearCart, useMergeCart, useApplyCoupon |
| `shared-hooks/queries/use-orders.ts` | 4 hooks: useCreateOrder, useOrders, useOrderDetail, useOrderStatus (polling) |
| `shared-hooks/queries/use-wishlist.ts` | 3 hooks: useWishlist, useAddToWishlist, useRemoveFromWishlist |

### Sửa đổi (17 files)
| File | Thay đổi |
|------|----------|
| `shared-hooks/services/index.ts` | Export 3 service mới |
| `shared-hooks/index.ts` | Export 13 hooks mới + 3 services |
| `cart/page.tsx` | Viết lại: server sync, merge, coupon, wishlist button, sub-components |
| `checkout/page.tsx` | Viết lại: tạo order, auth hydration guard, race condition fix |
| `payment/[orderId]/page.tsx` | Viết lại: QR, countdown, polling, back nav, API payment fallback |
| `orders/page.tsx` | Viết lại: dữ liệu API, phân trang |
| `orders/[orderId]/page.tsx` | Viết lại: chi tiết động, CTA tiếp tục thanh toán/học |
| `wishlist/page.tsx` | Viết lại: dữ liệu API, xóa, thêm vào giỏ (server + local + toast) |
| `courses/[slug]/page.tsx` | Thêm mua chương lẻ, bỏ redirect login khi add to cart |
| `navigation/navbar.tsx` | Cart icon luôn hiển thị, server cart count, wishlist icon + count |
| `course/detail/types.ts` | Thêm `price` vào ApiChapter |
| `course/detail/course-curriculum.tsx` | Nút giá chương + onAddChapterToCart callback |
| `orders/orders.service.ts` | Định dạng mã order mới + trả payment info cho PENDING |
| `orders/webhooks.service.ts` | Regex mới + tăng totalStudents khi mua chương |
| `orders/dto/sepay-webhook.dto.ts` | Thêm tất cả fields SePay để fix 400 |
| `messages/vi.json` | ~18 keys mới |
| `messages/en.json` | ~18 keys mới |

---

## Bài học rút ra

1. **Auth hydration phá vỡ logic SSR** — Zustand persist store hydrate bất đồng bộ. Bất kỳ kiểm tra `isAuthenticated` nào khi mount đều sẽ `false` lần đầu. Luôn dùng `useAuthHydrated()` trước khi quyết định dựa trên auth.

2. **Side-effect của mutation chạy trước callback component** — `useCreateOrder` hook `onSuccess` (xóa giỏ) chạy trước `mutate()` `onSuccess` (redirect). Logic redirect phải loại trừ `createOrder.isPending || createOrder.isSuccess`.

3. **Ngân hàng xóa ký tự đặc biệt** — Mã đơn hàng phải toàn chữ-số. `SSLM-xxx` bị NH biến thành `SSLMxxx`. Chỉ dùng chữ và số sau prefix.

4. **`forbidNonWhitelisted` phá webhook** — Service bên ngoài (SePay) gửi thêm fields. DTO phải khai báo TẤT CẢ fields có thể có dạng optional, nếu không global ValidationPipe sẽ reject.

5. **Thông tin thanh toán cần lưu trên server** — sessionStorage chỉ tồn tại trong tab, mất khi đóng tab. Backend phải trả payment info cho đơn PENDING để "Tiếp tục thanh toán" hoạt động từ bất kỳ tab/session nào.

6. **Giỏ hàng kép cần merge cẩn thận** — Merge localStorage → server phải chạy 1 lần duy nhất (`useRef`), và xảy ra trước khi hiển thị server cart. Xóa localStorage sau merge thành công để tránh merge lại.

7. **Guest phải thêm được vào giỏ** — Không redirect login khi "Add to Cart". Guest lưu vào localStorage, chỉ cần login khi ấn "Thanh toán". Sau login, cart page tự merge lên server.

8. **Cart count trên navbar phải đúng nguồn** — Guest đọc từ localStorage, authenticated đọc từ server (`useServerCart`). Sau merge, localStorage rỗng nên nếu vẫn đọc local → count = 0 sai.
