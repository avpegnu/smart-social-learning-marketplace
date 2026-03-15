import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockGateway = {
  pushToUser: jest.fn(),
  pushUnreadCount: jest.fn(),
  pushOrderStatus: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create notification and push via gateway', async () => {
      const notification = {
        id: 'n1',
        type: 'POST_LIKE',
        data: { actorName: 'User A' },
        isRead: false,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(notification);
      mockPrisma.notification.count.mockResolvedValue(3);

      const result = await service.create('user-1', 'POST_LIKE' as never, {
        actorName: 'User A',
      });

      expect(result.id).toBe('n1');
      expect(mockGateway.pushToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'POST_LIKE' }),
      );
      expect(mockGateway.pushUnreadCount).toHaveBeenCalledWith('user-1', 3);
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.getNotifications('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by read status', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
        read: false,
      } as never);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and update badge', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(2);

      await service.markAsRead('user-1', 'n1');
      expect(mockGateway.pushUnreadCount).toHaveBeenCalledWith('user-1', 2);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.markAsRead('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all as read and push 0 count', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      await service.markAllAsRead('user-1');
      expect(mockGateway.pushUnreadCount).toHaveBeenCalledWith('user-1', 0);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(7);
    });
  });
});
