import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';

const mockPrisma = {
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  like: { findUnique: jest.fn() },
  bookmark: { findUnique: jest.fn() },
  follow: { findMany: jest.fn() },
  feedItem: { createMany: jest.fn(), create: jest.fn() },
  group: { findUnique: jest.fn() },
  groupMember: { findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: QueueService,
          useValue: { addFeedFanout: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a text post and fanout', async () => {
      const post = { id: 'post-1', authorId: 'user-1', content: 'Hello' };
      mockPrisma.post.create.mockResolvedValue(post);
      mockPrisma.follow.findMany.mockResolvedValue([]);
      mockPrisma.feedItem.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create('user-1', {
        content: 'Hello',
      } as never);
      expect(result).toEqual(post);
      expect(mockPrisma.post.create).toHaveBeenCalled();
    });

    it('should create a post in a PUBLIC group without requiring membership', async () => {
      const post = { id: 'post-1', authorId: 'user-1', groupId: 'group-1' };
      mockPrisma.group.findUnique.mockResolvedValue({ privacy: 'PUBLIC' });
      mockPrisma.post.create.mockResolvedValue(post);

      const result = await service.create('user-1', {
        content: 'Group post',
        groupId: 'group-1',
      } as never);

      expect(result).toEqual(post);
      expect(mockPrisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ groupId: 'group-1' }) }),
      );
      // Public groups do not require a membership lookup.
      expect(mockPrisma.groupMember.findUnique).not.toHaveBeenCalled();
    });

    it('should reject posting into a PRIVATE group when not a member (IDOR guard)', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ privacy: 'PRIVATE' });
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create('outsider', { content: 'spam', groupId: 'private-1' } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.post.create).not.toHaveBeenCalled();
    });

    it('should allow a member to post into a PRIVATE group', async () => {
      const post = { id: 'post-9', authorId: 'member-1', groupId: 'private-1' };
      mockPrisma.group.findUnique.mockResolvedValue({ privacy: 'PRIVATE' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'gm-1', role: 'MEMBER' });
      mockPrisma.post.create.mockResolvedValue(post);

      const result = await service.create('member-1', {
        content: 'hello team',
        groupId: 'private-1',
      } as never);

      expect(result).toEqual(post);
      expect(mockPrisma.post.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the target group does not exist', async () => {
      mockPrisma.group.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', { content: 'x', groupId: 'ghost' } as never),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.post.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return post with isLiked/isBookmarked false when no user', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });

      const result = await service.findById('post-1');
      expect(result).toEqual({
        id: 'post-1',
        isLiked: false,
        isBookmarked: false,
      });
    });

    it('should enrich with isLiked/isBookmarked when user provided', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.like.findUnique.mockResolvedValue({ id: 'like-1' });
      mockPrisma.bookmark.findUnique.mockResolvedValue(null);

      const result = await service.findById('post-1', 'user-1');
      expect(result.isLiked).toBe(true);
      expect(result.isBookmarked).toBe(false);
    });

    it('should throw NotFoundException for deleted post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update post content', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        authorId: 'user-1',
        deletedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1', content: 'Updated' });

      const result = await service.update('post-1', 'user-1', { content: 'Updated' });
      expect(result.content).toBe('Updated');
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        authorId: 'user-2',
      });
      await expect(service.update('post-1', 'user-1', { content: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        authorId: 'user-1',
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'post-1',
        deletedAt: new Date(),
      });

      const result = await service.delete('post-1', 'user-1');
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        authorId: 'other',
      });
      await expect(service.delete('post-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('share', () => {
    it('should create shared post and increment shareCount', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'original' });
      const shared = { id: 'shared-1', type: 'SHARED', sharedPostId: 'original' };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.post.create.mockResolvedValue(shared);
      mockPrisma.post.update.mockResolvedValue({});
      mockPrisma.follow.findMany.mockResolvedValue([]);
      mockPrisma.feedItem.createMany.mockResolvedValue({ count: 1 });

      const result = await service.share('user-1', 'original', 'Check this out');
      expect(result.type).toBe('SHARED');
    });

    it('should throw NotFoundException for deleted original', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);
      await expect(service.share('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
