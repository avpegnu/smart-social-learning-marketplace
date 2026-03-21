import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { ORDER_EXPIRY_MINUTES } from '@/common/constants/app.constant';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { CreateOrderDto } from './dto/create-order.dto';

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

    // 2. Re-validate items
    for (const item of cartItems) {
      if (item.course && item.course.status !== 'PUBLISHED') {
        throw new BadRequestException({ code: 'COURSE_NO_LONGER_AVAILABLE' });
      }
    }

    // 3. Calculate totals
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
    let discountAmount = 0;
    let couponId: string | undefined;
    let applicableCourseIds: string[] | null = null;

    // 4. Apply coupon if provided
    if (dto.couponCode) {
      const couponResult = await this.couponsService.validateAndCalculateDiscount(
        dto.couponCode,
        userId,
        cartItems.map((item) => ({ courseId: item.courseId, price: item.price })),
      );
      discountAmount = couponResult.discount;
      couponId = couponResult.couponId;
      applicableCourseIds = couponResult.applicableCourseIds;
    }

    const finalAmount = totalAmount - discountAmount;
    const orderCode = this.generateOrderCode();

    // 5. Distribute discount per-item (proportionally among applicable items)
    const itemDiscounts = this.distributeDiscount(cartItems, discountAmount, applicableCourseIds);

    // 6. Create order in transaction
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
            create: cartItems.map((item, i) => ({
              type: item.chapterId ? 'CHAPTER' : 'COURSE',
              courseId: item.courseId,
              chapterId: item.chapterId,
              price: item.price,
              discount: itemDiscounts[i] ?? 0,
              title: item.course?.title ?? item.chapter?.title ?? '',
            })),
          },
        },
        include: { items: true },
      });

      // Record coupon usage + increment counter
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

    // Include payment info for pending orders so payment page can work without sessionStorage
    if (order.status === 'PENDING') {
      const payment = this.generatePaymentInfo(order.orderCode, order.finalAmount);
      return { ...order, payment };
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

  private distributeDiscount(
    cartItems: { courseId: string | null; price: number }[],
    discountAmount: number,
    applicableCourseIds: string[] | null,
  ): number[] {
    if (discountAmount === 0) return cartItems.map(() => 0);

    // Find applicable items
    const applicableItems = cartItems.map((item, i) => {
      const isApplicable =
        !applicableCourseIds || (item.courseId && applicableCourseIds.includes(item.courseId));
      return { index: i, price: item.price, isApplicable };
    });

    const applicableTotal = applicableItems
      .filter((a) => a.isApplicable)
      .reduce((sum, a) => sum + a.price, 0);

    if (applicableTotal === 0) return cartItems.map(() => 0);

    // Distribute proportionally among applicable items
    const discounts = cartItems.map(() => 0);
    let remaining = discountAmount;

    const applicable = applicableItems.filter((a) => a.isApplicable);
    for (let i = 0; i < applicable.length; i++) {
      const item = applicable[i]!;
      if (i === applicable.length - 1) {
        // Last item gets remainder to avoid rounding errors
        discounts[item.index] = remaining;
      } else {
        const itemDiscount = Math.round((item.price / applicableTotal) * discountAmount);
        discounts[item.index] = itemDiscount;
        remaining -= itemDiscount;
      }
    }

    return discounts;
  }

  private generateOrderCode(): string {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const seq = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `SSLM${date}${seq}`;
  }

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
