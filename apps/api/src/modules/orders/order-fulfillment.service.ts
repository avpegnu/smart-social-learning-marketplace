import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { PlatformSettingsService } from '@/modules/platform-settings/platform-settings.service';
import { GroupsService } from '@/modules/social/groups/groups.service';

// Default hold window when the platform setting is missing
const DEFAULT_EARNING_HOLD_MINUTES = 30;

export interface FulfillableOrderItem {
  id: string;
  type: string;
  courseId: string | null;
  chapterId: string | null;
  price: number;
  discount: number;
}

/**
 * Shared order-completion logic: marks an order COMPLETED, grants enrollments /
 * chapter purchases, creates instructor earnings and updates counters, then
 * sends notifications and adds the buyer to course groups.
 *
 * Used by both the SePay webhook (paid orders) and the checkout flow when an
 * order's final amount is 0 (fully covered by a coupon or a free course), so the
 * two paths stay identical and idempotent.
 */
@Injectable()
export class OrderFulfillmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(PlatformSettingsService) private readonly platformSettings: PlatformSettingsService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
  ) {}

  async fulfillOrder(
    orderId: string,
    userId: string,
    items: FulfillableOrderItem[],
    paymentRef?: string,
  ) {
    const holdMinutes = this.platformSettings.get<number>(
      'earning_hold_minutes',
      DEFAULT_EARNING_HOLD_MINUTES,
    );
    const availableAt = new Date(Date.now() + holdMinutes * 60 * 1000);

    const fulfilled = await this.prisma.$transaction(async (tx) => {
      // 1. Atomically transition the order PENDING -> COMPLETED. The status guard
      // makes fulfillment idempotent and race-safe: a duplicate/retried SePay
      // webhook, or a run that loses the race against the expiration cron, matches
      // zero rows and bails out instead of double-enrolling or double-crediting.
      const transition = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          paymentRef: paymentRef ?? null,
          paidAt: new Date(),
        },
      });
      if (transition.count === 0) {
        return false;
      }

      // Track which instructors got a new student in this order + cache their
      // commission rate (constant within a tx, so compute it once per instructor).
      const instructorStudentAdded = new Set<string>();
      const rateCache = new Map<string, number>();

      // 2. Process each order item
      for (const item of items) {
        // Whether this item created a brand-new enrollment (drives student counters).
        let isNewEnrollment = false;
        if (item.type === 'COURSE' && item.courseId) {
          // Full course enrollment. Only bump totalStudents for a brand-new
          // enrollment — upgrading an existing PARTIAL one must not double-count.
          const existing = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId: item.courseId } },
          });
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId, courseId: item.courseId } },
            update: { type: 'FULL' },
            create: { userId, courseId: item.courseId, type: 'FULL' },
          });
          if (!existing) {
            isNewEnrollment = true;
            await tx.course.update({
              where: { id: item.courseId },
              data: { totalStudents: { increment: 1 } },
            });
          }
        }

        if (item.type === 'CHAPTER' && item.chapterId) {
          // Chapter purchase
          await tx.chapterPurchase.upsert({
            where: { userId_chapterId: { userId, chapterId: item.chapterId } },
            update: {},
            create: { userId, chapterId: item.chapterId },
          });

          // Create PARTIAL enrollment if not already exists
          if (item.courseId) {
            const existing = await tx.enrollment.findUnique({
              where: { userId_courseId: { userId, courseId: item.courseId } },
            });
            if (!existing) {
              isNewEnrollment = true;
              await tx.enrollment.create({
                data: { userId, courseId: item.courseId, type: 'PARTIAL' },
              });
              await tx.course.update({
                where: { id: item.courseId },
                data: { totalStudents: { increment: 1 } },
              });
            }
          }
        }

        // 3. Create earning for instructor
        if (item.courseId) {
          const course = await tx.course.findUnique({
            where: { id: item.courseId },
            select: { instructorId: true },
            // FIX(suspension-gap): also read instructor status to hold earnings
            // select: { instructorId: true, instructor: { select: { status: true } } },
          });
          if (course) {
            // FIX(suspension-gap): don't accrue earnings while the instructor is suspended
            // if (course.instructor.status === 'SUSPENDED') {
            //   continue; // skip creating the Earning; revisit on reactivation
            // }
            const actualPrice = item.price - item.discount;
            let commissionRate = rateCache.get(course.instructorId);
            if (commissionRate === undefined) {
              commissionRate = await this.getCommissionRate(course.instructorId, tx);
              rateCache.set(course.instructorId, commissionRate);
            }
            const commissionAmount = Math.round(actualPrice * commissionRate);
            const netAmount = actualPrice - commissionAmount;

            await tx.earning.create({
              data: {
                instructorId: course.instructorId,
                orderItemId: item.id,
                amount: actualPrice,
                commissionRate,
                commissionAmount,
                netAmount,
                status: 'PENDING',
                availableAt,
              },
            });

            // Count a new student once per instructor per order — only when this
            // item actually created an enrollment (not a re-purchase / upgrade).
            const studentIncrement =
              isNewEnrollment && !instructorStudentAdded.has(course.instructorId) ? 1 : 0;
            if (isNewEnrollment) instructorStudentAdded.add(course.instructorId);

            await tx.instructorProfile.upsert({
              where: { userId: course.instructorId },
              update: {
                totalRevenue: { increment: netAmount },
                ...(studentIncrement > 0 && {
                  totalStudents: { increment: 1 },
                }),
              },
              create: {
                userId: course.instructorId,
                totalRevenue: netAmount,
                totalStudents: studentIncrement,
              },
            });
          }
        }
      }

      return true;
    });

    // Another path already fulfilled this order (concurrent webhook retry), or it
    // was expired before payment landed — skip side effects to stay idempotent.
    if (!fulfilled) return;

    // Notify buyer: order completed
    this.queue.addNotification(userId, 'ORDER_COMPLETED', { orderId });

    // Send the buyer an order receipt email (best-effort — must never break
    // fulfillment). Fire-and-forget like the notification above, and only for
    // paid orders (amount > 0), so free/fully-discounted orders get no receipt.
    try {
      const amount = items.reduce((sum, item) => sum + (item.price - item.discount), 0);
      if (amount > 0) {
        const buyer = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (buyer?.email) {
          this.queue.addOrderReceiptEmail(buyer.email, orderId, amount);
        }
      }
    } catch {
      // Receipt email is non-critical; never let a lookup/enqueue error surface.
    }

    // Add user to course groups
    const courseIds = [...new Set(items.filter((i) => i.courseId).map((i) => i.courseId!))];
    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true, instructorId: true },
      });
      for (const course of courses) {
        await this.groupsService.addMemberByCourseId(course.id, userId);
        this.queue.addNotification(course.instructorId, 'COURSE_ENROLLED', {
          courseId: course.id,
          courseTitle: course.title,
        });
      }
    }
  }

  private async getCommissionRate(
    instructorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const totalRevenue = await tx.earning.aggregate({
      where: {
        instructorId,
        status: { in: ['AVAILABLE', 'WITHDRAWN'] },
      },
      _sum: { netAmount: true },
    });

    const revenue = totalRevenue._sum.netAmount ?? 0;

    const tier = await tx.commissionTier.findFirst({
      where: { minRevenue: { lte: revenue } },
      orderBy: { minRevenue: 'desc' },
    });

    const defaultRate = this.platformSettings.get<number>('default_commission_rate', 30) / 100;
    return tier?.rate ?? defaultRate;
  }
}
