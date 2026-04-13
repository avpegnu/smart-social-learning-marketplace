import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import {
  TYPE_TO_PREFERENCE,
  ALWAYS_DELIVER_TYPES,
} from '@/modules/notifications/notification-preferences.map';

type NotificationPrefs = Record<string, { inApp: boolean }> | null;

const PREFS_CACHE_TTL = 300; // 5 minutes

@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing notification job: ${job.name}`);

    const { userId, type, data } = job.data;

    // Always-deliver types skip preference check
    if (!ALWAYS_DELIVER_TYPES.has(type)) {
      const prefKey = TYPE_TO_PREFERENCE[type];

      if (prefKey) {
        const prefs = await this.getPreferences(userId);

        if (prefs && prefs[prefKey]?.inApp === false) {
          this.logger.log(`Skipping ${type} for user ${userId} — disabled in preferences`);
          return;
        }
      }
    }

    await this.notifications.create(userId, type, data);
  }

  private async getPreferences(userId: string): Promise<NotificationPrefs> {
    return this.redis.getOrSet(`notif_prefs:${userId}`, PREFS_CACHE_TTL, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      return (user?.notificationPreferences as NotificationPrefs) ?? null;
    });
  }
}
