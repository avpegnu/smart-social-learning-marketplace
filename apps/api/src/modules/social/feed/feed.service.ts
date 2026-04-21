import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import { AUTHOR_SELECT } from '../posts/posts.service';

export interface TrendingPost {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  author: { id: string; fullName: string; avatarUrl: string | null };
}

@Injectable()
export class FeedService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getFeed(userId: string, query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { userId, post: { deletedAt: null } },
        include: {
          post: {
            include: {
              author: { select: AUTHOR_SELECT },
              images: { orderBy: { order: 'asc' }, take: 4 },
              sharedPost: {
                include: { author: { select: AUTHOR_SELECT } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.feedItem.count({
        where: { userId, post: { deletedAt: null } },
      }),
    ]);

    // Batch lookup isLiked / isBookmarked
    const postIds = items.map((item) => item.post.id);

    const [likes, bookmarks] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l) => l.postId));
    const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

    const posts = items.map((item) => ({
      ...item.post,
      isLiked: likedSet.has(item.post.id),
      isBookmarked: bookmarkedSet.has(item.post.id),
    }));

    return createPaginatedResult(posts, total, query.page, query.limit);
  }

  async getTrending(): Promise<TrendingPost[]> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const posts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        groupId: null,
        content: { not: null },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        content: true,
        likeCount: true,
        commentCount: true,
        author: { select: AUTHOR_SELECT },
      },
      orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
      take: 5,
    });

    return posts as TrendingPost[];
  }

  async getPublicFeed(userId: string | undefined, query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { deletedAt: null, groupId: null },
        include: {
          author: { select: AUTHOR_SELECT },
          images: { orderBy: { order: 'asc' }, take: 4 },
          sharedPost: {
            include: { author: { select: AUTHOR_SELECT } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.post.count({ where: { deletedAt: null, groupId: null } }),
    ]);

    if (!userId || items.length === 0) {
      const posts = items.map((p) => ({
        ...p,
        isLiked: false,
        isBookmarked: false,
      }));
      return createPaginatedResult(posts, total, query.page, query.limit);
    }

    const postIds = items.map((p) => p.id);
    const [likes, bookmarks] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l) => l.postId));
    const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

    const posts = items.map((p) => ({
      ...p,
      isLiked: likedSet.has(p.id),
      isBookmarked: bookmarkedSet.has(p.id),
    }));

    return createPaginatedResult(posts, total, query.page, query.limit);
  }
}
