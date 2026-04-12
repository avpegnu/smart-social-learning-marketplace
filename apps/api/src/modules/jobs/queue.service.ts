import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    @InjectQueue('feed') private readonly feedQueue: Queue,
  ) {}

  async addVerificationEmail(to: string, token: string) {
    await this.emailQueue.add('verification', { to, token });
  }

  async addResetPasswordEmail(to: string, token: string) {
    await this.emailQueue.add('reset-password', { to, token });
  }

  async addOrderReceiptEmail(to: string, orderId: string, amount: number) {
    await this.emailQueue.add('order-receipt', { to, orderId, amount });
  }

  async addNotification(userId: string, type: string, data: Record<string, unknown>) {
    await this.notificationQueue.add('create', { userId, type, data });
  }

  async addFeedFanout(postId: string, authorId: string, groupId?: string) {
    await this.feedQueue.add('fanout', { postId, authorId, groupId });
  }
}
