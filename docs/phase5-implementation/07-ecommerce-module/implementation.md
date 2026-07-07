# Phase 5.7 — ECOMMERCE MODULE

> Cart, Wishlist, Orders, SePay Payment (QR), Enrollments, Coupons, Earnings, Withdrawals.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md` (Module 5 + Module 4 coupons/withdrawals)

---

## Mục lục

- [Step 1: Schema Migration](#step-1-schema-migration)
- [Step 2: Module Structure](#step-2-module-structure)
- [Step 3: DTOs](#step-3-dtos)
- [Step 4: Cart Service](#step-4-cart-service)
- [Step 5: Wishlist Service](#step-5-wishlist-service)
- [Step 6: Coupons Service (Instructor + Validation)](#step-6-coupons-service)
- [Step 7: Orders Service & Checkout Flow](#step-7-orders-service--checkout-flow)
- [Step 8: SePay Webhook](#step-8-sepay-webhook)
- [Step 9: Enrollments Service](#step-9-enrollments-service)
- [Step 10: Withdrawals Service](#step-10-withdrawals-service)
- [Step 11: Controllers](#step-11-controllers)
- [Step 12: Register Modules](#step-12-register-modules)
- [Step 13: Verify](#step-13-verify)

---

## Scope & Boundaries

### In scope (Phase 5.7):
- Cart CRUD (add/remove/get/clear, conflict detection, merge localStorage)
- Wishlist (add/remove/list)
- Coupon CRUD (instructor) + validation (6-step)
- Orders (create from cart, SePay QR payment, order history/detail, status polling)
- SePay webhook (payment confirmation → enrollment + earning creation)
- Enrollments (auto-created by webhook, check enrollment, my-learning list)
- Earnings (auto-created by webhook, commission tier calculation, 7-day hold)
- Withdrawals (instructor request, balance check, pending lock)

### Out of scope (later phases):
- Order expiry cron (PENDING → EXPIRED) → Phase 5.11 (Admin & Jobs)
- Earning status cron (PENDING → AVAILABLE after 7 days) → Phase 5.11
- Withdrawal approval/rejection → Phase 5.11 (Admin)
- Email receipt + notifications after payment → Phase 5.10

---

## Step 1: Schema Migration

**Migration `20260314150000_add_ecommerce_fields` — 4 fields added:**

```prisma
// Order — payment tracking
orderCode String  @unique @map("order_code")  // "SSLM-clx..." for SePay content
paidAt    DateTime? @map("paid_at")            // Timestamp when payment confirmed

// Coupon — per-user usage limit
maxUsesPerUser Int? @default(1) @map("max_uses_per_user")

// Earning — 7-day hold period
availableAt DateTime? @map("available_at")     // When earning becomes withdrawable
```

---

## Step 2: Module Structure

Tách thành **5 modules riêng biệt** theo CLAUDE.md structure:

**Trước khi implement — cập nhật `sepay.config.ts`:**

```typescript
// config/sepay.config.ts — thêm bankId
export const sepayConfig = registerAs('sepay', () => ({
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
  bankId: process.env.BANK_ID ?? 'MB',    // ← THÊM MỚI
}));
```

Thêm `BANK_ID=MB` vào `.env.example`.

```
src/modules/
├── cart/
│   ├── cart.module.ts
│   ├── cart.controller.ts
│   ├── wishlist.controller.ts        # Tách riêng file
│   ├── cart.service.ts
│   └── dto/
│       ├── add-cart-item.dto.ts
│       └── merge-cart.dto.ts
│
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── webhooks.controller.ts      # SePay webhook (public)
│   ├── webhooks.service.ts
│   └── dto/
│       ├── create-order.dto.ts
│       └── sepay-webhook.dto.ts
│
├── enrollments/
│   ├── enrollments.module.ts
│   ├── enrollments.controller.ts
│   └── enrollments.service.ts
│
├── coupons/
│   ├── coupons.module.ts
│   ├── coupons.controller.ts       # Instructor CRUD
│   ├── coupons.service.ts
│   └── dto/
│       ├── create-coupon.dto.ts
│       ├── update-coupon.dto.ts
│       └── apply-coupon.dto.ts
│
└── withdrawals/
    ├── withdrawals.module.ts
    ├── withdrawals.controller.ts   # Instructor requests
    ├── withdrawals.service.ts
    └── dto/
        └── create-withdrawal.dto.ts
```

Wishlist: đặt chung trong `cart/` module (cùng domain "saved items"), nhưng controller file riêng.

> **Dependency:** CartModule imports CouponsModule (cho apply-coupon endpoint).

---

## Step 3: DTOs

### 3.1 `cart/dto/add-cart-item.dto.ts`

```typescript
export class AddCartItemDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  chapterId?: string;  // null = mua cả khóa, có value = mua lẻ chapter
}
```

> **KHÔNG có `price` field.** Service tự lookup giá từ course/chapter trong DB — tránh frontend gửi giá sai.

### 3.2 `cart/dto/merge-cart.dto.ts`

```typescript
export class MergeCartItemDto {
  @IsString() courseId!: string;
  @IsOptional() @IsString() chapterId?: string;
}

