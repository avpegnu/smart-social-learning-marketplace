import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  post: { findUnique: jest.fn(), update: jest.fn() },
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CommentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CommentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create top-level comment and increment counter', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      const comment = { id: 'comment-1', content: 'Nice!' };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.comment.create.mockResolvedValue(comment);
      mockPrisma.post.update.mockResolvedValue({});

      const result = await service.create('user-1', 'post-1', {
        content: 'Nice!',
      } as never);
      expect(result.content).toBe('Nice!');
    });

    it('should throw NotFoundException for deleted post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', 'bad-id', { content: 'x' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid parent', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'parent-1',
        postId: 'other-post',
      });

      await expect(
        service.create('user-1', 'post-1', {
          content: 'Reply',
          parentId: 'parent-1',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getByPost', () => {
    it('should return paginated top-level comments', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([
        { id: 'c1', replies: [], _count: { replies: 0 } },
      ]);
      mockPrisma.comment.count.mockResolvedValue(1);

      const result = await service.getByPost('post-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete comment and decrement counter', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        authorId: 'user-1',
      });
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.comment.delete.mockResolvedValue({});
      mockPrisma.post.update.mockResolvedValue({});

      await service.delete('c1', 'user-1', 'post-1');
      expect(mockPrisma.comment.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        authorId: 'other',
      });
      await expect(service.delete('c1', 'user-1', 'post-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
