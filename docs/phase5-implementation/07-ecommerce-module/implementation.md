# Phase 5.7 — ECOMMERCE MODULE

> Cart, Orders, Checkout (SePay QR), Enrollments, Coupons, Wishlist, Earnings, Withdrawals.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: Cart Service](#step-2-cart-service)
- [Step 3: Order Service & Checkout Flow](#step-3-order-service--checkout-flow)
- [Step 4: SePay Webhook](#step-4-sepay-webhook)
- [Step 5: Enrollment Service](#step-5-enrollment-service)
- [Step 6: Coupon Service](#step-6-coupon-service)
- [Step 7: Wishlist Service](#step-7-wishlist-service)
- [Step 8: Earnings & Withdrawals](#step-8-earnings--withdrawals)
- [Step 9: Controllers](#step-9-controllers)
- [Step 10: Verify](#step-10-verify)

---

## Step 1: Module Structure

```
src/modules/ecommerce/
├── ecommerce.module.ts
├── cart/
│   ├── cart.controller.ts
│   └── cart.service.ts
├── orders/
│   ├── orders.controller.ts
│   └── orders.service.ts
├── enrollments/
│   ├── enrollments.controller.ts
│   └── enrollments.service.ts
├── wishlists/
│   ├── wishlists.controller.ts
│   └── wishlists.service.ts
├── webhooks/
│   ├── webhooks.controller.ts
│   └── webhooks.service.ts
└── dto/
    ├── add-cart-item.dto.ts
    ├── create-order.dto.ts
    └── apply-coupon.dto.ts
```

---

## Step 2: Cart Service

### Key operations

```typescript
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, thumbnailUrl: true, price: true, instructorId: true },
        },
        chapter: { select: { id: true, title: true, price: true } },
      },
    });
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    // Validate: can't buy own course, can't buy if already enrolled
    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
      if (course.instructorId === userId)
        throw new BadRequestException({ code: 'CANNOT_BUY_OWN_COURSE' });

      const enrolled = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: dto.courseId } },
      });
      if (enrolled) throw new BadRequestException({ code: 'ALREADY_ENROLLED' });
    }

    return this.prisma.cartItem.create({
      data: {
        userId,
        courseId: dto.courseId,
        chapterId: dto.chapterId,
        price: dto.price,
      },
    });
  }

  async removeItem(userId: string, itemId: string) {
    return this.prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
  }

  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId } });
  }
}
```

---

## Step 3: Order Service & Checkout Flow

### Flow: Cart → Order (PENDING) → SePay QR → Webhook → Order (COMPLETED) → Enrollment

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { course: true, chapter: true },
    });

    if (cartItems.length === 0) throw new BadRequestException({ code: 'CART_EMPTY' });

    // Calculate totals
    let totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
    let discountAmount = 0;

    // Apply coupon if provided
    if (dto.couponCode) {
      discountAmount = await this.calculateDiscount(dto.couponCode, totalAmount, cartItems);
    }

    const finalAmount = totalAmount - discountAmount;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create order in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          discountAmount,
          finalAmount,
          expiresAt,
          items: {
            create: cartItems.map((item) => ({
              type: item.courseId ? 'COURSE' : 'CHAPTER',
              courseId: item.courseId,
              chapterId: item.chapterId,
              price: item.price,
              title: item.course?.title || item.chapter?.title || '',
            })),
          },
        },
        include: { items: true },
      });

      // Record coupon usage
      if (dto.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: dto.couponCode } });
        if (coupon) {
          await tx.couponUsage.create({
            data: { couponId: coupon.id, orderId: newOrder.id, discount: discountAmount },
          });
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { userId } });

      return newOrder;
    });

    // Generate SePay payment info
    const paymentInfo = this.generateSepayPayment(order.id, order.finalAmount);

    return { order, paymentInfo };
  }

  private generateSepayPayment(orderId: string, amount: number) {
    return {
      bankAccountNumber: this.config.get('sepay.bankAccountNumber'),
      bankAccountName: this.config.get('sepay.bankAccountName'),
      amount,
      content: `SSLM ${orderId}`, // Payment reference
      qrUrl: `https://qr.sepay.vn/img?bank=...&acc=...&amount=${amount}&des=SSLM ${orderId}`,
    };
  }
}
```

---

## Step 4: SePay Webhook

```typescript
@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async handleSepayWebhook(payload: SepayWebhookPayload) {
    // Verify webhook signature
    // ...

    // Extract order ID from payment content (format: "SSLM clx...")
    const orderId = payload.content.replace('SSLM ', '').trim();

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.status !== 'PENDING') return;
    if (payload.amount < order.finalAmount) return;

    // Complete order in transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', paymentRef: payload.referenceNumber },
      });

      // 2. Create enrollments
      for (const item of order.items) {
        if (item.courseId && item.type === 'COURSE') {
          await tx.enrollment.create({
            data: { userId: order.userId, courseId: item.courseId, type: 'FULL' },
          });
          await tx.course.update({
            where: { id: item.courseId },
            data: { totalStudents: { increment: 1 } },
          });
        }
        if (item.chapterId && item.type === 'CHAPTER') {
          await tx.chapterPurchase.create({
            data: { userId: order.userId, chapterId: item.chapterId },
          });
          // Create PARTIAL enrollment if not exists
          if (item.courseId) {
            await tx.enrollment.upsert({
              where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
              update: {},
              create: { userId: order.userId, courseId: item.courseId, type: 'PARTIAL' },
            });
          }
        }

        // 3. Create earning for instructor
        if (item.courseId) {
          const course = await tx.course.findUnique({ where: { id: item.courseId } });
          if (course) {
            const commissionRate = await this.getCommissionRate(course.instructorId, tx);
            const commissionAmount = item.price * commissionRate;
            await tx.earning.create({
              data: {
                instructorId: course.instructorId,
                orderItemId: item.id,
                amount: item.price,
                commissionRate,
                commissionAmount,
                netAmount: item.price - commissionAmount,
              },
            });
          }
        }
      }
    });

    // Send notification + email (async, non-blocking)
  }

  private async getCommissionRate(instructorId: string, tx: Prisma.TransactionClient) {
    const profile = await tx.instructorProfile.findUnique({ where: { userId: instructorId } });
    const totalRevenue = profile?.totalRevenue || 0;

    const tier = await tx.commissionTier.findFirst({
      where: { minRevenue: { lte: totalRevenue } },
      orderBy: { minRevenue: 'desc' },
    });

    return tier?.rate || 0.3;
  }
}
```

---

## Step 5: Enrollment Service

```typescript
async checkEnrollment(userId: string, courseId: string) {
  const enrollment = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return { enrolled: !!enrollment, type: enrollment?.type, progress: enrollment?.progress };
}