export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  items!: MergeCartItemDto[];
}
```

> Merge localStorage cart sau khi login — frontend gửi array items đã lưu local.

### 3.3 `orders/dto/create-order.dto.ts`

```typescript
export class CreateOrderDto {
  @IsOptional()
  @IsString()
  couponCode?: string;
}
```

> Order tạo từ cart items hiện tại. Chỉ cần optional couponCode.

### 3.4 `orders/dto/sepay-webhook.dto.ts`

```typescript
export class SepayWebhookDto {
  @IsString() gateway!: string;
  @IsString() transactionDate!: string;
  @IsString() accountNumber!: string;
  @IsString() transferType!: string;
  @IsNumber() transferAmount!: number;
  @IsString() content!: string;
  @IsOptional() @IsString() referenceCode?: string;
}
```

### 3.5 `coupons/dto/create-coupon.dto.ts`

```typescript
export class CreateCouponDto {
  @IsString() @MinLength(4) @Matches(/^[A-Z0-9]+$/)
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;     // PERCENTAGE | FIXED_AMOUNT

  @IsNumber() @Min(0)
  value!: number;        // 20 (=20%) or 50000 (=50k VND)

  @IsOptional() @IsInt()
  usageLimit?: number;

  @IsOptional() @IsInt() @Min(1)
  maxUsesPerUser?: number;

  @IsOptional() @IsNumber() @Min(0)
  minOrderAmount?: number;

  @IsOptional() @IsNumber() @Min(0)
  maxDiscount?: number;    // Cap for PERCENTAGE type

  @IsOptional() @IsArray() @IsString({ each: true })
  applicableCourseIds?: string[];  // null = all instructor courses

  @IsDateString() startsAt!: string;
  @IsDateString() expiresAt!: string;
}
```

### 3.6 `coupons/dto/update-coupon.dto.ts`

```typescript
export class UpdateCouponDto extends PartialType(
  OmitType(CreateCouponDto, ['code'] as const)   // Code cannot be changed
) {}
```

### 3.7 `coupons/dto/apply-coupon.dto.ts`

```typescript
export class ApplyCouponDto {
  @IsString() @MinLength(1)
  code!: string;
}
```

### 3.8 `withdrawals/dto/create-withdrawal.dto.ts`

```typescript
export class BankInfoDto {
  @IsString() bankName!: string;
  @IsString() accountNumber!: string;
  @IsString() accountName!: string;
}

export class CreateWithdrawalDto {
  @IsNumber() @Min(200000)
  amount!: number;

