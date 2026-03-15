import { Test } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  feedItem: { findMany: jest.fn(), count: jest.fn() },
  like: { findMany: jest.fn() },
  bookmark: { findMany: jest.fn() },
};

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FeedService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(FeedService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getFeed', () => {
    it('should return feed with isLiked/isBookmarked enrichment', async () => {
      mockPrisma.feedItem.findMany.mockResolvedValue([
        { post: { id: 'post-1' } },
        { post: { id: 'post-2' } },
      ]);
      mockPrisma.feedItem.count.mockResolvedValue(2);
      mockPrisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }]);
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-2' }]);

      const result = await service.getFeed('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'post-1',
        isLiked: true,
        isBookmarked: false,
      });
      expect(result.data[1]).toMatchObject({
        id: 'post-2',
        isLiked: false,
        isBookmarked: true,
      });
    });

    it('should return empty feed', async () => {
      mockPrisma.feedItem.findMany.mockResolvedValue([]);
      mockPrisma.feedItem.count.mockResolvedValue(0);
      mockPrisma.like.findMany.mockResolvedValue([]);
      mockPrisma.bookmark.findMany.mockResolvedValue([]);

      const result = await service.getFeed('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
