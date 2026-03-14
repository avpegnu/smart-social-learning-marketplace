import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { AddCartItemDto } from './dto/add-cart-item.dto';
import type { MergeCartItemDto } from './dto/merge-cart.dto';

@Injectable()
export class CartService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==================== CART ====================

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            price: true,
            instructorId: true,
            instructor: { select: { fullName: true } },
          },
        },
        chapter: { select: { id: true, title: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return { items, subtotal };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    // 1. Validate course exists + is published
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, status: 'PUBLISHED', deletedAt: null },
    });
    if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

    // 2. Can't buy own course
    if (course.instructorId === userId) {
      throw new BadRequestException({ code: 'CANNOT_BUY_OWN_COURSE' });
    }

    // 3. Check already enrolled (FULL enrollment)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: dto.courseId } },
    });
    if (enrollment?.type === 'FULL') {
      throw new ConflictException({ code: 'ALREADY_ENROLLED' });
    }

    // 4. Determine price from DB (NOT from frontend)
    let price: number;
    let chapterId: string | null = null;

    if (dto.chapterId) {
      // Buying individual chapter
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: dto.chapterId },
      });
      if (!chapter || !chapter.price) {
        throw new BadRequestException({ code: 'CHAPTER_NOT_PURCHASABLE' });
      }

      // Check already purchased chapter
      const purchased = await this.prisma.chapterPurchase.findUnique({
        where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
      });
      if (purchased) throw new ConflictException({ code: 'CHAPTER_ALREADY_PURCHASED' });

      // Check if full course already in cart
      const fullCourseInCart = await this.prisma.cartItem.findFirst({
        where: { userId, courseId: dto.courseId, chapterId: null },
      });
      if (fullCourseInCart) {
        throw new ConflictException({ code: 'FULL_COURSE_IN_CART' });
      }

      price = chapter.price;
      chapterId = dto.chapterId;
    } else {
      // Buying full course — remove chapter items of same course if any
      const chaptersInCart = await this.prisma.cartItem.findMany({
        where: { userId, courseId: dto.courseId, chapterId: { not: null } },
      });
      if (chaptersInCart.length > 0) {
        await this.prisma.cartItem.deleteMany({
          where: { userId, courseId: dto.courseId },
        });
      }

      price = course.price;
    }

    // 5. Check duplicate in cart
    const existing = await this.prisma.cartItem.findFirst({
      where: { userId, courseId: dto.courseId, chapterId },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_IN_CART' });

    return this.prisma.cartItem.create({
      data: { userId, courseId: dto.courseId, chapterId, price },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) throw new NotFoundException({ code: 'CART_ITEM_NOT_FOUND' });

    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
  }

  async mergeCart(userId: string, items: MergeCartItemDto[]) {
    for (const item of items) {
      try {
        await this.addItem(userId, item);
      } catch {
        // Skip items that fail validation (already enrolled, duplicate, etc.)
        continue;
      }
    }
    return this.getCart(userId);
  }

  // ==================== WISHLIST ====================

  async getWishlist(userId: string, query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              price: true,
              avgRating: true,
              totalStudents: true,
              instructor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.wishlist.count({ where: { userId } }),
    ]);
    return createPaginatedResult(items, total, query.page, query.limit);
  }

  async addToWishlist(userId: string, courseId: string) {
    const existing = await this.prisma.wishlist.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_IN_WISHLIST' });

    return this.prisma.wishlist.create({ data: { userId, courseId } });
  }

  async removeFromWishlist(userId: string, courseId: string) {
    await this.prisma.wishlist.deleteMany({
      where: { userId, courseId },
    });
  }
}
