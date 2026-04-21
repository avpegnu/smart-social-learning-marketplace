# 01 — Cart & Wishlist: Price Lookup, Conflict Detection, Merge, và Wishlist CRUD

> Giải thích chi tiết CartService — cart CRUD với price security, conflict detection giữa
> full course vs chapters, localStorage merge pattern, và wishlist management.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

CartService quản lý 2 domain liên quan: **giỏ hàng** (mua khóa học) và **wishlist** (lưu yêu thích). Gom chung vì cùng là "saved items" — user lưu course để mua sau hoặc mua ngay.

```
CartService — 8 methods:

Cart:
  ├── getCart(userId)                    → Items + subtotal
  ├── addItem(userId, dto)              → Add with 5 validations
  ├── removeItem(userId, itemId)        → Remove single item
  ├── clearCart(userId)                 → Remove all items
  └── mergeCart(userId, items)          → Merge localStorage after login

Wishlist:
  ├── getWishlist(userId, pagination)   → Paginated list
  ├── addToWishlist(userId, courseId)   → Add with duplicate check
  └── removeFromWishlist(userId, courseId)
```

### 1.2 Module Structure

```
cart/
├── cart.module.ts          → imports CouponsModule (cho apply-coupon)
├── cart.controller.ts      → 6 endpoints (/api/cart/*)
├── wishlist.controller.ts  → 3 endpoints (/api/wishlists/*)
├── cart.service.ts         → Cart + Wishlist business logic
├── cart.service.spec.ts    → 14 tests
└── dto/
    ├── add-cart-item.dto.ts
    └── merge-cart.dto.ts
```

### 1.3 Dependencies

```
CartModule
  ├── PrismaService     → Database
  └── CouponsModule     → apply-coupon endpoint delegates to CouponsService
```

---

## 2. PRICE SECURITY — LOOKUP TỪ DB

### 2.1 Vấn đề

```typescript
// ❌ Plan ban đầu — price từ DTO (NGUY HIỂM!)
export class AddCartItemDto {
  courseId: string;
  price: number;    // Frontend gửi giá → có thể manipulate!
}

// Attacker gửi: { courseId: "clx...", price: 0 }
// → Mua khóa 499,000₫ với giá 0₫
```

### 2.2 Solution — Lookup từ DB

```typescript
// ✅ Implementation thực tế — KHÔNG CÓ price trong DTO
export class AddCartItemDto {
  courseId!: string;
  chapterId?: string;   // null = full course, có value = mua lẻ chapter
  // KHÔNG CÓ price field!
}

// Service tự lookup giá:
if (dto.chapterId) {
  const chapter = await this.prisma.chapter.findUnique({ where: { id: dto.chapterId } });
  price = chapter.price;        // Giá từ DB, không từ frontend
} else {
  const course = await this.prisma.course.findFirst({ where: { id: dto.courseId } });
  price = course.price;         // Giá từ DB
}
```

**Nguyên tắc bảo mật:**
- **Never trust client-side data for pricing.** Frontend dùng giá hiển thị, backend tính giá thực.
- Pattern giống các payment gateway: Stripe, PayPal đều yêu cầu backend calculate amount.

---

## 3. CONFLICT DETECTION — 5 VALIDATION GATES

### 3.1 Khi thêm item vào cart

```
addItem(userId, dto):
  Gate 1: Course exists + PUBLISHED + not deleted
  Gate 2: Not buying own course (instructorId !== userId)
  Gate 3: Not already FULLY enrolled
  Gate 4a: If chapter → chapter has price + not already purchased + full course not in cart
  Gate 4b: If full course → remove existing chapter items of same course
  Gate 5: Not duplicate in cart
```

### 3.2 Full Course vs Chapter Conflict

```
Scenario 1: User có chapter A trong cart → thêm FULL course
  → Auto-replace: xóa chapter items, thêm full course
  → Tốt hơn cho user (full course rẻ hơn tổng chapters)

Scenario 2: User có FULL course trong cart → thêm chapter A
  → Reject: throw FULL_COURSE_IN_CART
  → Logic: đã có cả khóa thì không cần mua lẻ

Scenario 3: User mua full course → đã enrolled FULL
  → Reject: throw ALREADY_ENROLLED

Scenario 4: User mua chapter → đã purchased chapter
  → Reject: throw CHAPTER_ALREADY_PURCHASED
```

