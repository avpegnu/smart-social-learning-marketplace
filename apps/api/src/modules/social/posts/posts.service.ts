import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreatePostDto } from '../dto/create-post.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdatePostDto } from '../dto/update-post.dto';

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class PostsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        type: dto.type ?? 'TEXT',
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
        linkUrl: dto.linkUrl,
        groupId: dto.groupId,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, i) => ({ url, order: i })) }
          : undefined,
      },
      include: { images: true, author: { select: AUTHOR_SELECT } },
    });

    this.queue.addFeedFanout(post.id, authorId, dto.groupId);
    return post;
  }

  async findById(postId: string, currentUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      include: {
        author: { select: AUTHOR_SELECT },
        images: { orderBy: { order: 'asc' } },
        sharedPost: {
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    let isLiked = false;
    let isBookmarked = false;

    if (currentUserId) {
      const [like, bookmark] = await Promise.all([
        this.prisma.like.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
        this.prisma.bookmark.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    return { ...post, isLiked, isBookmarked };
  }

  async update(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_POST_OWNER' });
    }
    if (post.deletedAt) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
        linkUrl: dto.linkUrl,
      },
      include: { images: true, author: { select: AUTHOR_SELECT } },
    });
  }

  async delete(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_POST_OWNER' });
    }
    return this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  async share(userId: string, postId: string, content?: string) {
    const original = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!original) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const post = await this.prisma.$transaction(async (tx) => {
      const shared = await tx.post.create({
        data: {
          authorId: userId,
          type: 'SHARED',
          content,
          sharedPostId: postId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });

      await tx.post.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
      });

      return shared;
    });

    this.queue.addFeedFanout(post.id, userId);
    return post;
  }
}

export { AUTHOR_SELECT };