  @ValidateNested()
  @Type(() => BankInfoDto)
  bankInfo!: BankInfoDto;
}
```

---

## Step 4: Cart Service

### `cart/cart.service.ts`

```typescript
@Injectable()
export class CartService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            price: true, instructorId: true,
            instructor: { select: { fullName: true } },
          },
        },
        chapter: { select: { id: true, title: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return { items, subtotal };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    // 1. Validate course exists + is published
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, status: 'PUBLISHED', deletedAt: null },
    });
    if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

    // 2. Can't buy own course
    if (course.instructorId === userId) {
      throw new BadRequestException({ code: 'CANNOT_BUY_OWN_COURSE' });
    }

    // 3. Check already enrolled (FULL enrollment)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: dto.courseId } },
    });
    if (enrollment?.type === 'FULL') {
      throw new ConflictException({ code: 'ALREADY_ENROLLED' });
    }

    // 4. Determine price from DB (NOT from frontend)
    let price: number;
    let chapterId: string | null = null;

    if (dto.chapterId) {
      // Buying individual chapter
      const chapter = await this.prisma.chapter.findUnique({ where: { id: dto.chapterId } });
      if (!chapter || !chapter.price) {
        throw new BadRequestException({ code: 'CHAPTER_NOT_PURCHASABLE' });
      }

      // Check already purchased chapter
      const purchased = await this.prisma.chapterPurchase.findUnique({
        where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
      });
      if (purchased) throw new ConflictException({ code: 'CHAPTER_ALREADY_PURCHASED' });

      // Check if full course already in cart
      const fullCourseInCart = await this.prisma.cartItem.findFirst({
        where: { userId, courseId: dto.courseId, chapterId: null },
      });
      if (fullCourseInCart) {
        throw new ConflictException({ code: 'FULL_COURSE_IN_CART' });
      }

      price = chapter.price;
      chapterId = dto.chapterId;
    } else {
      // Buying full course
      // Check if chapters of this course already in cart
      const chaptersInCart = await this.prisma.cartItem.findMany({
        where: { userId, courseId: dto.courseId, chapterId: { not: null } },
      });
      if (chaptersInCart.length > 0) {
        // Remove chapter items, replace with full course
        await this.prisma.cartItem.deleteMany({
          where: { userId, courseId: dto.courseId },
        });
      }

      price = course.price;
    }

    // 5. Check duplicate in cart
    const existing = await this.prisma.cartItem.findFirst({
      where: { userId, courseId: dto.courseId, chapterId },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_IN_CART' });

    return this.prisma.cartItem.create({
      data: { userId, courseId: dto.courseId, chapterId, price },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) throw new NotFoundException({ code: 'CART_ITEM_NOT_FOUND' });

    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
  }

  async mergeCart(userId: string, items: MergeCartItemDto[]) {
    for (const item of items) {
      try {
        await this.addItem(userId, item);
      } catch {
        // Skip items that fail validation (already enrolled, duplicate, etc.)
        continue;
      }
    }
    return this.getCart(userId);
  }
}
```

**Key design decisions:**

1. **Price from DB, not DTO** — Frontend gửi courseId/chapterId, service lookup `course.price` / `chapter.price`. Tránh manipulation.
2. **Conflict detection** — Full course vs chapters: nếu thêm full course khi chapters cùng course đã trong cart → auto-replace (tốt hơn cho user).
3. **`mergeCart` try/catch loop** — Skip invalid items silently khi merge từ localStorage sau login. User không cần biết items cũ đã invalid.

### Apply Coupon — Preview discount (không lưu server-side)

```typescript
// CartController delegates to CouponsService
async applyCoupon(userId: string, code: string) {
  const cart = await this.getCart(userId);
  if (cart.items.length === 0) throw new BadRequestException({ code: 'CART_EMPTY' });

  const cartItems = cart.items.map((item) => ({
    courseId: item.courseId,
    price: item.price,
  }));

  const { discount } = await this.couponsService.validateAndCalculateDiscount(
    code, userId, cartItems,
  );

  return {
    coupon: { code },
    discount,
    subtotal: cart.subtotal,
    total: cart.subtotal - discount,
  };
}
```

> `DELETE /api/cart/coupon` **không cần backend endpoint** — coupon state chỉ lưu ở frontend (Zustand). Khi user bỏ coupon → clear state client-side. Coupon thực sự được apply khi tạo order (`POST /api/orders { couponCode }`).

### Free Course Enrollment

```typescript
// Thêm vào CartService hoặc EnrollmentsService
async enrollFree(userId: string, courseId: string) {
  const course = await this.prisma.course.findFirst({
    where: { id: courseId, status: 'PUBLISHED', deletedAt: null, price: 0 },
  });
  if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
  if (course.instructorId === userId) {
    throw new BadRequestException({ code: 'CANNOT_ENROLL_OWN_COURSE' });
  }

  const existing = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_ENROLLED' });

  return this.prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.create({
      data: { userId, courseId, type: 'FULL' },
    });
    await tx.course.update({
      where: { id: courseId },
      data: { totalStudents: { increment: 1 } },
    });
    return enrollment;
  });
}
```

> Free courses bypass cart/order flow hoàn toàn. `POST /api/enrollments/free/:courseId`.

---

## Step 5: Wishlist Service

Đặt chung trong `cart/` module, **controller file riêng** (`wishlist.controller.ts`).

### `cart/cart.service.ts` — thêm wishlist methods

```typescript
// ==================== WISHLIST ====================

async getWishlist(userId: string, query: PaginationDto) {
  const [items, total] = await Promise.all([
    this.prisma.wishlist.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            price: true, avgRating: true, totalStudents: true,
            instructor: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.wishlist.count({ where: { userId } }),
  ]);
  return createPaginatedResult(items, total, query.page, query.limit);
}

async addToWishlist(userId: string, courseId: string) {
  const existing = await this.prisma.wishlist.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_IN_WISHLIST' });

  return this.prisma.wishlist.create({ data: { userId, courseId } });
}