async getMyEnrollments(userId: string, query: PaginationDto) {
  const [enrollments, total] = await Promise.all([
    this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, slug: true, thumbnailUrl: true, totalLessons: true },
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
```

---

## Step 6: Coupon Service

```typescript
async validateCoupon(code: string, cartItems: CartItem[]) {
  const coupon = await this.prisma.coupon.findUnique({
    where: { code },
    include: { couponCourses: true },
  });

  if (!coupon || !coupon.isActive) throw new BadRequestException({ code: 'COUPON_NOT_FOUND' });
  if (new Date() < coupon.startDate || new Date() > coupon.endDate) throw new BadRequestException({ code: 'COUPON_EXPIRED' });
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw new BadRequestException({ code: 'COUPON_USAGE_EXCEEDED' });

  // Check if coupon applies to cart items
  const applicableCourseIds = coupon.couponCourses.map((cc) => cc.courseId);
  // ... calculate discount based on coupon type (PERCENTAGE or FIXED_AMOUNT)
}
```

---

## Step 7: Wishlist Service

```typescript
async toggle(userId: string, courseId: string) {
  const existing = await this.prisma.wishlist.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existing) {
    await this.prisma.wishlist.delete({ where: { id: existing.id } });
    return { wishlisted: false };
  }

  await this.prisma.wishlist.create({ data: { userId, courseId } });
  return { wishlisted: true };
}
```

---

## Step 8: Earnings & Withdrawals

Earnings tracked automatically on order completion (Step 4).
Instructor withdrawals via `src/modules/instructor/withdrawals/`.

```typescript
async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
  // Check available balance
  const available = await this.prisma.earning.aggregate({
    where: { instructorId, status: 'AVAILABLE' },
    _sum: { netAmount: true },
  });

  const balance = available._sum.netAmount || 0;
  if (dto.amount > balance) throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });

  // Check minimum withdrawal
  const minAmount = 200000; // from platform settings
  if (dto.amount < minAmount) throw new BadRequestException({ code: 'BELOW_MINIMUM_WITHDRAWAL' });

  return this.prisma.withdrawal.create({
    data: {
      instructorId,
      amount: dto.amount,
      bankInfo: dto.bankInfo,
    },
  });
}
```

---

## Step 9: Controllers

### Key endpoints:

| Method | Path                             | Auth   | Description            |
| ------ | -------------------------------- | ------ | ---------------------- |
| GET    | /api/cart                        | User   | Get cart items         |
| POST   | /api/cart                        | User   | Add item to cart       |
| DELETE | /api/cart/:id                    | User   | Remove item            |
| DELETE | /api/cart                        | User   | Clear cart             |
| POST   | /api/orders                      | User   | Create order from cart |
| GET    | /api/orders                      | User   | Order history          |
| GET    | /api/orders/:id                  | User   | Order detail           |
| POST   | /api/webhooks/sepay              | Public | SePay payment webhook  |
| GET    | /api/enrollments/check/:courseId | User   | Check enrollment       |
| GET    | /api/my-learning                 | User   | My enrolled courses    |
| POST   | /api/wishlists/:courseId         | User   | Toggle wishlist        |
| GET    | /api/wishlists                   | User   | Get wishlist           |
| POST   | /api/coupons/validate            | User   | Validate coupon        |

---

## Step 10: Verify

### Checklist

- [ ] Cart CRUD works (add, remove, clear, get)
- [ ] Cannot add own course to cart
- [ ] Cannot add already-enrolled course
- [ ] Order created from cart with 15-min expiry
- [ ] SePay QR payment info generated
- [ ] Webhook processes payment → creates enrollment + earning
- [ ] Coupon validation and discount calculation
- [ ] Wishlist toggle works
- [ ] Enrollment check returns correct status
- [ ] Commission tiers applied correctly
- [ ] Transaction ensures data consistency