### 3.3 Tại sao auto-replace cho Scenario 1?

```
User experience:
  Cart: [Chapter A: 79k] [Chapter B: 79k]
  User thêm Full Course: 499k
  → Cart: [Full Course: 499k]  (chapters tự xóa)
  → User tiết kiệm 158k - 499k = không cần mua lẻ

Nếu throw error thay vì auto-replace:
  → User phải manually xóa chapters → thêm full course → friction
  → Bad UX, user có thể bỏ checkout
```

---

## 4. MERGE CART — LOCALSTORAGE SAU LOGIN

### 4.1 Vấn đề

```
Guest (chưa login):
  → Thêm course vào cart → lưu localStorage (client-side)
  → Login hoặc register
  → Cart cần sync lên server

POST /api/cart/merge
Body: { items: [{ courseId: "c1" }, { courseId: "c2", chapterId: "ch1" }] }
```

### 4.2 Implementation — Try/Catch Loop

```typescript
async mergeCart(userId: string, items: MergeCartItemDto[]) {
  for (const item of items) {
    try {
      await this.addItem(userId, item);
    } catch {
      // Skip items that fail validation
      continue;
    }
  }
  return this.getCart(userId);
}
```

**Tại sao silently skip errors?**
- localStorage cart có thể outdated (course đã unpublish, user đã enrolled).
- Merge là best-effort: thêm được bao nhiêu thì thêm.
- Return cart hiện tại sau merge → frontend hiển thị kết quả.

---

## 5. WISHLIST — SEPARATE CONTROLLER, SAME MODULE

### 5.1 Tại sao tách controller nhưng cùng module?

```
// cart.controller.ts    → @Controller('cart')     → /api/cart/*
// wishlist.controller.ts → @Controller('wishlists') → /api/wishlists/*

// Cùng module vì:
// 1. Cùng domain "saved items"
// 2. Cùng dùng CartService (shared PrismaService)
// 3. Không cần DI cross-module

// Tách controller vì:
// 1. URL path khác nhau (/cart vs /wishlists)
// 2. Swagger tags khác nhau
// 3. File nhỏ, dễ navigate
```

### 5.2 Wishlist Methods

```typescript
// Add: Check duplicate trước khi create
async addToWishlist(userId: string, courseId: string) {
  const existing = await this.prisma.wishlist.findUnique({
    where: { userId_courseId: { userId, courseId } },   // @@unique
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_IN_WISHLIST' });

  return this.prisma.wishlist.create({ data: { userId, courseId } });
}

// Remove: deleteMany (idempotent, không throw nếu không tồn tại)
async removeFromWishlist(userId: string, courseId: string) {
  await this.prisma.wishlist.deleteMany({
    where: { userId, courseId },
  });
}
```

**Tại sao `deleteMany` thay vì `delete`?**
- `delete` cần unique identifier → phải tìm ID trước.
- `deleteMany` với compound filter → 1 query, idempotent (không throw nếu đã xóa).

---

## 6. APPLY COUPON — PREVIEW PATTERN

### 6.1 Flow

```
Frontend cart page:
  [Nhập mã giảm giá: REACT2024] [Áp dụng]
                    ↓
  POST /api/cart/apply-coupon { code: "REACT2024" }
                    ↓
  CartController delegates to CouponsService.validateAndCalculateDiscount()
                    ↓
  Response: { coupon: { code }, discount: 99800, subtotal: 499000, total: 399200 }
                    ↓
  Frontend hiển thị discount preview (Zustand state)
                    ↓
  User nhấn "Thanh toán" → POST /api/orders { couponCode: "REACT2024" }
  → Coupon re-validated + applied trong order creation
```

**Coupon KHÔNG lưu server-side trên cart** — chỉ preview. Actual application xảy ra khi tạo order. Tại sao:
- Tránh stale coupon state (coupon hết hạn giữa lúc apply và checkout).
- Re-validate mỗi lần checkout đảm bảo consistency.
- Frontend chỉ cần lưu `code` string trong Zustand, gửi lại khi checkout.
