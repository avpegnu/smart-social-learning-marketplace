import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==================== INSTRUCTOR CRUD ====================

  async create(instructorId: string, dto: CreateCouponDto) {
    // Validate applicable courses belong to instructor
    if (dto.applicableCourseIds?.length) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: dto.applicableCourseIds }, instructorId },
        select: { id: true },
      });
      if (courses.length !== dto.applicableCourseIds.length) {
        throw new BadRequestException({ code: 'INVALID_COURSE_IDS' });
      }
    }

    // Validate discount value
    if (dto.type === 'PERCENTAGE' && (dto.value < 1 || dto.value > 100)) {
      throw new BadRequestException({ code: 'INVALID_PERCENTAGE_VALUE' });
    }

    // Validate dates
    if (new Date(dto.startsAt) >= new Date(dto.expiresAt)) {
      throw new BadRequestException({ code: 'INVALID_DATE_RANGE' });
    }

    const { applicableCourseIds, startsAt, expiresAt, ...couponData } = dto;

    return this.prisma.coupon.create({
      data: {
        ...couponData,
        startDate: new Date(startsAt),
        endDate: new Date(expiresAt),
        instructorId,
        ...(applicableCourseIds?.length && {
          couponCourses: {
            create: applicableCourseIds.map((courseId) => ({ courseId })),
          },
        }),
      },
      include: { couponCourses: true },
    });
  }

  async getInstructorCoupons(instructorId: string, query: PaginationDto) {
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { instructorId },
        include: {
          couponCourses: {
            include: { course: { select: { id: true, title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.coupon.count({ where: { instructorId } }),
    ]);
    return createPaginatedResult(coupons, total, query.page, query.limit);
  }

  async update(couponId: string, instructorId: string, dto: UpdateCouponDto) {
    await this.verifyCouponOwnership(couponId, instructorId);

    const { applicableCourseIds, startsAt, expiresAt, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Update applicable courses if provided
      if (applicableCourseIds !== undefined) {
        await tx.couponCourse.deleteMany({ where: { couponId } });
        if (applicableCourseIds.length > 0) {
          await tx.couponCourse.createMany({
            data: applicableCourseIds.map((courseId) => ({ couponId, courseId })),
          });
        }
      }

      return tx.coupon.update({
        where: { id: couponId },
        data: {
          ...updateData,
          ...(startsAt && { startDate: new Date(startsAt) }),
          ...(expiresAt && { endDate: new Date(expiresAt) }),
        },
        include: { couponCourses: true },
      });
    });
  }

  async deactivate(couponId: string, instructorId: string) {
    await this.verifyCouponOwnership(couponId, instructorId);

    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });
  }

  // ==================== VALIDATION (called by OrdersService + CartController) ====================

  async validateAndCalculateDiscount(
    code: string,
    userId: string,
    cartItems: { courseId: string | null; price: number }[],
  ): Promise<{ couponId: string; discount: number; applicableCourseIds: string[] | null }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: { couponCourses: true },
    });

    // Gate 1: Coupon exists + active
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException({ code: 'COUPON_NOT_FOUND' });
    }

    // Gate 2: Date range
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new BadRequestException({ code: 'COUPON_EXPIRED' });
    }

    // Gate 3: Total usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException({ code: 'COUPON_USAGE_EXCEEDED' });
    }

    // Gate 4: Per-user usage limit
    if (coupon.maxUsesPerUser) {
      const userUsageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          order: { userId },
        },
      });
      if (userUsageCount >= coupon.maxUsesPerUser) {
        throw new BadRequestException({ code: 'COUPON_USER_LIMIT_EXCEEDED' });
      }
    }

    // Gate 5: Applicable courses
    const applicableCourseIds = coupon.couponCourses.map((cc) => cc.courseId);
    let applicableAmount: number;

    if (applicableCourseIds.length > 0) {
      applicableAmount = cartItems
        .filter((item) => item.courseId && applicableCourseIds.includes(item.courseId))
        .reduce((sum, item) => sum + item.price, 0);

      if (applicableAmount === 0) {
        throw new BadRequestException({ code: 'COUPON_NOT_APPLICABLE' });
      }
    } else {
      applicableAmount = cartItems.reduce((sum, item) => sum + item.price, 0);
    }

    // Gate 6: Minimum order amount
    const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new BadRequestException({ code: 'BELOW_MINIMUM_ORDER' });
    }

    // Calculate discount
    let discount: number;
    if (coupon.type === 'PERCENTAGE') {
      discount = Math.round(applicableAmount * (coupon.value / 100));
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // FIXED_AMOUNT
      discount = Math.min(coupon.value, applicableAmount);
    }

    return {
      couponId: coupon.id,
      discount,
      applicableCourseIds: applicableCourseIds.length > 0 ? applicableCourseIds : null,
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyCouponOwnership(couponId: string, instructorId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || coupon.instructorId !== instructorId) {
      throw new NotFoundException({ code: 'COUPON_NOT_FOUND' });
    }
    return coupon;
  }
}