async removeFromWishlist(userId: string, courseId: string) {
  await this.prisma.wishlist.deleteMany({
    where: { userId, courseId },
  });
}
```

---

## Step 6: Coupons Service

### `coupons/coupons.service.ts` — 2 parts: Instructor CRUD + Validation

```typescript
@Injectable()
export class CouponsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==================== INSTRUCTOR CRUD ====================

  async create(instructorId: string, dto: CreateCouponDto) {
    // Validate applicable courses belong to instructor
    if (dto.applicableCourseIds?.length) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: dto.applicableCourseIds }, instructorId },
        select: { id: true },
      });
      if (courses.length !== dto.applicableCourseIds.length) {
        throw new BadRequestException({ code: 'INVALID_COURSE_IDS' });
      }
    }

    // Validate discount value
    if (dto.type === 'PERCENTAGE' && (dto.value < 1 || dto.value > 100)) {
      throw new BadRequestException({ code: 'INVALID_PERCENTAGE_VALUE' });
    }

    // Validate dates
    if (new Date(dto.startsAt) >= new Date(dto.expiresAt)) {
      throw new BadRequestException({ code: 'INVALID_DATE_RANGE' });
    }

    const { applicableCourseIds, startsAt, expiresAt, ...couponData } = dto;

    return this.prisma.coupon.create({
      data: {
        ...couponData,
        startDate: new Date(startsAt),
        endDate: new Date(expiresAt),
        instructorId,
        ...(applicableCourseIds?.length && {
          couponCourses: {
            create: applicableCourseIds.map((courseId) => ({ courseId })),
          },
        }),
      },
      include: { couponCourses: true },
    });
  }

  async getInstructorCoupons(instructorId: string, query: PaginationDto) {
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { instructorId },
        include: { couponCourses: { include: { course: { select: { id: true, title: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.coupon.count({ where: { instructorId } }),
    ]);
    return createPaginatedResult(coupons, total, query.page, query.limit);
  }

  async update(couponId: string, instructorId: string, dto: UpdateCouponDto) {
    await this.verifyCouponOwnership(couponId, instructorId);

    const { applicableCourseIds, startsAt, expiresAt, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Update applicable courses if provided
      if (applicableCourseIds !== undefined) {
        await tx.couponCourse.deleteMany({ where: { couponId } });
        if (applicableCourseIds.length > 0) {
          await tx.couponCourse.createMany({
            data: applicableCourseIds.map((courseId) => ({ couponId, courseId })),
          });
        }
      }

      return tx.coupon.update({
        where: { id: couponId },
        data: {
          ...updateData,
          ...(startsAt && { startDate: new Date(startsAt) }),
          ...(expiresAt && { endDate: new Date(expiresAt) }),
        },
        include: { couponCourses: true },
      });
    });
  }

  async deactivate(couponId: string, instructorId: string) {
    await this.verifyCouponOwnership(couponId, instructorId);
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });
  }

  // ==================== VALIDATION (called by OrdersService) ====================

  async validateAndCalculateDiscount(
    code: string,
    userId: string,
    cartItems: { courseId: string | null; price: number }[],
  ): Promise<{ couponId: string; discount: number }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: { couponCourses: true },
    });

    // Gate 1: Coupon exists + active
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException({ code: 'COUPON_NOT_FOUND' });
    }

    // Gate 2: Date range
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new BadRequestException({ code: 'COUPON_EXPIRED' });
    }

    // Gate 3: Total usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException({ code: 'COUPON_USAGE_EXCEEDED' });
    }

    // Gate 4: Per-user usage limit
    if (coupon.maxUsesPerUser) {
      const userUsageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          order: { userId },  // JOIN through order to get userId
        },
      });
      if (userUsageCount >= coupon.maxUsesPerUser) {
        throw new BadRequestException({ code: 'COUPON_USER_LIMIT_EXCEEDED' });
      }
    }

    // Gate 5: Applicable courses
    const applicableCourseIds = coupon.couponCourses.map((cc) => cc.courseId);
    let applicableAmount: number;

    if (applicableCourseIds.length > 0) {
      // Only apply to matching courses
      applicableAmount = cartItems
        .filter((item) => item.courseId && applicableCourseIds.includes(item.courseId))
        .reduce((sum, item) => sum + item.price, 0);

      if (applicableAmount === 0) {
        throw new BadRequestException({ code: 'COUPON_NOT_APPLICABLE' });
      }
    } else {
      // Applies to all items (instructor's courses check done at creation)
      applicableAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
    }

    // Gate 6: Minimum order amount
    const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new BadRequestException({ code: 'BELOW_MINIMUM_ORDER' });
    }

    // Calculate discount
    let discount: number;
    if (coupon.type === 'PERCENTAGE') {
      discount = Math.round(applicableAmount * (coupon.value / 100));
      // Apply maxDiscount cap
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // FIXED_AMOUNT
      discount = Math.min(coupon.value, applicableAmount);
    }

    return { couponId: coupon.id, discount };
  }

  private async verifyCouponOwnership(couponId: string, instructorId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || coupon.instructorId !== instructorId) {
      throw new NotFoundException({ code: 'COUPON_NOT_FOUND' });
    }
    return coupon;
  }
}
```

**Key design decisions:**

1. **6-step validation** — Theo đúng API doc, check tuần tự. Throw error code cụ thể cho mỗi gate.
2. **Per-user check qua JOIN** — `couponUsage.count({ where: { couponId, order: { userId } } })` — Prisma relation filter, không cần userId trên CouponUsage.
3. **`maxDiscount` cap** — PERCENTAGE discount có thể bị cap bởi `maxDiscount` (ví dụ: giảm 50% nhưng tối đa 100k).
4. **`Math.round`** — Tránh floating point cents issue.
5. **Soft delete (deactivate)** — `isActive: false` thay vì delete, giữ data cho analytics.

---

## Step 7: Orders Service & Checkout Flow

### Flow tổng quan

```
Cart items → [CreateOrder] → Order(PENDING) + SePay QR
                                    ↓
                            User chuyển khoản
                                    ↓
                            SePay webhook → [CompleteOrder]
                                    ↓
                          Order(COMPLETED) + Enrollments + Earnings
