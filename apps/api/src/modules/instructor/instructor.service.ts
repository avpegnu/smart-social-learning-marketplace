import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import type { CreateApplicationDto } from './dto/create-application.dto';
import type { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Injectable()
export class InstructorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  // ==================== APPLICATION ====================

  async submitApplication(userId: string, dto: CreateApplicationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    if (user.role === 'INSTRUCTOR') {
      throw new BadRequestException({ code: 'ALREADY_INSTRUCTOR' });
    }

    const pending = await this.prisma.instructorApplication.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException({ code: 'APPLICATION_ALREADY_PENDING' });
    }

    const application = await this.prisma.instructorApplication.create({
      data: { userId, ...dto },
    });

    const applicant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    this.queue.addAdminNotification('NEW_APPLICATION', {
      applicationId: application.id,
      userId,
      fullName: applicant?.fullName,
    });

    return application;
  }

  async getApplicationStatus(userId: string) {
    return this.prisma.instructorApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // ==================== PROFILE ====================

  async getProfile(userId: string) {
    const profile = await this.prisma.instructorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { fullName: true, email: true, avatarUrl: true },
        },
      },
    });
    if (!profile) throw new NotFoundException({ code: 'INSTRUCTOR_PROFILE_NOT_FOUND' });
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateInstructorProfileDto) {
    const { qualifications, socialLinks, ...rest } = dto;

    const data: Prisma.InstructorProfileUncheckedUpdateInput = {
      ...rest,
      ...(qualifications !== undefined && {
        qualifications: qualifications as unknown as Prisma.InputJsonValue,
      }),
      ...(socialLinks !== undefined && {
        socialLinks: socialLinks as unknown as Prisma.InputJsonValue,
      }),
    };

    return this.prisma.instructorProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data } as Prisma.InstructorProfileUncheckedCreateInput,
    });
  }

  // ==================== DASHBOARD ====================

  async getDashboard(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [profile, courseCount, pendingBalance, recentEarnings] = await Promise.all([
      this.prisma.instructorProfile.findUnique({
        where: { userId },
        select: {
          totalStudents: true,
          totalCourses: true,
          totalRevenue: true,
          availableBalance: true,
        },
      }),
      this.prisma.course.count({
        where: { instructorId: userId, deletedAt: null, status: 'PUBLISHED' },
      }),
      this.prisma.earning.aggregate({
        where: { instructorId: userId, status: 'PENDING' },
        _sum: { netAmount: true },
      }),
      this.prisma.earning.findMany({
        where: {
          instructorId: userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          orderItem: { select: { title: true, price: true } },
        },
      }),
    ]);

    const courseStats = await this.prisma.course.findMany({
      where: { instructorId: userId, deletedAt: null, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        totalStudents: true,
        avgRating: true,
      },
      orderBy: { totalStudents: 'desc' },
      take: 10,
    });

    return {
      overview: {
        totalRevenue: profile?.totalRevenue ?? 0,
        totalStudents: profile?.totalStudents ?? 0,
        totalCourses: courseCount,
        availableBalance: profile?.availableBalance ?? 0,
        pendingBalance: pendingBalance._sum.netAmount ?? 0,
      },
      recentEarnings,
      courseStats,
    };
  }
}
