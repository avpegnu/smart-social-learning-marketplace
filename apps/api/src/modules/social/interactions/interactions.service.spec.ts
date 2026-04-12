import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';

const mockPrisma = {
  post: { findUnique: jest.fn(), update: jest.fn() },
  like: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  bookmark: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockQueue = {
  addNotification: jest.fn().mockResolvedValue(undefined),
  addFeedFanout: jest.fn().mockResolvedValue(undefined),
};

describe('InteractionsService', () => {
  let service: InteractionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InteractionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = module.get(InteractionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('toggleLike', () => {
    it('should create like and return updated likeCount', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        authorId: 'other-user',
        likeCount: 5,
      });
      mockPrisma.like.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, { likeCount: 6 }]);
      mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Test User' });

      const result = await service.toggleLike('user-1', 'post-1');
      expect(result).toEqual({ liked: true, likeCount: 6 });
    });

    it('should remove like and return updated likeCount', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', likeCount: 5 });
      mockPrisma.like.findUnique.mockResolvedValue({ id: 'like-1' });
      mockPrisma.$transaction.mockResolvedValue([{}, { likeCount: 4 }]);

      const result = await service.toggleLike('user-1', 'post-1');
      expect(result).toEqual({ liked: false, likeCount: 4 });
    });

    it('should throw NotFoundException for missing post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);
      await expect(service.toggleLike('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleBookmark', () => {
    it('should create bookmark', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.bookmark.findUnique.mockResolvedValue(null);
      mockPrisma.bookmark.create.mockResolvedValue({});

      const result = await service.toggleBookmark('user-1', 'post-1');
      expect(result).toEqual({ bookmarked: true });
    });

    it('should remove bookmark', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bm-1' });
      mockPrisma.bookmark.delete.mockResolvedValue({});

      const result = await service.toggleBookmark('user-1', 'post-1');
      expect(result).toEqual({ bookmarked: false });
    });
  });

  describe('getBookmarks', () => {
    it('should return paginated bookmarks as posts', async () => {
      mockPrisma.bookmark.findMany.mockResolvedValue([{ post: { id: 'post-1' } }]);
      mockPrisma.bookmark.count.mockResolvedValue(1);

      const result = await service.getBookmarks('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({ id: 'post-1' });
    });
  });
});
