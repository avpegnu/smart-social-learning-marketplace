import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Prisma, NotificationType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { NotificationsGateway } from './notifications.gateway';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsGateway)
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(recipientId: string, type: NotificationType, data: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        type,
        data: data as Prisma.InputJsonValue,
      },
    });

    // Push realtime
    this.gateway.pushToUser(recipientId, {
      id: notification.id,
      type: notification.type,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt,
    });

    // Update badge count
    const unreadCount = await this.getUnreadCount(recipientId);
    this.gateway.pushUnreadCount(recipientId, unreadCount);

    return notification;
  }

  async getNotifications(userId: string, query: QueryNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      ...(query.read !== undefined && { isRead: query.read }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return createPaginatedResult(notifications, total, query.page, query.limit);
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    }

    const unreadCount = await this.getUnreadCount(userId);
    this.gateway.pushUnreadCount(userId, unreadCount);
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    this.gateway.pushUnreadCount(userId, 0);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }
}