```

### `orders/orders.service.ts`

```typescript
@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CouponsService) private readonly couponsService: CouponsService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Get cart items
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { course: true, chapter: true },
    });
    if (cartItems.length === 0) throw new BadRequestException({ code: 'CART_EMPTY' });

    // 2. Re-validate items (courses still published, not enrolled, etc.)
    for (const item of cartItems) {
      if (item.course && item.course.status !== 'PUBLISHED') {
        throw new BadRequestException({ code: 'COURSE_NO_LONGER_AVAILABLE' });
      }
    }

    // 3. Calculate totals
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
    let discountAmount = 0;
    let couponId: string | undefined;

    // 4. Apply coupon if provided
    if (dto.couponCode) {
      const couponResult = await this.couponsService.validateAndCalculateDiscount(
        dto.couponCode,
        userId,
        cartItems.map((item) => ({ courseId: item.courseId, price: item.price })),
      );
      discountAmount = couponResult.discount;
      couponId = couponResult.couponId;
    }

    const finalAmount = totalAmount - discountAmount;
    const orderCode = this.generateOrderCode();

    // 5. Create order in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          orderCode,
          totalAmount,
          discountAmount,
          finalAmount,
          expiresAt: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000),
          items: {
            create: cartItems.map((item) => ({
              type: item.chapterId ? 'CHAPTER' : 'COURSE',
              courseId: item.courseId,
              chapterId: item.chapterId,
              price: item.price,
              title: item.course?.title ?? item.chapter?.title ?? '',
            })),
          },
        },
        include: { items: true },
      });

      // Record coupon usage + increment counter (atomic)
      if (couponId) {
        await tx.couponUsage.create({
          data: { couponId, orderId: newOrder.id, discount: discountAmount },
        });
        await tx.coupon.update({
          where: { id: couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { userId } });

      return newOrder;
    });

    // 6. Generate payment info
    const payment = this.generatePaymentInfo(order.orderCode, order.finalAmount);

    return { order, payment };
  }

  async findById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    }
    return order;
  }

  async getOrderStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paidAt: true, userId: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    }
    return { status: order.status, paidAt: order.paidAt };
  }

  async getOrderHistory(userId: string, query: PaginationDto) {
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return createPaginatedResult(orders, total, query.page, query.limit);
  }

  // ==================== PRIVATE HELPERS ====================

  private generateOrderCode(): string {
    // Format: SSLM + 10 chars (timestamp base36 + random)
    // Ví dụ: SSLM-lq8k9x2f4a
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `SSLM-${timestamp}${random}`;
  }

  // Nếu collision (P2002 unique constraint) → retry với code mới
  // Xử lý trong createOrder: wrap order.create trong try/catch,
  // catch Prisma.PrismaClientKnownRequestError code P2002 → regenerate + retry (max 3)

  private generatePaymentInfo(orderCode: string, amount: number) {
    const bankId = this.config.get<string>('sepay.bankId') ?? 'MB';
    const accountNumber = this.config.get<string>('sepay.bankAccountNumber') ?? '';
    const accountName = this.config.get<string>('sepay.bankAccountName') ?? '';

    return {
      bankId,
      accountNumber,
      accountName,
      amount,
      content: orderCode,
      qrUrl: `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${orderCode}`,
    };
  }
}
```

**Key design decisions:**

1. **`orderCode` format** — `SSLM` + 8 digits. Ngắn gọn cho nội dung chuyển khoản ngân hàng (giới hạn chars). Unique qua `@unique` constraint.
2. **Re-validate cart items** — Giữa lúc add to cart và checkout, course có thể bị unpublish/delete. Check lại.
3. **Coupon atomic increment** — `usageCount: { increment: 1 }` trong transaction. Tránh race condition khi 2 users dùng coupon cùng lúc.
4. **VietQR URL** — `img.vietqr.io` format chuẩn, tạo QR image trực tiếp. `bankId` từ config (MB, VCB, TCB...).
5. **ORDER_EXPIRY_MINUTES = 15** — Từ constants. Order PENDING → hết hạn sau 15 phút (cron check ở Phase 5.11).

---

## Step 8: SePay Webhook

### `orders/webhooks.service.ts`

```typescript
@Injectable()
export class WebhooksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async handleSepayWebhook(apiKey: string, payload: SepayWebhookDto) {
    // 1. Verify API key
    const webhookSecret = this.config.get<string>('sepay.webhookSecret');
    if (apiKey !== webhookSecret) {
      throw new ForbiddenException({ code: 'INVALID_WEBHOOK_KEY' });
    }

