import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    @InjectQueue('feed') private readonly feedQueue: Queue,
  ) {}

  private enqueue(queue: Queue, name: string, data: Record<string, unknown>) {
    queue.add(name, data).catch((err: Error) => {
      this.logger.warn(`Failed to enqueue ${queue.name}/${name}: ${err.message}`);
    });
  }

  addVerificationEmail(to: string, token: string) {
    this.enqueue(this.emailQueue, 'verification', { to, token });
  }

  addResetPasswordEmail(to: string, token: string) {
    this.enqueue(this.emailQueue, 'reset-password', { to, token });
  }

  addOrderReceiptEmail(to: string, orderId: string, amount: number) {
    this.enqueue(this.emailQueue, 'order-receipt', { to, orderId, amount });
  }

  addNotification(userId: string, type: string, data: Record<string, unknown>) {
    this.enqueue(this.notificationQueue, 'create', { userId, type, data });
  }

  addAdminNotification(type: string, data: Record<string, unknown>) {
    this.prisma.user
      .findMany({
        where: { role: 'ADMIN', deletedAt: null },
        select: { id: true },
      })
      .then((admins) => {
        for (const admin of admins) {
          this.enqueue(this.notificationQueue, 'create', {
            userId: admin.id,
            type,
            data,
          });
        }
      })
      .catch((err: Error) => {
        this.logger.warn(`Failed to query admins for notification: ${err.message}`);
      });
  }

  addFeedFanout(postId: string, authorId: string, groupId?: string) {
    this.enqueue(this.feedQueue, 'fanout', { postId, authorId, groupId });
  }
}
