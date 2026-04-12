import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { EARNING_HOLD_DAYS } from '@/common/constants/app.constant';
import type { SepayWebhookDto } from './dto/sepay-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async handleSepayWebhook(authorization: string, payload: SepayWebhookDto) {
    // 1. Verify API key — SePay sends "Apikey <key>" in Authorization header
    const webhookSecret = this.config.get<string>('sepay.webhookSecret');
    const apiKey = authorization?.replace(/^Apikey\s+/i, '') ?? '';
    if (apiKey !== webhookSecret) {
      throw new ForbiddenException({ code: 'INVALID_WEBHOOK_KEY' });
    }

    // 2. Only process incoming transfers
    if (payload.transferType !== 'in') return { success: true };

    // 3. Extract order code from content (format: SSLM20260321xxxxx)
    const orderCodeMatch = payload.content.match(/SSLM\d{13}/i);
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
    await this.completeOrder(order.id, order.userId, order.items, payload.referenceCode);

    return { success: true };
  }

  private async completeOrder(
    orderId: string,
    userId: string,
    items: {
      id: string;
      type: string;
      courseId: string | null;
      chapterId: string | null;
      price: number;
      discount: number;
    }[],
    paymentRef?: string,
  ) {
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
                availableAt: new Date(Date.now() + EARNING_HOLD_DAYS * 24 * 60 * 60 * 1000),
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

    // Notify instructors: new enrollment
    const courseIds = [...new Set(items.filter((i) => i.courseId).map((i) => i.courseId!))];
    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true, instructorId: true },
      });
      for (const course of courses) {
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

    return tier?.rate ?? 0.3;
  }
}
