import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import { AUTHOR_SELECT } from '../posts/posts.service';

@Injectable()
export class InteractionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async toggleLike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const existing = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      const [, updatedPost] = await this.prisma.$transaction([
        this.prisma.like.delete({ where: { id: existing.id } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        }),
      ]);
      return { liked: false, likeCount: updatedPost.likeCount };
    }

    const [, updatedPost] = await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId, postId } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      }),
    ]);

    // Notify post author (skip self-like)
    if (post.authorId !== userId) {
      const liker = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      await this.queue.addNotification(post.authorId, 'POST_LIKE', {
        postId,
        userId,
        fullName: liker?.fullName,
      });
    }

    return { liked: true, likeCount: updatedPost.likeCount };
  }

  async toggleBookmark(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, postId } });
    return { bookmarked: true };
  }

  async getBookmarks(userId: string, query: PaginationDto) {
    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              author: { select: AUTHOR_SELECT },
              images: { orderBy: { order: 'asc' }, take: 4 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.bookmark.count({ where: { userId } }),
    ]);

    return createPaginatedResult(
      bookmarks.map((b) => b.post),
      total,
      query.page,
      query.limit,
    );
  }
}