    // 2. Only process incoming transfers
    if (payload.transferType !== 'in') return { success: true };

    // 3. Extract order code from content (format: SSLM-xxxxxxxxxx)
    const orderCodeMatch = payload.content.match(/SSLM-[a-z0-9]+/i);
    if (!orderCodeMatch) return { success: true };
    const orderCode = orderCodeMatch[0]!;

    // 4. Find pending order
    const order = await this.prisma.order.findFirst({
      where: { orderCode, status: 'PENDING' },
      include: { items: true },
    });
    if (!order) return { success: true };

    // 5. Verify amount
    if (payload.transferAmount < order.finalAmount) return { success: true };

    // 6. Complete order in transaction
    await this.completeOrder(order, payload.referenceCode);

    return { success: true };
  }

  private async completeOrder(
    order: Order & { items: OrderItem[] },
    paymentRef?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          paymentRef: paymentRef ?? null,
          paidAt: new Date(),
        },
      });

      // 2. Process each order item
      for (const item of order.items) {
        if (item.type === 'COURSE' && item.courseId) {
          // Full course enrollment
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
            update: { type: 'FULL' },  // Upgrade PARTIAL → FULL if exists
            create: { userId: order.userId, courseId: item.courseId, type: 'FULL' },
          });
          await tx.course.update({
            where: { id: item.courseId },
            data: { totalStudents: { increment: 1 } },
          });
        }

        if (item.type === 'CHAPTER' && item.chapterId) {
          // Chapter purchase
          await tx.chapterPurchase.upsert({
            where: { userId_chapterId: { userId: order.userId, chapterId: item.chapterId } },
            update: {},
            create: { userId: order.userId, chapterId: item.chapterId },
          });

          // Create PARTIAL enrollment if not already FULL
          if (item.courseId) {
            const existing = await tx.enrollment.findUnique({
              where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
            });
            if (!existing) {
              await tx.enrollment.create({
                data: { userId: order.userId, courseId: item.courseId, type: 'PARTIAL' },
              });
            }
          }
        }

        // 3. Create earning for instructor
        if (item.courseId) {
          const course = await tx.course.findUnique({
            where: { id: item.courseId },
            select: { instructorId: true },
          });
          if (course) {
            const commissionRate = await this.getCommissionRate(course.instructorId, tx);
            const commissionAmount = Math.round(item.price * commissionRate);
            const netAmount = item.price - commissionAmount;

            await tx.earning.create({
              data: {
                instructorId: course.instructorId,
                orderItemId: item.id,
                amount: item.price,
                commissionRate,
                commissionAmount,
                netAmount,
                status: 'PENDING',
                availableAt: new Date(Date.now() + EARNING_HOLD_DAYS * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
      }
    });
  }

  private async getCommissionRate(
    instructorId: string,
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ): Promise<number> {
    // Calculate total revenue from available + withdrawn earnings
    const totalRevenue = await tx.earning.aggregate({
      where: {
        instructorId,
        status: { in: ['AVAILABLE', 'WITHDRAWN'] },
      },
      _sum: { netAmount: true },
    });

    const revenue = totalRevenue._sum.netAmount ?? 0;

    // Find matching commission tier
    const tier = await tx.commissionTier.findFirst({
      where: { minRevenue: { lte: revenue } },
      orderBy: { minRevenue: 'desc' },
    });

    return tier?.rate ?? 0.3; // Default 30% commission
  }
}
```

**Key design decisions:**

1. **Always return `{ success: true }`** — SePay expects 200 response. Never throw for invalid data (idempotent).
2. **`upsert` for enrollment** — Nếu user mua chapter trước → PARTIAL enrollment. Sau mua full course → upgrade to FULL.
3. **Commission tier from earnings aggregate** — Không dùng denormalized `totalRevenue` field. Tính từ source of truth.
4. **`EARNING_HOLD_DAYS = 7`** — Từ constants. Earnings PENDING 7 ngày mới AVAILABLE (chống refund fraud).
5. **Regex `SSLM-[a-z0-9]+`** — Robust parsing content ngân hàng (có thể có text thừa: "SSLM-lq8k9x2f4a chuyen tien").
6. **Transaction type cho Prisma** — `Parameters<Parameters<PrismaService['$transaction']>[0]>[0]` để type-safe transaction client.

---

## Step 9: Enrollments Service

### `enrollments/enrollments.service.ts`

```typescript
@Injectable()
export class EnrollmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async checkEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    // Also check individual chapter purchases
    let purchasedChapterIds: string[] = [];
    if (!enrollment || enrollment.type === 'PARTIAL') {
      const purchases = await this.prisma.chapterPurchase.findMany({
        where: { userId, chapter: { section: { courseId } } },
        select: { chapterId: true },
      });
      purchasedChapterIds = purchases.map((p) => p.chapterId);
    }

    return {
      enrolled: !!enrollment,
      type: enrollment?.type ?? null,
      progress: enrollment?.progress ?? 0,
      purchasedChapterIds,
    };
  }

  async getMyLearning(userId: string, query: PaginationDto) {
    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true, title: true, slug: true, thumbnailUrl: true,
              totalLessons: true, totalDuration: true,
              instructor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.enrollment.count({ where: { userId } }),
    ]);
    return createPaginatedResult(enrollments, total, query.page, query.limit);
  }
}
```

---

## Step 10: Withdrawals Service

### `withdrawals/withdrawals.service.ts`

```typescript
@Injectable()
export class WithdrawalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
    // 1. Check no pending withdrawal exists
    const pending = await this.prisma.withdrawal.findFirst({
      where: { instructorId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException({ code: 'WITHDRAWAL_PENDING_EXISTS' });
    }

    // 2. Check available balance (only AVAILABLE earnings)
    const available = await this.prisma.earning.aggregate({
      where: { instructorId, status: 'AVAILABLE' },
      _sum: { netAmount: true },
    });
    const balance = available._sum.netAmount ?? 0;

    if (dto.amount > balance) {
      throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });
    }

    // 3. Create withdrawal + lock earnings in transaction
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          instructorId,
          amount: dto.amount,
          bankInfo: dto.bankInfo as unknown as Prisma.InputJsonValue,
        },
      });

      // Lock earnings: mark enough AVAILABLE earnings as WITHDRAWN
      // to cover the withdrawal amount
      let remaining = dto.amount;
      const availableEarnings = await tx.earning.findMany({
        where: { instructorId, status: 'AVAILABLE' },
        orderBy: { createdAt: 'asc' }, // FIFO
      });

      for (const earning of availableEarnings) {
        if (remaining <= 0) break;
        await tx.earning.update({
          where: { id: earning.id },
          data: { status: 'WITHDRAWN' },
        });
        remaining -= earning.netAmount;
      }

      return withdrawal;
    });
  }

  async getWithdrawalHistory(instructorId: string, query: PaginationDto) {
    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { instructorId },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.withdrawal.count({ where: { instructorId } }),
    ]);
    return createPaginatedResult(withdrawals, total, query.page, query.limit);
  }
}
```

**Key design decisions:**

1. **Only 1 pending withdrawal** — Tránh duplicate requests.
2. **FIFO earning lock** — Đánh dấu earnings cũ nhất trước thành WITHDRAWN.
3. **`bankInfo` JSON cast** — Same pattern as Phase 5.5 qualifications.
4. **Admin approval ở Phase 5.11** — Phase này chỉ tạo request, admin approve/reject sau.

---

## Step 11: Controllers

### 11.1 Cart + Wishlist Controller

```typescript
@Controller('cart')
@ApiTags('Cart')
@ApiBearerAuth()
export class CartController {
  // Cart
  @Get()           getCart()
  @Post('items')   addItem(@Body() dto: AddCartItemDto)
  @Delete('items/:itemId')  removeItem(@Param('itemId') itemId)
  @Delete()        clearCart()
  @Post('merge')   mergeCart(@Body() dto: MergeCartDto)

