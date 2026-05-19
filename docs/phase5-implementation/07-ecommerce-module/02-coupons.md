# 02 — Coupons: Instructor CRUD, 6-Gate Validation, và Discount Calculation

> Giải thích CouponsService — instructor tạo/quản lý coupon, 6-step validation flow,
> PERCENTAGE vs FIXED_AMOUNT calculation, maxDiscount cap, và per-user limit qua JOIN.

---

## 1. TỔNG QUAN

### 1.1 Dual Role

CouponsService phục vụ 2 use cases khác nhau:

```
Instructor side (CRUD):
  ├── create(instructorId, dto)              → Tạo coupon + link courses
  ├── getInstructorCoupons(instructorId)     → List coupons
  ├── update(couponId, instructorId, dto)    → Sửa coupon (except code)
  └── deactivate(couponId, instructorId)     → Soft delete (isActive: false)

Student side (Validation — called by CartController + OrdersService):
  └── validateAndCalculateDiscount(code, userId, cartItems)
      → 6-gate validation → return { couponId, discount }
```

### 1.2 Tại sao CouponsService exported?

```
CouponsModule exports CouponsService
  → CartModule imports CouponsModule (apply-coupon preview)
  → OrdersModule imports CouponsModule (checkout validation)
```

---

## 2. INSTRUCTOR COUPON CRUD

### 2.1 Create — 3 Validations

```typescript
async create(instructorId: string, dto: CreateCouponDto) {
  // ① Applicable courses phải thuộc instructor
  if (dto.applicableCourseIds?.length) {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: dto.applicableCourseIds }, instructorId },
    });
    if (courses.length !== dto.applicableCourseIds.length) {
      throw new BadRequestException({ code: 'INVALID_COURSE_IDS' });
    }
  }

  // ② PERCENTAGE value phải 1-100
  if (dto.type === 'PERCENTAGE' && (dto.value < 1 || dto.value > 100)) {
    throw new BadRequestException({ code: 'INVALID_PERCENTAGE_VALUE' });
  }

  // ③ Start date phải trước end date
  if (new Date(dto.startsAt) >= new Date(dto.expiresAt)) {
    throw new BadRequestException({ code: 'INVALID_DATE_RANGE' });
  }
}
```

### 2.2 DTO Field Mapping — startsAt/expiresAt vs startDate/endDate

```
DTO (frontend-friendly):     Prisma schema (DB):
  startsAt: string             startDate: DateTime
  expiresAt: string            endDate: DateTime

Service converts:
  startDate: new Date(dto.startsAt)
  endDate: new Date(dto.expiresAt)
```

**Tại sao khác tên?**
- DTO dùng `At` suffix (convention cho ISO date strings: `startsAt`, `expiresAt`).
- Prisma dùng `Date` suffix (convention cho DateTime fields: `startDate`, `endDate`).
- Service layer bridge giữa 2 conventions.

### 2.3 Update — OmitType Pattern

```typescript
// Code không thể sửa (unique identifier, đã phát cho users)
export class UpdateCouponDto extends PartialType(
  OmitType(CreateCouponDto, ['code'] as const)
) {}
```

`OmitType` từ `@nestjs/swagger`: loại bỏ `code` field khỏi DTO. `PartialType` làm tất cả fields còn lại optional.

### 2.4 Deactivate vs Delete

```typescript
async deactivate(couponId: string, instructorId: string) {
  return this.prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: false },    // Soft delete
  });
}
```

**Tại sao không hard delete?**
- Coupon đã sử dụng → `CouponUsage` records tham chiếu `couponId`.
- Hard delete → cascading issues hoặc orphan records.
- Soft delete giữ data cho analytics (coupon nào hiệu quả nhất).

---

## 3. 6-GATE VALIDATION

### 3.1 Flow

```
validateAndCalculateDiscount(code, userId, cartItems):

  Gate 1: Coupon exists + isActive
    → COUPON_NOT_FOUND

  Gate 2: Date range (startDate <= now <= endDate)
    → COUPON_EXPIRED

  Gate 3: Total usage (usageCount < usageLimit)
    → COUPON_USAGE_EXCEEDED

  Gate 4: Per-user usage (user's count < maxUsesPerUser)
    → COUPON_USER_LIMIT_EXCEEDED

  Gate 5: Applicable courses (coupon matches cart items)
    → COUPON_NOT_APPLICABLE

  Gate 6: Minimum order amount (subtotal >= minOrderAmount)
    → BELOW_MINIMUM_ORDER

  → Calculate discount → return { couponId, discount }
```

### 3.2 Gate 4 — Per-User Check qua JOIN

```typescript
// CouponUsage không có userId field!
// Nhưng có orderId → Order có userId
// → JOIN qua relation

const userUsageCount = await this.prisma.couponUsage.count({
  where: {
    couponId: coupon.id,
    order: { userId },      // Prisma relation filter
  },
});
```

**Prisma generates SQL:**
```sql
SELECT COUNT(*) FROM coupon_usages cu
  JOIN orders o ON cu.order_id = o.id
  WHERE cu.coupon_id = ? AND o.user_id = ?
```

**Tại sao không thêm `userId` vào CouponUsage?**
- Denormalization không cần thiết — JOIN nhẹ, CouponUsage ít records.
- Prisma relation filter syntax clean: `order: { userId }`.
- Giữ schema normalized, tránh inconsistency.

---

## 4. DISCOUNT CALCULATION

### 4.1 PERCENTAGE vs FIXED_AMOUNT

```typescript
let discount: number;

if (coupon.type === 'PERCENTAGE') {
  discount = Math.round(applicableAmount * (coupon.value / 100));
  // Cap tại maxDiscount
  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }
} else {
  // FIXED_AMOUNT: giảm tối đa = applicable amount (không giảm âm)
  discount = Math.min(coupon.value, applicableAmount);
}
```

### 4.2 Ví dụ

```
PERCENTAGE coupon: value=50, maxDiscount=200000
  Cart: 500,000₫
  Discount: 500,000 * 50% = 250,000₫
  Capped: min(250,000, 200,000) = 200,000₫ ✅

FIXED_AMOUNT coupon: value=100000
  Cart: 80,000₫
  Discount: min(100,000, 80,000) = 80,000₫ (không giảm quá giá trị cart)

PERCENTAGE coupon with applicableCourseIds:
  Cart: [Course A: 300k, Course B: 200k]
  Coupon chỉ apply cho Course A
  applicableAmount = 300,000₫
  Discount: 300,000 * 20% = 60,000₫ (chỉ tính trên Course A)
```

### 4.3 `Math.round` — Tại sao?

```
500000 * 0.2 = 100000.0       ← OK
499000 * 0.15 = 74850.0       ← OK
333333 * 0.1 = 33333.3        ← Floating point!

Math.round(33333.3) = 33333   ← VNĐ không có decimal
```

Tiền VNĐ luôn là số nguyên → `Math.round` xử lý floating point edge cases.
