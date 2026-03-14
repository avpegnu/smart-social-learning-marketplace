import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { CourseSortBy } from '../dto/query-courses.dto';
import type { QueryCoursesDto } from '../dto/query-courses.dto';

@Injectable()
export class CoursesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  // ==================== BROWSE ====================

  async findAll(query: QueryCoursesDto) {
    const where = this.buildWhereFilter(query);
    const orderBy = this.buildSortOrder(query.sort);

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          level: true,
          language: true,
          price: true,
          originalPrice: true,
          avgRating: true,
          reviewCount: true,
          totalStudents: true,
          totalLessons: true,
          totalDuration: true,
          publishedAt: true,
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
          courseTags: { include: { tag: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  // ==================== COURSE DETAIL ====================

  async findBySlug(slug: string, currentUserId?: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            instructorProfile: {
              select: { headline: true, biography: true },
            },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
        courseTags: { include: { tag: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            chapters: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    estimatedDuration: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    // Track view with per-user dedup
    await this.trackView(course.id, currentUserId);

    return course;
  }

  // ==================== PRIVATE HELPERS ====================

  private buildWhereFilter(query: QueryCoursesDto): Prisma.CourseWhereInput {
    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.language) {
      where.language = query.language;
    }

    if (query.tagId) {
      where.courseTags = { some: { tagId: query.tagId } };
    }

    if (query.minRating !== undefined) {
      where.avgRating = { gte: query.minRating };
    }

    // Build price filter without using `any`
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: { gte?: number; lte?: number } = {};
      if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
      if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
      where.price = priceFilter;
    }

    return where;
  }

  private buildSortOrder(sort?: CourseSortBy): Prisma.CourseOrderByWithRelationInput {
    switch (sort) {
      case CourseSortBy.POPULAR:
        return { totalStudents: 'desc' };
      case CourseSortBy.HIGHEST_RATED:
        return { avgRating: 'desc' };
      case CourseSortBy.PRICE_ASC:
        return { price: 'asc' };
      case CourseSortBy.PRICE_DESC:
        return { price: 'desc' };
      case CourseSortBy.NEWEST:
      default:
        return { publishedAt: 'desc' };
    }
  }

  private async trackView(courseId: string, userId?: string): Promise<void> {
    const viewerKey = userId ?? 'anon';
    const dedupKey = `viewed:${courseId}:${viewerKey}`;

    const alreadyViewed = await this.redis.get(dedupKey);
    if (alreadyViewed) return;

    await this.redis.set(dedupKey, '1', 'EX', 3600);
    await this.redis.incr(`course_views:${courseId}`);
  }
}
