import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';

const BATCH_SIZE = 1000;

@Processor('feed')
export class FeedProcessor extends WorkerHost {
  private readonly logger = new Logger(FeedProcessor.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'fanout') {
      await this.handleFanout(job.data);
    } else {
      this.logger.warn(`Unknown feed job type: ${job.name}`);
    }
  }

  private async handleFanout(data: { postId: string; authorId: string; groupId?: string }) {
    const { postId, authorId, groupId } = data;

    let targetIds: string[];

    if (groupId) {
      const members = await this.prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      targetIds = members.map((m) => m.userId);
    } else {
      const follows = await this.prisma.follow.findMany({
        where: { followingId: authorId },
        select: { followerId: true },
      });
      targetIds = follows.map((f) => f.followerId);
    }

    // Add author to their own feed
    targetIds.push(authorId);

    // Batch insert
    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
      const batch = targetIds.slice(i, i + BATCH_SIZE);
      await this.prisma.feedItem.createMany({
        data: batch.map((userId) => ({ userId, postId })),
        skipDuplicates: true,
      });
    }

    this.logger.log(`Fanout post ${postId} to ${targetIds.length} users`);
  }
}