  // Apply coupon (delegates to CouponsService)
  @Post('apply-coupon')   applyCoupon(@Body() dto: ApplyCouponDto)
  @Delete('coupon')       removeCoupon()
}

// Wishlist — separate controller, same module
@Controller('wishlists')
@ApiTags('Wishlists')
@ApiBearerAuth()
export class WishlistController {
  @Get()                    getWishlist(@Query() query: PaginationDto)
  @Post(':courseId')        addToWishlist(@Param('courseId') courseId)
  @Delete(':courseId')      removeFromWishlist(@Param('courseId') courseId)
}
```

### 11.2 Orders Controller

```typescript
@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth()
export class OrdersController {
  @Post()          createOrder(@Body() dto: CreateOrderDto)
  @Get()           getOrderHistory(@Query() query: PaginationDto)
  @Get(':id')      findById(@Param('id') id)
  @Get(':id/status')  getOrderStatus(@Param('id') id)  // Polling
}
```

### 11.3 Webhooks Controller

```typescript
@Controller('webhooks')
@ApiTags('Webhooks')
export class WebhooksController {
  @Public()
  @Post('sepay')
  async handleSepay(
    @Headers('x-api-key') apiKey: string,
    @Body() payload: SepayWebhookDto,
  ) {
    return this.webhooksService.handleSepayWebhook(apiKey, payload);
  }
}
```

> `@Public()` — bypass JWT auth. Security via `x-api-key` header verification.

### 11.4 Coupons Controller (Instructor)

```typescript
@Controller('instructor/coupons')
@ApiTags('Instructor — Coupons')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class CouponsController {
  @Post()          create(@Body() dto: CreateCouponDto)
  @Get()           getInstructorCoupons(@Query() query: PaginationDto)
  @Patch(':id')    update(@Param('id') id, @Body() dto: UpdateCouponDto)
  @Delete(':id')   deactivate(@Param('id') id)  // Soft delete
}
```

### 11.5 Enrollments Controller

```typescript
@Controller('enrollments')
@ApiTags('Enrollments')
@ApiBearerAuth()
export class EnrollmentsController {
  @Get('check/:courseId')   checkEnrollment(@Param('courseId') courseId)
  @Get('my-learning')       getMyLearning(@Query() query: PaginationDto)
  @Post('free/:courseId')   enrollFree(@Param('courseId') courseId)  // Free course
}
```

### 11.6 Withdrawals Controller (Instructor)

```typescript
@Controller('instructor/withdrawals')
@ApiTags('Instructor — Withdrawals')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class WithdrawalsController {
  @Post()    requestWithdrawal(@Body() dto: CreateWithdrawalDto)
  @Get()     getWithdrawalHistory(@Query() query: PaginationDto)
}
```

---

## Step 12: Register Modules

### Module definitions

```typescript
// cart.module.ts — imports CouponsModule for apply-coupon
@Module({
  imports: [CouponsModule],
  controllers: [CartController, WishlistController],
  providers: [CartService],
  exports: [CartService],
})

