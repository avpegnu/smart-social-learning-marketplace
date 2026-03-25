import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const mockPrisma = {
  conversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  conversationMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockNotifications = { create: jest.fn().mockResolvedValue({}) };

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreateConversation', () => {
    it('should return existing 1-on-1 conversation', async () => {
      const existing = { id: 'conv-1', isGroup: false };
      mockPrisma.conversation.findFirst.mockResolvedValue(existing);

      const result = await service.getOrCreateConversation('user-1', {
        participantId: 'user-2',
      } as never);
      expect(result).toEqual(existing);
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new 1-on-1 if not found', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      const created = { id: 'conv-new', isGroup: false };
      mockPrisma.conversation.create.mockResolvedValue(created);

      const result = await service.getOrCreateConversation('user-1', {
        participantId: 'user-2',
      } as never);
      expect(result).toEqual(created);
    });

    it('should create group conversation', async () => {
      const groupConv = { id: 'conv-group', isGroup: true };
      mockPrisma.conversation.create.mockResolvedValue(groupConv);

      const result = await service.getOrCreateConversation('user-1', {
        participantId: 'user-2',
        isGroup: true,
        participantIds: ['user-2', 'user-3'],
        name: 'Study Group',
      } as never);
      expect(result.isGroup).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should send message and update conversation', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue({
        id: 'member-1',
      });
      const message = { id: 'msg-1', content: 'Hello' };
      mockPrisma.message.create.mockResolvedValue(message);
      mockPrisma.conversation.update.mockResolvedValue({});
      mockPrisma.conversationMember.findMany.mockResolvedValue([]);

      const result = await service.sendMessage('user-1', 'conv-1', {
        content: 'Hello',
      } as never);
      expect(result.content).toBe('Hello');
    });

    it('should throw ForbiddenException if not member', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue(null);
      await expect(
        service.sendMessage('user-1', 'conv-1', {
          content: 'x',
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 'm1' });
      mockPrisma.message.findMany.mockResolvedValue([{ id: 'msg-1' }]);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages('conv-1', 'user-1', {
        page: 1,
        limit: 50,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('markRead', () => {
    it('should update lastReadAt', async () => {
      mockPrisma.conversationMember.update.mockResolvedValue({
        lastReadAt: new Date(),
      });

      await service.markRead('conv-1', 'user-1');
      expect(mockPrisma.conversationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('isMember', () => {
    it('should return true for members', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue({ id: 'm1' });
      const result = await service.isMember('conv-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false for non-members', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue(null);
      const result = await service.isMember('conv-1', 'user-1');
      expect(result).toBe(false);
    });
  });
});
