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

    await this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          paymentRef: paymentRef ?? null,
          paidAt: new Date(),
        },
      });

      // Track which instructors got a new student in this order
      const instructorStudentAdded = new Set<string>();

      // 2. Process each order item
      for (const item of items) {
        if (item.type === 'COURSE' && item.courseId) {
          // Full course enrollment
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId, courseId: item.courseId } },
            update: { type: 'FULL' },
            create: { userId, courseId: item.courseId, type: 'FULL' },
          });
          await tx.course.update({
            where: { id: item.courseId },
            data: { totalStudents: { increment: 1 } },
          });
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
          });
          if (course) {
            const actualPrice = item.price - item.discount;
            const commissionRate = await this.getCommissionRate(course.instructorId, tx);
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

            // Update instructor profile counters
            const studentIncrement = instructorStudentAdded.has(course.instructorId) ? 0 : 1;
            instructorStudentAdded.add(course.instructorId);

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
    });

    // Notify buyer: order completed
    this.queue.addNotification(userId, 'ORDER_COMPLETED', { orderId });

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