// orders.module.ts — imports CouponsModule
@Module({
  imports: [CouponsModule],
  controllers: [OrdersController, WebhooksController],
  providers: [OrdersService, WebhooksService],
  exports: [OrdersService],
})

// enrollments.module.ts
@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})

// coupons.module.ts
@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})

// withdrawals.module.ts
@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
```

### `app.module.ts` — Add 5 imports

```typescript
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
```

---

## Step 13: Verify

### Endpoint Summary — 25 endpoints

**Cart (6):** GET cart, POST items, DELETE items/:id, DELETE cart, POST merge, POST apply-coupon
**Wishlist (3):** GET list, POST :courseId, DELETE :courseId
**Orders (4):** POST create, GET history, GET :id, GET :id/status
**Webhook (1):** POST sepay
**Enrollments (3):** GET check/:courseId, GET my-learning, POST free/:courseId
**Coupons Instructor (4):** POST create, GET list, PATCH :id, DELETE :id
**Withdrawals (2):** POST create, GET history

### Checklist

- [ ] Cart: add/remove/clear/get with price lookup from DB
- [ ] Cart: conflict detection (full course vs chapters, already enrolled)
- [ ] Cart: merge localStorage items after login
- [ ] Wishlist: add/remove/list
- [ ] Coupon: instructor CRUD with ownership + validation
- [ ] Coupon: 6-gate validation (exists, date, usage, per-user, applicable, min amount)
- [ ] Coupon: PERCENTAGE vs FIXED_AMOUNT + maxDiscount cap
- [ ] Order: create from cart with coupon + 15-min expiry
- [ ] Order: SePay QR via VietQR URL format
- [ ] Order: history, detail, status polling
- [ ] Webhook: verify x-api-key, parse order code, verify amount
- [ ] Webhook: create enrollments (FULL/PARTIAL + chapter purchases)
- [ ] Webhook: create earnings with commission tier + 7-day hold
- [ ] Webhook: idempotent (always return success)
- [ ] Enrollment: check status + purchased chapters
- [ ] Enrollment: my-learning list with course progress
- [ ] Enrollment: free course enrollment (price=0, bypass cart/order)
- [ ] Withdrawal: balance check, only 1 pending, FIFO earning lock
- [ ] Cart apply-coupon: preview discount (CartModule imports CouponsModule)
- [ ] OrderCode collision: catch P2002, retry with new code (max 3)
- [ ] Config: `sepay.bankId` added to sepay.config.ts
- [ ] All DTOs use `!:`, no `price` in cart DTO
- [ ] All services use `@Inject()` pattern
- [ ] Error codes (not messages) in all exceptions
- [ ] Build: 0 errors, Lint: 0 errors, Tests: all pass
